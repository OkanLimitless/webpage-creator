import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { LandingPage, ILandingPage } from '@/lib/models/LandingPage';
import { createDnsRecord } from '@/lib/cloudflare';
import { takeScreenshots } from '@/lib/screenshot';
import { addDomainAndSubdomainToVercel } from '@/lib/vercel';
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
      mobileScreenshotUrl
    } = body;
    
    // Validate required fields
    if (!name || !domainId || !subdomain || !affiliateUrl || !originalUrl) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }
    
    // Validate manual screenshots if provided
    if (manualScreenshots && (!desktopScreenshotUrl || !mobileScreenshotUrl)) {
      return NextResponse.json(
        { error: 'Both desktop and mobile screenshots are required when using manual mode' },
        { status: 400 }
      );
    }
    
    // Check if domain exists
    const domain = await Domain.findById(domainId);
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }
    
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
    
    if (manualScreenshots && desktopScreenshotUrl && mobileScreenshotUrl) {
      console.log('Using manually uploaded screenshots');
      screenshotResult = {
        desktopUrl: desktopScreenshotUrl,
        mobileUrl: mobileScreenshotUrl
      };
    } else {
      // Take screenshots of the original URL
      console.log('Taking automated screenshots');
      screenshotResult = await takeScreenshots(originalUrl, tempId);
    }
    
    // Create the landing page
    const landingPage = await LandingPage.create({
      name,
      domainId,
      subdomain,
      affiliateUrl,
      originalUrl,
      desktopScreenshotUrl: screenshotResult.desktopUrl,
      mobileScreenshotUrl: screenshotResult.mobileUrl,
      isActive: true,
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