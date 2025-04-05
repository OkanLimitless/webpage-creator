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

// GET /api/root-pages/[id] - Get a root page by ID
export async function GET(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const rootPage = await RootPage.findById(params.id).populate('domainId', 'name');
    
    if (!rootPage) {
      return NextResponse.json(
        { error: 'Root page not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(rootPage);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch root page' },
      { status: 500 }
    );
  }
}

// PUT /api/root-pages/[id] - Update a root page
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    
    // Find and update the root page
    const updatedRootPage = await RootPage.findByIdAndUpdate(
      params.id,
      { $set: body },
      { new: true, runValidators: true }
    );
    
    if (!updatedRootPage) {
      return NextResponse.json(
        { error: 'Root page not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      ...updatedRootPage.toJSON(),
      message: 'Root page updated successfully',
    });
  } catch (error) {
    console.error('Error updating root page:', error);
    return NextResponse.json(
      { error: 'Failed to update root page' },
      { status: 500 }
    );
  }
}

// DELETE /api/root-pages/[id] - Delete a root page
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    // Find and delete the root page
    const deletedRootPage = await RootPage.findByIdAndDelete(params.id);
    
    if (!deletedRootPage) {
      return NextResponse.json(
        { error: 'Root page not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Root page deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting root page:', error);
    return NextResponse.json(
      { error: 'Failed to delete root page' },
      { status: 500 }
    );
  }
} 