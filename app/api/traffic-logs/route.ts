import { NextRequest, NextResponse } from 'next/server';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const TRAFFIC_LOGS_NAMESPACE_ID = process.env.TRAFFIC_LOGS_NAMESPACE_ID;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const domain = searchParams.get('domain') || '';
    const decision = searchParams.get('decision') || '';
    const since = searchParams.get('since') || '';

    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN || !TRAFFIC_LOGS_NAMESPACE_ID) {
      return NextResponse.json({
        success: false,
        error: 'Missing Cloudflare configuration for traffic logs'
      }, { status: 500 });
    }

    // List all keys from KV namespace
    const listUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${TRAFFIC_LOGS_NAMESPACE_ID}/keys`;
    
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

    // Filter keys by date if 'since' parameter is provided
    let filteredKeys = keys;
    if (since) {
      const sinceDate = new Date(since);
      filteredKeys = keys.filter((key: any) => {
        const keyDate = new Date(key.name.split('_')[2]); // Extract timestamp from key
        return keyDate >= sinceDate;
      });
    }

    // Sort keys by timestamp (newest first)
    filteredKeys.sort((a: any, b: any) => {
      const aTime = a.name.split('_')[2];
      const bTime = b.name.split('_')[2];
      return bTime.localeCompare(aTime);
    });

    // Paginate
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedKeys = filteredKeys.slice(startIndex, endIndex);

    // Fetch actual log entries
    const logs = [];
    for (const key of paginatedKeys) {
      try {
        const valueUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${TRAFFIC_LOGS_NAMESPACE_ID}/values/${key.name}`;
        
        const valueResponse = await fetch(valueUrl, {
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`
          }
        });

        if (valueResponse.ok) {
          const logEntry = await valueResponse.json();
          
          // Apply filters
          let includeEntry = true;
          
          if (domain && !logEntry.domain.includes(domain)) {
            includeEntry = false;
          }
          
          if (decision && logEntry.decision !== decision) {
            includeEntry = false;
          }
          
          if (includeEntry) {
            logs.push(logEntry);
          }
        }
      } catch (error) {
        console.error(`Error fetching log entry ${key.name}:`, error);
      }
    }

    // Calculate stats
    const stats = {
      totalRequests: filteredKeys.length,
      safePageRequests: logs.filter(log => log.decision === 'safe_page').length,
      moneyPageRequests: logs.filter(log => log.decision === 'money_page').length,
      topCountries: getTopCountries(logs),
      topReasons: getTopReasons(logs)
    };

    return NextResponse.json({
      success: true,
      data: {
        logs,
        stats,
        pagination: {
          page,
          limit,
          total: filteredKeys.length,
          pages: Math.ceil(filteredKeys.length / limit)
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