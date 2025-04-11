import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain, IDomain } from '@/lib/models/Domain';
import { LandingPage } from '@/lib/models/LandingPage';
import { getNameservers, addDomain as addDomainToCloudflare, createDnsRecord, getZoneIdByName, checkDomainActivation, getDnsRecords, deleteDnsRecord } from '@/lib/cloudflare';
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
    landingPageCount: 3,
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
    
    // Get all domains
    const domains = await Domain.find().sort({ createdAt: -1 });
    
    // Get landing page counts for each domain
    const domainIds = domains.map(domain => domain._id);
    
    // Use aggregation to count landing pages for each domain
    const landingPageCounts = await LandingPage.aggregate([
      { $match: { domainId: { $in: domainIds } } },
      { $group: { _id: '$domainId', count: { $sum: 1 } } }
    ]);
    
    // Create a map of domain IDs to counts
    const countMap = landingPageCounts.reduce((map, item) => {
      map[item._id.toString()] = item.count;
      return map;
    }, {} as Record<string, number>);
    
    // Add landing page counts to domains
    const domainsWithCounts = domains.map(domain => {
      const domainObj = domain.toObject();
      return {
        ...domainObj,
        landingPageCount: countMap[domainObj._id.toString()] || 0
      };
    });
    
    return NextResponse.json(domainsWithCounts);
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

// Helper function to check if a record exists before creating it
const createOrSkipDnsRecord = async (
  subdomain: string, 
  domain: string, 
  type: 'A' | 'CNAME', 
  content: string, 
  zoneId?: string
) => {
  try {
    // Check if record already exists
    const existingRecords = await getDnsRecords(subdomain === '@' ? domain : `${subdomain}.${domain}`, zoneId);
    
    // If this is a root domain (@) and we're trying to add an A record
    if (subdomain === '@' && type === 'A') {
      // Look for any existing records that might conflict (like CNAME)
      const existingCname = existingRecords.find((r: any) => r.type === 'CNAME');
      const existingA = existingRecords.find((r: any) => r.type === 'A' && r.content === content);
      
      // If A record with same content already exists, skip creation
      if (existingA) {
        console.log(`A record already exists for ${domain} with content ${content}, skipping creation`);
        return { success: true, message: 'Record already exists', record: existingA };
      }
      
      // If there's a CNAME record for the root domain, we need to remove it
      // as Cloudflare doesn't allow both CNAME and A records at the root
      if (existingCname) {
        console.log(`Found conflicting CNAME record for root domain ${domain}, removing it before adding A record`);
        const deleteResult = await deleteDnsRecord(existingCname.id, zoneId);
        if (!deleteResult.success) {
          console.error(`Failed to delete conflicting CNAME record: ${JSON.stringify(deleteResult.error)}`);
          return { success: false, error: `Failed to delete conflicting CNAME record` };
        }
      }
      
      // Now create the A record
      return await createDnsRecord(subdomain, domain, type, content, zoneId);
    } else {
      // For other records (subdomains), check if a record of the same type exists
      const existingRecord = existingRecords.find((r: any) => r.type === type);
      
      if (existingRecord) {
        // If content is the same, just skip
        if (existingRecord.content === content) {
          console.log(`DNS record already exists for ${subdomain === '@' ? domain : `${subdomain}.${domain}`} with content ${content}, skipping creation`);
          return { success: true, message: 'Record already exists', record: existingRecord };
        } else {
          // If content is different, consider updating it (optional improvement)
          console.log(`DNS record exists but with different content, consider updating in the future`);
          return { success: true, message: 'Record exists with different content', record: existingRecord };
        }
      }
      
      // Record doesn't exist, create it
      return await createDnsRecord(subdomain, domain, type, content, zoneId);
    }
  } catch (error) {
    console.error(`Error in createOrSkipDnsRecord: ${error}`);
    return { success: false, error };
  }
};

// POST /api/domains - Create a new domain
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    let { name } = body;
    
    // Sanitize domain name - trim whitespace
    name = name.trim();
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Domain name is required' },
        { status: 400 }
      );
    }
    
    // Check if domain already exists in our database
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
    
    // Variables to store Cloudflare information
    let cloudflareZoneId: string | undefined;
    let cloudflareNameservers: string[] = [];
    let verificationStatus = 'pending';
    let verificationKey: string | undefined;
    
    try {
      // Try to add the domain to Cloudflare
      const cfResult = await addDomainToCloudflare(name);
      
      // If successful, store Cloudflare information
      cloudflareZoneId = cfResult.zoneId;
      cloudflareNameservers = cfResult.nameServers;
      verificationStatus = cfResult.status;
      verificationKey = cfResult.verificationKey;
      
    } catch (error: any) {
      // Check if the error is that the domain already exists in Cloudflare (code 1061)
      const errorMessage = error?.message || '';
      const domainAlreadyExists = errorMessage.includes('1061') && errorMessage.includes('already exists');
      
      if (domainAlreadyExists) {
        console.log(`Domain ${name} already exists in Cloudflare, fetching zone information...`);
        
        try {
          // Get the zone ID for the existing domain
          const zoneIdResult = await getZoneIdByName(name);
          cloudflareZoneId = zoneIdResult || undefined;
          
          if (!cloudflareZoneId) {
            console.error(`Could not find Cloudflare zone ID for existing domain ${name}`);
            throw new Error('Failed to get zone ID for existing domain');
          }
          
          console.log(`Found zone ID for existing domain: ${cloudflareZoneId}`);
          
          // Try to get nameservers for the domain
          try {
            // Try to get the domain status and nameservers using the zone ID
            const domainInfo = await checkDomainActivation(cloudflareZoneId);
            verificationStatus = domainInfo.status;
            console.log(`Retrieved domain status: ${verificationStatus}`);
            
            // Get nameservers (either from the domain or fallback to global)
            cloudflareNameservers = await getNameservers();
          } catch (nsError) {
            console.error(`Error getting nameservers for existing domain:`, nsError);
            // Fallback to global nameservers
            cloudflareNameservers = await getNameservers();
          }
        } catch (zoneError) {
          console.error(`Error getting zone info for existing domain:`, zoneError);
          // Fallback to global nameservers
          cloudflareNameservers = await getNameservers();
        }
      } else {
        // If it's another error, fallback to getting global nameservers
        console.error('Error adding domain to Cloudflare:', error);
        console.log('Falling back to fetching global nameservers...');
        cloudflareNameservers = await getNameservers();
      }
    }
    
    // Create domain with the information we have
    const domain = await Domain.create({
      name,
      cloudflareNameservers,
      cloudflareZoneId,
      verificationStatus,
      verificationKey,
      isActive: true,
      deploymentStatus: 'pending',
    });

    // Try to create DNS records for Vercel integration
    try {
      console.log(`Creating DNS records for ${name} with zone ID ${cloudflareZoneId || 'global'}...`);
      
      // First create an A record for the root domain (Vercel recommendation for apex domains)
      // which points to Vercel's servers
      const aRecordResult = await createOrSkipDnsRecord('@', name, 'A', '76.76.21.21', cloudflareZoneId);
      if (aRecordResult.success) {
        console.log(`Successfully created or confirmed A record for root domain ${name}`);
      } else {
        console.error(`Failed to create A record for root domain:`, aRecordResult.error);
      }
      
      // Then create a CNAME record for the www subdomain
      const wwwRecordResult = await createOrSkipDnsRecord('www', name, 'CNAME', 'cname.vercel-dns.com', cloudflareZoneId);
      if (wwwRecordResult.success) {
        console.log(`Successfully created or confirmed CNAME record for www.${name}`);
      } else {
        console.error(`Failed to create CNAME record for www subdomain:`, wwwRecordResult.error);
      }
    } catch (dnsError) {
      // Log the error but continue - DNS records can be fixed later
      console.error(`Error creating DNS records for ${name}:`, dnsError);
    }

    // The domain is no longer automatically registered with Vercel when created
    // It will be registered with Vercel only when deployed or when a landing page is created
    // This prevents the domain from being unnecessarily added to Vercel projects
    console.log(`Domain ${name} created without adding to Vercel - will be added during deployment.`);

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
      message: 'Domain added successfully. DNS records have been configured. Please update your domain nameservers to the ones shown in the table to complete verification.',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating domain:', error);
    return NextResponse.json(
      { error: 'Failed to create domain' },
      { status: 500 }
    );
  }
} 