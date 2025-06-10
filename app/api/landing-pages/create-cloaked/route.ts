import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { LandingPage } from '@/lib/models/LandingPage';
import { Domain } from '@/lib/models/Domain';
import { createCloakedLandingPage, generateComingSoonPage } from '@/lib/cloudflare';
import { addDomainToVercel } from '@/lib/vercel';

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
      targetCountries,
      excludeCountries = []
    } = body;
    
    if (!name || !domainId || !moneyUrl || !targetCountries || !Array.isArray(targetCountries) || targetCountries.length === 0) {
      return NextResponse.json({ error: 'Missing required fields: name, domainId, moneyUrl, and targetCountries are required' }, { status: 400 });
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
    }
    
    // Generate safe page HTML content
    const safePageContent = generateComingSoonPage();
    
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
      safePageContent
    });
    
    try {
      await landingPage.save();
      console.log(`Cloaked landing page record created: ${landingPage._id}`);
      
      // Step 2: Deploy safe page to Vercel first
      const safePageDomain = isExternal ? domain.name : `${finalSubdomain}.${domain.name}`;
      
      try {
        // Add domain to Vercel
        if (isExternal) {
          console.log(`Adding external domain ${domain.name} to Vercel for safe page`);
          await addDomainToVercel(domain.name);
        } else {
          console.log(`Adding subdomain ${finalSubdomain}.${domain.name} to Vercel for safe page`);
          await addDomainToVercel(`${finalSubdomain}.${domain.name}`);
        }
        
        console.log(`Safe page domain added to Vercel: https://${safePageDomain}`);
        
        // Wait a moment for the domain to be configured
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (vercelError) {
        console.error('Vercel deployment error:', vercelError);
        // Continue with worker creation even if Vercel deployment fails
      }
      
      // Step 3: Create Cloudflare Worker with cloaking logic
      try {
        const cloakResult = await createCloakedLandingPage({
          domain,
          subdomain: finalSubdomain,
          moneyUrl,
          targetCountries,
          excludeCountries,
          safePageContent
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
          message: `Cloaked landing page created successfully! Visit https://${safePageDomain} to test.`
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
          message: `Landing page record created and safe page deployed to Vercel. Worker creation failed: ${errorMessage}`,
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