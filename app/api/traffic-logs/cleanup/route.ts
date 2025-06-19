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
  try {
    const { dryRun = false, aggressiveCleanup = false } = await request.json();
    
    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !TRAFFIC_LOGS_NAMESPACE_ID) {
      return NextResponse.json({
        success: false,
        error: 'Missing Cloudflare configuration'
      }, { status: 500 });
    }

    // NEW: Date-based cleanup - delete logs older than 2 days
    const result = await cleanupLogsByDate(dryRun);
    
    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// NEW: More efficient date-based cleanup function
async function cleanupLogsByDate(dryRun: boolean = false) {
  console.log(`Starting date-based cleanup (dryRun: ${dryRun})`);
  
  // Calculate cutoff date (2 days ago)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 2);
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0]; // Format: 2025-06-17
  
  console.log(`Cutoff date: ${cutoffDateStr} (deleting logs from this date and older)`);
  
  let totalKeysProcessed = 0;
  let totalKeysToDelete = 0;
  let totalDeleted = 0;
  const keysToDelete: string[] = [];
  let cursor: string | undefined;
  
  try {
    // Step 1: Scan all keys and identify old ones
    while (true) {
      const batchLimit = 1000; // KV max limit
      
      let listUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${TRAFFIC_LOGS_NAMESPACE_ID}/keys?limit=${batchLimit}`;
      
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

      // Filter traffic log keys and check dates
      for (const key of keys) {
        if (key.name.startsWith('traffic_log_')) {
          totalKeysProcessed++;
          
          try {
            // Extract date from key: traffic_log_2025-06-16T14:05:25.797Z_o3uls...
            // Get the date part (first 10 chars after traffic_log_)
            const keyDateStr = key.name.substring(12, 22); // Extract "2025-06-16"
            
            // Compare with cutoff date
            if (keyDateStr <= cutoffDateStr) {
              keysToDelete.push(key.name);
              totalKeysToDelete++;
              
              // Log some examples
              if (totalKeysToDelete <= 5) {
                console.log(`Will delete: ${key.name} (date: ${keyDateStr})`);
              }
            }
          } catch (error) {
            console.warn(`Failed to parse date from key: ${key.name}`);
          }
        }
      }
      
      // Update cursor for next iteration
      cursor = listData.result_info?.cursor;
      
      // Break if no more results
      if (!cursor || listData.result_info?.list_complete !== false) {
        break;
      }
      
      // Progress update every 10k keys
      if (totalKeysProcessed % 10000 === 0) {
        console.log(`Processed ${totalKeysProcessed} keys, found ${totalKeysToDelete} to delete`);
      }
    }
    
    console.log(`Scan complete: ${totalKeysProcessed} keys processed, ${totalKeysToDelete} keys to delete`);
    
    if (dryRun) {
      return {
        action: 'dry_run',
        totalKeysProcessed,
        totalKeysToDelete,
        cutoffDate: cutoffDateStr,
        message: `Would delete ${totalKeysToDelete} keys from ${cutoffDateStr} and older`
      };
    }
    
    // Step 2: Delete old keys in batches
    if (totalKeysToDelete > 0) {
      const BATCH_SIZE = 10000; // KV bulk delete limit
      
      for (let i = 0; i < keysToDelete.length; i += BATCH_SIZE) {
        const batch = keysToDelete.slice(i, i + BATCH_SIZE);
        
        try {
          const deleteUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${TRAFFIC_LOGS_NAMESPACE_ID}/bulk/delete`;
          
          const deleteResponse = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              keys: batch
            })
          });

          if (deleteResponse.ok) {
            totalDeleted += batch.length;
            console.log(`Deleted batch of ${batch.length} keys (total: ${totalDeleted})`);
          } else {
            console.error(`Failed to delete batch: ${deleteResponse.statusText}`);
          }
        } catch (error) {
          console.error(`Error deleting batch:`, error);
        }
      }
    }
    
    return {
      action: 'cleanup',
      totalKeysProcessed,
      totalKeysToDelete,
      totalDeleted,
      cutoffDate: cutoffDateStr,
      message: `Successfully deleted ${totalDeleted} keys from ${cutoffDateStr} and older`
    };
    
  } catch (error) {
    console.error('Date-based cleanup error:', error);
    throw error;
  }
}

// Old helper functions removed - using new date-based cleanup approach 