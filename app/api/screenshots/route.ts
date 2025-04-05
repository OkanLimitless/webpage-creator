import { NextRequest, NextResponse } from 'next/server';
import { takeScreenshots } from '@/lib/screenshot';

// Mark this route as dynamic to prevent static optimization issues
export const dynamic = 'force-dynamic';

// POST /api/screenshots - Take screenshots of a URL
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, id } = body;
    
    if (!url || !id) {
      return NextResponse.json(
        { error: 'URL and ID are required' },
        { status: 400 }
      );
    }
    
    const screenshotResult = await takeScreenshots(url, id);
    
    return NextResponse.json(screenshotResult);
  } catch (error) {
    console.error('Error taking screenshots:', error);
    return NextResponse.json(
      { error: 'Failed to take screenshots' },
      { status: 500 }
    );
  }
} 