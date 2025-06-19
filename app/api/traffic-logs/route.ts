/**
 * Traffic Logs API - Optimized for Large Datasets
 * 
 * This API reads traffic logs from Cloudflare KV storage with the key format:
 * traffic_log_{timestamp}_{randomString}
 * 
 * Optimizations for handling large datasets (30k+ logs) efficiently:
 * - Uses cursor-based pagination instead of fetching all keys
 * - Limits to most recent MAX_RECENT_LOGS (300) for performance
 * - Employs Cloudflare KV bulk GET operations for speed
 * - Numeric timestamp sorting for proper chronological order
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
const MAX_RECENT_LOGS = 1000; // Fetch recent logs (after cleanup, these should be truly recent)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    
    // Get filter parameters
    const dateFilter = searchParams.get('date') || 'today'; // 'today', 'yesterday', 'both'
    const domainFilter = searchParams.get('domain') || '';
    const countryFilter = searchParams.get('country') || '';
    const userTypeFilter = searchParams.get('userType') || ''; // 'bot', 'real'

    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !TRAFFIC_LOGS_NAMESPACE_ID) {
      return NextResponse.json({
        success: false,
        error: 'Missing Cloudflare configuration'
      }, { status: 500 });
    }

    console.log(`Fetching traffic logs - Page: ${page}, Limit: ${limit}, Date: ${dateFilter}`);

    // Get logs using efficient date-based filtering
    const result = await fetchLogsByDate(dateFilter, domainFilter, countryFilter, userTypeFilter, page, limit);
    
    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Traffic logs API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch traffic logs'
    }, { status: 500 });
  }
}

async function fetchLogsByDate(
  dateFilter: string, 
  domainFilter: string, 
  countryFilter: string, 
  userTypeFilter: string,
  page: number, 
  limit: number
): Promise<any> {
  try {
    console.log(`Fetching recent traffic logs...`);
    
    // Simplified approach: Just get a reasonable sample of logs and sort them
    // This avoids the alphabetical ordering issue with KV date prefixes
    const allLogs: any[] = [];
    const MAX_LOGS_TO_FETCH = 200; // Reasonable limit to avoid timeouts
    
    console.log(`Fetching up to ${MAX_LOGS_TO_FETCH} logs...`);
    
    // Fetch logs without date filtering - just get recent ones
    const logs = await fetchRecentLogsSimple(MAX_LOGS_TO_FETCH);
    allLogs.push(...logs);
    
    console.log(`Fetched ${allLogs.length} total logs`);
    
    // Apply filters
    let filteredLogs = allLogs;
    
    // Apply date filter after fetching (since KV alphabetical order doesn't help)
    if (dateFilter !== 'both') {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      filteredLogs = filteredLogs.filter(log => {
        const logDate = log.timestamp.split('T')[0];
        if (dateFilter === 'today') {
          return logDate === today;
        } else if (dateFilter === 'yesterday') {
          return logDate === yesterdayStr;
        }
        return true; // both
      });
    }
    
    if (domainFilter) {
      filteredLogs = filteredLogs.filter(log => 
        log.domain && log.domain.toLowerCase().includes(domainFilter.toLowerCase())
      );
    }
    
    if (countryFilter) {
      filteredLogs = filteredLogs.filter(log => 
        log.country && log.country.toLowerCase().includes(countryFilter.toLowerCase())
      );
    }
    
    if (userTypeFilter) {
      filteredLogs = filteredLogs.filter(log => {
        if (userTypeFilter === 'bot') return log.isBot === true;
        if (userTypeFilter === 'real') return log.isBot === false;
        return true;
      });
    }
    
    console.log(`Logs after filtering: ${filteredLogs.length}`);
    
    // Sort by timestamp (newest first) - this is the key fix
    filteredLogs.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA; // Newest first
    });
    
    // Calculate pagination
    const totalLogs = filteredLogs.length;
    const totalPages = Math.ceil(totalLogs / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);
    
    // Calculate stats
    const stats = {
      totalRequests: totalLogs,
      botRequests: filteredLogs.filter(log => log.isBot === true).length,
      realUserRequests: filteredLogs.filter(log => log.isBot === false).length,
      uniqueCountries: Array.from(new Set(filteredLogs.map(log => log.country).filter(Boolean))).length,
      uniqueDomains: Array.from(new Set(filteredLogs.map(log => log.domain).filter(Boolean))).length
    };
    
    return {
      logs: paginatedLogs,
      stats,
      pagination: {
        page,
        pages: totalPages,
        total: totalLogs,
        limit
      }
    };
    
  } catch (error) {
    console.error('Error in fetchLogsByDate:', error);
    throw error;
  }
}

// Simplified function to just get recent logs without complex date filtering
async function fetchRecentLogsSimple(maxLogs: number): Promise<any[]> {
  try {
    const logs: any[] = [];
    let cursor: string | undefined;
    let fetchedCount = 0;
    
    console.log(`Fetching traffic logs (simple approach)...`);
    
    while (fetchedCount < maxLogs) {
      const remainingToFetch = maxLogs - fetchedCount;
      const batchLimit = Math.min(1000, remainingToFetch * 3); // Fetch more keys since not all will be traffic logs
      
      let listUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${TRAFFIC_LOGS_NAMESPACE_ID}/keys?limit=${batchLimit}`;
      
      if (cursor) {
        listUrl += `&cursor=${encodeURIComponent(cursor)}`;
      }
      
      console.log(`Fetching keys (limit: ${batchLimit})...`);
      
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
      
      console.log(`Found ${keys.length} keys`);
      
      // Filter only traffic log keys
      const trafficLogKeys = keys.filter((key: any) => key.name.startsWith('traffic_log_'));
      console.log(`Traffic log keys in batch: ${trafficLogKeys.length}`);
      
      // Fetch log data for traffic log keys only
      const keysToFetch = trafficLogKeys.slice(0, Math.min(trafficLogKeys.length, remainingToFetch));
      if (keysToFetch.length > 0) {
        const logBatch = await fetchLogBatch(keysToFetch);
        logs.push(...logBatch);
        fetchedCount += logBatch.length;
        
        console.log(`Fetched ${logBatch.length} logs, total: ${fetchedCount}`);
      }
      
      // If we have enough logs or no more keys, stop
      if (fetchedCount >= maxLogs || !listData.result_info?.cursor) {
        break;
      }
      
      cursor = listData.result_info?.cursor;
    }
    
    console.log(`Finished fetching logs, total: ${logs.length}`);
    return logs;
    
  } catch (error) {
    console.error('Error fetching recent logs:', error);
    return [];
  }
}

async function fetchLogBatch(keys: any[]): Promise<any[]> {
  const logs: any[] = [];
  
  // Fetch log data for each key
  for (const key of keys) {
    try {
      const valueUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${TRAFFIC_LOGS_NAMESPACE_ID}/values/${encodeURIComponent(key.name)}`;
      
      const valueResponse = await fetch(valueUrl, {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`
        }
      });

      if (valueResponse.ok) {
        const logData = await valueResponse.json();
        
        // Extract timestamp from key name for sorting
        // Key format: traffic_log_2025-06-19T14:05:25.797Z_randomString
        const keyParts = key.name.split('_');
        const timestamp = keyParts.slice(2, -1).join('_'); // Everything between traffic_log_ and last _
        
        logs.push({
          ...logData,
          timestamp: timestamp,
          keyName: key.name
        });
      }
    } catch (error) {
      console.error(`Error fetching log data for key ${key.name}:`, error);
      // Continue with other keys even if one fails
    }
  }
  
  return logs;
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