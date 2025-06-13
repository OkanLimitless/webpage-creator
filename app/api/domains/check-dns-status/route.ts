import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { promises as dns } from 'dns';

// Set timeout for the function
export const maxDuration = 60;
// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface DnsCheckResult {
  domain: string;
  status: 'active' | 'inactive' | 'error';
  currentTarget?: string;
  expectedTarget: string;
  error?: string;
  verificationStatus: string;
  dnsManagement: string;
}

async function checkDomainDNS(domainName: string): Promise<{
  isActive: boolean;
  currentTarget?: string;
  error?: string;
}> {
  try {
    // First try CNAME lookup
    try {
      const cnameRecords = await dns.resolveCname(domainName);
      const target = cnameRecords[0];
      
      // Check if it points to Vercel
      if (target === 'cname.vercel-dns.com' || target.includes('vercel-dns.com')) {
        return { isActive: true, currentTarget: target };
      } else {
        return { isActive: false, currentTarget: target };
      }
    } catch (cnameError) {
      // If CNAME fails, try A record lookup
      try {
        const aRecords = await dns.resolve4(domainName);
        const target = aRecords[0];
        
        // Check if it points to Vercel's IP
        if (target === '76.76.21.21') {
          return { isActive: true, currentTarget: target };
        } else {
          return { isActive: false, currentTarget: target };
        }
      } catch (aError) {
        return { 
          isActive: false, 
          error: `DNS resolution failed: ${aError instanceof Error ? aError.message : 'Unknown error'}` 
        };
      }
    }
  } catch (error) {
    return { 
      isActive: false, 
      error: `DNS check failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const checkType = searchParams.get('type') || 'all'; // 'all', 'external', 'inactive'
    
    let query: any = {};
    
    // Build query based on check type
    switch (checkType) {
      case 'external':
        query = { dnsManagement: 'external' };
        break;
      case 'inactive':
        query = { 
          dnsManagement: 'external',
          verificationStatus: { $in: ['pending', 'inactive', 'error'] }
        };
        break;
      case 'all':
      default:
        // Check all domains, but focus on external ones
        query = {};
        break;
    }
    
    // Fetch domains from database
    const domains = await Domain.find(query).sort({ name: 1 });
    
    if (domains.length === 0) {
      return NextResponse.json({
        message: 'No domains found matching the criteria',
        results: []
      });
    }
    
    const results: DnsCheckResult[] = [];
    const BATCH_SIZE = 5; // Check 5 domains at a time to avoid overwhelming DNS servers
    
    // Process domains in batches
    for (let i = 0; i < domains.length; i += BATCH_SIZE) {
      const batch = domains.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (domain) => {
        const expectedTarget = domain.dnsManagement === 'external' 
          ? 'cname.vercel-dns.com' 
          : 'Cloudflare managed';
        
        // Only check DNS for external domains or domains that should be pointing to Vercel
        if (domain.dnsManagement === 'external' || domain.verificationStatus === 'verified') {
          const dnsCheck = await checkDomainDNS(domain.name);
          
          return {
            domain: domain.name,
            status: dnsCheck.isActive ? 'active' : (dnsCheck.error ? 'error' : 'inactive'),
            currentTarget: dnsCheck.currentTarget,
            expectedTarget,
            error: dnsCheck.error,
            verificationStatus: domain.verificationStatus,
            dnsManagement: domain.dnsManagement || 'cloudflare'
          } as DnsCheckResult;
        } else {
          // For Cloudflare domains, just return their current status
          return {
            domain: domain.name,
            status: domain.verificationStatus === 'active' ? 'active' : 'inactive',
            expectedTarget,
            verificationStatus: domain.verificationStatus,
            dnsManagement: domain.dnsManagement || 'cloudflare'
          } as DnsCheckResult;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    // Categorize results
    const summary = {
      total: results.length,
      active: results.filter(r => r.status === 'active').length,
      inactive: results.filter(r => r.status === 'inactive').length,
      errors: results.filter(r => r.status === 'error').length
    };
    
    // Filter results based on what's most useful
    const inactiveResults = results.filter(r => r.status !== 'active');
    const externalInactive = results.filter(r => 
      r.dnsManagement === 'external' && r.status !== 'active'
    );
    
    return NextResponse.json({
      message: `DNS check completed. ${summary.active}/${summary.total} domains are active.`,
      summary,
      results: {
        all: results,
        inactive: inactiveResults,
        externalInactive: externalInactive
      }
    });
    
  } catch (error) {
    console.error('DNS status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check DNS status' },
      { status: 500 }
    );
  }
} 