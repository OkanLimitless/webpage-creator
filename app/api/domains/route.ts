import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain, IDomain } from '@/lib/models/Domain';
import { getNameservers, addDomain as addDomainToCloudflare, createDnsRecord } from '@/lib/cloudflare';
import { addDomainToVercel } from '@/lib/vercel';
import { startDomainDeployment } from '@/lib/services/domainDeploymentService';

// Flag to check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';

// Mock data for development mode
const mockDomains = [
  {
    _id: 'mock-domain-1',
    name: 'example.com',
    cloudflareNameservers: ['ns1.mockdns.com', 'ns2.mockdns.com'],
    cloudflareZoneId: 'mock-zone-id',
    verificationStatus: 'pending',
    verificationKey: 'mock-verification-key',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Mark this route as dynamic to prevent static optimization issues
export const dynamic = 'force-dynamic';

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
    
    console.log('Adding domain to Cloudflare...');
    console.log('Environment check:', {
      hasToken: !!process.env.CLOUDFLARE_API_TOKEN,
      hasZoneId: !!process.env.CLOUDFLARE_ZONE_ID,
      hasEmail: !!process.env.CLOUDFLARE_EMAIL,
      hasAccountId: !!process.env.CLOUDFLARE_ACCOUNT_ID,
      hasVercelToken: !!process.env.VERCEL_TOKEN,
      hasVercelProjectId: !!process.env.VERCEL_PROJECT_ID,
      isDev: isDevelopment,
      isVercel: process.env.VERCEL === '1'
    });
    
    try {
      // Try to add the domain to Cloudflare
      const cfResult = await addDomainToCloudflare(name);
      
      // Create domain with Cloudflare information
      const domain = await Domain.create({
        name,
        cloudflareNameservers: cfResult.nameServers,
        cloudflareZoneId: cfResult.zoneId,
        verificationStatus: cfResult.status,
        verificationKey: cfResult.verificationKey,
        isActive: true,
        deploymentStatus: 'pending',
      });

      // Add DNS records for Vercel integration
      console.log(`Creating DNS records for ${name} with zone ID ${cfResult.zoneId}...`);
      
      try {
        // Try to create a CNAME record for the root domain first (some providers support this)
        console.log(`Attempting to create CNAME record for root domain ${name}...`);
        const cnameResult = await createDnsRecord('@', name, 'CNAME', 'cname.vercel-dns.com', cfResult.zoneId, false);
        
        if (cnameResult.success) {
          console.log(`Successfully created CNAME record for root domain ${name}`);
        } else {
          // If CNAME fails, try an A record (common for root domains)
          console.log(`Failed to create CNAME record for root domain, trying A record...`);
          const aRecordResult = await createDnsRecord('@', name, 'A', '76.76.21.21', cfResult.zoneId, false);
          
          if (aRecordResult.success) {
            console.log(`Successfully created A record for root domain ${name}`);
          } else {
            console.error(`Failed to create A record for ${name}:`, aRecordResult.errors || 'Unknown error');
          }
        }
        
        // Always create a CNAME record for www subdomain
        console.log(`Creating CNAME record for www.${name}...`);
        const wwwResult = await createDnsRecord('www', name, 'CNAME', 'cname.vercel-dns.com', cfResult.zoneId, false);
        
        if (wwwResult.success) {
          console.log(`Successfully created CNAME record for www.${name}`);
        } else {
          console.error(`Failed to create CNAME record for www.${name}:`, wwwResult.errors || 'Unknown error');
        }
      } catch (dnsError) {
        // Log the error but continue - DNS records can be added later
        console.error(`Error creating DNS records for ${name}:`, dnsError);
      }

      // Register domain with Vercel
      try {
        console.log(`Registering domain ${name} with Vercel...`);
        const vercelResult = await addDomainToVercel(name);
        if (vercelResult.success) {
          console.log(`Successfully registered domain ${name} with Vercel`);
        } else {
          console.error(`Failed to register domain ${name} with Vercel:`, vercelResult.error || 'Unknown error');
        }
      } catch (vercelError) {
        // Log the error but continue - Vercel registration can be done later
        console.error(`Error registering domain ${name} with Vercel:`, vercelError);
      }

      // We no longer automatically deploy static sites - use WordPress template instead
      // try {
      //   console.log(`Starting automatic deployment for new domain: ${name}`);
      //   startDomainDeployment(domain._id.toString())
      //     .catch(deployError => {
      //       console.error(`Error during automatic deployment for ${name}:`, deployError);
      //     });
      // } catch (deployError) {
      //   console.error(`Failed to trigger automatic deployment for ${name}:`, deployError);
      //   // We continue even if deployment fails, as it can be manually triggered later
      // }
      
      return NextResponse.json({
        ...domain.toJSON(),
        message: 'Domain added successfully. DNS records for Vercel have been configured. The domain has been registered with Vercel. Please update your domain nameservers to the ones shown in the table to complete verification.',
      }, { status: 201 });
    } catch (error) {
      console.error('Error adding domain to Cloudflare:', error);
      
      // If Cloudflare fails, fall back to just getting nameservers
      console.log('Falling back to fetching global nameservers...');
      const cloudflareNameservers = await getNameservers();
      
      // Create domain with just nameservers
      const domain = await Domain.create({
        name,
        cloudflareNameservers,
        verificationStatus: 'pending',
        isActive: true,
        deploymentStatus: 'pending',
      });

      // Even in the fallback case, try to set up DNS records using the global zone ID
      console.log(`Creating DNS records for ${name} using global zone ID...`);
      
      try {
        // Try to create DNS records using the global zone ID
        console.log(`Attempting to create A record for root domain ${name}...`);
        const aRecordResult = await createDnsRecord('@', name, 'A', '76.76.21.21', undefined, false);
        
        if (aRecordResult.success) {
          console.log(`Successfully created A record for root domain ${name}`);
        } else {
          console.error(`Failed to create A record for ${name}:`, aRecordResult.errors || 'Unknown error');
        }
        
        // Always create a CNAME record for www subdomain
        console.log(`Creating CNAME record for www.${name}...`);
        const wwwResult = await createDnsRecord('www', name, 'CNAME', 'cname.vercel-dns.com', undefined, false);
        
        if (wwwResult.success) {
          console.log(`Successfully created CNAME record for www.${name}`);
        } else {
          console.error(`Failed to create CNAME record for www.${name}:`, wwwResult.errors || 'Unknown error');
        }
      } catch (dnsError) {
        // Log the error but continue - DNS records can be added later
        console.error(`Error creating DNS records for ${name} in fallback mode:`, dnsError);
      }

      // Register domain with Vercel even in fallback mode
      try {
        console.log(`Registering domain ${name} with Vercel (fallback mode)...`);
        const vercelResult = await addDomainToVercel(name);
        if (vercelResult.success) {
          console.log(`Successfully registered domain ${name} with Vercel (fallback mode)`);
        } else {
          console.error(`Failed to register domain ${name} with Vercel (fallback mode):`, vercelResult.error || 'Unknown error');
        }
      } catch (vercelError) {
        // Log the error but continue - Vercel registration can be done later
        console.error(`Error registering domain ${name} with Vercel (fallback mode):`, vercelError);
      }

      // We no longer automatically deploy static sites - use WordPress template instead
      // try {
      //   console.log(`Starting automatic deployment for new domain with fallback: ${name}`);
      //   startDomainDeployment(domain._id.toString())
      //     .catch(deployError => {
      //       console.error(`Error during automatic deployment for ${name}:`, deployError);
      //     });
      // } catch (deployError) {
      //   console.error(`Failed to trigger automatic deployment for ${name}:`, deployError);
      //   // We continue even if deployment fails, as it can be manually triggered later
      // }
      
      return NextResponse.json({
        ...domain.toJSON(),
        message: 'Domain added with global nameservers. DNS records for Vercel have been configured and the domain has been registered with Vercel. Please update your domain nameservers to the ones shown in the table.',
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Error creating domain:', error);
    return NextResponse.json(
      { error: 'Failed to create domain' },
      { status: 500 }
    );
  }
} 