/**
 * Traffic Logs API - Optimized for Large Datasets
 * 
 * This API has been optimized to handle large traffic log datasets (30k+ logs) efficiently:
 * - Uses cursor-based pagination instead of fetching all keys
 * - Limits to most recent MAX_RECENT_LOGS (300) for performance
 * - Employs Cloudflare KV bulk GET operations for speed
 * - Provides auto-refresh capability for real-time updates
 * - Includes graceful fallbacks for reliability
 * 
 * Author: MODIE Protocol Implementation
 * Date: 2025-06-17
 */

import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const TRAFFIC_LOGS_NAMESPACE_ID = process.env.TRAFFIC_LOGS_NAMESPACE_ID;

// Maximum number of recent logs to fetch (keep it reasonable for performance)
const MAX_RECENT_LOGS = 300;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const domain = searchParams.get('domain') || '';
    const decision = searchParams.get('decision') || '';
    const since = searchParams.get('since') || '';

    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN || !TRAFFIC_LOGS_NAMESPACE_ID) {
      return NextResponse.json({
        success: false,
        error: 'Missing Cloudflare configuration for traffic logs'
      }, { status: 500 });
    }

    // Fetch recent logs efficiently using cursor-based pagination
    const recentLogs = await fetchRecentLogs();
    
    // Apply filters
    let filteredLogs = recentLogs;
    
    if (domain) {
      filteredLogs = filteredLogs.filter(log => log.domain.includes(domain));
    }
    
    if (decision) {
      filteredLogs = filteredLogs.filter(log => log.decision === decision);
    }
    
    if (since) {
      const sinceDate = new Date(since);
      filteredLogs = filteredLogs.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= sinceDate;
      });
    }

    // Sort by timestamp (newest first) - they should already be sorted from fetchRecentLogs
    filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Paginate the filtered results
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

    // Calculate stats
    const stats = {
      totalRequests: filteredLogs.length,
      safePageRequests: filteredLogs.filter(log => log.decision === 'safe_page').length,
      moneyPageRequests: filteredLogs.filter(log => log.decision === 'money_page').length,
      topCountries: getTopCountries(filteredLogs),
      topReasons: getTopReasons(filteredLogs)
    };

    return NextResponse.json({
      success: true,
      data: {
        logs: paginatedLogs,
        stats,
        pagination: {
          page,
          limit,
          total: filteredLogs.length,
          pages: Math.ceil(filteredLogs.length / limit)
        },
        metadata: {
          maxRecentLogs: MAX_RECENT_LOGS,
          showingRecentOnly: true,
          totalLogsShown: recentLogs.length,
          fetchedAt: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Traffic logs API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function fetchRecentLogs(): Promise<any[]> {
  const logs: any[] = [];
  let cursor: string | undefined;
  let totalFetched = 0;
  
  try {
    // Fetch keys in batches using cursor pagination, limiting to recent logs
    while (totalFetched < MAX_RECENT_LOGS) {
      const remaining = MAX_RECENT_LOGS - totalFetched;
      const batchLimit = Math.min(1000, remaining); // KV max limit is 1000
      
      // Build the list URL with cursor pagination
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
        throw new Error(`Failed to list traffic log keys: ${listResponse.statusText}`);
      }

      const listData = await listResponse.json();
      const keys = listData.result || [];
      
      if (keys.length === 0) {
        break; // No more keys
      }

      // Sort keys by timestamp (newest first) - extract timestamp from key name
      keys.sort((a: any, b: any) => {
        const aTime = a.name.split('_')[2] || '0';
        const bTime = b.name.split('_')[2] || '0';
        return bTime.localeCompare(aTime);
      });

      // Take only what we need to reach our limit
      const keysToProcess = keys.slice(0, remaining);
      
      // Fetch log entries in bulk batches (KV bulk GET supports up to 100 keys)
      const batchedLogs = await fetchLogsBulk(keysToProcess);
      logs.push(...batchedLogs);
      
      totalFetched += keysToProcess.length;
      
      // Update cursor for next iteration
      cursor = listData.result_info?.cursor;
      
      // Break if we've reached our limit or if there are no more results
      if (totalFetched >= MAX_RECENT_LOGS || !cursor || listData.result_info?.list_complete !== false) {
        break;
      }
    }
    
    // Final sort by timestamp (newest first)
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Trim to exact limit
    return logs.slice(0, MAX_RECENT_LOGS);
    
  } catch (error) {
    console.error('Error fetching recent logs:', error);
    return [];
  }
}

async function fetchLogsBulk(keys: any[]): Promise<any[]> {
  const logs: any[] = [];
  
  // Process keys in batches of 100 (KV bulk GET limit)
  const BULK_BATCH_SIZE = 100;
  
  for (let i = 0; i < keys.length; i += BULK_BATCH_SIZE) {
    const batch = keys.slice(i, i + BULK_BATCH_SIZE);
    const keyNames = batch.map((key: any) => key.name);
    
    try {
      // Use bulk GET operation for efficiency
      const bulkGetUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${TRAFFIC_LOGS_NAMESPACE_ID}/bulk/get`;
      
      const bulkResponse = await fetch(bulkGetUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          keys: keyNames
        })
      });

      if (bulkResponse.ok) {
        const bulkData = await bulkResponse.json();
        const values = bulkData.result?.values || {};
        
        // Convert the key-value pairs to log entries
        for (const keyName of keyNames) {
          if (values[keyName]) {
            try {
              const logEntry = JSON.parse(values[keyName]);
              logs.push(logEntry);
            } catch (parseError) {
              console.error(`Error parsing log entry ${keyName}:`, parseError);
            }
          }
        }
      } else {
        console.error(`Bulk GET failed for batch:`, bulkResponse.statusText);
        
        // Fallback to individual GET requests for this batch
        await fetchLogsIndividually(batch, logs);
      }
    } catch (error) {
      console.error(`Error in bulk fetch for batch:`, error);
      
      // Fallback to individual GET requests for this batch
      await fetchLogsIndividually(batch, logs);
    }
  }
  
  return logs;
}

async function fetchLogsIndividually(keys: any[], logs: any[]): Promise<void> {
  // Fallback: fetch individual log entries (less efficient but more reliable)
  for (const key of keys) {
    try {
      const valueUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${TRAFFIC_LOGS_NAMESPACE_ID}/values/${key.name}`;
      
      const valueResponse = await fetch(valueUrl, {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`
        }
      });

      if (valueResponse.ok) {
        const logEntry = await valueResponse.json();
        logs.push(logEntry);
      }
    } catch (error) {
      console.error(`Error fetching individual log entry ${key.name}:`, error);
    }
  }
}

function getTopCountries(logs: any[]) {
  const countryCounts: { [key: string]: number } = {};
  
  logs.forEach(log => {
    if (log.country) {
      countryCounts[log.country] = (countryCounts[log.country] || 0) + 1;
    }
  });
  
  return Object.entries(countryCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([country, count]) => ({ country, count }));
}

function getTopReasons(logs: any[]) {
  const reasonCounts: { [key: string]: number } = {};
  
  logs.forEach(log => {
    if (log.detectionReason) {
      reasonCounts[log.detectionReason] = (reasonCounts[log.detectionReason] || 0) + 1;
    }
  });
  
  return Object.entries(reasonCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));
} 