import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { JciLog } from '@/lib/models/JciLog';

// POST /api/jci-logs - Receive logs from Cloudflare Workers
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const logData = await request.json();
    
    // Extract domain from the request headers or URL
    const referer = request.headers.get('referer') || '';
    const host = request.headers.get('host') || '';
    const origin = request.headers.get('origin') || '';
    const domain = extractDomainFromUrl(referer) || extractDomainFromUrl(origin) || host;
    
    // Process and enrich the log data
    const enrichedLogData = {
      ...logData,
      domain,
      // Extract additional fields from JCI response if available
      ...(logData.jciResponse && {
        country: logData.jciResponse.country,
        device: logData.jciResponse.device,
        os: logData.jciResponse.os,
        browser: logData.jciResponse.browser,
        isp: logData.jciResponse.isp,
        riskScore: parseFloat(logData.jciResponse.risk_score) || null
      })
    };
    
    // Create and save the log entry
    const jciLog = new JciLog(enrichedLogData);
    await jciLog.save();
    
    console.log(`📝 JCI log saved: ${jciLog._id} - ${logData.decision} for ${logData.ip}`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Log saved successfully',
      id: jciLog._id 
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
    
  } catch (error) {
    console.error('Error saving JCI log:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save log' 
      }, 
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    );
  }
}

// Handle preflight OPTIONS requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// GET /api/jci-logs - Retrieve logs with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;
    
    // Filters
    const decision = searchParams.get('decision');
    const reason = searchParams.get('reason');
    const domain = searchParams.get('domain');
    const country = searchParams.get('country');
    const since = searchParams.get('since'); // Date filter
    
    // Build query
    const query: any = {};
    
    if (decision) query.decision = decision;
    if (reason) query.reason = reason;
    if (domain) query.domain = new RegExp(domain, 'i'); // Case-insensitive partial match
    if (country) query.country = country;
    if (since) {
      query.timestamp = { $gte: new Date(since) };
    }
    
    // Execute query
    const [logs, totalCount] = await Promise.all([
      JciLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      JciLog.countDocuments(query)
    ]);
    
    // Calculate stats
    const stats = await JciLog.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          moneyPageShown: { 
            $sum: { $cond: [{ $eq: ['$decision', 'MONEY_PAGE'] }, 1, 0] } 
          },
          safePageShown: { 
            $sum: { $cond: [{ $eq: ['$decision', 'SAFE_PAGE'] }, 1, 0] } 
          },
          jciApproved: {
            $sum: { $cond: [{ $eq: ['$reason', 'JCI_APPROVED'] }, 1, 0] }
          },
          jciBlocked: {
            $sum: { $cond: [{ $eq: ['$reason', 'JCI_BLOCKED'] }, 1, 0] }
          },
          apiErrors: {
            $sum: { $cond: [{ $eq: ['$reason', 'JCI_API_FAILED'] }, 1, 0] }
          },
          workerErrors: {
            $sum: { $cond: [{ $eq: ['$reason', 'WORKER_ERROR'] }, 1, 0] }
          }
        }
      }
    ]);
    
    const currentStats = stats[0] || {
      totalRequests: 0,
      moneyPageShown: 0,
      safePageShown: 0,
      jciApproved: 0,
      jciBlocked: 0,
      apiErrors: 0,
      workerErrors: 0
    };
    
    return NextResponse.json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        },
        stats: {
          ...currentStats,
          conversionRate: currentStats.totalRequests > 0 
            ? ((currentStats.moneyPageShown / currentStats.totalRequests) * 100).toFixed(2) + '%'
            : '0%'
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching JCI logs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch logs' 
      }, 
      { status: 500 }
    );
  }
}

// Helper function to extract domain from URL
function extractDomainFromUrl(url: string): string | null {
  try {
    if (!url) return null;
    
    // Remove protocol if present
    const cleanUrl = url.replace(/^https?:\/\//, '');
    
    // Extract domain part (before path)
    const domain = cleanUrl.split('/')[0];
    
    return domain || null;
  } catch {
    return null;
  }
} 