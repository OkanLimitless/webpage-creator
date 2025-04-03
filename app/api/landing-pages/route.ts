import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { LandingPage, ILandingPage } from '@/lib/models/LandingPage';
import { createDnsRecord } from '@/lib/cloudflare';
import { takeScreenshots } from '@/lib/screenshot';
import mongoose from 'mongoose';

// GET /api/landing-pages - Get all landing pages
export async function GET() {
  try {
    await connectToDatabase();
    const landingPages = await LandingPage.find()
      .populate('domainId', 'name')
      .sort({ createdAt: -1 });
    
    return NextResponse.json(landingPages);
  } catch (error) {
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
    await createDnsRecord(subdomain, domain.name);
    
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