import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain, IDomain } from '@/lib/models/Domain';
import { getNameservers } from '@/lib/cloudflare';

// Flag to check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';

// Mock data for development mode
const mockDomains = [
  {
    _id: 'mock-domain-1',
    name: 'example.com',
    cloudflareNameservers: ['ns1.mockdns.com', 'ns2.mockdns.com'],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// GET /api/domains - Get all domains
export async function GET() {
  try {
    const db = await connectToDatabase();
    
    // If we're in a mock database situation, return mock data
    if (isDevelopment && (!db || !db.connection || db.connection.readyState !== 1)) {
      console.log('Using mock domains data');
      return NextResponse.json(mockDomains);
    }
    
    const domains = await Domain.find().sort({ createdAt: -1 });
    return NextResponse.json(domains);
  } catch (error) {
    console.error('Error fetching domains:', error);
    
    // If in development mode, return mock data on error
    if (isDevelopment) {
      console.log('Returning mock domains after error');
      return NextResponse.json(mockDomains);
    }
    
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
    
    console.log('Fetching nameservers from Cloudflare...');
    console.log('Environment check:', {
      hasToken: !!process.env.CLOUDFLARE_API_TOKEN,
      hasZoneId: !!process.env.CLOUDFLARE_ZONE_ID,
      hasEmail: !!process.env.CLOUDFLARE_EMAIL,
      isDev: isDevelopment,
      isVercel: process.env.VERCEL === '1'
    });
    
    // Fetch nameservers from Cloudflare
    const cloudflareNameservers = await getNameservers();
    console.log('Nameservers retrieved:', cloudflareNameservers);
    
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