// Get Cloudflare credentials with fallbacks for development
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || 'development_key';
const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || 'development_zone';
const CLOUDFLARE_EMAIL = process.env.CLOUDFLARE_EMAIL || 'development@example.com';
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';

// Flag to check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';

// Warn if environment variables are missing in production
if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ZONE_ID || !process.env.CLOUDFLARE_EMAIL) {
  if (!isDevelopment) {
    console.warn('Cloudflare environment variables are missing. DNS functionality will be limited.');
  }
}

// Helper to ensure valid zone ID
function validateZoneId(zoneId?: string): string {
  if (!zoneId) {
    if (!CLOUDFLARE_ZONE_ID) {
      console.error('No zone ID provided and no global zone ID configured!');
      throw new Error('Missing Cloudflare Zone ID');
    }
    return CLOUDFLARE_ZONE_ID;
  }
  return zoneId;
}

// Initialize Cloudflare client with different method
// Directly work with the API
const cf = {
  async getZone() {
    // In development with missing credentials, return mock data
    if (isDevelopment && (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ZONE_ID)) {
      return {
        success: true,
        result: {
          name_servers: ['ns1.mockdns.com', 'ns2.mockdns.com']
        }
      };
    }

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });
    return response.json();
  },

  async createZone(domainName: string) {
    // In development with missing credentials, return mock success
    if (isDevelopment && (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)) {
      return {
        success: true,
        result: {
          id: 'mock-zone-id',
          name: domainName,
          name_servers: ['ns1.mockdns.com', 'ns2.mockdns.com'],
          status: 'pending',
          verification_key: 'mock-verification-key',
        }
      };
    }

    if (!CLOUDFLARE_ACCOUNT_ID) {
      throw new Error('Cloudflare account ID is required to create zones');
    }

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
      body: JSON.stringify({
        name: domainName,
        account: {
          id: CLOUDFLARE_ACCOUNT_ID
        },
        type: 'full',
      }),
    });
    return response.json();
  },

  async checkZoneActivation(zoneId: string) {
    // In development with missing credentials, return mock success
    if (isDevelopment && (!process.env.CLOUDFLARE_API_TOKEN)) {
      return {
        success: true,
        result: {
          id: zoneId,
          status: 'active',
        }
      };
    }

    console.log(`Checking activation status for zone ID: ${zoneId}`);
    
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });
    
    const data = await response.json();
    console.log(`Zone activation response:`, JSON.stringify(data));
    
    return data;
  },

  async createDnsRecord(data: any, zoneId?: string) {
    // In development with missing credentials, return mock success
    if (isDevelopment && (!process.env.CLOUDFLARE_API_TOKEN || (!process.env.CLOUDFLARE_ZONE_ID && !zoneId))) {
      return {
        success: true,
        result: {
          id: 'mock-record-id',
          ...data
        }
      };
    }
    
    // Use the provided zoneId if available, otherwise fall back to the global one
    const targetZoneId = validateZoneId(zoneId);
    console.log(`[cf.createDnsRecord] Using zone ID: ${targetZoneId} for record: ${data.name}`);
    
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${targetZoneId}/dns_records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async deleteDnsRecord(recordId: string, zoneId?: string) {
    // In development with missing credentials, return mock success
    if (isDevelopment && (!process.env.CLOUDFLARE_API_TOKEN || (!process.env.CLOUDFLARE_ZONE_ID && !zoneId))) {
      return {
        success: true
      };
    }

    // Use the provided zoneId if available, otherwise fall back to the global one
    const targetZoneId = validateZoneId(zoneId);
    console.log(`[cf.deleteDnsRecord] Using zone ID: ${targetZoneId} for record ID: ${recordId}`);

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${targetZoneId}/dns_records/${recordId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });
    return response.json();
  },

  async getDnsRecords(name: string, zoneId?: string) {
    // In development with missing credentials, return mock data
    if (isDevelopment && (!process.env.CLOUDFLARE_API_TOKEN || (!process.env.CLOUDFLARE_ZONE_ID && !zoneId))) {
      return [{
        id: 'mock-record-id',
        name: name,
        type: 'CNAME',
        content: 'alias.vercel.com'
      }];
    }

    // Use the provided zoneId if available, otherwise fall back to the global one
    const targetZoneId = validateZoneId(zoneId);
    console.log(`[cf.getDnsRecords] Using zone ID: ${targetZoneId} for lookup: ${name}`);

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${targetZoneId}/dns_records?name=${name}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });
    const data = await response.json();
    return data.result || [];
  },
};

export type CloudflareNameserver = string;

// Get Cloudflare nameservers for a domain
export async function getNameservers(): Promise<CloudflareNameserver[]> {
  try {
    console.log('Getting zone info from Cloudflare...');
    const response = await cf.getZone();
    console.log('Zone API response:', JSON.stringify(response));
    
    if (!response.success) {
      console.error('Cloudflare API returned an error:', response.errors || response);
      // Return mock data in case of API error
      if (isDevelopment) {
        return ['ns1.mockdns.com', 'ns2.mockdns.com'];
      }
      throw new Error(`Cloudflare API error: ${JSON.stringify(response.errors || 'Unknown error')}`);
    }
    
    return response.result?.name_servers || [];
  } catch (error) {
    console.error('Error getting Cloudflare nameservers:', error);
    // Return mock data in case of error
    if (isDevelopment) {
      return ['ns1.mockdns.com', 'ns2.mockdns.com'];
    }
    throw error;
  }
}

// Add a domain to Cloudflare
export async function addDomain(domainName: string) {
  try {
    // Trim whitespace from domain name
    domainName = domainName.trim();
    
    console.log(`Adding domain ${domainName} to Cloudflare...`);
    const response = await cf.createZone(domainName);
    console.log('Zone creation response:', JSON.stringify(response));

    if (!response.success) {
      console.error('Cloudflare API returned an error:', response.errors || response);
      throw new Error(`Failed to add domain to Cloudflare: ${JSON.stringify(response.errors || 'Unknown error')}`);
    }

    return {
      zoneId: response.result.id,
      nameServers: response.result.name_servers,
      status: response.result.status,
      verificationKey: response.result.verification_key
    };
  } catch (error) {
    console.error(`Error adding domain ${domainName} to Cloudflare:`, error);
    throw error;
  }
}

// Check domain activation status
export async function checkDomainActivation(zoneId: string) {
  try {
    console.log(`Checking domain activation for zone ${zoneId}`);
    const response = await cf.checkZoneActivation(zoneId);
    console.log(`Domain activation response:`, JSON.stringify(response));
    
    if (!response.success) {
      console.error('Cloudflare API returned an error:', response.errors || response);
      throw new Error(`Failed to check domain activation: ${JSON.stringify(response.errors || 'Unknown error')}`);
    }
    
    // Cloudflare may return status as "active", "pending", "initializing", etc.
    // We'll check if the status is specifically "active" for our verification
    const status = response.result.status;
    const isActive = status === 'active';
    
    console.log(`Domain status: ${status}, isActive: ${isActive}`);
    
    return {
      status: status,
      active: isActive,
    };
  } catch (error) {
    console.error(`Error checking domain activation for zone ${zoneId}:`, error);
    throw error;
  }
}

// Helper to determine which zone ID to use
function getEffectiveZoneId(providedZoneId?: string): string {
  const zoneId = validateZoneId(providedZoneId);
  return zoneId;
}

// Create a DNS record for a subdomain
export async function createDnsRecord(
  subdomain: string, 
  domain: string,
  type: 'CNAME' | 'A' | 'AAAA' | 'TXT' | 'MX' | 'NS', 
  content: string = 'cname.vercel-dns.com',
  zoneId?: string,
  proxied: boolean = false // Default to false which is required for Vercel SSL to work properly
) {
  try {
    // Trim whitespace from domain and subdomain
    domain = domain.trim();
    subdomain = subdomain.trim();
    
    // For Cloudflare DNS API, we should use just the subdomain as name when it's in the correct zone
    const name = subdomain;
    const effectiveZoneId = getEffectiveZoneId(zoneId);
    console.log(`[${new Date().toISOString()}] createDnsRecord: Creating DNS record for ${name} in domain ${domain} with zone ID: ${effectiveZoneId}`);
    console.log(`[${new Date().toISOString()}] createDnsRecord: Type: ${type}, Content: ${content}, Proxied: ${proxied}`);
    
    // Check if this is a record pointing to Vercel
    const isVercelRecord = content.includes('vercel') || content === '76.76.21.21';
    
    // Force proxied to false if this is a Vercel record to prevent redirect loops
    // Vercel requires DNS-only mode for its SSL to work properly
    const shouldProxy = isVercelRecord ? false : proxied;
    
    if (isVercelRecord && proxied) {
      console.log(`[${new Date().toISOString()}] createDnsRecord: Detected Vercel record, forcing proxied=false to prevent redirect loops`);
    }
    
    const response = await cf.createDnsRecord({
      type,
      name,
      content,
      ttl: 1, // Auto TTL
      proxied: shouldProxy, // Explicitly set proxied value - for Vercel domains this should ALWAYS be false
    }, effectiveZoneId);
    
    console.log(`[${new Date().toISOString()}] createDnsRecord: DNS record creation response:`, JSON.stringify(response));
    
    if (!response.success) {
      console.error('[${new Date().toISOString()}] createDnsRecord: Cloudflare API returned an error:', response.errors || response);
    }
    
    return response;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] createDnsRecord: Error creating DNS record:`, error);
    // Return mock success in case of error
    if (isDevelopment) {
      return { success: true };
    }
    throw error;
  }
}

// Delete a DNS record by ID
export async function deleteDnsRecord(recordId: string, zoneId?: string) {
  try {
    const effectiveZoneId = getEffectiveZoneId(zoneId);
    
    console.log(`[${new Date().toISOString()}] deleteDnsRecord: Deleting DNS record ${recordId} from zone ${effectiveZoneId}`);
    
    // Call Cloudflare API to delete the record
    const response = await cf.deleteDnsRecord(recordId, effectiveZoneId);
    
    if (!response.success) {
      console.error(`[${new Date().toISOString()}] deleteDnsRecord: Failed to delete DNS record:`, response.errors || 'Unknown error');
      return { success: false, error: response.errors || 'Unknown error' };
    }
    
    console.log(`[${new Date().toISOString()}] deleteDnsRecord: Successfully deleted DNS record ${recordId}`);
    return { success: true };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] deleteDnsRecord: Error deleting DNS record:`, error);
    return { success: false, error };
  }
}

// Get DNS records for a domain or subdomain
export async function getDnsRecords(nameOrFqdn: string, zoneId?: string) {
  try {
    // Trim whitespace from domain name
    nameOrFqdn = nameOrFqdn.trim();
    
    const effectiveZoneId = getEffectiveZoneId(zoneId);
    
    // If the name contains dots, it might be a full domain name (subdomain.domain.com)
    // We'll use it as is in that case
    const name = nameOrFqdn;
    
    console.log(`Getting DNS records for ${name} with zone ID: ${effectiveZoneId}`);
    
    const records = await cf.getDnsRecords(name, effectiveZoneId);
    
    console.log(`Found ${records.length} DNS records for ${name}`);
    
    return records;
  } catch (error) {
    console.error('Error getting DNS records:', error);
    // Return mock data in case of error
    if (isDevelopment) {
      return [{
        id: 'mock-record-id',
        name: nameOrFqdn,
        type: 'CNAME',
        content: 'alias.vercel.com'
      }];
    }
    throw error;
  }
}

// Get Cloudflare zone ID by domain name
export async function getZoneIdByName(domainName: string): Promise<string | null> {
  try {
    // Trim whitespace from domain name
    domainName = domainName.trim();
    
    console.log(`Getting zone ID for domain: ${domainName}`);
    
    // In development with missing credentials, return mock data
    if (isDevelopment && (!process.env.CLOUDFLARE_API_TOKEN)) {
      return 'mock-zone-id';
    }
    
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${domainName}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });
    
    const data = await response.json();
    console.log(`Zone lookup response:`, JSON.stringify(data));
    
    if (!data.success || !data.result || data.result.length === 0) {
      console.error('Failed to find zone by domain name:', data.errors || data);
      return null;
    }
    
    return data.result[0].id;
  } catch (error) {
    console.error(`Error getting zone ID for domain ${domainName}:`, error);
    return null;
  }
}

// Check domain activation status by domain name
export async function checkDomainActivationByName(domainName: string) {
  try {
    // Trim whitespace from domain name
    domainName = domainName.trim();
    
    console.log(`Checking domain activation by name: ${domainName}`);
    
    // Get zone information directly
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${domainName}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });
    
    const data = await response.json();
    console.log(`Zone lookup response:`, JSON.stringify(data));
    
    if (!data.success || !data.result || data.result.length === 0) {
      console.error('Failed to find zone by domain name:', data.errors || data);
      throw new Error(`Could not find zone for domain: ${domainName}`);
    }
    
    // Get zone status directly from the lookup response
    const zoneInfo = data.result[0];
    const status = zoneInfo.status;
    const isActive = status === 'active';
    
    console.log(`Domain status from lookup: ${status}, isActive: ${isActive}`);
    
    return {
      status: status,
      active: isActive,
      zoneId: zoneInfo.id
    };
  } catch (error) {
    console.error(`Error checking domain activation by name ${domainName}:`, error);
    throw error;
  }
}

// Add a new function to check and fix DNS settings for Vercel domains
export async function checkAndFixDnsSettings(domainName: string, zoneId?: string): Promise<any> {
  try {
    // Trim whitespace from domain name
    domainName = domainName.trim();
    
    console.log(`[${new Date().toISOString()}] checkAndFixDnsSettings: Checking DNS records for ${domainName}`);
    
    // Get the effective zone ID
    const effectiveZoneId = getEffectiveZoneId(zoneId);
    
    // First, check root domain records
    const rootRecords = await getDnsRecords(domainName, effectiveZoneId);
    let rootFixed = false;
    
    // Check A record for root domain (recommended by Vercel for apex domains)
    const existingRootA = rootRecords.find((r: any) => r.type === 'A' && r.content === '76.76.21.21');
    const existingRootCname = rootRecords.find((r: any) => r.type === 'CNAME');
    
    // If there's a conflicting CNAME record, we need to delete it to add an A record
    if (existingRootCname && !existingRootA) {
      console.log(`[${new Date().toISOString()}] checkAndFixDnsSettings: Found conflicting CNAME record for root domain ${domainName}, removing it`);
      await deleteDnsRecord(existingRootCname.id, effectiveZoneId);
    }
    
    // If no A record exists for the root, create it
    if (!existingRootA) {
      console.log(`[${new Date().toISOString()}] checkAndFixDnsSettings: Creating A record for root domain ${domainName}`);
      await createDnsRecord('@', domainName, 'A', '76.76.21.21', effectiveZoneId);
      rootFixed = true;
    } else {
      console.log(`[${new Date().toISOString()}] checkAndFixDnsSettings: A record already exists for root domain ${domainName}`);
    }
    
    // Then check www subdomain
    const wwwRecords = await getDnsRecords(`www.${domainName}`, effectiveZoneId);
    let wwwFixed = false;
    
    // Check for CNAME for www subdomain (always recommended)
    const existingWwwCname = wwwRecords.find((r: any) => r.type === 'CNAME' && r.content === 'cname.vercel-dns.com');
    
    // If no CNAME exists for www, create it
    if (!existingWwwCname) {
      console.log(`[${new Date().toISOString()}] checkAndFixDnsSettings: Creating CNAME record for www.${domainName}`);
      await createDnsRecord('www', domainName, 'CNAME', 'cname.vercel-dns.com', effectiveZoneId);
      wwwFixed = true;
    } else {
      console.log(`[${new Date().toISOString()}] checkAndFixDnsSettings: CNAME record already exists for www.${domainName}`);
    }
    
    return {
      success: true,
      rootFixed,
      wwwFixed,
      message: rootFixed || wwwFixed ? 'DNS settings fixed' : 'DNS settings already correct'
    };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] checkAndFixDnsSettings: Error checking/fixing DNS settings for ${domainName}:`, error);
    return { success: false, error };
  }
}