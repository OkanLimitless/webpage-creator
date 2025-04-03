import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { LandingPage } from '@/lib/models/LandingPage';

interface Params {
  params: {
    id: string;
  };
}

// GET /api/domains/[id] - Get a domain by ID
export async function GET(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const domain = await Domain.findById(params.id);
    
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(domain);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch domain' },
      { status: 500 }
    );
  }
}

// DELETE /api/domains/[id] - Delete a domain
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    // First check if domain exists
    const domain = await Domain.findById(params.id);
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }
    
    // Check if there are any landing pages using this domain
    const landingPagesCount = await LandingPage.countDocuments({ domainId: params.id });
    if (landingPagesCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete domain with landing pages. Delete landing pages first.' },
        { status: 400 }
      );
    }
    
    // Delete the domain
    await Domain.findByIdAndDelete(params.id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete domain' },
      { status: 500 }
    );
  }
}

// PATCH /api/domains/[id] - Update a domain
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { isActive } = body;
    
    // Find and update the domain
    const updatedDomain = await Domain.findByIdAndUpdate(
      params.id,
      { isActive },
      { new: true, runValidators: true }
    );
    
    if (!updatedDomain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(updatedDomain);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update domain' },
      { status: 500 }
    );
  }
} 