import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain, IDomain } from '@/lib/models/Domain';
import { getNameservers } from '@/lib/cloudflare';

// GET /api/domains - Get all domains
export async function GET() {
  try {
    await connectToDatabase();
    const domains = await Domain.find().sort({ createdAt: -1 });
    return NextResponse.json(domains);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch domains' },
      { status: 500 }
    );
  }
}

// POST /api/domains - Create a new domain
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { name } = body;
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Domain name is required' },
        { status: 400 }
      );
    }
    
    // Check if domain already exists
    const existingDomain = await Domain.findOne({ name });
    if (existingDomain) {
      return NextResponse.json(
        { error: 'Domain already exists' },
        { status: 400 }
      );
    }
    
    // Fetch nameservers from Cloudflare
    const cloudflareNameservers = await getNameservers();
    
    // Create new domain
    const domain = await Domain.create({
      name,
      cloudflareNameservers,
      isActive: true,
    });
    
    return NextResponse.json(domain, { status: 201 });
  } catch (error) {
    console.error('Error creating domain:', error);
    return NextResponse.json(
      { error: 'Failed to create domain' },
      { status: 500 }
    );
  }
} 