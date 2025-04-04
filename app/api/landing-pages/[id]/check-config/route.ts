import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { LandingPage } from '@/lib/models/LandingPage';
import { Domain, IDomain } from '@/lib/models/Domain';
import { getDnsRecords } from '@/lib/cloudflare';
import { addDomainToVercel } from '@/lib/vercel';

interface Params {
  params: {
    id: string;
  };
}

// GET /api/landing-pages/[id]/check-config - Check configuration status
export async function GET(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    const { id } = params;
    console.log(`Checking configuration for landing page with ID: ${id}`);
    
    // Find the landing page
    const landingPage = await LandingPage.findById(id).populate('domainId');
    if (!landingPage) {
      return NextResponse.json(
        { error: 'Landing page not found' },
        { status: 404 }
      );
    }
    
    // Get domain info
    const domain = landingPage.domainId as unknown as IDomain;
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found for this landing page' },
        { status: 404 }
      );
    }
    
    // Build full domain
    const fullDomain = `${landingPage.subdomain}.${domain.name}`;
    console.log(`Checking configuration for: ${fullDomain}`);
    
    // Check DNS records in Cloudflare
    let cloudflareRecords = [];
    let cloudflareStatus = 'unknown';
    try {
      cloudflareRecords = await getDnsRecords(landingPage.subdomain, domain.cloudflareZoneId);
      cloudflareStatus = cloudflareRecords.length > 0 ? 'configured' : 'not_configured';
    } catch (error) {
      console.error('Error checking Cloudflare DNS records:', error);
      cloudflareStatus = 'error';
    }
    
    // Check if this is a repair request
    const repair = request.nextUrl.searchParams.get('repair') === 'true';
    let repairResult = null;
    
    if (repair && cloudflareStatus !== 'configured') {
      // Try to repair the configuration by adding the domain to Vercel
      try {
        repairResult = await addDomainToVercel(fullDomain);
        console.log(`Repair: Subdomain added to Vercel: ${fullDomain}`);
      } catch (error) {
        console.error(`Error repairing subdomain in Vercel: ${fullDomain}`, error);
        repairResult = { success: false, error };
      }
    }
    
    // Return status
    return NextResponse.json({
      landingPageId: id,
      domain: domain.name,
      subdomain: landingPage.subdomain,
      fullDomain,
      cloudflare: {
        status: cloudflareStatus,
        records: cloudflareRecords,
      },
      repair: repair ? {
        requested: true,
        result: repairResult,
      } : undefined,
      message: cloudflareStatus === 'configured' 
        ? `Subdomain ${fullDomain} is correctly configured in Cloudflare.` 
        : `Subdomain ${fullDomain} is not properly configured in Cloudflare. Try adding it to Vercel manually or use the repair option.`,
    });
  } catch (error: any) {
    console.error('Error checking landing page configuration:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check landing page configuration', 
        details: error.message || String(error)
      },
      { status: 500 }
    );
  }
} 