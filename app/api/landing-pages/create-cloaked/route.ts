import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { LandingPage } from '@/lib/models/LandingPage';
import { Domain } from '@/lib/models/Domain';
import { createCloakedLandingPage, createDnsRecord } from '@/lib/cloudflare';
import { addDomainToVercel, addDomainAndSubdomainToVercel } from '@/lib/vercel';

// POST /api/landing-pages/create-cloaked
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { 
      name, 
      domainId, 
      subdomain, 
      moneyUrl,
      whitePageUrl,
      targetCountries,
      excludeCountries = []
    } = body;
    
    if (!name || !domainId || !moneyUrl || !whitePageUrl || !targetCountries || !Array.isArray(targetCountries) || targetCountries.length === 0) {
      return NextResponse.json({ error: 'Missing required fields: name, domainId, moneyUrl, whitePageUrl, and targetCountries are required' }, { status: 400 });
    }
    
    // Validate and get domain
    const domain = await Domain.findById(domainId);
    if (!domain) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }
    
    if (!domain.isActive) {
      return NextResponse.json({ error: 'Domain is not active' }, { status: 400 });
    }
    
    // Check if domain already has a landing page
    const existingLandingPage = await LandingPage.findOne({ domainId });
    if (existingLandingPage) {
      return NextResponse.json({ error: 'Domain already has a landing page deployed' }, { status: 400 });
    }
    
    // Determine if this is an external domain
    const isExternal = domain.dnsManagement === 'external';
    let finalSubdomain = '';
    
    if (!isExternal) {
      // For regular domains, subdomain is required
      if (!subdomain) {
        return NextResponse.json({ error: 'Subdomain is required for regular domains' }, { status: 400 });
      }
      finalSubdomain = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');
      
      // Check if subdomain is already in use for this domain
      const existingPage = await LandingPage.findOne({
        domainId,
        subdomain: finalSubdomain,
      });
      
      if (existingPage) {
        return NextResponse.json(
          { error: 'Subdomain already in use for this domain' },
          { status: 400 }
        );
      }
    }
    
    // No fallback safe page content - whitePageUrl is required
    
    // Step 1: Create and save the landing page record first
    const landingPage = new LandingPage({
      name,
      domainId: domain._id,
      subdomain: finalSubdomain,
      originalUrl: 'https://placeholder.example.com',
      desktopScreenshotUrl: '',
      mobileScreenshotUrl: '',
      isActive: true,
      templateType: 'cloaked',
      moneyUrl,
      targetCountries,
      excludeCountries,
      safePageContent: '', // No fallback content - requires whitePageUrl
      safeUrl: whitePageUrl // Store the original safe URL for re-deployments
    });
    
    try {
      await landingPage.save();
      console.log(`Cloaked landing page record created: ${landingPage._id}`);
      
      // Handle external domains (like regular landing pages do)
      if (isExternal) {
        console.log(`External domain detected: ${domain.name}. Adding domain to Vercel but skipping Cloudflare DNS operations.`);
        
        const safePageDomain = domain.name;
        
        try {
          // Add the external domain to Vercel
          console.log(`Adding external domain ${domain.name} to Vercel for safe page`);
          const vercelResult = await addDomainToVercel(domain.name);
          console.log(`External domain ${domain.name} added to Vercel successfully`);
          
          // Wait a moment for the domain to be configured
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          return NextResponse.json({
            success: true,
            landingPage: {
              _id: landingPage._id,
              name: landingPage.name,
              domain: domain.name,
              subdomain: '',
              fullDomain: safePageDomain,
              moneyUrl,
              targetCountries,
              excludeCountries
            },
            vercelStatus: vercelResult ? 'domain_added' : 'failed',
            dnsConfiguration: {
              message: 'External domain - DNS managed externally',
              requiredRecord: `CNAME ${domain.name} → cname.vercel-dns.com`,
              vercelStatus: vercelResult ? 'added' : 'failed'
            },
            message: `Cloaked landing page created for external domain ${domain.name}. Domain added to Vercel. Make sure DNS record is configured: CNAME ${domain.name} → cname.vercel-dns.com. Note: Cloudflare Workers cloaking will not work for external domains.`,
            warning: 'External domains cannot use Cloudflare Workers for cloaking. Only the safe page will be served.'
          });
          
        } catch (vercelError) {
          console.error('Vercel deployment error for external domain:', vercelError);
          return NextResponse.json({
            success: false,
            error: `Failed to add external domain to Vercel: ${vercelError instanceof Error ? vercelError.message : 'Unknown error'}`
          }, { status: 500 });
        }
      }
      
      // For regular domains, continue with Cloudflare-managed flow
      if (!domain.cloudflareZoneId) {
        return NextResponse.json(
          { error: 'Domain is not properly configured with Cloudflare. Please update domain settings first.' },
          { status: 400 }
        );
      }
      
      const safePageDomain = `${finalSubdomain}.${domain.name}`;
      
      // Step 2: Add subdomain to Vercel and create DNS records (same as regular landing pages)
      try {
        console.log(`Adding subdomain ${finalSubdomain}.${domain.name} to Vercel for safe page`);
        const vercelResult = await addDomainAndSubdomainToVercel(domain.name, finalSubdomain, false);
        console.log(`Subdomain added to Vercel: ${finalSubdomain}.${domain.name}`);
        
        // Extract the required DNS record information
        const subdomainDnsRecords = vercelResult.dnsRecords?.subdomain || [];
        
        // Get the Vercel DNS target - default to cname.vercel-dns.com if not provided
        let vercelDnsTarget = 'cname.vercel-dns.com';
        const cnameRecord = subdomainDnsRecords.find((record: { type: string; value?: string }) => record.type === 'CNAME');
        if (cnameRecord && cnameRecord.value) {
          vercelDnsTarget = cnameRecord.value;
        }
        
        // Create DNS record in Cloudflare using Vercel's recommended value
        console.log(`Creating DNS record in Cloudflare for ${finalSubdomain}.${domain.name} pointing to ${vercelDnsTarget}`);
        await createDnsRecord(finalSubdomain, domain.name, 'CNAME', vercelDnsTarget, domain.cloudflareZoneId, false, true);
        console.log(`DNS record created successfully for ${finalSubdomain}.${domain.name} (proxied for worker routing)`);
        
        // Wait a moment for DNS to propagate
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (vercelError) {
        console.error('Vercel deployment error:', vercelError);
        // Continue with worker creation even if Vercel deployment fails
      }
      
      // Step 3: Create Cloudflare Worker with cloaking logic (only for Cloudflare-managed domains)
      try {
        const cloakResult = await createCloakedLandingPage({
          domain,
          subdomain: finalSubdomain,
          moneyUrl,
          whitePageUrl,
          targetCountries,
          excludeCountries,
          safePageContent: '' // No fallback content - requires whitePageUrl
        });
        
        // Update landing page with worker details
        landingPage.workerScriptName = cloakResult.workerScriptName;
        landingPage.workerRouteId = cloakResult.workerRouteId;
        await landingPage.save();
        
        console.log(`Cloaked landing page deployed successfully: ${cloakResult.message}`);
        
        return NextResponse.json({
          success: true,
          landingPage: {
            _id: landingPage._id,
            name: landingPage.name,
            domain: domain.name,
            subdomain: finalSubdomain,
            fullDomain: safePageDomain,
            moneyUrl,
            targetCountries,
            excludeCountries,
            workerScriptName: cloakResult.workerScriptName,
            workerRouteId: cloakResult.workerRouteId,
            safeUrl: cloakResult.safeUrl,
            routePattern: cloakResult.routePattern
          },
          vercelStatus: 'subdomain_added',
          dnsConfiguration: {
            target: 'cname.vercel-dns.com',
            type: 'CNAME',
            proxied: false
          },
          message: `Cloaked landing page created successfully! Visit https://${safePageDomain} to test. DNS record created and Cloudflare Worker deployed for cloaking functionality.`
        });
        
      } catch (workerError) {
        console.error('Cloudflare Worker creation error:', workerError);
        const errorMessage = workerError instanceof Error ? workerError.message : 'Unknown error';
        
        // If worker creation fails, still return success for the Vercel deployment
        return NextResponse.json({
          success: true,
          landingPage: {
            _id: landingPage._id,
            name: landingPage.name,
            domain: domain.name,
            subdomain: finalSubdomain,
            fullDomain: safePageDomain,
            moneyUrl,
            targetCountries,
            excludeCountries
          },
          vercelStatus: 'subdomain_added',
          dnsConfiguration: {
            target: 'cname.vercel-dns.com',
            type: 'CNAME',
            proxied: false
          },
          message: `Landing page record created and safe page deployed to Vercel with DNS record. Worker creation failed: ${errorMessage}`,
          warning: 'Cloudflare Worker creation failed. The landing page is deployed but without cloaking functionality.'
        });
      }
      
    } catch (error) {
      console.error('Error creating cloaked landing page:', error);
      
      // If we created the landing page record but deployment failed, clean up
      try {
        await LandingPage.findByIdAndDelete(landingPage._id);
      } catch (cleanupError) {
        console.error('Error cleaning up landing page record:', cleanupError);
      }
      
      throw error;
    }
    
  } catch (error) {
    console.error('Error in cloaked landing page creation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create cloaked landing page' }, 
      { status: 500 }
    );
  }
} 