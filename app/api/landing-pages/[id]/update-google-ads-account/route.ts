import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { LandingPage } from '@/lib/models/LandingPage';

interface Params {
  params: {
    id: string;
  };
}

// POST /api/landing-pages/[id]/update-google-ads-account - Update Google Ads account ID
export async function POST(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { googleAdsAccountId } = body;
    
    // Check if landing page exists
    const landingPage = await LandingPage.findById(params.id);
    if (!landingPage) {
      return NextResponse.json(
        { error: 'Landing page not found' },
        { status: 404 }
      );
    }
    
    // Update the Google Ads account ID
    landingPage.googleAdsAccountId = googleAdsAccountId;
    await landingPage.save();
    
    return NextResponse.json({
      success: true,
      message: 'Google Ads account ID updated successfully'
    });
  } catch (error) {
    console.error('Error updating Google Ads account ID:', error);
    return NextResponse.json(
      { error: 'Failed to update Google Ads account ID' },
      { status: 500 }
    );
  }
} 