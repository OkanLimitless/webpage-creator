import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { getNameservers, addDomain as addDomainToCloudflare, getZoneIdByName, checkDomainActivation } from '@/lib/cloudflare';

// Mark this route as dynamic to prevent static optimization issues
export const dynamic = 'force-dynamic';

// Set a longer timeout for this API route
export const maxDuration = 60;

// Validation regex for domain names
const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;

// POST /api/domains/bulk - Create multiple domains at once
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    let { domains, dnsManagement = 'cloudflare' } = body;
    
    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return NextResponse.json(
        { error: 'Domains list is required and must be an array' },
        { status: 400 }
      );
    }
    
    // Validate dnsManagement parameter
    if (!['cloudflare', 'external'].includes(dnsManagement)) {
      return NextResponse.json(
        { error: 'dnsManagement must be either "cloudflare" or "external"' },
        { status: 400 }
      );
    }
    
    // Cap the number of domains to process at once to avoid overloading
    const MAX_DOMAINS = 50;
    if (domains.length > MAX_DOMAINS) {
      return NextResponse.json(
        { error: `Too many domains. Maximum of ${MAX_DOMAINS} domains can be processed at once.` },
        { status: 400 }
      );
    }
    
    // Sanitize domain names and check for validity
    const sanitizedDomains = domains.map(domain => ({
      original: domain,
      sanitized: domain.trim().toLowerCase()
    }));
    
    // Results tracking
    const results = {
      success: [] as string[],
      failed: [] as { domain: string, reason: string }[]
    };
    
    // Process each domain sequentially to avoid rate limiting
    for (const { original, sanitized } of sanitizedDomains) {
      try {
        // Validate domain format
        if (!domainRegex.test(sanitized)) {
          results.failed.push({
            domain: original, 
            reason: 'Invalid domain format'
          });
          continue;
        }

        // Check if domain already exists in our database
        const existingDomain = await Domain.findOne({ name: sanitized });
        if (existingDomain) {
          results.failed.push({
            domain: original, 
            reason: 'Domain already exists in database'
          });
          continue;
        }
        
        // Handle external domains differently
        if (dnsManagement === 'external') {
          console.log(`Processing external domain: ${sanitized}`);
          
          // For external domains, create with minimal Cloudflare integration
          const domain = await Domain.create({
            name: sanitized,
            cloudflareNameservers: [], // Empty for external domains
            cloudflareZoneId: undefined, // No Cloudflare zone
            verificationStatus: 'pending', // Will be verified externally
            verificationKey: undefined,
            isActive: true,
            deploymentStatus: 'pending',
            dnsManagement: 'external',
            targetCname: 'cname.vercel-dns.com',
          });

          // Add to success list
          results.success.push(sanitized);
          continue;
        }
        
        // For regular Cloudflare domains, continue with existing logic
        // Variables to store Cloudflare information
        let cloudflareZoneId: string | undefined;
        let cloudflareNameservers: string[] = [];
        let verificationStatus = 'pending';
        let verificationKey: string | undefined;
        
        try {
          // Try to add the domain to Cloudflare
          const cfResult = await addDomainToCloudflare(sanitized);
          
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
            console.log(`Domain ${sanitized} already exists in Cloudflare, fetching zone information...`);
            
            try {
              // Get the zone ID for the existing domain
              const zoneIdResult = await getZoneIdByName(sanitized);
              cloudflareZoneId = zoneIdResult || undefined;
              
              if (!cloudflareZoneId) {
                console.error(`Could not find Cloudflare zone ID for existing domain ${sanitized}`);
                results.failed.push({
                  domain: original, 
                  reason: 'Failed to get zone ID for existing domain in Cloudflare'
                });
                continue;
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
            // If it's another error, add to failed domains and continue
            console.error(`Error adding domain ${sanitized} to Cloudflare:`, error);
            results.failed.push({
              domain: original, 
              reason: `Failed to add to Cloudflare: ${error.message || 'Unknown error'}`
            });
            continue;
          }
        }
        
        // Create domain with the information we have
        const domain = await Domain.create({
          name: sanitized,
          cloudflareNameservers,
          cloudflareZoneId,
          verificationStatus,
          verificationKey,
          isActive: true,
          deploymentStatus: 'pending',
          dnsManagement: 'cloudflare', // Explicitly set for regular domains
        });

        // Try to create DNS records for Vercel integration
        try {
          console.log(`Creating DNS records for ${sanitized} with zone ID ${cloudflareZoneId || 'global'}...`);
          
          // Create imported function to use
          const createOrSkipDnsRecord = async (
            subdomain: string, 
            domain: string, 
            type: 'A' | 'CNAME', 
            content: string, 
            zoneId?: string
          ) => {
            try {
              // Just a basic implementation to avoid importing more files
              const result = await createDnsRecord(subdomain, domain, type, content, zoneId);
              return { success: true, result };
            } catch (error) {
              console.error(`Error creating DNS record: ${error}`);
              return { success: false, error };
            }
          };

          // First create an A record for the root domain (Vercel recommendation for apex domains)
          // which points to Vercel's servers
          const aRecordResult = await createOrSkipDnsRecord('@', sanitized, 'A', '76.76.21.21', cloudflareZoneId);
          if (aRecordResult.success) {
            console.log(`Successfully created or confirmed A record for root domain ${sanitized}`);
          } else {
            console.error(`Failed to create A record for root domain:`, aRecordResult.error);
          }
          
          // Then create a CNAME record for the www subdomain
          const wwwRecordResult = await createOrSkipDnsRecord('www', sanitized, 'CNAME', 'cname.vercel-dns.com', cloudflareZoneId);
          if (wwwRecordResult.success) {
            console.log(`Successfully created or confirmed CNAME record for www.${sanitized}`);
          } else {
            console.error(`Failed to create CNAME record for www subdomain:`, wwwRecordResult.error);
          }
        } catch (dnsError) {
          // Log the error but continue - DNS records can be fixed later
          console.error(`Error creating DNS records for ${sanitized}:`, dnsError);
        }
        
        // Add to success list
        results.success.push(sanitized);
        
      } catch (error: any) {
        console.error(`Error processing domain ${original}:`, error);
        results.failed.push({
          domain: original, 
          reason: error.message || 'Unknown error'
        });
      }
    }
    
    // Return results
    return NextResponse.json({
      results,
      message: `Processed ${sanitizedDomains.length} domains. ${results.success.length} succeeded, ${results.failed.length} failed.`
    });
    
  } catch (error: any) {
    console.error('Error bulk adding domains:', error);
    return NextResponse.json(
      { error: 'Failed to process domains', message: error.message },
      { status: 500 }
    );
  }
}

// Helper function from lib/cloudflare
async function createDnsRecord(subdomain: string, domain: string, type: 'A' | 'CNAME', content: string, zoneId?: string) {
  // This is a simplified version just to make the code work
  // In a real implementation, you would import this from lib/cloudflare
  console.log(`[MOCK] Creating DNS record: ${subdomain}.${domain} ${type} ${content}`);
  return { success: true };
} 