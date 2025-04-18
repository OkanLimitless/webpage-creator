import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { LandingPage } from '@/lib/models/LandingPage';
import { Domain } from '@/lib/models/Domain';
import { getDnsRecords, deleteDnsRecord } from '@/lib/cloudflare';
import { deleteFromVercelBlob } from '@/lib/vercelBlobStorage';
import { deleteDomainFromVercel } from '@/lib/vercel';

interface Params {
  params: {
    id: string;
  };
}

// DELETE /api/landing-pages/[id]/delete-with-domain - Delete a landing page and its domain
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
      landingPageDeleted: false,
      domainDeleted: false,
      dnsRecordsDeleted: false,
      vercelDomainDeleted: false,
      screenshotsDeleted: false
    };
    
    // Get the domain
    const domainId = typeof landingPage.domainId === 'string' 
      ? landingPage.domainId 
      : landingPage.domainId.toString();
      
    const domain = await Domain.findById(domainId);
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }
    
    // Check if there are any other landing pages using this domain
    const otherLandingPagesCount = await LandingPage.countDocuments({ 
      domainId: domainId,
      _id: { $ne: params.id } // Exclude the current landing page
    });
    
    if (otherLandingPagesCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete domain as it has other landing pages. Delete those landing pages first or use regular delete.' },
        { status: 400 }
      );
    }
    
    // 1. Delete the landing page first (reusing existing code)
    // Create the full subdomain URL
    const fullyQualifiedDomain = `${landingPage.subdomain}.${domain.name}`;
    console.log(`Deleting landing page with subdomain: ${fullyQualifiedDomain}`);
    
    // Delete subdomain from Vercel
    try {
      console.log(`Removing subdomain ${fullyQualifiedDomain} from Vercel`);
      const vercelResult = await deleteDomainFromVercel(fullyQualifiedDomain);
      
      if (vercelResult.success) {
        console.log(`Successfully removed subdomain ${fullyQualifiedDomain} from Vercel`);
        deletionResults.vercelDomainDeleted = true;
      } else {
        console.warn(`Warning: Failed to remove subdomain from Vercel: ${JSON.stringify(vercelResult.error || vercelResult.message)}`);
      }
    } catch (vercelError) {
      console.error('Error removing subdomain from Vercel:', vercelError);
      // Continue with deletion even if Vercel deletion fails
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
    
    // 2. Delete the landing page from the database
    try {
      await LandingPage.findByIdAndDelete(params.id);
      deletionResults.landingPageDeleted = true;
      console.log(`Landing page ${params.id} deleted successfully`);
    } catch (dbError) {
      console.error('Error deleting landing page from database:', dbError);
      throw dbError; // Re-throw database errors as they are critical
    }
    
    // 3. Delete the root domain (also removes from Vercel and Cloudflare)
    try {
      await Domain.findByIdAndDelete(domainId);
      deletionResults.domainDeleted = true;
      console.log(`Domain ${domainId} deleted successfully`);
    } catch (dbError) {
      console.error('Error deleting domain from database:', dbError);
      throw dbError; // Re-throw database errors as they are critical
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Landing page and domain deleted successfully',
      deletionResults
    });
  } catch (error) {
    console.error('Error deleting landing page and domain:', error);
    return NextResponse.json(
      { error: 'Failed to delete landing page and domain' },
      { status: 500 }
    );
  }
} 