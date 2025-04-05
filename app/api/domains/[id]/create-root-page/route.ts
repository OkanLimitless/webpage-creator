import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { RootPage } from '@/lib/models/RootPage';

interface Params {
  params: {
    id: string;
  };
}

// Mark this route as dynamic to prevent static optimization issues
export const dynamic = 'force-dynamic';

// POST /api/domains/[id]/create-root-page - Create a default root page for a domain
export async function POST(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    // Find the domain
    const domain = await Domain.findById(params.id);
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }
    
    // Check if a root page already exists for this domain
    const existingRootPage = await RootPage.findOne({ domainId: domain._id });
    if (existingRootPage) {
      return NextResponse.json(
        { error: 'A root page already exists for this domain', rootPageId: existingRootPage._id },
        { status: 400 }
      );
    }
    
    // Get parameters from request body (if any) or use defaults
    const body = await request.json().catch(() => ({}));
    const { companyName, primaryColor } = body;
    
    // Create default features
    const defaultFeatures = [
      {
        title: 'High Quality',
        description: 'We pride ourselves on delivering products and services of the highest quality.',
        iconName: 'star'
      },
      {
        title: 'Excellent Support',
        description: 'Our support team is available 24/7 to assist you with any questions or concerns.',
        iconName: 'chat'
      },
      {
        title: 'Secure & Reliable',
        description: 'Your security is our priority. We use the latest technology to protect your data.',
        iconName: 'shield'
      }
    ];
    
    // Create a default testimonial
    const defaultTestimonials = [
      {
        name: 'John Smith',
        role: 'Satisfied Customer',
        comment: 'I\'ve been using this service for months and I\'m extremely satisfied with the results.',
      }
    ];
    
    // Create the root page with default values
    const rootPage = await RootPage.create({
      domainId: domain._id,
      title: `${domain.name} - Official Website`,
      description: `Welcome to the official website of ${companyName || domain.name}`,
      isActive: true,
      
      // Hero section
      heroTitle: `Welcome to ${companyName || domain.name}`,
      heroSubtitle: 'Providing quality products and services to meet your needs',
      heroButtonText: 'Learn More',
      heroButtonUrl: '#features',
      
      // Features
      features: defaultFeatures,
      
      // Testimonials
      testimonials: defaultTestimonials,
      
      // Contact info
      contactTitle: 'Get In Touch',
      contactEmail: `info@${domain.name}`,
      
      // Company info
      companyName: companyName || domain.name,
      privacyPolicyUrl: `/privacy`,
      termsUrl: `/terms`,
      
      // Styling
      primaryColor: primaryColor || '#3b82f6',
    });
    
    return NextResponse.json({
      success: true,
      rootPage: rootPage.toJSON(),
      message: `Default root page created successfully for ${domain.name}`
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating default root page:', error);
    return NextResponse.json(
      { error: 'Failed to create default root page' },
      { status: 500 }
    );
  }
} 