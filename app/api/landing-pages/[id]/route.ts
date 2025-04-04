import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { LandingPage } from '@/lib/models/LandingPage';
import { Domain } from '@/lib/models/Domain';
import { getDnsRecords, deleteDnsRecord } from '@/lib/cloudflare';

interface Params {
  params: {
    id: string;
  };
}

// GET /api/landing-pages/[id] - Get a landing page by ID
export async function GET(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const landingPage = await LandingPage.findById(params.id).populate('domainId', 'name');
    
    if (!landingPage) {
      return NextResponse.json(
        { error: 'Landing page not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(landingPage);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch landing page' },
      { status: 500 }
    );
  }
}

// DELETE /api/landing-pages/[id] - Delete a landing page
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    // First check if landing page exists
    const landingPage = await LandingPage.findById(params.id);
    if (!landingPage) {
      return NextResponse.json(
        { error: 'Landing page not found' },
        { status: 404 }
      );
    }
    
    // Get the domain
    const domain = await Domain.findById(landingPage.domainId);
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }
    
    // Verify domain has a zone ID
    if (!domain.cloudflareZoneId) {
      console.warn(`Domain ${domain.name} missing Cloudflare Zone ID. Cannot remove DNS records.`);
    } else {
      console.log(`Using zone ID ${domain.cloudflareZoneId} to delete DNS records`);
      
      // Delete DNS record from Cloudflare - using just the subdomain for lookup
      // We need to use the FQDN format for lookup but only subdomain for zone-scoped operations
      const fqdn = `${landingPage.subdomain}.${domain.name}`;
      console.log(`Looking up DNS records for ${fqdn}`);
      
      // Get records matching the full domain name
      const dnsRecords = await getDnsRecords(fqdn, domain.cloudflareZoneId);
      if (dnsRecords && dnsRecords.length > 0) {
        // Delete all matching DNS records
        for (const record of dnsRecords) {
          console.log(`Deleting DNS record ${record.id} with name ${record.name}`);
          await deleteDnsRecord(record.id, domain.cloudflareZoneId);
        }
      } else {
        console.warn(`No DNS records found for ${fqdn}`);
      }
    }
    
    // Delete the landing page
    await LandingPage.findByIdAndDelete(params.id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting landing page:', error);
    return NextResponse.json(
      { error: 'Failed to delete landing page' },
      { status: 500 }
    );
  }
}

// PATCH /api/landing-pages/[id] - Update a landing page
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { isActive, affiliateUrl } = body;
    
    const updateData: any = {};
    
    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }
    
    if (affiliateUrl) {
      updateData.affiliateUrl = affiliateUrl;
    }
    
    // Find and update the landing page
    const updatedLandingPage = await LandingPage.findByIdAndUpdate(
      params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!updatedLandingPage) {
      return NextResponse.json(
        { error: 'Landing page not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(updatedLandingPage);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update landing page' },
      { status: 500 }
    );
  }
} 