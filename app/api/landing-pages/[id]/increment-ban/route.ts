import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { LandingPage } from '@/lib/models/LandingPage';
import { Domain } from '@/lib/models/Domain';

interface Params {
  params: {
    id: string;
  };
}

// POST /api/landing-pages/[id]/increment-ban - Increment ban count for a landing page
export async function POST(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    // Check if landing page exists
    const landingPage = await LandingPage.findById(params.id).populate('domainId');
    if (!landingPage) {
      return NextResponse.json(
        { error: 'Landing page not found' },
        { status: 404 }
      );
    }
    
    // Increment the ban count for the landing page
    landingPage.banCount = (landingPage.banCount || 0) + 1;
    await landingPage.save();
    
    // Also increment the ban count for the parent domain
    const domainId = landingPage.domainId;
    if (domainId) {
      // If domainId is a string, we need to fetch the domain
      let domain;
      if (typeof domainId === 'string') {
        domain = await Domain.findById(domainId);
      } else {
        // If domainId is already an object due to population, use it directly
        domain = domainId;
      }
      
      if (domain) {
        domain.banCount = (domain.banCount || 0) + 1;
        await domain.save();
        console.log(`Incremented ban count for domain ${domain.name} to ${domain.banCount}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Ban count incremented successfully',
      banCount: landingPage.banCount,
      domainBanCount: typeof domainId === 'object' ? domainId.banCount : null
    });
  } catch (error) {
    console.error('Error incrementing ban count:', error);
    return NextResponse.json(
      { error: 'Failed to increment ban count' },
      { status: 500 }
    );
  }
} 