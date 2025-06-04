import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { LandingPage } from '@/lib/models/LandingPage';

interface Params {
  params: {
    id: string;
  };
}

// POST /api/landing-pages/[id]/update-google-ads-account - Update Google Ads account ID and/or Google Analytics ID
export async function POST(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { googleAdsAccountId, googleAnalyticsId } = body;
    
    // Check if landing page exists
    const landingPage = await LandingPage.findById(params.id);
    if (!landingPage) {
      return NextResponse.json(
        { error: 'Landing page not found' },
        { status: 404 }
      );
    }
    
    // Update the tracking IDs if provided
    if (googleAdsAccountId !== undefined) {
      landingPage.googleAdsAccountId = googleAdsAccountId;
    }
    
    if (googleAnalyticsId !== undefined) {
      landingPage.googleAnalyticsId = googleAnalyticsId;
    }
    
    await landingPage.save();
    
    let message = '';
    if (googleAdsAccountId !== undefined && googleAnalyticsId !== undefined) {
      message = 'Google Ads account ID and Google Analytics ID updated successfully';
    } else if (googleAdsAccountId !== undefined) {
      message = 'Google Ads account ID updated successfully';
    } else if (googleAnalyticsId !== undefined) {
      message = 'Google Analytics ID updated successfully';
    } else {
      message = 'No changes made';
    }
    
    return NextResponse.json({
      success: true,
      message: message
    });
  } catch (error) {
    console.error('Error updating tracking IDs:', error);
    return NextResponse.json(
      { error: 'Failed to update tracking IDs' },
      { status: 500 }
    );
  }
} 