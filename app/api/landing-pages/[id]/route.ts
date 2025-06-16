import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { LandingPage } from '@/lib/models/LandingPage';
import { Domain } from '@/lib/models/Domain';
import { getDnsRecords, deleteDnsRecord, deleteWorkerAndRoutes } from '@/lib/cloudflare';
import { deleteFromVercelBlob } from '@/lib/vercelBlobStorage';
import { deleteDomainFromVercel } from '@/lib/vercel';

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
      vercelDomainDeleted: false,
      screenshotsDeleted: false,
      workerDeleted: false,
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

// PUT /api/landing-pages/[id] - Update landing page or fix cloaking DNS
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { action } = body;
    
    // Handle different actions
    if (action === 'fix-cloaking-dns') {
      // Fix cloaking DNS records for this landing page
      const landingPage = await LandingPage.findById(params.id).populate('domainId');
      
      if (!landingPage) {
        return NextResponse.json({ error: 'Landing page not found' }, { status: 404 });
      }
      
      if (landingPage.templateType !== 'cloaked') {
        return NextResponse.json({ error: 'This is not a cloaked landing page' }, { status: 400 });
      }
      
      const domain = landingPage.domainId as any;
      
      if (!domain.cloudflareZoneId) {
        return NextResponse.json({ error: 'Domain does not have Cloudflare Zone ID' }, { status: 400 });
      }
      
      // Import the fix function
      const { fixCloakingDnsRecords } = await import('@/lib/cloudflare');
      
      const fixResult = await fixCloakingDnsRecords(
        domain.name,
        landingPage.subdomain,
        domain.cloudflareZoneId
      );
      
      return NextResponse.json({
        success: fixResult.success,
        message: fixResult.message,
        results: fixResult.results,
        landingPageId: landingPage._id,
        domain: domain.name,
        subdomain: landingPage.subdomain
      });
    }

    if (action === 're-deploy-cloaked') {
      // Re-deploy cloaked landing page with latest code
      const landingPage = await LandingPage.findById(params.id).populate('domainId');
      
      if (!landingPage) {
        return NextResponse.json({ error: 'Landing page not found' }, { status: 404 });
      }
      
      if (landingPage.templateType !== 'cloaked') {
        return NextResponse.json({ error: 'This is not a cloaked landing page' }, { status: 400 });
      }
      
      const domain = landingPage.domainId as any;
      
      if (!domain.cloudflareZoneId) {
        return NextResponse.json({ error: 'Domain does not have Cloudflare Zone ID' }, { status: 400 });
      }
      
      try {
        // Use existing worker script name or generate new one
        const scriptName = landingPage.workerScriptName || `cloak_${domain.name.replace(/\./g, '_')}_${landingPage.subdomain || 'root'}_${new Date().getTime()}`;
        
        // Determine safe URL
        const safeUrl = landingPage.subdomain && domain.dnsManagement !== 'external' 
          ? `https://${landingPage.subdomain}.${domain.name}`
          : `https://${domain.name}`;
        
        // Use white page URL if available, otherwise fall back to safe URL
        const whitePageUrl = body.whitePageUrl || undefined;
        
        // Import Cloudflare functions dynamically
        const cloudflareModule = await import('@/lib/cloudflare');
        const { generateJciWorkerScript } = cloudflareModule;
        
        // Generate updated worker script with latest code
        const workerScript = generateJciWorkerScript({
          safeUrl,
          moneyUrl: landingPage.moneyUrl!,
          whitePageUrl,
          targetCountries: landingPage.targetCountries!,
          excludeCountries: landingPage.excludeCountries || []
        });
        
        // For re-deployment, we'll use the Cloudflare API directly
        const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
        const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
        
        if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
          throw new Error('Cloudflare API credentials not configured');
        }
        
        // Update the worker script directly
        const workerResult = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${scriptName}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/javascript',
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          },
          body: JSON.stringify({
            script: workerScript,
            bindings: [{
              name: 'TRAFFIC_LOGS',
              type: 'kv_namespace',
              namespace_id: '0b5157572fe24cc092500d70954ab67e'
            }]
          })
        }).then(r => r.json());
        
        if (!workerResult.success) {
          throw new Error(`Failed to deploy worker: ${JSON.stringify(workerResult.errors)}`);
        }
        
        // Update landing page record if we created a new worker
        if (!landingPage.workerScriptName) {
          landingPage.workerScriptName = scriptName;
          await landingPage.save();
        }
        
        return NextResponse.json({
          success: true,
          message: `Cloaked landing page re-deployed successfully! Worker script updated with latest code.`,
          workerScriptName: landingPage.workerScriptName,
          safeUrl,
          landingPageId: landingPage._id,
          domain: domain.name,
          subdomain: landingPage.subdomain
        });
        
      } catch (error) {
        console.error('Error re-deploying cloaked page:', error);
        return NextResponse.json({
          success: false,
          message: `Failed to re-deploy: ${error instanceof Error ? error.message : 'Unknown error'}`
        }, { status: 500 });
      }
    }
    
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    
  } catch (error) {
    console.error('Error in PUT /api/landing-pages/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 