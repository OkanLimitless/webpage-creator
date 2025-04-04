import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { checkDomainActivation } from '@/lib/cloudflare';

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
    
    // If no Cloudflare zone ID, can't check status
    if (!domain.cloudflareZoneId) {
      console.error(`Domain ${domain.name} does not have a Cloudflare zone ID`);
      return NextResponse.json(
        { error: 'Domain does not have a Cloudflare zone ID' },
        { status: 400 }
      );
    }
    
    // Check activation status in Cloudflare
    console.log(`Checking activation status for ${domain.name} with zone ID ${domain.cloudflareZoneId}`);
    const activationStatus = await checkDomainActivation(domain.cloudflareZoneId);
    console.log(`Activation status for ${domain.name}: ${JSON.stringify(activationStatus)}`);
    
    // Update domain status in database
    const previousStatus = domain.verificationStatus;
    domain.verificationStatus = activationStatus.status;
    await domain.save();
    
    console.log(`Updated domain status from ${previousStatus} to ${domain.verificationStatus}`);
    
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