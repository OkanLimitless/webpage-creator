import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { RootPage } from '@/lib/models/RootPage';

interface Params {
  params: {
    id: string;
  };
}

// Mark this route as dynamic to prevent static optimization issues
export const dynamic = 'force-dynamic';

// GET /api/domains/[id]/has-root-page - Check if a domain has a root page
export async function GET(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    // Find a root page with this domain ID
    const rootPage = await RootPage.findOne({ domainId: params.id });
    
    return NextResponse.json({
      hasRootPage: !!rootPage,
      rootPageId: rootPage?._id || null
    });
  } catch (error) {
    console.error('Error checking root page:', error);
    return NextResponse.json(
      { error: 'Failed to check for root page' },
      { status: 500 }
    );
  }
} 