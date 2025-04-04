import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { checkDomainActivation } from '@/lib/cloudflare';

interface Params {
  params: {
    id: string;
  };
}

// GET /api/domains/[id]/verify - Check verification status of a domain
export async function GET(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    const { id } = params;
    
    // Find the domain
    const domain = await Domain.findById(id);
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }
    
    // If no Cloudflare zone ID, can't check status
    if (!domain.cloudflareZoneId) {
      return NextResponse.json(
        { error: 'Domain does not have a Cloudflare zone ID' },
        { status: 400 }
      );
    }
    
    // Check activation status in Cloudflare
    const activationStatus = await checkDomainActivation(domain.cloudflareZoneId);
    
    // Update domain status in database
    domain.verificationStatus = activationStatus.status;
    await domain.save();
    
    return NextResponse.json({
      name: domain.name,
      status: activationStatus.status,
      active: activationStatus.active,
      message: activationStatus.active 
        ? 'Domain is verified and active!' 
        : 'Domain is not yet active. Please make sure your nameservers are updated correctly.',
    });
  } catch (error) {
    console.error('Error checking domain verification:', error);
    return NextResponse.json(
      { error: 'Failed to check domain verification status' },
      { status: 500 }
    );
  }
} 