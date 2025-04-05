import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { getZoneIdByName, checkDomainActivationByName } from '@/lib/cloudflare';

// Mark this route as dynamic to prevent static optimization issues
export const dynamic = 'force-dynamic';

// GET /api/domains/check-by-name?name=example.com - Check and update a domain by name
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    // Get domain name from query params
    const domainName = request.nextUrl.searchParams.get('name');
    if (!domainName) {
      return NextResponse.json(
        { error: 'Domain name is required as a query parameter' },
        { status: 400 }
      );
    }
    
    console.log(`Checking domain by name: ${domainName}`);
    
    // Find the domain in our database
    const domain = await Domain.findOne({ name: domainName.toLowerCase() });
    if (!domain) {
      console.warn(`Domain ${domainName} not found in database`);
      
      // Check if it exists in Cloudflare anyway
      let cloudflareInfo;
      try {
        cloudflareInfo = await checkDomainActivationByName(domainName);
      } catch (error) {
        console.error(`Error checking domain in Cloudflare: ${error}`);
        return NextResponse.json(
          { error: 'Domain not found in database and could not be verified in Cloudflare' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        found: false,
        name: domainName,
        existsInCloudflare: !!cloudflareInfo,
        cloudflareInfo: cloudflareInfo || null,
        message: 'Domain not found in database but exists in Cloudflare, consider adding it'
      });
    }
    
    // Get domain info from Cloudflare
    let zoneId;
    let activationInfo;
    
    try {
      // Try to get full activation info
      activationInfo = await checkDomainActivationByName(domainName);
      zoneId = activationInfo.zoneId;
      
      // Update domain if zone ID is missing or different
      if (zoneId && (!domain.cloudflareZoneId || domain.cloudflareZoneId !== zoneId)) {
        console.log(`Updating zone ID for ${domain.name} from ${domain.cloudflareZoneId || 'none'} to ${zoneId}`);
        
        // Get update flag
        const shouldUpdate = request.nextUrl.searchParams.get('update') === 'true';
        
        if (shouldUpdate) {
          domain.cloudflareZoneId = zoneId;
          if (activationInfo.status) {
            domain.verificationStatus = activationInfo.status;
          }
          await domain.save();
        }
        
        return NextResponse.json({
          found: true,
          name: domain.name,
          currentZoneId: domain.cloudflareZoneId,
          cloudflareZoneId: zoneId,
          updated: shouldUpdate,
          status: activationInfo.status,
          message: shouldUpdate 
            ? `Domain updated with zone ID: ${zoneId}` 
            : `Domain needs update but update flag not set (use ?update=true)`
        });
      }
      
      // Zone ID is already correct
      return NextResponse.json({
        found: true,
        name: domain.name,
        zoneId: domain.cloudflareZoneId,
        status: activationInfo.status,
        message: 'Domain has correct zone ID'
      });
    } catch (error) {
      console.error(`Error checking domain in Cloudflare: ${error}`);
      return NextResponse.json({
        error: 'Error checking domain in Cloudflare',
        domain: domain.name,
        currentZoneId: domain.cloudflareZoneId,
        details: String(error)
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in domain check-by-name API:', error);
    return NextResponse.json(
      { error: 'Server error processing domain check' },
      { status: 500 }
    );
  }
} 