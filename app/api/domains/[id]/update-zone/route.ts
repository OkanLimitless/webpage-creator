import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { getZoneIdByName, checkDomainActivationByName } from '@/lib/cloudflare';

interface Params {
  params: {
    id: string;
  };
}

// POST /api/domains/[id]/update-zone - Force update zone ID for a domain
export async function POST(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    const { id } = params;
    console.log(`Updating zone ID for domain with ID: ${id}`);
    
    // Find the domain
    const domain = await Domain.findById(id);
    if (!domain) {
      console.error(`Domain with ID ${id} not found`);
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }
    
    console.log(`Found domain: ${domain.name}, current zoneId: ${domain.cloudflareZoneId || 'none'}`);
    
    // Get zone ID from Cloudflare
    let zoneId;
    try {
      // First try with checkDomainActivationByName which returns more info
      const activationInfo = await checkDomainActivationByName(domain.name);
      zoneId = activationInfo.zoneId;
      
      // Also update the status if available
      if (activationInfo.status) {
        domain.verificationStatus = activationInfo.status;
      }
    } catch (error) {
      console.error(`Error with checkDomainActivationByName, falling back to getZoneIdByName: ${error}`);
      // Fall back to simpler method
      zoneId = await getZoneIdByName(domain.name);
    }
    
    if (!zoneId) {
      return NextResponse.json({
        error: 'Could not find zone ID for this domain in Cloudflare',
        domain: domain.name
      }, { status: 400 });
    }
    
    // Update the domain with the zone ID
    const oldZoneId = domain.cloudflareZoneId;
    domain.cloudflareZoneId = zoneId;
    await domain.save();
    
    console.log(`Updated zone ID for ${domain.name} from ${oldZoneId || 'none'} to ${zoneId}`);
    
    return NextResponse.json({
      success: true,
      domain: domain.name,
      zoneId: zoneId,
      message: `Zone ID updated successfully from ${oldZoneId || 'none'} to ${zoneId}`
    });
  } catch (error: any) {
    console.error('Error updating zone ID:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update zone ID', 
        details: error.message || String(error)
      },
      { status: 500 }
    );
  }
}

// GET /api/domains/[id]/update-zone - Check zone ID for a domain without updating
export async function GET(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    const { id } = params;
    console.log(`Checking zone ID for domain with ID: ${id}`);
    
    // Find the domain
    const domain = await Domain.findById(id);
    if (!domain) {
      console.error(`Domain with ID ${id} not found`);
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }
    
    console.log(`Found domain: ${domain.name}, current zoneId: ${domain.cloudflareZoneId || 'none'}`);
    
    // Check Cloudflare for zone ID
    let cloudflareZoneId;
    let cloudflareStatus;
    
    try {
      // First try with checkDomainActivationByName which returns more info
      const activationInfo = await checkDomainActivationByName(domain.name);
      cloudflareZoneId = activationInfo.zoneId;
      cloudflareStatus = activationInfo.status;
    } catch (error) {
      console.error(`Error with checkDomainActivationByName, falling back to getZoneIdByName: ${error}`);
      // Fall back to simpler method
      cloudflareZoneId = await getZoneIdByName(domain.name);
    }
    
    return NextResponse.json({
      domain: domain.name,
      currentZoneId: domain.cloudflareZoneId || null,
      cloudflareZoneId: cloudflareZoneId || null,
      cloudflareStatus: cloudflareStatus || 'unknown',
      needsUpdate: !domain.cloudflareZoneId || domain.cloudflareZoneId !== cloudflareZoneId,
      message: cloudflareZoneId 
        ? (domain.cloudflareZoneId === cloudflareZoneId 
            ? "Zone ID is up-to-date" 
            : "Zone ID needs to be updated")
        : "Could not find zone ID in Cloudflare"
    });
  } catch (error: any) {
    console.error('Error checking zone ID:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check zone ID', 
        details: error.message || String(error)
      },
      { status: 500 }
    );
  }
} 