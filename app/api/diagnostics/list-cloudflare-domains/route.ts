import { NextRequest, NextResponse } from 'next/server';
import { listAvailableDomains } from '@/lib/cloudflare';

// GET /api/diagnostics/list-cloudflare-domains
export async function GET(request: NextRequest) {
  try {
    console.log('Listing available Cloudflare domains...');
    
    const domains = await listAvailableDomains();
    
    return NextResponse.json({
      success: true,
      domains,
      count: domains.length,
      message: `Found ${domains.length} domain(s) in your Cloudflare account`
    });
    
  } catch (error) {
    console.error('Error listing Cloudflare domains:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list Cloudflare domains',
        domains: [],
        count: 0
      }, 
      { status: 500 }
    );
  }
} 