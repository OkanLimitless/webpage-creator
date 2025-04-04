import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { LandingPage, ILandingPage } from '@/lib/models/LandingPage';
import { createDnsRecord } from '@/lib/cloudflare';
import { takeScreenshots } from '@/lib/screenshot';
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
    affiliateUrl: 'https://example.com/affiliate',
    originalUrl: 'https://example.com/original',
    desktopScreenshotUrl: '/screenshots/mock_desktop.png',
    mobileScreenshotUrl: '/screenshots/mock_mobile.png',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

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
    const { name, domainId, subdomain, affiliateUrl, originalUrl } = body;
    
    // Validate required fields
    if (!name || !domainId || !subdomain || !affiliateUrl || !originalUrl) {
      return NextResponse.json(
        { error: 'All fields are required' },
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
    
    // Create DNS record in Cloudflare
    await createDnsRecord(subdomain, domain.name, 'CNAME', 'alias.vercel.com', domain.cloudflareZoneId);
    
    // Generate a temporary ID for the landing page (for screenshots)
    const tempId = new mongoose.Types.ObjectId().toString();
    
    // Take screenshots of the original URL
    const screenshotResult = await takeScreenshots(originalUrl, tempId);
    
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
    
    return NextResponse.json(landingPage, { status: 201 });
  } catch (error) {
    console.error('Error creating landing page:', error);
    return NextResponse.json(
      { error: 'Failed to create landing page' },
      { status: 500 }
    );
  }
} 