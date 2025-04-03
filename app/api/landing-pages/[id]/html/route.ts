import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { LandingPage } from '@/lib/models/LandingPage';
import { generateLandingPageHtml } from '@/lib/landingPageGenerator';

interface Params {
  params: {
    id: string;
  };
}

// GET /api/landing-pages/[id]/html - Get the HTML for a landing page
export async function GET(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const landingPage = await LandingPage.findById(params.id);
    
    if (!landingPage) {
      return NextResponse.json(
        { error: 'Landing page not found' },
        { status: 404 }
      );
    }
    
    const html = generateLandingPageHtml(landingPage);
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate landing page HTML' },
      { status: 500 }
    );
  }
} 