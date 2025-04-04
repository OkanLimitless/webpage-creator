import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { checkDomainActivation, checkDomainActivationByName } from '@/lib/cloudflare';

interface Params {
  params: {
    id: string;
  };
}

// GET /api/domains/[id]/verify - Check verification status of a domain
export async function GET(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    const { id } = params;
    console.log(`Verifying domain with ID: ${id}`);
    
    // Find the domain
    const domain = await Domain.findById(id);
    if (!domain) {
      console.error(`Domain with ID ${id} not found`);
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }
    
    console.log(`Found domain: ${domain.name}, zoneId: ${domain.cloudflareZoneId}, current status: ${domain.verificationStatus}`);
    
    // Check activation status in Cloudflare
    // First try by domain name (more reliable)
    let activationStatus;
    try {
      console.log(`Checking activation status by name for ${domain.name}`);
      activationStatus = await checkDomainActivationByName(domain.name);
    } catch (domainNameError) {
      console.error(`Error checking by domain name, falling back to zone ID: ${domainNameError}`);
      
      // If no Cloudflare zone ID, can't continue with fallback
      if (!domain.cloudflareZoneId) {
        console.error(`Domain ${domain.name} does not have a Cloudflare zone ID`);
        return NextResponse.json(
          { error: 'Domain does not have a Cloudflare zone ID and name lookup failed' },
          { status: 400 }
        );
      }
      
      // Fall back to check by zone ID
      console.log(`Checking activation status for ${domain.name} with zone ID ${domain.cloudflareZoneId}`);
      activationStatus = await checkDomainActivation(domain.cloudflareZoneId);
    }
    
    console.log(`Activation status for ${domain.name}: ${JSON.stringify(activationStatus)}`);
    
    // Update domain status in database
    const previousStatus = domain.verificationStatus;
    domain.verificationStatus = activationStatus.status;
    await domain.save();
    
    console.log(`Updated domain status from ${previousStatus} to ${domain.verificationStatus}`);
    
    // Force status to active for testing if it's in Cloudflare dashboard as active
    const forceActive = request.nextUrl.searchParams.get('forceActive') === 'true';
    if (forceActive && activationStatus.status === 'pending') {
      console.log(`Forcing domain status to active for ${domain.name}`);
      domain.verificationStatus = 'active';
      await domain.save();
      activationStatus.status = 'active';
      activationStatus.active = true;
    }
    
    return NextResponse.json({
      name: domain.name,
      status: activationStatus.status,
      active: activationStatus.active,
      message: activationStatus.active 
        ? 'Domain is verified and active!' 
        : `Domain is not yet active (status: ${activationStatus.status}). Please make sure your nameservers are updated correctly and DNS propagation is complete.`,
      debug: {
        zoneId: domain.cloudflareZoneId,
        previousStatus,
        currentStatus: activationStatus.status,
        forceActive: forceActive
      }
    });
  } catch (error: any) {
    console.error('Error checking domain verification:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check domain verification status', 
        details: error.message || String(error)
      },
      { status: 500 }
    );
  }
} 