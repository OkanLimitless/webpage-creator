import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { LandingPage } from '@/lib/models/LandingPage';
import { Domain } from '@/lib/models/Domain';
import { addDomainToVercel } from '@/lib/vercel';
import { takeScreenshots } from '@/lib/screenshot';

// Set a reasonable timeout for the function
export const maxDuration = 60; // 60 seconds

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { 
      name, 
      domainIds, 
      subdomain, 
      affiliateUrl, 
      originalUrl,
      manualScreenshots,
      desktopScreenshotUrl,
      mobileScreenshotUrl
    } = body;

    // Validate required fields
    if (!name || !domainIds || !Array.isArray(domainIds) || domainIds.length === 0 || !affiliateUrl) {
      return NextResponse.json(
        { error: 'Name, domain IDs array, and affiliate URL are required' },
        { status: 400 }
      );
    }

    // Validate that we have either originalUrl (for automatic) or both screenshot URLs (for manual)
    if (!manualScreenshots && !originalUrl) {
      return NextResponse.json(
        { error: 'Original URL is required for automatic screenshots' },
        { status: 400 }
      );
    }

    if (manualScreenshots && (!desktopScreenshotUrl || !mobileScreenshotUrl)) {
      return NextResponse.json(
        { error: 'Both desktop and mobile screenshot URLs are required for manual screenshots' },
        { status: 400 }
      );
    }

    // Fetch all domains to validate they exist and are eligible
    const domains = await Domain.find({ _id: { $in: domainIds } });
    
    if (domains.length !== domainIds.length) {
      return NextResponse.json(
        { error: 'One or more domains not found' },
        { status: 404 }
      );
    }

    // Validate all domains are eligible (verified and no landing pages)
    const ineligibleDomains = domains.filter(domain => {
      const isVerified = domain.verificationStatus === 'active' || 
                        (domain.dnsManagement === 'external' && domain.verificationStatus === 'verified');
      const hasNoLandingPages = (domain.landingPageCount || 0) === 0;
      return !isVerified || !hasNoLandingPages;
    });

    if (ineligibleDomains.length > 0) {
      return NextResponse.json(
        { 
          error: 'Some domains are not eligible for landing page creation',
          ineligibleDomains: ineligibleDomains.map(d => ({
            name: d.name,
            reason: d.verificationStatus !== 'active' && !(d.dnsManagement === 'external' && d.verificationStatus === 'verified')
              ? 'Not verified'
              : 'Already has landing pages'
          }))
        },
        { status: 400 }
      );
    }

    const results = {
      success: [] as string[],
      failed: [] as { domain: string, reason: string }[]
    };

    // Process domains in parallel with a concurrency limit to avoid overwhelming the system
    const BATCH_SIZE = 3; // Process 3 domains at a time
    const batches = [];
    
    for (let i = 0; i < domains.length; i += BATCH_SIZE) {
      batches.push(domains.slice(i, i + BATCH_SIZE));
    }

    // Process each batch sequentially, but domains within each batch in parallel
    for (const batch of batches) {
      const batchPromises = batch.map(async (domain) => {
        try {
          const isExternal = domain.dnsManagement === 'external';
          const finalSubdomain = isExternal ? '' : subdomain;
          
          // For external domains, subdomain should be empty, for regular domains it's required
          if (!isExternal && !subdomain) {
            return {
              success: false,
              domain: domain.name,
              reason: 'Subdomain is required for regular domains'
            };
          }

          let finalDesktopUrl = desktopScreenshotUrl;
          let finalMobileUrl = mobileScreenshotUrl;

          // Take screenshots if not using manual mode
          if (!manualScreenshots && originalUrl) {
            try {
              // Add timeout for screenshot capture
              const screenshotPromise = takeScreenshots(originalUrl, domain._id.toString());
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Screenshot timeout')), 30000) // 30 second timeout
              );
              
              const screenshots = await Promise.race([screenshotPromise, timeoutPromise]) as any;
              finalDesktopUrl = screenshots.desktopUrl;
              finalMobileUrl = screenshots.mobileUrl;
            } catch (screenshotError) {
              console.error(`Screenshot error for ${domain.name}:`, screenshotError);
              return {
                success: false,
                domain: domain.name,
                reason: 'Failed to capture screenshots'
              };
            }
          }

          // Create the landing page
          const landingPage = new LandingPage({
            name,
            domainId: domain._id,
            subdomain: finalSubdomain,
            affiliateUrl,
            originalUrl: originalUrl || '',
            desktopScreenshotUrl: finalDesktopUrl,
            mobileScreenshotUrl: finalMobileUrl,
            isActive: true,
            banCount: 0
          });

          await landingPage.save();

          // Add domain to Vercel (don't fail the entire operation if this fails)
          try {
            const fullDomain = isExternal ? domain.name : `${finalSubdomain}.${domain.name}`;
            await addDomainToVercel(fullDomain);
          } catch (vercelError) {
            console.error(`Vercel error for ${domain.name}:`, vercelError);
            // Continue anyway - Vercel errors shouldn't fail the landing page creation
          }

          // Update domain's landing page count
          await Domain.findByIdAndUpdate(domain._id, {
            $inc: { landingPageCount: 1 }
          });

          return {
            success: true,
            domain: domain.name
          };

        } catch (error) {
          console.error(`Error creating landing page for ${domain.name}:`, error);
          return {
            success: false,
            domain: domain.name,
            reason: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      // Wait for the current batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Process results
      batchResults.forEach(result => {
        if (result.success) {
          results.success.push(result.domain);
        } else {
          results.failed.push({
            domain: result.domain,
            reason: result.reason || 'Unknown error'
          });
        }
      });
    }

    return NextResponse.json({
      message: `Bulk creation completed. ${results.success.length} successful, ${results.failed.length} failed.`,
      results
    });

  } catch (error) {
    console.error('Bulk landing page creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create landing pages' },
      { status: 500 }
    );
  }
} 