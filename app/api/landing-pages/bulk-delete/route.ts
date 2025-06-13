import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { LandingPage } from '@/lib/models/LandingPage';
import { Domain } from '@/lib/models/Domain';
import { getDnsRecords, deleteDnsRecord, deleteWorkerAndRoutes } from '@/lib/cloudflare';
import { deleteFromVercelBlob } from '@/lib/vercelBlobStorage';
import { deleteDomainFromVercel } from '@/lib/vercel';

// Mark this route as dynamic to prevent static optimization issues
export const dynamic = 'force-dynamic';

// Set a longer timeout for bulk operations
export const maxDuration = 60;

// POST /api/landing-pages/bulk-delete - Delete multiple landing pages
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { ids } = body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Landing page IDs are required and must be an array' },
        { status: 400 }
      );
    }
    
    // Limit bulk operations to avoid overloading
    const MAX_ITEMS = 50;
    if (ids.length > MAX_ITEMS) {
      return NextResponse.json(
        { error: `Too many items. Maximum of ${MAX_ITEMS} items can be processed at once.` },
        { status: 400 }
      );
    }
    
    // Results tracking
    const results = {
      success: [] as string[],
      failed: [] as { id: string, reason: string }[]
    };
    
    // Process each landing page sequentially
    for (const id of ids) {
      try {
        // Find the landing page
        const landingPage = await LandingPage.findById(id);
        if (!landingPage) {
          results.failed.push({
            id,
            reason: 'Landing page not found'
          });
          continue;
        }
        
        // Track deletion operations and their results
        const deletionResults = {
          dnsRecordsDeleted: false,
          vercelDomainDeleted: false,
          screenshotsDeleted: false,
          workerDeleted: false,
          landingPageDeleted: false,
        };
        
        // Get the domain
        const domain = await Domain.findById(landingPage.domainId);
        if (!domain) {
          results.failed.push({
            id,
            reason: 'Domain not found'
          });
          continue;
        }
        
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
        
        // Delete Cloudflare Worker if it exists (for cloaked landing pages)
        if (landingPage.workerScriptName) {
          try {
            console.log(`Deleting Cloudflare Worker: ${landingPage.workerScriptName}`);
            const workerDeletionResult = await deleteWorkerAndRoutes(
              landingPage.workerScriptName, 
              domain.cloudflareZoneId
            );
            
            if (workerDeletionResult.workerDeleted) {
              console.log(`Successfully deleted worker: ${landingPage.workerScriptName}`);
              deletionResults.workerDeleted = true;
            } else {
              console.warn(`Failed to delete worker: ${landingPage.workerScriptName}`, workerDeletionResult.errors);
            }
            
            if (workerDeletionResult.routesDeleted > 0) {
              console.log(`Successfully deleted ${workerDeletionResult.routesDeleted} worker routes`);
            }
          } catch (workerError) {
            console.error('Error deleting Cloudflare Worker:', workerError);
            // Continue with landing page deletion even if worker deletion fails
          }
        }
        
        // Delete the landing page
        try {
          await LandingPage.findByIdAndDelete(id);
          deletionResults.landingPageDeleted = true;
          console.log(`Landing page ${id} deleted successfully`);
          
          // Add to success list
          results.success.push(id);
        } catch (dbError) {
          console.error('Error deleting landing page from database:', dbError);
          results.failed.push({
            id,
            reason: `Database error: ${(dbError as Error).message || 'Unknown error'}`
          });
        }
      } catch (error) {
        console.error(`Error processing landing page ${id}:`, error);
        results.failed.push({
          id,
          reason: (error as Error).message || 'Unknown error'
        });
      }
    }
    
    // Return results
    return NextResponse.json({
      results,
      message: `Processed ${ids.length} landing pages. ${results.success.length} succeeded, ${results.failed.length} failed.`
    });
    
  } catch (error) {
    console.error('Error bulk deleting landing pages:', error);
    return NextResponse.json(
      { error: 'Failed to process bulk delete', message: (error as Error).message },
      { status: 500 }
    );
  }
} 