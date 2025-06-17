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
    const { dryRun = false, aggressiveCleanup = false } = await request.json();
    
    console.log('Starting smart traffic logs cleanup...');
    
    let totalDeleted = 0;
    let totalKeys = 0;
    let batchCount = 0;
    const maxBatches = aggressiveCleanup ? 50 : 20; // Limit to prevent timeouts
    
    // Strategy: Delete batches of the "first" (oldest) keys until we have a reasonable number left
    while (batchCount < maxBatches) {
      batchCount++;
      console.log(`Processing batch ${batchCount}...`);
      
      // Fetch a batch of keys (these will be alphabetically first = generally oldest)
      const batchKeys = await fetchKeysBatch(1000);
      
      if (batchKeys.length === 0) {
        console.log('No more keys found');
        break;
      }
      
      totalKeys += batchKeys.length;
      
      // Quick check: if we're getting keys with recent timestamps, we should stop
      const sampleKey = batchKeys[0];
      const timestamp = extractTimestampFromKey(sampleKey.name);
      const keyAge = Date.now() - new Date(timestamp).getTime();
      const hoursOld = keyAge / (1000 * 60 * 60);
      
      console.log(`Sample key age: ${hoursOld.toFixed(1)} hours old`);
      
      // If keys are less than 2 hours old, we've reached recent data - stop here
      if (hoursOld < 2) {
        console.log('Reached recent data, stopping cleanup');
        break;
      }
      
      if (dryRun) {
        console.log(`Would delete batch of ${batchKeys.length} keys (oldest: ${hoursOld.toFixed(1)}h old)`);
        totalDeleted += batchKeys.length;
      } else {
        // Delete this batch of old keys
        const deleted = await deleteKeysBatch(batchKeys);
        totalDeleted += deleted;
        console.log(`Deleted ${deleted} keys from batch ${batchCount}`);
      }
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: 'Dry run completed',
        batchesProcessed: batchCount,
        totalKeysFound: totalKeys,
        wouldDelete: totalDeleted,
        note: 'This deletes old logs in batches until reaching recent data (< 2 hours old)'
      });
    }
    
    return NextResponse.json({
      success: true,
      message: `Smart cleanup completed`,
      batchesProcessed: batchCount,
      totalDeleted,
      note: 'Deleted old logs until reaching recent data'
    });
    
  } catch (error) {
    console.error('Traffic logs cleanup error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function fetchKeysBatch(limit: number): Promise<any[]> {
  try {
    const listUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${TRAFFIC_LOGS_NAMESPACE_ID}/keys?limit=${limit}`;
    
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
    
    // Filter only traffic log keys
    return keys.filter((key: any) => key.name.startsWith('traffic_log_'));
    
  } catch (error) {
    console.error('Error fetching keys batch:', error);
    return [];
  }
}

async function deleteKeysBatch(keys: any[]): Promise<number> {
  let deleted = 0;
  const BATCH_SIZE = 100; // KV bulk delete supports up to 100 keys
  
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, i + BATCH_SIZE);
    const keyNames = batch.map((key: any) => key.name);
    
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
      } else {
        console.error(`Failed to delete batch:`, deleteResponse.statusText);
      }
    } catch (error) {
      console.error(`Error deleting batch:`, error);
    }
  }
  
  return deleted;
}

function extractTimestampFromKey(keyName: string): string {
  const prefixLength = 'traffic_log_'.length;
  const lastUnderscoreIndex = keyName.lastIndexOf('_');
  return keyName.substring(prefixLength, lastUnderscoreIndex);
} 