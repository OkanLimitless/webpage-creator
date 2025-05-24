import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import dns from 'dns';
import { promisify } from 'util';

const resolveCname = promisify(dns.resolveCname);
const resolve4 = promisify(dns.resolve4);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    
    const domain = await Domain.findById(params.id);
    if (!domain) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }
    
    if (domain.dnsManagement !== 'external') {
      return NextResponse.json(
        { error: 'This endpoint is only for external domains' },
        { status: 400 }
      );
    }
    
    try {
      let pointsToVercel = false;
      let dnsInfo: any = {};
      
      // First try to resolve CNAME
      try {
        const cnameRecords = await resolveCname(domain.name);
        dnsInfo.cnameRecords = cnameRecords;
        
        // Check if any CNAME points to Vercel
        pointsToVercel = cnameRecords.some(record => 
          record.includes('vercel') || 
          record.includes('cname.vercel-dns.com') ||
          record.includes('76.76.21.21')
        );
        
        console.log(`CNAME records for ${domain.name}:`, cnameRecords);
      } catch (cnameError) {
        // If CNAME fails, try A record (for apex domains)
        try {
          const aRecords = await resolve4(domain.name);
          dnsInfo.aRecords = aRecords;
          
          // Check if any A record points to Vercel IPs
          pointsToVercel = aRecords.some(ip => 
            ip === '76.76.21.21' || 
            ip === '76.76.21.98' ||
            ip === '76.76.21.142' ||
            ip === '76.76.21.164'
          );
          
          console.log(`A records for ${domain.name}:`, aRecords);
        } catch (aError) {
          dnsInfo.error = 'DNS lookup failed - domain may not have DNS records set yet';
        }
      }
      
      if (pointsToVercel) {
        // Update domain status
        domain.verificationStatus = 'active';
        await domain.save();
        
        return NextResponse.json({
          success: true,
          verified: true,
          message: 'Domain verified successfully! DNS is correctly pointing to Vercel.',
          dnsInfo
        });
      } else {
        return NextResponse.json({
          success: true,
          verified: false,
          message: 'Domain does not point to Vercel yet. Please check your DNS configuration.',
          dnsInfo,
          expectedTargets: [
            'cname.vercel-dns.com (for CNAME)',
            '76.76.21.21 (for A record)'
          ]
        });
      }
    } catch (dnsError: any) {
      console.error('DNS verification error:', dnsError);
      return NextResponse.json({
        success: false,
        verified: false,
        message: 'DNS lookup failed - domain may not have DNS records configured yet',
        error: dnsError.message,
        expectedTargets: [
          'cname.vercel-dns.com (for CNAME)',
          '76.76.21.21 (for A record)'
        ]
      });
    }
    
  } catch (error) {
    console.error('Error verifying external domain:', error);
    return NextResponse.json(
      { error: 'Failed to verify domain' },
      { status: 500 }
    );
  }
}
