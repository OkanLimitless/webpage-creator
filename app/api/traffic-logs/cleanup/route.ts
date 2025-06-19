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
    const { dryRun = false } = await request.json();
    
    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !TRAFFIC_LOGS_NAMESPACE_ID) {
      return NextResponse.json({
        success: false,
        error: 'Missing Cloudflare configuration'
      }, { status: 500 });
    }

    console.log(`Starting aggressive cleanup - DryRun: ${dryRun}`);
    
    // Aggressive cleanup: Delete everything older than 2 hours
    const result = await aggressiveCleanup(dryRun);
    
    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to cleanup traffic logs'
    }, { status: 500 });
  }
}

async function aggressiveCleanup(dryRun: boolean): Promise<any> {
  try {
    console.log('Starting aggressive cleanup of old traffic logs...');
    
    // Calculate cutoff time (2 hours ago)
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - 2);
    const cutoffISO = cutoffTime.toISOString();
    
    console.log(`Cutoff time: ${cutoffISO} (deleting everything older)`);
    
    let totalKeysFound = 0;
    let totalKeysToDelete = 0;
    let totalDeleted = 0;
    const keysToDelete: string[] = [];
    
    // Fetch all traffic log keys in batches
    let cursor: string | undefined;
    let batchCount = 0;
    
    while (true) {
      batchCount++;
      console.log(`Processing batch ${batchCount}...`);
      
      // Build the list URL with cursor pagination
      let listUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${TRAFFIC_LOGS_NAMESPACE_ID}/keys?limit=1000`;
      
      if (cursor) {
        listUrl += `&cursor=${encodeURIComponent(cursor)}`;
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
        console.log('No more keys found');
        break;
      }
      
      totalKeysFound += keys.length;
      console.log(`Found ${keys.length} keys in batch ${batchCount} (total: ${totalKeysFound})`);
      
      // Filter traffic log keys and check their timestamps
      for (const key of keys) {
        if (key.name.startsWith('traffic_log_')) {
          try {
            // Extract timestamp from key name: traffic_log_2025-06-19T14:05:25.797Z_randomString
            const parts = key.name.split('_');
            const timestamp = parts.slice(2, -1).join('_'); // Everything between traffic_log_ and last _
            const keyDate = new Date(timestamp);
            
            // If key is older than cutoff, mark for deletion
            if (keyDate < cutoffTime) {
              keysToDelete.push(key.name);
              totalKeysToDelete++;
            }
          } catch (error) {
            console.warn(`Failed to parse timestamp from key: ${key.name}`, error);
            // If we can't parse the timestamp, assume it's old and delete it
            keysToDelete.push(key.name);
            totalKeysToDelete++;
          }
        }
      }
      
      console.log(`Keys to delete so far: ${totalKeysToDelete}`);
      
      // Check if there are more keys
      cursor = listData.result_info?.cursor;
      if (!cursor) {
        console.log('Finished scanning all keys');
        break;
      }
      
      // Safety check to prevent infinite loops
      if (batchCount > 100) {
        console.log('Reached maximum batch limit (100), stopping scan');
        break;
      }
    }
    
    console.log(`Scan complete. Total keys: ${totalKeysFound}, Keys to delete: ${totalKeysToDelete}`);
    
    if (dryRun) {
      return {
        dryRun: true,
        totalKeysFound,
        totalKeysToDelete,
        totalKeysToKeep: totalKeysFound - totalKeysToDelete,
        cutoffTime: cutoffISO,
        message: `Would delete ${totalKeysToDelete} keys older than ${cutoffISO}`
      };
    }
    
    // Perform actual deletion using the new bulk delete API
    if (keysToDelete.length > 0) {
      console.log(`Starting deletion of ${keysToDelete.length} keys...`);
      
      // Delete in batches of 10,000 (Cloudflare's limit)
      const BULK_DELETE_LIMIT = 10000;
      let deletedCount = 0;
      
      for (let i = 0; i < keysToDelete.length; i += BULK_DELETE_LIMIT) {
        const batch = keysToDelete.slice(i, i + BULK_DELETE_LIMIT);
        console.log(`Deleting batch ${Math.floor(i / BULK_DELETE_LIMIT) + 1}: ${batch.length} keys`);
        
        const deleted = await bulkDeleteKeys(batch);
        deletedCount += deleted;
        
        // Small delay between batches to avoid rate limiting
        if (i + BULK_DELETE_LIMIT < keysToDelete.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      totalDeleted = deletedCount;
    }
    
    const remaining = totalKeysFound - totalDeleted;
    
    console.log(`Cleanup complete. Deleted: ${totalDeleted}, Remaining: ${remaining}`);
    
    return {
      dryRun: false,
      totalKeysFound,
      deleted: totalDeleted,
      remaining,
      cutoffTime: cutoffISO,
      message: `Successfully deleted ${totalDeleted} old traffic logs`
    };
    
  } catch (error) {
    console.error('Error in aggressive cleanup:', error);
    throw error;
  }
}

async function bulkDeleteKeys(keys: string[]): Promise<number> {
  try {
    // Use the new bulk delete API endpoint
    const deleteUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${TRAFFIC_LOGS_NAMESPACE_ID}/bulk`;
    
    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(keys) // Just send array of key names
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error(`Bulk delete failed: ${deleteResponse.statusText}`, errorText);
      return 0;
    }

    const deleteData = await deleteResponse.json();
    console.log(`Bulk delete response:`, deleteData);
    
    // Return the number of keys we attempted to delete
    // Cloudflare doesn't always return exact success counts
    return keys.length;
    
  } catch (error) {
    console.error('Error in bulk delete:', error);
    return 0;
  }
}

// Old helper functions removed - using new date-based cleanup approach 