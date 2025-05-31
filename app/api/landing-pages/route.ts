import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { LandingPage, ILandingPage } from '@/lib/models/LandingPage';
import { createDnsRecord } from '@/lib/cloudflare';
import { takeScreenshots } from '@/lib/screenshot';
import { addDomainAndSubdomainToVercel, addDomainToVercel } from '@/lib/vercel';
import mongoose from 'mongoose';

// Flag to check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';

// Mock data for development mode
const mockLandingPages = [
  {
    _id: 'mock-landing-page-1',
    name: 'Example Landing Page',
    domainId: {
      _id: 'mock-domain-1',
      name: 'example.com',
    },
    subdomain: 'landing',
    affiliateUrl: 'https://example.com/original',
    originalUrl: 'https://example.com/original',
    desktopScreenshotUrl: '/screenshots/mock_desktop.png',
    mobileScreenshotUrl: '/screenshots/mock_mobile.png',
    googleAdsAccountId: '123-456-7890',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Mark this route as dynamic to prevent static optimization issues
export const dynamic = 'force-dynamic';

// Set a longer timeout (30 seconds) for this API route
export const maxDuration = 30;

// GET /api/landing-pages - Get all landing pages
export async function GET() {
  try {
    const db = await connectToDatabase();
    
    // If we're in a mock database situation, return mock data
    if (isDevelopment && (!db || !db.connection || db.connection.readyState !== 1)) {
      console.log('Using mock landing pages data');
      return NextResponse.json(mockLandingPages);
    }
    
    const landingPages = await LandingPage.find()
      .populate('domainId', 'name')
      .sort({ createdAt: -1 });
    
    return NextResponse.json(landingPages);
  } catch (error) {
    console.error('Error fetching landing pages:', error);
    
    // If in development mode, return mock data on error
    if (isDevelopment) {
      console.log('Returning mock landing pages after error');
      return NextResponse.json(mockLandingPages);
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch landing pages' },
      { status: 500 }
    );
  }
}

// POST /api/landing-pages - Create a new landing page
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { 
      name, 
      domainId, 
      subdomain, 
      affiliateUrl, 
      originalUrl,
      manualScreenshots,
      desktopScreenshotUrl,
      mobileScreenshotUrl,
      templateType,
      phoneNumber,
      businessName
    } = body;
    
    // Validate required fields
    if (!name || !domainId) {
      return NextResponse.json(
        { error: 'Name and domain are required' },
        { status: 400 }
      );
    }

    // Validate template-specific fields
    if (templateType === 'call-ads') {
      if (!phoneNumber || !businessName) {
        return NextResponse.json(
          { error: 'Phone number and business name are required for call ads template' },
          { status: 400 }
        );
      }
    } else {
      // For standard template, affiliate URL is required
      if (!affiliateUrl) {
        return NextResponse.json(
          { error: 'Affiliate URL is required for standard template' },
          { status: 400 }
        );
      }
    }

    // For non-manual screenshots and non-call-ads templates, originalUrl is required
    if (!manualScreenshots && !originalUrl && templateType !== 'call-ads') {
      return NextResponse.json(
        { error: 'Original URL is required for automatic screenshots' },
        { status: 400 }
      );
    }
    
    // Set a placeholder originalUrl for manual screenshots or call-ads if none provided
    const effectiveOriginalUrl = originalUrl || (manualScreenshots || templateType === 'call-ads' ? 'https://manual-screenshots.example.com' : '');
    
    // Validate manual screenshots if provided (only for standard template)
    if (manualScreenshots && templateType === 'standard' && (!desktopScreenshotUrl || !mobileScreenshotUrl)) {
      return NextResponse.json(
        { error: 'Both desktop and mobile screenshots are required when using manual mode' },
        { status: 400 }
      );
    }
    
    // Check if domain exists and get its DNS management type
    const domain = await Domain.findById(domainId);
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }

    // For non-external domains, subdomain is required
    if (domain.dnsManagement !== 'external' && !subdomain) {
      return NextResponse.json(
        { error: 'Subdomain is required for non-external domains' },
        { status: 400 }
      );
    }
    
    // For external domains, skip Cloudflare and Vercel operations
    if (domain.dnsManagement === 'external') {
      console.log(`External domain detected: ${domain.name}. Adding domain to Vercel but skipping Cloudflare DNS operations.`);
      
      // For external domains, only allow one landing page per domain (no subdomain)
      const existingPage = await LandingPage.findOne({
        domainId,
      });
      
      if (existingPage) {
        return NextResponse.json(
          { error: 'External domain already has a landing page. Only one landing page per external domain is allowed.' },
          { status: 400 }
        );
      }
      
      // Add the external domain to Vercel so it can serve content for it
      console.log(`Adding external domain ${domain.name} to Vercel`);
      let vercelResult;
      try {
        vercelResult = await addDomainToVercel(domain.name);
        console.log(`External domain added to Vercel: ${domain.name}`);
      } catch (error: any) {
        // Try to extract a more helpful error message
        let errorMessage = 'Unknown error';
        if (error.message) {
          try {
            // Check if this is a JSON string error from the Vercel API
            if (error.message.includes('{"error":')) {
              const errorData = JSON.parse(error.message.substring(error.message.indexOf('{')));
              if (errorData.error && errorData.error.code === 'domain_already_in_use') {
                errorMessage = `Domain ${domain.name} is already in use by project ${errorData.error.projectId}. Please choose a different domain or use the existing domain configuration.`;
              } else {
                errorMessage = errorData.error?.message || errorData.error?.code || 'API error';
              }
            } else {
              errorMessage = error.message;
            }
          } catch (parseError) {
            errorMessage = error.message;
          }
        }
        
        console.error(`Error adding external domain to Vercel: ${domain.name}`, error);
        return NextResponse.json(
          { error: `Failed to add external domain to Vercel: ${errorMessage}` },
          { status: 500 }
        );
      }
      
      // Generate a temporary ID for the landing page (for screenshots)
      const tempId = new mongoose.Types.ObjectId().toString();
      
      // Either use the provided manual screenshots or take new ones automatically
      let screenshotResult: { desktopUrl: string; mobileUrl: string };
      
      if (templateType === 'call-ads') {
        // For call-ads template, no screenshots are needed
        console.log('Call ads template - no screenshots needed');
        screenshotResult = {
          desktopUrl: '',
          mobileUrl: ''
        };
      } else if (manualScreenshots && desktopScreenshotUrl && mobileScreenshotUrl) {
        console.log('Using manually uploaded screenshots');
        screenshotResult = {
          desktopUrl: desktopScreenshotUrl,
          mobileUrl: mobileScreenshotUrl
        };
      } else {
        // Take screenshots of the original URL
        console.log('Taking automated screenshots');
        const effectiveOriginalUrl = originalUrl || 'https://manual-screenshots.example.com';
        screenshotResult = await takeScreenshots(effectiveOriginalUrl, tempId);
      }
      
      // Create the landing page for external domain
      const landingPage = await LandingPage.create({
        name,
        domainId,
        subdomain: '', // Empty subdomain for external domains
        affiliateUrl: affiliateUrl || (templateType === 'call-ads' ? 'https://verification-placeholder.example.com' : ''),
        originalUrl: originalUrl || (manualScreenshots || templateType === 'call-ads' ? 'https://manual-screenshots.example.com' : ''),
        desktopScreenshotUrl: screenshotResult.desktopUrl,
        mobileScreenshotUrl: screenshotResult.mobileUrl,
        isActive: true,
        manualScreenshots: manualScreenshots || false,
        templateType: templateType || 'standard',
        phoneNumber: templateType === 'call-ads' ? phoneNumber : undefined,
        businessName: templateType === 'call-ads' ? businessName : undefined,
      });
      
      return NextResponse.json({
        ...landingPage.toJSON(),
        vercelStatus: vercelResult ? 'domain_added' : 'failed',
        fullDomain: domain.name,
        dnsConfiguration: {
          message: 'External domain - DNS managed externally',
          requiredRecord: `CNAME ${domain.name} → cname.vercel-dns.com`,
          vercelStatus: vercelResult ? 'added' : 'failed'
        },
        message: `Landing page created for external domain ${domain.name}. Domain added to Vercel. Make sure DNS record is configured: CNAME ${domain.name} → cname.vercel-dns.com`,
      }, { status: 201 });
    }
    
    // For regular domains, continue with original logic
    // Check if the domain has a cloudflareZoneId
    if (!domain.cloudflareZoneId) {
      console.warn(`Domain ${domain.name} does not have a Cloudflare Zone ID. Using default zone.`);
      
      // If no zone ID exists for this domain, we can't create the DNS record
      return NextResponse.json(
        { error: 'Domain is not properly configured with Cloudflare. Please update domain settings first.' },
        { status: 400 }
      );
    } else {
      console.log(`Using domain-specific zone ID for ${domain.name}: ${domain.cloudflareZoneId}`);
    }
    
    // Check if subdomain is already in use for this domain
    const existingPage = await LandingPage.findOne({
      domainId,
      subdomain,
    });
    
    if (existingPage) {
      return NextResponse.json(
        { error: 'Subdomain already in use for this domain' },
        { status: 400 }
      );
    }
    
    // Add the subdomain to Vercel (skipping the root domain)
    console.log(`Adding subdomain ${subdomain}.${domain.name} to Vercel (skipping root domain)`);
    let vercelResult;
    try {
      vercelResult = await addDomainAndSubdomainToVercel(domain.name, subdomain, false);
      console.log(`Subdomain added to Vercel: ${subdomain}.${domain.name}`);
    } catch (error: any) {
      // Try to extract a more helpful error message
      let errorMessage = 'Unknown error';
      if (error.message) {
        try {
          // Check if this is a JSON string error from the Vercel API
          if (error.message.includes('{"error":')) {
            const errorData = JSON.parse(error.message.substring(error.message.indexOf('{')));
            if (errorData.error && errorData.error.code === 'domain_already_in_use') {
              errorMessage = `Domain ${domain.name} is already in use by project ${errorData.error.projectId}. Please choose a different domain or use the existing domain configuration.`;
            } else {
              errorMessage = errorData.error?.message || errorData.error?.code || 'API error';
            }
          } else {
            errorMessage = error.message;
          }
        } catch (parseError) {
          errorMessage = error.message;
        }
      }
      
      console.error(`Error adding subdomain to Vercel: ${domain.name}/${subdomain}`, error);
      return NextResponse.json(
        { error: `Failed to add subdomain to Vercel: ${errorMessage}` },
        { status: 500 }
      );
    }
    
    // Extract the required DNS record information
    const subdomainDnsRecords = vercelResult.dnsRecords?.subdomain || [];
    
    // Get the Vercel DNS target - default to cname.vercel-dns.com if not provided
    let vercelDnsTarget = 'cname.vercel-dns.com';
    const cnameRecord = subdomainDnsRecords.find((record: { type: string; value?: string }) => record.type === 'CNAME');
    if (cnameRecord && cnameRecord.value) {
      vercelDnsTarget = cnameRecord.value;
    }
    
    // Create DNS record in Cloudflare using Vercel's recommended value
    console.log(`Creating DNS record in Cloudflare for ${subdomain}.${domain.name} pointing to ${vercelDnsTarget}`);
    await createDnsRecord(subdomain, domain.name, 'CNAME', vercelDnsTarget, domain.cloudflareZoneId);
    
    // Generate a temporary ID for the landing page (for screenshots)
    const tempId = new mongoose.Types.ObjectId().toString();
    
    // Either use the provided manual screenshots or take new ones automatically
    let screenshotResult: { desktopUrl: string; mobileUrl: string };
    
    if (templateType === 'call-ads') {
      // For call-ads template, no screenshots are needed
      console.log('Call ads template - no screenshots needed');
      screenshotResult = {
        desktopUrl: '',
        mobileUrl: ''
      };
    } else if (manualScreenshots && desktopScreenshotUrl && mobileScreenshotUrl) {
      console.log('Using manually uploaded screenshots');
      screenshotResult = {
        desktopUrl: desktopScreenshotUrl,
        mobileUrl: mobileScreenshotUrl
      };
    } else {
      // Take screenshots of the original URL
      console.log('Taking automated screenshots');
      const effectiveOriginalUrl = originalUrl || 'https://manual-screenshots.example.com';
      screenshotResult = await takeScreenshots(effectiveOriginalUrl, tempId);
    }
    
    // Create the landing page
    const landingPage = await LandingPage.create({
      name,
      domainId,
      subdomain,
      affiliateUrl: affiliateUrl || (templateType === 'call-ads' ? 'https://verification-placeholder.example.com' : ''),
      originalUrl: effectiveOriginalUrl,
      desktopScreenshotUrl: screenshotResult.desktopUrl,
      mobileScreenshotUrl: screenshotResult.mobileUrl,
      isActive: true,
      manualScreenshots: manualScreenshots || false,
      templateType: templateType || 'standard',
      phoneNumber: templateType === 'call-ads' ? phoneNumber : undefined,
      businessName: templateType === 'call-ads' ? businessName : undefined,
    });
    
    // Return comprehensive information about the setup
    return NextResponse.json({
      ...landingPage.toJSON(),
      vercelStatus: vercelResult ? 'subdomain_added' : 'failed',
      fullDomain: `${subdomain}.${domain.name}`,
      dnsConfiguration: {
        target: vercelDnsTarget,
        type: 'CNAME',
        proxied: false
      },
      message: `Landing page created with subdomain ${subdomain}.${domain.name}. DNS record created pointing to ${vercelDnsTarget}. It may take a few minutes for DNS to propagate.`,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating landing page:', error);
    return NextResponse.json(
      { error: 'Failed to create landing page' },
      { status: 500 }
    );
  }
} 