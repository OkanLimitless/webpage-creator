import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { checkDomainInVercel } from '@/lib/vercel';

interface Params {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    // Find the domain
    const domain = await Domain.findById(params.id);
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }
    
    // Results object
    const results: any = {
      domain: {
        id: domain._id,
        name: domain.name,
        cloudflareZoneId: domain.cloudflareZoneId,
        isActive: domain.isActive,
        verificationStatus: domain.verificationStatus
      },
      dnsRecords: [],
      cloudflare: {},
      vercel: {},
      issues: [],
      recommendations: []
    };
    
    // Check Cloudflare DNS records
    if (domain.cloudflareZoneId) {
      try {
        const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
        
        if (!CF_API_TOKEN) {
          results.issues.push('Cloudflare API token not configured');
          results.recommendations.push('Set CLOUDFLARE_API_TOKEN environment variable');
        } else {
          // Get Cloudflare zone info
          const zoneResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.cloudflareZoneId}`, {
            headers: {
              'Authorization': `Bearer ${CF_API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          });
          
          const zoneData = await zoneResponse.json();
          
          if (zoneData.success) {
            results.cloudflare.zoneStatus = zoneData.result.status;
            results.cloudflare.ssl = zoneData.result.ssl?.mode;
            
            // Check for full ssl strict which might cause issues with Vercel
            if (zoneData.result.ssl?.mode === 'full_strict') {
              results.issues.push('Cloudflare SSL is set to "Full (strict)" which may cause issues with Vercel');
              results.recommendations.push('Change Cloudflare SSL mode to "Full" or "Flexible" for better compatibility with Vercel');
            }
          } else {
            results.issues.push('Failed to get Cloudflare zone info');
          }
          
          // Get DNS records
          const dnsResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.cloudflareZoneId}/dns_records`, {
            headers: {
              'Authorization': `Bearer ${CF_API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          });
          
          const dnsData = await dnsResponse.json();
          
          if (dnsData.success) {
            results.dnsRecords = dnsData.result.map((record: any) => ({
              id: record.id,
              type: record.type,
              name: record.name,
              content: record.content,
              proxied: record.proxied,
              isVercel: record.content === 'cname.vercel-dns.com' || record.content === '76.76.21.21'
            }));
            
            // Check for correct Vercel DNS setup
            const rootRecords = results.dnsRecords.filter((r: any) => 
              (r.name === domain.name || r.name === `www.${domain.name}`) && 
              (r.type === 'CNAME' || r.type === 'A')
            );
            
            if (rootRecords.length === 0) {
              results.issues.push('No DNS records found for root domain or www subdomain');
              results.recommendations.push('Add a CNAME record pointing to cname.vercel-dns.com or an A record pointing to 76.76.21.21');
            } else {
              const hasVercelRecord = rootRecords.some((r: any) => r.isVercel);
              if (!hasVercelRecord) {
                results.issues.push('None of the root domain DNS records point to Vercel');
                results.recommendations.push('Update DNS to point to Vercel (CNAME: cname.vercel-dns.com or A: 76.76.21.21)');
              }
            }
          } else {
            results.issues.push('Failed to get DNS records from Cloudflare');
          }
        }
      } catch (error) {
        console.error('Error checking Cloudflare:', error);
        results.issues.push('Error checking Cloudflare configuration');
      }
    } else {
      results.issues.push('Cloudflare Zone ID not set for this domain');
      results.recommendations.push('Update the domain with the Cloudflare Zone ID');
    }
    
    // Check Vercel domain status
    try {
      const vercelStatus = await checkDomainInVercel(domain.name);
      results.vercel = {
        registered: vercelStatus.exists,
        verified: vercelStatus.configured,
        details: vercelStatus
      };
      
      if (!vercelStatus.exists) {
        results.issues.push('Domain not registered with Vercel');
        results.recommendations.push('Add the domain to your Vercel project');
      } else if (!vercelStatus.configured) {
        results.issues.push('Domain not verified with Vercel');
        results.recommendations.push('Verify domain ownership with Vercel by setting up correct DNS records');
      }
    } catch (error) {
      console.error('Error checking Vercel domain status:', error);
      results.issues.push('Error checking Vercel domain configuration');
    }
    
    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Error checking DNS configuration:', error);
    return NextResponse.json(
      { error: `Error checking DNS configuration: ${error.message}` },
      { status: 500 }
    );
  }
} 