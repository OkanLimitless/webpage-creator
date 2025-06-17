import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const TRAFFIC_LOGS_NAMESPACE_ID = process.env.TRAFFIC_LOGS_NAMESPACE_ID;

const KEEP_RECENT_LOGS = 300; // Keep only the most recent 300 logs

export async function DELETE(request: NextRequest) {
  try {
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN || !TRAFFIC_LOGS_NAMESPACE_ID) {
      return NextResponse.json({
        success: false,
        error: 'Missing Cloudflare environment variables'
      }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action'); // 'older_than' or 'all_safe_pages' or 'all'
    const daysOld = parseInt(searchParams.get('days') || '7');
    const decision = searchParams.get('decision'); // 'safe_page' or 'money_page'
    
    let deletedCount = 0;
    let cursor: string | undefined;
    const keysToDelete: string[] = [];
    
    // Fetch all keys first to filter them
    while (true) {
      let listUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${TRAFFIC_LOGS_NAMESPACE_ID}/keys?limit=1000`;
      
      if (cursor) {
        listUrl += `&cursor=${cursor}`;
      }
      
      const listResponse = await fetch(listUrl, {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!listResponse.ok) {
        throw new Error(`Failed to list keys: ${listResponse.statusText}`);
      }

      const listData = await listResponse.json();
      const keys = listData.result || [];
      
      if (keys.length === 0) {
        break;
      }

      // Filter keys based on criteria
      for (const key of keys) {
        const keyName = key.name;
        
        if (!keyName.startsWith('traffic_log_')) {
          continue;
        }
        
        // Extract timestamp from key
        const timestampStr = keyName.split('_')[2];
        if (!timestampStr) continue;
        
        const logTime = new Date(decodeURIComponent(timestampStr));
        const cutoffTime = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000));
        
        let shouldDelete = false;
        
        if (action === 'older_than' && logTime < cutoffTime) {
          shouldDelete = true;
        } else if (action === 'all') {
          shouldDelete = true;
        } else if (action === 'by_decision' && decision) {
          // Need to check the log content for decision filtering
          // For now, we'll add it to a list to check later
          keysToDelete.push(keyName);
          continue;
        }
        
        if (shouldDelete) {
          keysToDelete.push(keyName);
        }
      }
      
      cursor = listData.result_info?.cursor;
      
      if (!cursor || listData.result_info?.list_complete !== false) {
        break;
      }
    }
    
    // If filtering by decision, we need to fetch the content first
    if (action === 'by_decision' && decision) {
      const filteredKeys: string[] = [];
      
      // Process in batches of 100 for bulk GET
      for (let i = 0; i < keysToDelete.length; i += 100) {
        const batch = keysToDelete.slice(i, i + 100);
        
        try {
          const bulkGetUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${TRAFFIC_LOGS_NAMESPACE_ID}/bulk/get`;
          
          const bulkResponse = await fetch(bulkGetUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              keys: batch
            })
          });

          if (bulkResponse.ok) {
            const bulkData = await bulkResponse.json();
            const values = bulkData.result?.values || {};
            
            for (const keyName of batch) {
              if (values[keyName]) {
                try {
                  const logEntry = JSON.parse(values[keyName]);
                  if (logEntry.decision === decision) {
                    filteredKeys.push(keyName);
                  }
                } catch (parseError) {
                  // Skip invalid entries
                }
              }
            }
          }
        } catch (error) {
          console.error('Error in bulk filter:', error);
        }
      }
      
      keysToDelete.length = 0;
      keysToDelete.push(...filteredKeys);
    }
    
    // Delete keys in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < keysToDelete.length; i += BATCH_SIZE) {
      const batch = keysToDelete.slice(i, i + BATCH_SIZE);
      
      // Delete each key individually (KV doesn't support bulk delete)
      const deletePromises = batch.map(async (keyName) => {
        try {
          const deleteUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${TRAFFIC_LOGS_NAMESPACE_ID}/values/${keyName}`;
          
          const response = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`
            }
          });
          
          if (response.ok) {
            return true;
          } else {
            console.error(`Failed to delete ${keyName}:`, response.statusText);
            return false;
          }
        } catch (error) {
          console.error(`Error deleting ${keyName}:`, error);
          return false;
        }
      });
      
      const results = await Promise.all(deletePromises);
      deletedCount += results.filter(success => success).length;
    }
    
    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deletedCount} traffic log entries`,
      deletedCount,
      criteria: {
        action,
        daysOld: action === 'older_than' ? daysOld : null,
        decision: action === 'by_decision' ? decision : null
      }
    });

  } catch (error) {
    console.error('Traffic logs cleanup error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !TRAFFIC_LOGS_NAMESPACE_ID) {
    return NextResponse.json({
      success: false,
      error: 'Missing Cloudflare configuration for traffic logs'
    }, { status: 500 });
  }

  try {
    const { dryRun = false } = await request.json();
    
    console.log('Starting traffic logs cleanup...');
    
    // Step 1: Fetch ALL traffic log keys
    const allKeys = await fetchAllTrafficLogKeys();
    console.log(`Found ${allKeys.length} total traffic log keys`);
    
    if (allKeys.length <= KEEP_RECENT_LOGS) {
      return NextResponse.json({
        success: true,
        message: `Only ${allKeys.length} logs found, no cleanup needed`,
        deleted: 0,
        remaining: allKeys.length
      });
    }
    
    // Step 2: Sort keys by timestamp (newest first)
    allKeys.sort((a, b) => {
      const aKeyName = a.name;
      const bKeyName = b.name;
      const prefixLength = 'traffic_log_'.length;
      
      const aLastUnderscoreIndex = aKeyName.lastIndexOf('_');
      const bLastUnderscoreIndex = bKeyName.lastIndexOf('_');
      
      const aTimestamp = aKeyName.substring(prefixLength, aLastUnderscoreIndex);
      const bTimestamp = bKeyName.substring(prefixLength, bLastUnderscoreIndex);
      
      const aTime = new Date(aTimestamp).getTime() || 0;
      const bTime = new Date(bTimestamp).getTime() || 0;
      
      return bTime - aTime; // Newest first
    });
    
    // Step 3: Identify keys to delete (everything after the first KEEP_RECENT_LOGS)
    const keysToDelete = allKeys.slice(KEEP_RECENT_LOGS);
    console.log(`Will delete ${keysToDelete.length} old logs, keeping ${KEEP_RECENT_LOGS} recent ones`);
    
    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: 'Dry run completed',
        totalLogs: allKeys.length,
        toDelete: keysToDelete.length,
        toKeep: KEEP_RECENT_LOGS,
        oldestToKeep: allKeys[KEEP_RECENT_LOGS - 1]?.name || 'N/A',
        newestToDelete: keysToDelete[0]?.name || 'N/A'
      });
    }
    
    // Step 4: Delete old keys in batches
    let deleted = 0;
    const BATCH_SIZE = 100; // KV bulk delete supports up to 100 keys
    
    for (let i = 0; i < keysToDelete.length; i += BATCH_SIZE) {
      const batch = keysToDelete.slice(i, i + BATCH_SIZE);
      const keyNames = batch.map(key => key.name);
      
      try {
        const deleteUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${TRAFFIC_LOGS_NAMESPACE_ID}/bulk/delete`;
        
        const deleteResponse = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            keys: keyNames
          })
        });
        
        if (deleteResponse.ok) {
          deleted += keyNames.length;
          console.log(`Deleted batch of ${keyNames.length} logs (total: ${deleted})`);
        } else {
          console.error(`Failed to delete batch:`, deleteResponse.statusText);
        }
      } catch (error) {
        console.error(`Error deleting batch:`, error);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Cleanup completed`,
      totalLogs: allKeys.length,
      deleted,
      remaining: allKeys.length - deleted,
      keptRecent: KEEP_RECENT_LOGS
    });
    
  } catch (error) {
    console.error('Traffic logs cleanup error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function fetchAllTrafficLogKeys(): Promise<any[]> {
  const allKeys: any[] = [];
  let cursor: string | undefined;
  
  try {
    while (true) {
      let listUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${TRAFFIC_LOGS_NAMESPACE_ID}/keys?limit=1000`;
      
      if (cursor) {
        listUrl += `&cursor=${cursor}`;
      }
      
      const listResponse = await fetch(listUrl, {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!listResponse.ok) {
        throw new Error(`Failed to list traffic log keys: ${listResponse.statusText}`);
      }

      const listData = await listResponse.json();
      const keys = listData.result || [];
      
      if (keys.length === 0) {
        break;
      }
      
      // Filter only traffic log keys
      const trafficLogKeys = keys.filter((key: any) => key.name.startsWith('traffic_log_'));
      allKeys.push(...trafficLogKeys);
      
      cursor = listData.result_info?.cursor;
      
      if (!cursor || listData.result_info?.list_complete !== false) {
        break;
      }
    }
    
    return allKeys;
    
  } catch (error) {
    console.error('Error fetching all traffic log keys:', error);
    return [];
  }
} 