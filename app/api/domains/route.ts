import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain, IDomain } from '@/lib/models/Domain';
import { getNameservers, addDomain as addDomainToCloudflare, createDnsRecord, getZoneIdByName, checkDomainActivation, getDnsRecords } from '@/lib/cloudflare';
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
    const existingRecords = await getDnsRecords(`${subdomain === '@' ? domain : subdomain + '.' + domain}`, zoneId);
    const matchingRecord = existingRecords.find((r: any) => 
      r.type === type && 
      (r.content === content || (type === 'A' && content === '76.76.21.21' && r.content === '76.76.21.21'))
    );
    
    if (matchingRecord) {
      console.log(`DNS record for ${subdomain}.${domain} of type ${type} already exists, skipping creation`);
      return { success: true, existing: true, record: matchingRecord };
    }
    
    // Record doesn't exist, create it
    console.log(`Creating ${type} record for ${subdomain}.${domain} pointing to ${content}...`);
    const result = await createDnsRecord(subdomain, domain, type, content, zoneId, false);
    return result;
  } catch (recordError: any) {
    // Check for record already exists error (code 81053)
    if (recordError.message && recordError.message.includes('81053')) {
      console.log(`DNS record for ${subdomain}.${domain} already exists (code 81053), skipping creation`);
      return { success: true, existing: true };
    }
    
    console.error(`Error creating DNS record for ${subdomain}.${domain}:`, recordError);
    return { success: false, error: recordError };
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

    // Add DNS records for Vercel integration
    console.log(`Creating DNS records for ${name} with zone ID ${cloudflareZoneId || 'global'}...`);
    
    try {
      // Try to create a CNAME record for the root domain first
      const rootResult = await createOrSkipDnsRecord('@', name, 'CNAME', 'cname.vercel-dns.com', cloudflareZoneId);
      
      // If CNAME fails or doesn't exist yet, try an A record
      if (!rootResult.success || !rootResult.existing) {
        const aRecordResult = await createOrSkipDnsRecord('@', name, 'A', '76.76.21.21', cloudflareZoneId);
        if (aRecordResult.success) {
          console.log(`Successfully created or confirmed A record for root domain ${name}`);
        }
      } else {
        console.log(`Successfully confirmed CNAME record for root domain ${name}`);
      }
      
      // Always ensure www subdomain has a CNAME record
      const wwwResult = await createOrSkipDnsRecord('www', name, 'CNAME', 'cname.vercel-dns.com', cloudflareZoneId);
      if (wwwResult.success) {
        console.log(`Successfully created or confirmed CNAME record for www.${name}`);
      }
    } catch (dnsError) {
      // Log the error but continue - DNS records can be added later
      console.error(`Error creating DNS records for ${name}:`, dnsError);
    }

    // Register domain with Vercel - ensure trimmed domain name
    try {
      console.log(`Registering domain ${name} with Vercel...`);
      const vercelResult = await addDomainToVercel(name.trim());
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
    console.error('Error creating domain:', error);
    return NextResponse.json(
      { error: 'Failed to create domain' },
      { status: 500 }
    );
  }
} 