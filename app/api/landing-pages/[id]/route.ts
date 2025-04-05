import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { LandingPage } from '@/lib/models/LandingPage';
import { Domain } from '@/lib/models/Domain';
import { getDnsRecords, deleteDnsRecord } from '@/lib/cloudflare';
import { deleteFromVercelBlob } from '@/lib/vercelBlobStorage';

interface Params {
  params: {
    id: string;
  };
}

// Mark this route as dynamic to prevent static optimization issues
export const dynamic = 'force-dynamic';

// GET /api/landing-pages/[id] - Get a landing page by ID
export async function GET(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const landingPage = await LandingPage.findById(params.id).populate('domainId', 'name');
    
    if (!landingPage) {
      return NextResponse.json(
        { error: 'Landing page not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(landingPage);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch landing page' },
      { status: 500 }
    );
  }
}

// DELETE /api/landing-pages/[id] - Delete a landing page
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    // First check if landing page exists
    const landingPage = await LandingPage.findById(params.id);
    if (!landingPage) {
      return NextResponse.json(
        { error: 'Landing page not found' },
        { status: 404 }
      );
    }
    
    // Track deletion operations and their results
    const deletionResults = {
      dnsRecordsDeleted: false,
      screenshotsDeleted: false,
      landingPageDeleted: false,
    };
    
    // Get the domain
    const domain = await Domain.findById(landingPage.domainId);
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }
    
    // Verify domain has a zone ID
    if (!domain.cloudflareZoneId) {
      console.warn(`Domain ${domain.name} missing Cloudflare Zone ID. Cannot remove DNS records.`);
    } else {
      console.log(`Using zone ID ${domain.cloudflareZoneId} to delete DNS records`);
      
      // Delete DNS record from Cloudflare - using just the subdomain for lookup
      // We need to use the FQDN format for lookup but only subdomain for zone-scoped operations
      const fqdn = `${landingPage.subdomain}.${domain.name}`;
      console.log(`Looking up DNS records for ${fqdn}`);
      
      try {
        // Get records matching the full domain name
        const dnsRecords = await getDnsRecords(fqdn, domain.cloudflareZoneId);
        if (dnsRecords && dnsRecords.length > 0) {
          // Delete all matching DNS records
          for (const record of dnsRecords) {
            console.log(`Deleting DNS record ${record.id} with name ${record.name}`);
            await deleteDnsRecord(record.id, domain.cloudflareZoneId);
          }
          deletionResults.dnsRecordsDeleted = true;
        } else {
          console.warn(`No DNS records found for ${fqdn}`);
        }
      } catch (dnsError) {
        console.error('Error deleting DNS records:', dnsError);
        // Continue with deletion even if DNS deletion fails
      }
    }
    
    // Delete screenshot files from Vercel Blob Storage
    try {
      console.log('Deleting screenshot files from Vercel Blob Storage');
      
      // Check if the landing page has screenshot URLs
      if (landingPage.desktopScreenshotUrl) {
        const desktopDeleted = await deleteFromVercelBlob(landingPage.desktopScreenshotUrl);
        console.log(`Desktop screenshot deletion result: ${desktopDeleted ? 'Success' : 'Failed'}`);
      }
      
      if (landingPage.mobileScreenshotUrl) {
        const mobileDeleted = await deleteFromVercelBlob(landingPage.mobileScreenshotUrl);
        console.log(`Mobile screenshot deletion result: ${mobileDeleted ? 'Success' : 'Failed'}`);
      }
      
      deletionResults.screenshotsDeleted = true;
    } catch (blobError) {
      console.error('Error deleting screenshot files:', blobError);
      // Continue with landing page deletion even if blob deletion fails
    }
    
    // Delete the landing page
    try {
      await LandingPage.findByIdAndDelete(params.id);
      deletionResults.landingPageDeleted = true;
      console.log(`Landing page ${params.id} deleted successfully`);
    } catch (dbError) {
      console.error('Error deleting landing page from database:', dbError);
      throw dbError; // Re-throw database errors as they are critical
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Landing page deleted successfully',
      deletionResults
    });
  } catch (error) {
    console.error('Error deleting landing page:', error);
    return NextResponse.json(
      { error: 'Failed to delete landing page' },
      { status: 500 }
    );
  }
}

// PATCH /api/landing-pages/[id] - Update a landing page
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { isActive, affiliateUrl } = body;
    
    const updateData: any = {};
    
    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }
    
    if (affiliateUrl) {
      updateData.affiliateUrl = affiliateUrl;
    }
    
    // Find and update the landing page
    const updatedLandingPage = await LandingPage.findByIdAndUpdate(
      params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!updatedLandingPage) {
      return NextResponse.json(
        { error: 'Landing page not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(updatedLandingPage);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update landing page' },
      { status: 500 }
    );
  }
} 