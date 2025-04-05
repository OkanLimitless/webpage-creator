import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { RootPage, IRootPage } from '@/lib/models/RootPage';

// Mark this route as dynamic to prevent static optimization issues
export const dynamic = 'force-dynamic';

// GET /api/root-pages - Get all root pages
export async function GET() {
  try {
    await connectToDatabase();
    
    const rootPages = await RootPage.find()
      .populate('domainId', 'name')
      .sort({ createdAt: -1 });
    
    return NextResponse.json(rootPages);
  } catch (error) {
    console.error('Error fetching root pages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch root pages' },
      { status: 500 }
    );
  }
}

// POST /api/root-pages - Create a new root page
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { 
      domainId, 
      title, 
      description, 
      heroTitle, 
      heroSubtitle, 
      heroImageUrl, 
      heroButtonText, 
      heroButtonUrl,
      features, 
      testimonials,
      contactTitle,
      contactEmail,
      contactPhone,
      contactAddress,
      companyName,
      privacyPolicyUrl,
      termsUrl,
      primaryColor,
      logoUrl
    } = body;
    
    // Validate required fields
    if (!domainId || !title || !description || !heroTitle || !heroSubtitle || !features || features.length === 0) {
      return NextResponse.json(
        { error: 'Required fields are missing' },
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
    
    // Check if a root page already exists for this domain
    const existingRootPage = await RootPage.findOne({ domainId });
    if (existingRootPage) {
      return NextResponse.json(
        { error: 'A root page already exists for this domain' },
        { status: 400 }
      );
    }
    
    // Create the root page
    const rootPage = await RootPage.create({
      domainId,
      title,
      description,
      heroTitle,
      heroSubtitle,
      heroImageUrl,
      heroButtonText,
      heroButtonUrl,
      features: features || [],
      testimonials: testimonials || [],
      contactTitle,
      contactEmail,
      contactPhone,
      contactAddress,
      companyName,
      privacyPolicyUrl,
      termsUrl,
      primaryColor,
      logoUrl,
      isActive: true
    });
    
    return NextResponse.json({
      ...rootPage.toJSON(),
      message: 'Root page created successfully.',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating root page:', error);
    return NextResponse.json(
      { error: 'Failed to create root page' },
      { status: 500 }
    );
  }
} 