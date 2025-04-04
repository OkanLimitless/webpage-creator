import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { checkDomainActivationByName } from '@/lib/cloudflare';
import { checkDomainInVercel, addDomainToVercel } from '@/lib/vercel';

interface Params {
  params: {
    id: string;
  };
}

// Define types for Cloudflare and Vercel status responses
interface CloudflareStatus {
  status: string;
  active: boolean;
  zoneId?: string;
  error?: any;
}

interface VercelStatus {
  exists: boolean;
  configured: boolean;
  domainName?: string;
  vercelDomain?: any;
  error?: any;
}

interface RepairResult {
  cloudflare: null | { action: string; success: boolean };
  vercel: null | { action: string; success: boolean; result?: any; error?: any };
}

// GET /api/domains/[id]/check-full-config - Check complete configuration status
export async function GET(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    const { id } = params;
    console.log(`Checking full configuration for domain with ID: ${id}`);
    
    // Find the domain
    const domain = await Domain.findById(id);
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }
    
    console.log(`Found domain: ${domain.name}, current zoneId: ${domain.cloudflareZoneId || 'none'}`);
    
    // Check if this is a repair request
    const repair = request.nextUrl.searchParams.get('repair') === 'true';
    
    // Check Cloudflare status
    let cloudflareStatus: CloudflareStatus = { status: 'unknown', active: false };
    try {
      cloudflareStatus = await checkDomainActivationByName(domain.name) as CloudflareStatus;
      console.log(`Cloudflare status for ${domain.name}:`, cloudflareStatus);
    } catch (error) {
      console.error(`Error checking Cloudflare status for ${domain.name}:`, error);
      cloudflareStatus = { status: 'error', active: false, error };
    }
    
    // Check Vercel status
    let vercelStatus: VercelStatus = { exists: false, configured: false };
    try {
      vercelStatus = await checkDomainInVercel(domain.name) as VercelStatus;
      console.log(`Vercel status for ${domain.name}:`, vercelStatus);
    } catch (error) {
      console.error(`Error checking Vercel status for ${domain.name}:`, error);
      vercelStatus = { exists: false, configured: false, error };
    }
    
    // Perform repairs if requested
    let repairResult: RepairResult | undefined = undefined;
    if (repair) {
      repairResult = {
        cloudflare: null,
        vercel: null
      };
      
      // Update cloudflareZoneId if needed
      if (cloudflareStatus.zoneId && cloudflareStatus.zoneId !== domain.cloudflareZoneId) {
        domain.cloudflareZoneId = cloudflareStatus.zoneId;
        await domain.save();
        repairResult.cloudflare = { action: 'updated_zone_id', success: true };
      }
      
      // Add domain to Vercel if it doesn't exist
      if (!vercelStatus.exists) {
        try {
          const vercelAddResult = await addDomainToVercel(domain.name);
          repairResult.vercel = { action: 'added_domain', success: true, result: vercelAddResult };
        } catch (error) {
          console.error(`Error adding domain to Vercel during repair:`, error);
          repairResult.vercel = { action: 'added_domain', success: false, error };
        }
      }
    }
    
    // Return combined status
    return NextResponse.json({
      domain: domain.name,
      cloudflare: {
        status: cloudflareStatus.status || 'unknown',
        active: cloudflareStatus.active || false,
        zoneId: cloudflareStatus.zoneId || domain.cloudflareZoneId,
      },
      vercel: {
        exists: vercelStatus.exists || false,
        configured: vercelStatus.configured || false,
      },
      repair: repair ? {
        performed: true,
        results: repairResult
      } : undefined,
      overallStatus: 
        (cloudflareStatus.active && vercelStatus.exists && vercelStatus.configured) 
          ? 'fully_configured' 
          : 'issues_detected',
      nextSteps: determineNextSteps(cloudflareStatus, vercelStatus),
    });
  } catch (error: any) {
    console.error('Error checking domain configuration:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check domain configuration', 
        details: error.message || String(error)
      },
      { status: 500 }
    );
  }
}

// Helper function to determine next steps based on configuration status
function determineNextSteps(cloudflareStatus: CloudflareStatus, vercelStatus: VercelStatus): string[] {
  const steps: string[] = [];
  
  // Cloudflare issues
  if (!cloudflareStatus.active) {
    steps.push('Ensure your domain nameservers are set to Cloudflare nameservers');
    steps.push('Wait for DNS propagation (this can take 24-48 hours)');
  }
  
  // Vercel issues
  if (!vercelStatus.exists) {
    steps.push('Add your domain to Vercel project (use the "Repair" option)');
  } else if (!vercelStatus.configured) {
    steps.push('Verify your domain in Vercel (check Vercel dashboard)');
    steps.push('Ensure CNAME records are properly set to cname.vercel-dns.com');
  }
  
  // If everything looks good
  if (steps.length === 0) {
    steps.push('Your domain is fully configured in both Cloudflare and Vercel');
  }
  
  return steps;
} 