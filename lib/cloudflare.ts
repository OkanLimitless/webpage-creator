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

  // Cloudflare Workers API methods
  async createWorker(scriptName: string, scriptContent: string) {
    // In development with missing credentials, return mock success
    if (isDevelopment && (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)) {
      return {
        success: true,
        result: {
          id: 'mock-worker-id',
          script: scriptName
        }
      };
    }

    if (!CLOUDFLARE_ACCOUNT_ID) {
      throw new Error('Cloudflare account ID is required to create workers');
    }

    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${scriptName}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/javascript',
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
      body: scriptContent,
    });
    return response.json();
  },

  async updateWorker(scriptName: string, scriptContent: string) {
    // In development with missing credentials, return mock success
    if (isDevelopment && (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)) {
      return {
        success: true,
        result: {
          id: 'mock-worker-id',
          script: scriptName
        }
      };
    }

    if (!CLOUDFLARE_ACCOUNT_ID) {
      throw new Error('Cloudflare account ID is required to update workers');
    }

    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${scriptName}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/javascript',
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
      body: scriptContent,
    });
    return response.json();
  },

  async deleteWorker(scriptName: string) {
    // In development with missing credentials, return mock success
    if (isDevelopment && (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)) {
      return {
        success: true
      };
    }

    if (!CLOUDFLARE_ACCOUNT_ID) {
      throw new Error('Cloudflare account ID is required to delete workers');
    }

    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${scriptName}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });
    return response.json();
  },

  async createWorkerRoute(zoneId: string, pattern: string, scriptName: string) {
    // In development with missing credentials, return mock success
    if (isDevelopment && (!process.env.CLOUDFLARE_API_TOKEN)) {
      return {
        success: true,
        result: {
          id: 'mock-route-id',
          pattern: pattern,
          script: scriptName
        }
      };
    }

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
      body: JSON.stringify({
        pattern: pattern,
        script: scriptName
      }),
    });
    return response.json();
  },

  async deleteWorkerRoute(zoneId: string, routeId: string) {
    // In development with missing credentials, return mock success
    if (isDevelopment && (!process.env.CLOUDFLARE_API_TOKEN)) {
      return {
        success: true
      };
    }

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes/${routeId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });
    return response.json();
  },

  async listWorkerRoutes(zoneId: string) {
    // In development with missing credentials, return mock data
    if (isDevelopment && (!process.env.CLOUDFLARE_API_TOKEN)) {
      return {
        success: true,
        result: []
      };
    }

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`, {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });
    return response.json();
  },

  async listZones() {
    // In development with missing credentials, return mock data
    if (isDevelopment && (!process.env.CLOUDFLARE_API_TOKEN)) {
      return {
        success: true,
        result: [
          { id: 'mock-zone-1', name: 'example.com', status: 'active' },
          { id: 'mock-zone-2', name: 'test.com', status: 'pending' }
        ]
      };
    }

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones`, {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });
    return response.json();
  }
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
  proxied: boolean = false, // Default to false which is required for Vercel SSL to work properly
  forceProxied?: boolean // New parameter to override Vercel detection for cloaking
) {
  try {
    // Trim whitespace from domain and subdomain
    domain = domain.trim();
    subdomain = subdomain.trim();
    
    // For Cloudflare DNS API, we should use just the subdomain as name when it's in the correct zone
    const name = subdomain;
    const effectiveZoneId = getEffectiveZoneId(zoneId);
    console.log(`[${new Date().toISOString()}] createDnsRecord: Creating DNS record for ${name} in domain ${domain} with zone ID: ${effectiveZoneId}`);
    console.log(`[${new Date().toISOString()}] createDnsRecord: Type: ${type}, Content: ${content}, Proxied: ${proxied}, ForceProxied: ${forceProxied}`);
    
    // Check if this is a record pointing to Vercel
    const isVercelRecord = content.includes('vercel') || content === '76.76.21.21';
    
    // Determine final proxied value
    let shouldProxy: boolean;
    
    if (forceProxied !== undefined) {
      // If forceProxied is explicitly set, use that value (for cloaking)
      shouldProxy = forceProxied;
      console.log(`[${new Date().toISOString()}] createDnsRecord: Using forceProxied=${forceProxied} for cloaking`);
    } else if (isVercelRecord) {
      // Force proxied to false if this is a Vercel record to prevent redirect loops
      // Vercel requires DNS-only mode for its SSL to work properly
      shouldProxy = false;
      console.log(`[${new Date().toISOString()}] createDnsRecord: Detected Vercel record, forcing proxied=false to prevent redirect loops`);
    } else {
      // Use the provided proxied value for non-Vercel records
      shouldProxy = proxied;
    }
    
    const response = await cf.createDnsRecord({
      type,
      name,
      content,
      ttl: 1, // Auto TTL
      proxied: shouldProxy, // Use the determined proxied value
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

// Helper function to generate reverse proxy worker script (without JCI for now)
export function generateJciWorkerScript(options: {
  safeUrl: string;
  moneyUrl: string;
  whitePageUrl?: string;
  targetCountries: string[];
  excludeCountries?: string[];
}): string {
  const { moneyUrl, whitePageUrl, safeUrl } = options;
  
  // Use white page URL if provided, otherwise use safe URL as fallback
  const safePageUrl = whitePageUrl || safeUrl;
  
  // Convert country names to country codes for ip-api.com
  const countryNameToCode: Record<string, string> = {
    'Germany': 'DE',
    'United States': 'US',
    'United Kingdom': 'GB',
    'France': 'FR',
    'Italy': 'IT',
    'Spain': 'ES',
    'Netherlands': 'NL',
    'Belgium': 'BE',
    'Austria': 'AT',
    'Switzerland': 'CH',
    'Canada': 'CA',
    'Australia': 'AU',
    'Norway': 'NO',
    'Sweden': 'SE',
    'Denmark': 'DK',
    'Finland': 'FI',
    'Poland': 'PL',
    'Czech Republic': 'CZ',
    'Portugal': 'PT',
    'Ireland': 'IE',
    'Luxembourg': 'LU',
    'New Zealand': 'NZ',
    'Japan': 'JP',
    'South Korea': 'KR'
  };
  
  // Convert target countries from names to codes
  const targetCountryCodes = options.targetCountries
    .map(country => countryNameToCode[country] || country)
    .filter(code => code); // Remove any undefined values
  
  // Use fixed CDN path for consistency
  const selectedCdnPath = 'r8';
  
  return `// ULTIMATE CLOAKING WORKER v3.0
// Advanced bot detection with reverse proxy capabilities

const TARGET_COUNTRIES = ${JSON.stringify(targetCountryCodes)};
const MONEY_URL = '${moneyUrl}';
const SAFE_URL = '${safePageUrl}';
const CDN_PATH = '${selectedCdnPath}';
const PROXYCHECK_API_KEY = '235570-278538-1m4693-m16027';

const BOT_USER_AGENTS = [
  'googlebot', 'google', 'bingbot', 'slurp', 'duckduckbot',
  'baiduspider', 'yandexbot', 'facebookexternalhit', 'twitterbot',
  'linkedinbot', 'whatsapp', 'telegrambot', 'curl', 'wget',
  'python', 'requests', 'urllib', 'java', 'go-http', 'okhttp',
  'axios', 'fetch', 'postman', 'insomnia', 'headless', 'phantom',
  'selenium', 'puppeteer', 'playwright', 'chromedriver', 'webdriver',
  'nmap', 'masscan', 'zmap', 'shodan', 'censys', 'nuclei',
  'sqlmap', 'nikto', 'gobuster', 'dirb', 'burp', 'owasp',
  'monitor', 'check', 'test', 'scan', 'audit', 'analysis',
  'crawler', 'spider', 'scraper', 'parser', 'extractor',
  'semrush', 'ahrefs', 'majestic', 'moz', 'sistrix'
];

const DATACENTER_ASNS = [
  13335, 15169, 16509, 8075, 32934, 14061, 20940,
  16276, 46606, 174, 3356, 1299, 6453, 2914, 24940,
  20473, 63949, 39351, 398324, 13414, 30633
];

const BLOCKED_COUNTRIES = ['CN', 'RU', 'IN', 'PK', 'BD', 'VN', 'IR', 'KP', 'BY'];
const requestTracker = new Map();
// --- END CONFIGURATION ---

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  // ROUTE 1: Serve the advanced service worker with comprehensive blocking
  if (url.pathname === '/service-worker.js') {
    const swCode = '// Service Worker Configuration - Use the same CDN path as main worker\\n' +
      'const CDN_PATH = \\'' + CDN_PATH + '\\';\\n\\n' +
      'const TRACKER_BLACKLIST = [\\n' +
      '  // Analytics & Tracking\\n' +
      '  \\'google-analytics.com\\', \\'googletagmanager.com\\', \\'googleadservices.com\\',\\n' +
      '  \\'doubleclick.net\\', \\'googlesyndication.com\\', \\'pagead2.googlesyndication.com\\', \\'doubleverify.com\\',\\n' +
      '  \\'facebook.com\\', \\'facebook.net\\', \\'fbcdn.net\\', \\'connect.facebook.net\\',\\n' +
      '  \\'analytics.twitter.com\\', \\'ads-twitter.com\\', \\'t.co\\',\\n' +
      '  \\'linkedin.com\\', \\'ads.linkedin.com\\', \\'snap.licdn.com\\',\\n' +
      '  \\'analytics.tiktok.com\\', \\'ads.tiktok.com\\',\\n' +
      '  \\'analytics.optidigital.com\\', \\'outbrain.com\\', \\'taboola.com\\',\\n' +
      '  // Ad Networks & Sync Services (from console errors)\\n' +
      '  \\'acdn.afnx.com\\', \\'afnx.com\\', \\'stackadapt.com\\', \\'srv.stackadapt.com\\',\\n' +
      '  \\'sync.srv.stackadapt.com\\', \\'dmp\\', \\'usersync\\', \\'async_usersync\\',\\n' +
      '  \\'adsystem.com\\', \\'adsystem.net\\', \\'adnxs.com\\', \\'adsystem\\',\\n' +
      '  // Anti-bot services\\n' +
      '  \\'recaptcha.net\\', \\'gstatic.com\\',\\n' +
      '  \\'akamai.com\\', \\'fastly.com\\', \\'imperva.com\\',\\n' +
      '  \\'distilnetworks.com\\', \\'perimeterx.com\\',\\n' +
      '  // Bot detection\\n' +
      '  \\'datadome.co\\', \\'shape.com\\', \\'kasada.io\\',\\n' +
      '  \\'fingerprintjs.com\\', \\'trustpilot.com\\',\\n' +
      '  // Security scanners\\n' +
      '  \\'qualys.com\\', \\'nessus.org\\', \\'rapid7.com\\'\\n' +
      '];\\n\\n' +
      'const SEARCH_ENGINE_PATTERNS = [\\n' +
      '  /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i,\\n' +
      '  /crawler/i, /spider/i, /scraper/i\\n' +
      '];\\n\\n' +
      'self.addEventListener(\\'install\\', () => {\\n' +
      '  console.log(\\'🔧 Service Worker installing\\');\\n' +
      '  self.skipWaiting();\\n' +
      '});\\n\\n' +
      'self.addEventListener(\\'activate\\', event => {\\n' +
      '  console.log(\\'🚀 Service Worker activated\\');\\n' +
      '  event.waitUntil(self.clients.claim());\\n' +
      '});\\n\\n' +
      'self.addEventListener(\\'fetch\\', event => {\\n' +
      '  const request = event.request;\\n' +
      '  const url = new URL(request.url);\\n' +
      '  const selfOrigin = new URL(self.registration.scope).origin;\\n' +
      '  \\n' +
      '  console.log(\\'🔍 SW intercepting:\\', url.href, \\'Mode:\\', request.mode);\\n' +
      '  \\n' +
      '  // Don\\'t intercept same-origin requests or navigation requests\\n' +
      '  if (url.origin === selfOrigin || request.mode === \\'navigate\\') {\\n' +
      '    console.log(\\'⏭️ Skipping same-origin/navigation request\\');\\n' +
      '    return;\\n' +
      '  }\\n' +
      '  \\n' +
      '  // Block keepalive requests (often used for tracking)\\n' +
      '  if (request.keepalive) {\\n' +
      '    event.respondWith(new Response(null, { status: 204 }));\\n' +
      '    return;\\n' +
      '  }\\n' +
      '  \\n' +
      '  // Block known trackers and analytics\\n' +
      '  if (TRACKER_BLACKLIST.some(tracker => url.hostname.includes(tracker) || url.pathname.includes(tracker))) {\\n' +
      '    console.log(\\'🚫 Blocked tracker:\\', url.hostname, url.pathname);\\n' +
      '    \\n' +
      '    // Return appropriate response to minimize console errors\\n' +
      '    if (url.pathname.endsWith(\\'.js\\')) {\\n' +
      '      event.respondWith(new Response(\\'// Blocked tracking script\\', { \\n' +
      '        status: 200, \\n' +
      '        headers: { \\'Content-Type\\': \\'application/javascript\\' }\\n' +
      '      }));\\n' +
      '    } else if (url.pathname.endsWith(\\'.css\\')) {\\n' +
      '      event.respondWith(new Response(\\'/* Blocked tracking stylesheet */\\', { \\n' +
      '        status: 200, \\n' +
      '        headers: { \\'Content-Type\\': \\'text/css\\' }\\n' +
      '      }));\\n' +
      '    } else if (url.pathname.includes(\\'pixel\\') || url.pathname.includes(\\'sync\\') || url.pathname.includes(\\'usersync\\')) {\\n' +
      '      // Return 1x1 transparent GIF for tracking pixels\\n' +
      '      const pixel = new Uint8Array([71,73,70,56,57,97,1,0,1,0,128,0,0,255,255,255,0,0,0,33,249,4,1,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,4,1,0,59]);\\n' +
      '      event.respondWith(new Response(pixel, { \\n' +
      '        status: 200, \\n' +
      '        headers: { \\'Content-Type\\': \\'image/gif\\' }\\n' +
      '      }));\\n' +
      '    } else {\\n' +
      '      event.respondWith(new Response(null, { status: 204 }));\\n' +
      '    }\\n' +
      '    return;\\n' +
      '  }\\n' +
      '  \\n' +
      '  // Block suspicious user agents at service worker level\\n' +
      '  const userAgent = request.headers.get(\\'User-Agent\\') || \\'\\';\\n' +
      '  if (SEARCH_ENGINE_PATTERNS.some(pattern => pattern.test(userAgent))) {\\n' +
      '    console.log(\\'🤖 Blocked bot request:\\', userAgent);\\n' +
      '    event.respondWith(new Response(null, { status: 204 }));\\n' +
      '    return;\\n' +
      '  }\\n' +
      '  \\n' +
      '  // Check if this is an asset request that should be proxied\\n' +
      '  const pathname = url.pathname.toLowerCase();\\n' +
      '  const isAssetRequest = pathname.endsWith(\\'.css\\') || pathname.endsWith(\\'.js\\') || \\n' +
      '                        pathname.endsWith(\\'.png\\') || pathname.endsWith(\\'.jpg\\') || \\n' +
      '                        pathname.endsWith(\\'.jpeg\\') || pathname.endsWith(\\'.gif\\') || \\n' +
      '                        pathname.endsWith(\\'.svg\\') || pathname.endsWith(\\'.woff\\') || \\n' +
      '                        pathname.endsWith(\\'.woff2\\') || pathname.endsWith(\\'.ttf\\') || \\n' +
      '                        pathname.endsWith(\\'.ico\\') || pathname.endsWith(\\'.webp\\');\\n' +
      '  \\n' +
      '  const isTrackingRequest = pathname.includes(\\'analytics\\') || \\n' +
      '                           pathname.includes(\\'tracking\\') || \\n' +
      '                           pathname.includes(\\'ads\\') || \\n' +
      '                           pathname.includes(\\'metrics\\') || \\n' +
      '                           url.hostname.includes(\\'google-analytics\\') || \\n' +
      '                           url.hostname.includes(\\'facebook\\') || \\n' +
      '                           url.hostname.includes(\\'twitter\\') || \\n' +
      '                           url.hostname.includes(\\'linkedin\\');\\n' +
      '  \\n' +
      '  const shouldProxy = isAssetRequest || isTrackingRequest;\\n' +
      '  \\n' +
      '  // Only proxy suspicious requests, let legitimate content through\\n' +
      '  if (shouldProxy) {\\n' +
      '    console.log(\\'🔄 SW proxying request:\\', url.href);\\n' +
      '    event.respondWith(\\n' +
      '      (async () => {\\n' +
      '        try {\\n' +
      '          const encoded = btoa(url.href);\\n' +
      '          const proxyUrl = \\'/\\' + CDN_PATH + \\'/\\' + encoded;\\n' +
      '          \\n' +
      '          // Handle streaming body properly\\n' +
      '          const requestOptions = {\\n' +
      '            method: request.method,\\n' +
      '            headers: request.headers,\\n' +
      '            mode: \\'cors\\',\\n' +
      '            credentials: \\'omit\\'\\n' +
      '          };\\n' +
      '          \\n' +
      '          // Only add body and duplex for requests that need it\\n' +
      '          if (request.method !== \\'GET\\' && request.method !== \\'HEAD\\' && request.body) {\\n' +
      '            requestOptions.body = request.body;\\n' +
      '            requestOptions.duplex = \\'half\\';\\n' +
      '          }\\n' +
      '          \\n' +
      '          const proxyRequest = new Request(proxyUrl, requestOptions);\\n' +
      '          return await fetch(proxyRequest);\\n' +
      '        } catch (error) {\\n' +
      '          console.error(\\'SW proxy error:\\', error);\\n' +
      '          return new Response(null, { status: 204 });\\n' +
      '        }\\n' +
      '      })()\\n' +
      '    );\\n' +
      '    return;\\n' +
      '  } else {\\n' +
      '    console.log(\\'⏭️ SW letting request pass through:\\', url.href);\\n' +
      '  }\\n' +
      '  // Let all other requests pass through normally\\n' +
      '});';
    
    return new Response(swCode, { 
      headers: { 
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=86400'
      } 
    });
  }

  // ROUTE 2: Handle proxied resource requests (for CSS, JS, images).
  if (url.pathname.startsWith('/' + CDN_PATH + '/')) {
    return handleResourceRequest(request);
  }
  
  // ROUTE 3: Handle the initial page load with cloaking logic.
  return handleMainRequest(request);
}

// --- CORE FUNCTIONS ---

async function isVisitorABot(request) {
  const clientIP = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
  const userAgent = request.headers.get('User-Agent') || '';
  const acceptHeader = request.headers.get('Accept') || '';
  const acceptLanguage = request.headers.get('Accept-Language') || '';
  
  let botScore = 0;

  try {
    // Check user agent for bot patterns
    const userAgentLower = userAgent.toLowerCase();
    for (let i = 0; i < BOT_USER_AGENTS.length; i++) {
      if (userAgentLower.includes(BOT_USER_AGENTS[i])) {
        botScore += 0.4;
        break;
      }
    }

    // Check browser headers
    if (!acceptHeader.includes('text/html')) {
      botScore += 0.3;
    }
    
    if (!acceptLanguage || acceptLanguage.split(',').length < 2) {
      botScore += 0.2;
    }

    // Check datacenter ASN if available
    if (request.cf && request.cf.asn) {
      if (DATACENTER_ASNS.includes(request.cf.asn)) {
        botScore += 0.3;
      }
    }

    // Request frequency tracking
    const clientKey = clientIP + ':' + userAgent;
    const now = Date.now();
    
    if (requestTracker.has(clientKey)) {
      const tracker = requestTracker.get(clientKey);
      const timeDiff = now - tracker.lastSeen;
      
      if (timeDiff < 100) {
        botScore += 0.5;
      }
      
      tracker.count++;
      tracker.lastSeen = now;
      
      if (tracker.count > 10 && (now - tracker.firstSeen) < 60000) {
        botScore += 0.4;
      }
    } else {
      const newTracker = {
        count: 1,
        firstSeen: now,
        lastSeen: now
      };
      requestTracker.set(clientKey, newTracker);
    }

    // Geo check
    const geoRes = await fetch('https://ip-api.com/json/' + clientIP + '?fields=countryCode,org');
    if (geoRes.ok) {
      const geo = await geoRes.json();
      
      // Block high-risk countries
      if (BLOCKED_COUNTRIES.includes(geo.countryCode)) {
        botScore += 0.8;
      }
      
      // Check target countries
      if (!TARGET_COUNTRIES.includes(geo.countryCode)) {
        botScore += 0.6;
      }
      
      // Check hosting providers
      const org = (geo.org || '').toLowerCase();
      if (org.includes('hosting') || org.includes('cloud') || org.includes('datacenter') || org.includes('server')) {
        botScore += 0.3;
      }
    }

    // ProxyCheck.io risk assessment
    if (botScore < 0.7) {
      try {
        const pcUrl = 'https://proxycheck.io/v2/' + clientIP + '?key=' + PROXYCHECK_API_KEY + '&vpn=1&risk=1';
        const response = await fetch(pcUrl);
        const data = await response.json();
        const ipData = data[clientIP];

        if (ipData) {
          const risk = parseInt(ipData.risk || '0', 10);
          if (risk >= 60) {
            botScore += 0.4;
          }
          
          if (ipData.proxy === 'yes' || ipData.vpn === 'yes') {
            botScore += 0.3;
          }
        }
      } catch (pcError) {
        console.warn('ProxyCheck API error:', pcError.message);
      }
    }

    const isBot = botScore > 0.8; // Made less aggressive - was 0.6
  
  console.log('🔍 Bot detection details:');
  console.log('  - Final bot score:', botScore);
  console.log('  - Is classified as bot:', isBot);
  console.log('  - User Agent:', userAgent);
  console.log('  - Client IP:', clientIP);
    console.log('Bot detection result:', isBot, 'Score:', botScore.toFixed(2));
    return isBot;

  } catch (error) {
    console.error('Bot detection error:', error.message);
    return true;
  }
}

async function handleMainRequest(request) {
  const requestUrl = new URL(request.url);
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  
  try {
    const isBot = await isVisitorABot(request);
    
    // ✅ CRITICAL: Maintain URL path parity for perfect cloaking
    // Bots must see the EXACT same path they requested on the safe domain
    let targetUrl;
    if (isBot) {
      // Bot requesting /nieuws/muziek/12345 gets achterhoeknieuws.nl/nieuws/muziek/12345
      const safeOrigin = new URL(SAFE_URL).origin;
      targetUrl = safeOrigin + requestUrl.pathname + requestUrl.search;
    } else {
      // For real users, construct URL with money domain + requested path
      if (requestUrl.pathname === '/' || requestUrl.pathname === '') {
        targetUrl = MONEY_URL;
      } else {
        const moneyOrigin = new URL(MONEY_URL).origin;
        targetUrl = moneyOrigin + requestUrl.pathname + requestUrl.search;
      }
    }
    
    const baseTargetUrl = isBot ? SAFE_URL : MONEY_URL;
    
    console.log('🎯 Routing to:', isBot ? 'SAFE' : 'MONEY', 'page for IP:', clientIP);
    console.log('📍 Original URL:', requestUrl.href);
    console.log('🔗 Target URL:', targetUrl);
    console.log('🛡️ Path Parity:', requestUrl.pathname, '→', new URL(targetUrl).pathname);
    console.log('🤖 Bot detection result:', isBot);
    console.log('👤 User Agent:', request.headers.get('User-Agent'));
    console.log('🌍 Accept Header:', request.headers.get('Accept'));
    
    const upstreamHeaders = new Headers(request.headers);
    upstreamHeaders.set('X-Forwarded-For', clientIP);
    upstreamHeaders.set('X-Real-IP', clientIP);
    upstreamHeaders.delete('CF-Connecting-IP');
    upstreamHeaders.delete('CF-RAY');
    upstreamHeaders.delete('CF-Visitor');
    
    const upstreamRequest = new Request(targetUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body: request.body
    });
    
    console.log('🌐 Fetching upstream URL:', targetUrl);
    const response = await fetch(upstreamRequest);
    
    console.log('📡 Upstream response status:', response.status);
    console.log('📋 Upstream response headers:', [...response.headers.entries()]);
    
    if (!response.ok) {
      console.error('❌ Upstream error:', response.status, response.statusText, 'for', targetUrl);
      console.error('🔍 Response headers:', [...response.headers.entries()]);
      
      // Try to get response body for debugging
      const errorBody = await response.text();
      console.error('💥 Error response body:', errorBody.substring(0, 500));
      
      return new Response('<!DOCTYPE html><html><head><title>Page Not Found</title></head><body><h1>404 - Page Not Found</h1><p>The requested page could not be found.</p><p>Debug: ' + response.status + ' ' + response.statusText + '</p></body></html>', {
        status: 404,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet'
        }
      });
    }
    
    // Check if response has content
    const contentLength = response.headers.get('content-length');
    const contentType = response.headers.get('content-type');
    console.log('📏 Content length:', contentLength);
    console.log('📄 Content type:', contentType);
    
    console.log('🔧 Setting up HTMLRewriter for:', requestUrl.pathname);
    console.log('🎯 Base target URL:', baseTargetUrl);
    console.log('🏠 Proxy domain:', requestUrl.hostname);
    
    // ✅ FIXED: Re-enable HTMLRewriter with safer, more conservative approach
    console.log('🔧 Enabling conservative HTMLRewriter');
    
    const rewriter = new HTMLRewriter()
      // Only enable essential rewriters that won't break the page
      .on('link[rel="canonical"]', new MetadataStripper())
      .on('meta[property^="og:"]', new MetadataStripper())
      .on('meta[name="twitter:"]', new MetadataStripper())
      .on('script[type="application/ld+json"]', new MetadataStripper())
      .on('base', {
        element(base) {
          console.log('🧱 Stripping <base> tag:', base.getAttribute('href'));
          base.remove();
        }
      });
    
    const transformedResponse = rewriter.transform(response);
    
    const finalResponse = new Response(transformedResponse.body, {
      status: transformedResponse.status,
      statusText: transformedResponse.statusText,
      headers: transformedResponse.headers
    });
    
    // ✅ CRITICAL: Anti-leak headers for perfect cloaking
    finalResponse.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex');
    finalResponse.headers.set('X-Frame-Options', 'SAMEORIGIN');
    finalResponse.headers.set('X-Content-Type-Options', 'nosniff');
    finalResponse.headers.set('Referrer-Policy', 'no-referrer');
    finalResponse.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    // Temporarily disable CSP to debug asset loading issues
    // finalResponse.headers.set('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'");
    
    // Remove identifying headers that could leak source
    finalResponse.headers.delete('Server');
    finalResponse.headers.delete('X-Powered-By');
    finalResponse.headers.delete('CF-RAY');
    finalResponse.headers.delete('CF-Cache-Status');
    finalResponse.headers.delete('Age');
    finalResponse.headers.delete('Via');
    finalResponse.headers.delete('X-Cache');
    
    finalResponse.headers.set('Vary', 'User-Agent, Accept-Encoding, Accept-Language');
    finalResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    finalResponse.headers.set('Pragma', 'no-cache');
    finalResponse.headers.set('Expires', '0');
    
    return finalResponse;
    
  } catch (error) {
    console.error('Main request handler error:', error.message);
    return new Response('<!DOCTYPE html><html><head><title>Service Unavailable</title></head><body><h1>503 - Service Unavailable</h1><p>The service is temporarily unavailable. Please try again later.</p></body></html>', {
      status: 503,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Retry-After': '300'
      }
    });
  }
}

async function handleResourceRequest(request) {
  try {
    const url = new URL(request.url);
    const encodedUrl = url.pathname.replace('/' + CDN_PATH + '/', '');
    
    console.log('🔗 Resource request for CDN path:', url.pathname);
    console.log('📦 Encoded URL:', encodedUrl);
    
    if (!encodedUrl) {
      console.warn('❌ Empty encoded URL from path:', url.pathname);
      return new Response('Empty resource URL', { status: 400 });
    }
    
    // More lenient base64 validation - allow URL-safe base64
    if (!encodedUrl.match(/^[A-Za-z0-9+/_-]*={0,2}$/)) {
      console.warn('Invalid base64 URL format:', encodedUrl);
      return new Response('Invalid resource URL format', { status: 400 });
    }
    
    let resourceUrl;
    try {
      resourceUrl = atob(encodedUrl);
      console.log('🎯 Decoded resource URL:', resourceUrl);
    } catch (decodeError) {
      console.warn('❌ Failed to decode base64 URL:', encodedUrl);
      return new Response('Malformed resource URL', { status: 400 });
    }
    
    let targetUrl;
    try {
      targetUrl = new URL(resourceUrl);
    } catch (urlError) {
      console.warn('Invalid decoded URL:', resourceUrl);
      return new Response('Malformed resource URL', { status: 400 });
    }

    // ✅ CRITICAL FIX: Create clean headers with correct Host header
    const cleanHeaders = new Headers();
    
    // Forward essential browser headers
    const allowedHeaders = ['accept', 'accept-encoding', 'accept-language', 'cache-control', 'user-agent', 'referer'];
    for (const headerPair of request.headers) {
      const key = headerPair[0].toLowerCase();
      const value = headerPair[1];
      if (allowedHeaders.includes(key)) {
        cleanHeaders.set(key, value);
      }
    }
    
    // ✅ CRITICAL: Set correct Host header for target domain
    cleanHeaders.set('Host', targetUrl.hostname);
    cleanHeaders.set('Origin', targetUrl.origin);
    
    console.log('🏠 Setting Host header to:', targetUrl.hostname);
    
    // Create clean request with proper headers
    const resourceRequest = new Request(resourceUrl, {
      method: 'GET',
      headers: cleanHeaders,
      redirect: 'follow'
    });

    let response;
    try {
      response = await fetch(resourceRequest);
      console.log('✅ Resource fetch success:', response.status, 'for', resourceUrl);
    } catch (fetchError) {
      console.warn('❌ Resource fetch network error:', resourceUrl, fetchError.message);
      
      // Return appropriate error response based on expected resource type
      const pathname = targetUrl.pathname.toLowerCase();
      let errorContent = '';
      let errorContentType = 'text/plain';
      
      if (pathname.endsWith('.css')) {
        errorContent = '/* Network error: Resource unavailable */';
        errorContentType = 'text/css; charset=utf-8';
      } else if (pathname.endsWith('.js') || pathname.endsWith('.mjs')) {
        errorContent = '// Network error: Resource unavailable';
        errorContentType = 'application/javascript; charset=utf-8';
      } else if (pathname.endsWith('.json')) {
        errorContent = '{"error": "Network error", "message": "Resource unavailable"}';
        errorContentType = 'application/json; charset=utf-8';
      } else {
        errorContent = 'Network error: Resource unavailable';
      }
      
      return new Response(errorContent, { 
        status: 502,
        headers: { 'Content-Type': errorContentType }
      });
    }

    if (!response.ok) {
      console.warn('❌ Resource fetch failed:', resourceUrl, response.status);
      
      // Return appropriate error response based on expected resource type
      const pathname = targetUrl.pathname.toLowerCase();
      let errorContent = '';
      let errorContentType = 'text/plain';
      
      if (pathname.endsWith('.css')) {
        errorContent = '/* Resource unavailable: ' + response.status + ' */';
        errorContentType = 'text/css; charset=utf-8';
      } else if (pathname.endsWith('.js') || pathname.endsWith('.mjs')) {
        errorContent = '// Resource unavailable: ' + response.status;
        errorContentType = 'application/javascript; charset=utf-8';
      } else if (pathname.endsWith('.json')) {
        errorContent = '{"error": "Resource unavailable", "status": ' + response.status + '}';
        errorContentType = 'application/json; charset=utf-8';
      } else {
        errorContent = 'Resource unavailable (' + response.status + ')';
      }
      
      return new Response(errorContent, { 
        status: response.status,
        headers: { 'Content-Type': errorContentType }
      });
    }

    // Clone response to make headers mutable
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });

    // Set permissive CORS headers for browser
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    newResponse.headers.set('X-Content-Type-Options', 'nosniff');
    newResponse.headers.set('X-Frame-Options', 'SAMEORIGIN');
    
    // Fix MIME type issues by ensuring proper Content-Type headers
    const originalContentType = response.headers.get('Content-Type') || '';
    const pathname = targetUrl.pathname.toLowerCase();
    
    // Override incorrect MIME types based on file extension
    if (pathname.endsWith('.css') && !originalContentType.includes('text/css')) {
      newResponse.headers.set('Content-Type', 'text/css; charset=utf-8');
    } else if ((pathname.endsWith('.js') || pathname.endsWith('.mjs')) && !originalContentType.includes('javascript')) {
      newResponse.headers.set('Content-Type', 'application/javascript; charset=utf-8');
    } else if (pathname.endsWith('.json') && !originalContentType.includes('json')) {
      newResponse.headers.set('Content-Type', 'application/json; charset=utf-8');
    } else if (pathname.endsWith('.woff2')) {
      newResponse.headers.set('Content-Type', 'font/woff2');
    } else if (pathname.endsWith('.woff')) {
      newResponse.headers.set('Content-Type', 'font/woff');
    } else if (pathname.endsWith('.ttf')) {
      newResponse.headers.set('Content-Type', 'font/ttf');
    } else if (pathname.endsWith('.svg')) {
      newResponse.headers.set('Content-Type', 'image/svg+xml');
    }
    
    // Set appropriate cache headers
    const contentType = newResponse.headers.get('Content-Type') || '';
    if (contentType.includes('image/') || contentType.includes('font/')) {
      newResponse.headers.set('Cache-Control', 'public, max-age=2592000');
    } else if (contentType.includes('text/css') || contentType.includes('javascript')) {
      newResponse.headers.set('Cache-Control', 'public, max-age=86400');
    } else {
      newResponse.headers.set('Cache-Control', 'public, max-age=3600');
    }

    return newResponse;

  } catch (error) {
    console.error('❌ Resource proxy critical error:', error.message);
    
    // Return generic error response since we might not have resourceUrl
    return new Response('/* Resource proxy error */', { 
      status: 502,
      headers: { 'Content-Type': 'text/css; charset=utf-8' }
    });
  }
}

class AttributeRewriter {
  constructor(proxyDomain, targetOrigin, cdnPath) {
    this.proxyDomain = proxyDomain;
    this.targetOrigin = targetOrigin;
    this.cdnPath = cdnPath;
  }
  
  element(element) {
    const attributes = ['href', 'src', 'action', 'data-src', 'srcset'];
    for (let i = 0; i < attributes.length; i++) {
      const attr = attributes[i];
      const originalUrl = element.getAttribute(attr);
      if (originalUrl) {
        try {
          let absoluteUrl;
          
          // Handle relative URLs and absolute URLs
          if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://')) {
            // Already absolute URL
            absoluteUrl = originalUrl;
          } else if (originalUrl.startsWith('//')) {
            // Protocol-relative URL
            absoluteUrl = 'https:' + originalUrl;
          } else if (originalUrl.startsWith('/')) {
            // Root-relative URL
            const targetOriginObj = new URL(this.targetOrigin);
            absoluteUrl = targetOriginObj.origin + originalUrl;
          } else {
            // Relative URL
            absoluteUrl = new URL(originalUrl, this.targetOrigin).href;
          }
          
          // Only rewrite if it's not already pointing to our proxy domain
          if (!absoluteUrl.includes(this.proxyDomain)) {
            const urlObj = new URL(absoluteUrl);
            const targetUrlObj = new URL(this.targetOrigin);
            
            // For same-domain resources, check if they should be proxied
            if (urlObj.hostname === targetUrlObj.hostname) {
              // Check if this is an asset that needs proxying
              const pathname = urlObj.pathname.toLowerCase();
              const isAsset = pathname.endsWith('.css') || pathname.endsWith('.js') || pathname.endsWith('.mjs') || 
                             pathname.endsWith('.json') || pathname.endsWith('.png') || pathname.endsWith('.jpg') || 
                             pathname.endsWith('.jpeg') || pathname.endsWith('.gif') || pathname.endsWith('.svg') || 
                             pathname.endsWith('.woff') || pathname.endsWith('.woff2') || pathname.endsWith('.ttf') || 
                             pathname.endsWith('.ico') || pathname.endsWith('.webp') || pathname.endsWith('.xml') ||
                             pathname.endsWith('.pdf') || pathname.endsWith('.mp4') || pathname.endsWith('.mp3') ||
                             pathname.endsWith('.zip') || pathname.endsWith('.eot') || pathname.endsWith('.otf');
              
              if (isAsset) {
                // ALWAYS proxy assets through CDN path to avoid CORS/CSP issues
                const encoded = btoa(absoluteUrl);
                const newUrl = '/' + this.cdnPath + '/' + encoded;
                console.log('🔄 Rewriting asset:', originalUrl, '→', newUrl);
                element.setAttribute(attr, newUrl);
              } else {
                // For same-domain HTML pages/articles, use relative paths (let main handler route them)
                console.log('📄 Keeping relative path for page:', originalUrl, '→', urlObj.pathname + urlObj.search);
                element.setAttribute(attr, urlObj.pathname + urlObj.search);
              }
            } else {
              // For external domains, always proxy
              const encoded = btoa(absoluteUrl);
              element.setAttribute(attr, '/' + this.cdnPath + '/' + encoded);
            }
          }
        } catch (e) {
          console.warn('Failed to rewrite URL:', originalUrl, e.message);
        }
      }
    }
  }
}

class HeadRewriter {
  element(head) {
    // Inject Service Worker for asset control
    const swScript = '<script>if("serviceWorker" in navigator){navigator.serviceWorker.register("/service-worker.js").then(function(reg){console.log("✅ Service Worker registered successfully");}).catch(function(e){console.warn("❌ Service Worker registration failed:", e);});}else{console.warn("❌ Service Worker not supported");}try{Object.defineProperty(navigator,"webdriver",{get:function(){return undefined;}});window.chrome=window.chrome||{runtime:{}};delete navigator.__proto__.webdriver;delete navigator.webdriver;}catch(e){}</script>';
    head.append(swScript, { html: true });

    // ✅ CRITICAL: Anti-bot metadata to prevent indexing and referral leakage
    const metaTags = '<meta name="robots" content="noindex,nofollow,noarchive,nosnippet,noimageindex"><meta name="googlebot" content="noindex,nofollow,noarchive,nosnippet,noimageindex"><meta http-equiv="X-Robots-Tag" content="noindex,nofollow,noarchive,nosnippet"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1">';
    head.append(metaTags, { html: true });
  }
}

class FormRewriter {
  constructor(proxyDomain, cdnPath) {
    this.proxyDomain = proxyDomain;
    this.cdnPath = cdnPath;
  }
  
  element(form) {
    const action = form.getAttribute('action');
    if (action && !action.startsWith('/') && !action.includes(this.proxyDomain)) {
      const encoded = btoa(action);
      form.setAttribute('action', '/' + this.cdnPath + '/' + encoded);
    }
  }
}

class LinkRewriter {
  constructor(proxyDomain, targetOrigin, cdnPath) {
    this.proxyDomain = proxyDomain;
    this.targetOrigin = targetOrigin;
    this.cdnPath = cdnPath;
  }
  
  element(link) {
    const href = link.getAttribute('href');
    if (href) {
      try {
        let absoluteUrl;
        
        // Handle different types of URLs
        if (href.startsWith('http://') || href.startsWith('https://')) {
          // Already absolute URL
          absoluteUrl = href;
        } else if (href.startsWith('//')) {
          // Protocol-relative URL
          absoluteUrl = 'https:' + href;
        } else if (href.startsWith('/')) {
          // Root-relative URL - these are the problematic ones!
          const targetOriginObj = new URL(this.targetOrigin);
          absoluteUrl = targetOriginObj.origin + href;
        } else if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
          // Skip anchors and special protocols
          return;
        } else {
          // Relative URL
          absoluteUrl = new URL(href, this.targetOrigin).href;
        }
        
        // Only rewrite if it's not already pointing to our proxy domain
        if (!absoluteUrl.includes(this.proxyDomain)) {
          const linkDomain = new URL(absoluteUrl).hostname;
          const targetDomain = new URL(this.targetOrigin).hostname;
          
          // For same-domain links (articles), don't proxy them - let them be handled by main request
          if (linkDomain === targetDomain) {
            // Keep the original href but make it relative to our proxy domain
            const linkPath = new URL(absoluteUrl).pathname + new URL(absoluteUrl).search;
            link.setAttribute('href', linkPath);
          } else {
            // For external domains, proxy through CDN path
            const encoded = btoa(absoluteUrl);
            link.setAttribute('href', '/' + this.cdnPath + '/' + encoded);
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
          }
        }
      } catch (e) {
        console.warn('Failed to rewrite link:', href, e.message);
      }
    }
  }
}

class MetadataStripper {
  element(element) {
    // ✅ CRITICAL: Strip dangerous metadata that could leak source domain
    const tagName = element.tagName.toLowerCase();
    
    if (tagName === 'link' && element.getAttribute('rel') === 'canonical') {
      // Remove canonical tags that point to original domain
      element.remove();
    } else if (tagName === 'meta') {
      const property = element.getAttribute('property');
      const name = element.getAttribute('name');
      
      // Remove Open Graph and Twitter Card metadata
      if (property && (property.startsWith('og:') || property.startsWith('fb:'))) {
        element.remove();
      } else if (name && (name.startsWith('twitter:') || name === 'description')) {
        element.remove();
      }
    } else if (tagName === 'script' && element.getAttribute('type') === 'application/ld+json') {
      // Remove structured data that could leak domain info
      element.remove();
    }
  }
}

class StyleRewriter {
  constructor(proxyDomain, targetOrigin, cdnPath) {
    this.proxyDomain = proxyDomain;
    this.targetOrigin = targetOrigin;
    this.cdnPath = cdnPath;
  }

  text(textChunk) {
    let content = textChunk.text();

    // Rewrite url(/images/abc.png) → proxied via /r8/
    // Use indexOf and substring to avoid complex regex issues
    let urlIndex = content.indexOf('url(');
    while (urlIndex !== -1) {
      let startQuote = content.charAt(urlIndex + 4);
      let isQuoted = startQuote === '"' || startQuote === "'";
      let pathStart = isQuoted ? urlIndex + 5 : urlIndex + 4;
      
      // Find the end of the URL
      let pathEnd = pathStart;
      if (isQuoted) {
        pathEnd = content.indexOf(startQuote, pathStart);
      } else {
        pathEnd = content.indexOf(')', pathStart);
      }
      
      if (pathEnd !== -1) {
        let path = content.substring(pathStart, pathEnd);
        if (path.startsWith('/')) {
          try {
            const fullUrl = new URL(path, this.targetOrigin).href;
            const encoded = btoa(fullUrl);
            const newUrl = '/' + this.cdnPath + '/' + encoded;
            const replacement = isQuoted ? 
              'url(' + startQuote + newUrl + startQuote + ')' :
              'url(' + newUrl + ')';
            
            content = content.substring(0, urlIndex) + replacement + 
                     content.substring(isQuoted ? pathEnd + 2 : pathEnd + 1);
            console.log('🎨 Rewriting CSS asset:', path, '→', newUrl);
          } catch (e) {
            console.warn('Failed to rewrite CSS URL:', path, e.message);
          }
        }
      }
      
      urlIndex = content.indexOf('url(', urlIndex + 1);
    }

    // Handle @import statements with simple string replacement
    // Use indexOf approach for @import as well to avoid regex issues
    let importIndex = content.indexOf('@import');
    while (importIndex !== -1) {
      let quoteStart = -1;
      let quote = '';
      
      // Find the opening quote after @import
      for (let i = importIndex + 7; i < content.length; i++) {
        if (content.charAt(i) === '"' || content.charAt(i) === "'") {
          quoteStart = i;
          quote = content.charAt(i);
          break;
        }
      }
      
      if (quoteStart !== -1) {
        let quoteEnd = content.indexOf(quote, quoteStart + 1);
        if (quoteEnd !== -1) {
          let path = content.substring(quoteStart + 1, quoteEnd);
          if (path.startsWith('/')) {
            try {
              const fullUrl = new URL(path, this.targetOrigin).href;
              const encoded = btoa(fullUrl);
              const newPath = '/' + this.cdnPath + '/' + encoded;
              const replacement = '@import "' + newPath + '"';
              
              content = content.substring(0, importIndex) + replacement + 
                       content.substring(quoteEnd + 1);
              console.log('📥 Rewriting CSS import:', path, '→', newPath);
            } catch (e) {
              console.warn('Failed to rewrite CSS import:', path, e.message);
            }
          }
        }
      }
      
      importIndex = content.indexOf('@import', importIndex + 1);
    }

    textChunk.replace(content);
  }
}
`;
}

// Helper function to create a simple "Coming Soon" page
export function generateComingSoonPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coming Soon</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Arial', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        h1 {
            font-size: 3rem;
            margin-bottom: 1rem;
            background: linear-gradient(45deg, #fff, #f0f0f0);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        p {
            font-size: 1.2rem;
            margin-bottom: 2rem;
            opacity: 0.9;
        }
        .loader {
            width: 50px;
            height: 50px;
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-top: 3px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
            h1 { font-size: 2rem; }
            p { font-size: 1rem; }
            .container { margin: 1rem; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Coming Soon</h1>
        <p>We're working on something amazing. Stay tuned!</p>
        <div class="loader"></div>
    </div>
</body>
</html>`;
}

// Helper function to extract root domain from a full domain name
function extractRootDomain(domainName: string): string {
  // Remove any protocol if present
  domainName = domainName.replace(/^https?:\/\//, '');
  
  // Split by dots and get the last two parts (domain.tld)
  const parts = domainName.split('.');
  
  // Handle cases like domain.co.uk, domain.com.au, etc.
  // For now, we'll assume the root domain is the last two parts
  // This covers most common cases like example.com, but might need
  // adjustment for complex TLDs
  if (parts.length >= 2) {
    // Handle common two-part TLDs
    const twoPartTlds = ['co.uk', 'com.au', 'co.za', 'com.br', 'co.jp'];
    const lastTwoParts = parts.slice(-2).join('.');
    
    if (twoPartTlds.includes(lastTwoParts) && parts.length >= 3) {
      // Return last 3 parts for two-part TLDs (e.g., example.co.uk)
      return parts.slice(-3).join('.');
    } else {
      // Return last 2 parts for standard TLDs (e.g., example.com)
      return lastTwoParts;
    }
  }
  
  // If less than 2 parts, return as is
  return domainName;
}

// Main function to create a cloaked landing page with Cloudflare Worker
export async function createCloakedLandingPage(options: {
  domain: any;
  subdomain?: string;
  moneyUrl: string;
  whitePageUrl?: string;
  targetCountries: string[];
  excludeCountries?: string[];
  safePageContent?: string;
}) {
  const { domain, subdomain, moneyUrl, whitePageUrl, targetCountries, excludeCountries, safePageContent } = options;
  
  try {
    // 1. Get or find the Cloudflare Zone ID
    let zoneId = domain.cloudflareZoneId;
    
    if (!zoneId) {
      console.log(`Zone ID not found in domain object, looking up zone for domain: ${domain.name}`);
      
      // Extract root domain for zone lookup
      const rootDomain = extractRootDomain(domain.name);
      console.log(`Extracted root domain: ${rootDomain} from full domain: ${domain.name}`);
      
      zoneId = await getZoneIdByName(rootDomain);
      
      if (!zoneId) {
        // Get list of available domains in Cloudflare account for better error message
        try {
          const zonesResponse = await cf.listZones();
          let availableDomains: string[] = [];
          
          if (zonesResponse.success && zonesResponse.result && Array.isArray(zonesResponse.result)) {
            availableDomains = zonesResponse.result.map((zone: any) => zone.name);
          }
          
          const errorMessage = availableDomains.length > 0 
            ? `Could not find Cloudflare zone for root domain: ${rootDomain} (from ${domain.name}). 

Available domains in your Cloudflare account:
${availableDomains.map(d => `- ${d}`).join('\n')}

Please either:
1. Add ${rootDomain} to your Cloudflare account first, or 
2. Use one of the existing domains listed above.`
            : `Could not find Cloudflare zone for root domain: ${rootDomain} (from ${domain.name}). 

No domains found in your Cloudflare account. Please add ${rootDomain} to your Cloudflare account first.`;
          
          throw new Error(errorMessage);
        } catch (listError) {
          // Fallback to original error if we can't list zones
          throw new Error(`Could not find Cloudflare zone for root domain: ${rootDomain} (from ${domain.name}). Make sure the root domain is properly configured in Cloudflare.`);
        }
      }
      
      console.log(`Found zone ID: ${zoneId} for root domain: ${rootDomain}`);
    }
    
    // 2. Generate safe page URL (we'll deploy the coming soon page to Vercel first)
    const safePageDomain = subdomain && domain.dnsManagement !== 'external' 
      ? `${subdomain}.${domain.name}` 
      : domain.name;
    const safeUrl = `https://${safePageDomain}`;
    
    // 3. Generate unique worker script name
    const scriptName = `cloak-${domain.name.replace(/\./g, '-')}-${Date.now()}`;
    
    // 4. Generate JCI worker script
    const workerScript = generateJciWorkerScript({
      safeUrl,
      moneyUrl,
      whitePageUrl,
      targetCountries,
      excludeCountries
    });
    
    // 5. Deploy worker to Cloudflare
    console.log(`Creating worker script: ${scriptName}`);
    const workerResult = await cf.createWorker(scriptName, workerScript);
    
    if (!workerResult.success) {
      throw new Error(`Failed to create worker: ${JSON.stringify(workerResult.errors)}`);
    }
    
    // 6. Create worker route
    const routePattern = subdomain && domain.dnsManagement !== 'external'
      ? `${subdomain}.${domain.name}/*`
      : `${domain.name}/*`;
      
    console.log(`Creating worker route: ${routePattern} -> ${scriptName} (Zone ID: ${zoneId})`);
    const routeResult = await cf.createWorkerRoute(zoneId, routePattern, scriptName);
    
    if (!routeResult.success) {
      throw new Error(`Failed to create worker route: ${JSON.stringify(routeResult.errors)}`);
    }
    
    return {
      success: true,
      workerScriptName: scriptName,
      workerRouteId: routeResult.result.id,
      safeUrl,
      routePattern,
      zoneId,
      message: `Cloaked landing page deployed successfully. Worker route: ${routePattern}`
    };
    
  } catch (error) {
    console.error('Error creating cloaked landing page:', error);
    throw error;
  }
}

// Utility function to list all available domains in Cloudflare account
export async function listAvailableDomains(): Promise<{ name: string; id: string; status: string }[]> {
  try {
    console.log('Fetching available domains from Cloudflare...');
    const response = await cf.listZones();
    
    if (!response.success) {
      console.error('Failed to fetch domains from Cloudflare:', response.errors || response);
      throw new Error(`Cloudflare API error: ${JSON.stringify(response.errors || 'Unknown error')}`);
    }
    
    const domains = response.result?.map((zone: any) => ({
      name: zone.name,
      id: zone.id,
      status: zone.status
    })) || [];
    
    console.log(`Found ${domains.length} domains in Cloudflare account:`, domains);
    return domains;
  } catch (error) {
    console.error('Error listing available domains:', error);
    if (isDevelopment) {
      return [
        { name: 'example.com', id: 'mock-zone-1', status: 'active' },
        { name: 'test.com', id: 'mock-zone-2', status: 'pending' }
      ];
    }
    throw error;
  }
}

// Update DNS record proxying status (useful for fixing cloaking issues)
export async function updateDnsRecordProxying(recordId: string, proxied: boolean, zoneId?: string) {
  try {
    const effectiveZoneId = getEffectiveZoneId(zoneId);
    
    console.log(`[${new Date().toISOString()}] updateDnsRecordProxying: Updating DNS record ${recordId} proxying to ${proxied} in zone ${effectiveZoneId}`);
    
    // In development with missing credentials, return mock success
    if (isDevelopment && (!process.env.CLOUDFLARE_API_TOKEN)) {
      return {
        success: true,
        result: {
          id: recordId,
          proxied: proxied
        }
      };
    }

    // First get the current record details
    const getResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${effectiveZoneId}/dns_records/${recordId}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });
    
    const getCurrentRecord = await getResponse.json();
    
    if (!getCurrentRecord.success) {
      console.error(`[${new Date().toISOString()}] updateDnsRecordProxying: Failed to get current record:`, getCurrentRecord.errors);
      return getCurrentRecord;
    }
    
    const currentRecord = getCurrentRecord.result;
    
    // Update the record with new proxying status
    const updateResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${effectiveZoneId}/dns_records/${recordId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
      body: JSON.stringify({
        type: currentRecord.type,
        name: currentRecord.name,
        content: currentRecord.content,
        ttl: currentRecord.ttl,
        proxied: proxied
      }),
    });
    
    const updateResult = await updateResponse.json();
    
    console.log(`[${new Date().toISOString()}] updateDnsRecordProxying: Update response:`, JSON.stringify(updateResult));
    
    return updateResult;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] updateDnsRecordProxying: Error updating DNS record:`, error);
    return { success: false, error };
  }
}

// Helper function to fix cloaking DNS records (enable proxying for existing records)
export async function fixCloakingDnsRecords(domainName: string, subdomain: string, zoneId?: string) {
  try {
    const effectiveZoneId = getEffectiveZoneId(zoneId);
    const recordName = `${subdomain}.${domainName}`;
    
    console.log(`[${new Date().toISOString()}] fixCloakingDnsRecords: Fixing DNS records for ${recordName}`);
    
    // Get all DNS records for this subdomain
    const records = await getDnsRecords(recordName, effectiveZoneId);
    
    if (!records || records.length === 0) {
      return {
        success: false,
        message: `No DNS records found for ${recordName}`
      };
    }
    
    const results = [];
    
    for (const record of records) {
      if ((record.type === 'CNAME' || record.type === 'A') && !record.proxied) {
        console.log(`[${new Date().toISOString()}] fixCloakingDnsRecords: Enabling proxying for ${record.type} record ${record.id}`);
        
        const updateResult = await updateDnsRecordProxying(record.id, true, effectiveZoneId);
        
        results.push({
          recordId: record.id,
          type: record.type,
          name: record.name,
          content: record.content,
          success: updateResult.success,
          error: updateResult.error
        });
      } else {
        results.push({
          recordId: record.id,
          type: record.type,
          name: record.name,
          content: record.content,
          success: true,
          message: record.proxied ? 'Already proxied' : 'Not a CNAME/A record'
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return {
      success: successCount > 0,
      message: `Updated ${successCount}/${results.length} DNS records for ${recordName}`,
      results
    };
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] fixCloakingDnsRecords: Error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to fix cloaking DNS records'
    };
  }
}

// Delete Cloudflare Worker and its routes
export async function deleteWorkerAndRoutes(workerScriptName: string, zoneId?: string) {
  try {
    console.log(`Deleting Cloudflare Worker: ${workerScriptName}`);
    
    const deletionResults = {
      workerDeleted: false,
      routesDeleted: 0,
      errors: [] as string[]
    };
    
    // First, try to delete any worker routes if zoneId is provided
    if (zoneId) {
      try {
        console.log(`Listing worker routes for zone: ${zoneId}`);
        const routesResponse = await cf.listWorkerRoutes(zoneId);
        
        if (routesResponse.success && routesResponse.result) {
          // Filter routes that belong to this worker
          const workerRoutes = routesResponse.result.filter((route: any) => 
            route.script === workerScriptName
          );
          
          console.log(`Found ${workerRoutes.length} routes for worker ${workerScriptName}`);
          
          // Delete each route
          for (const route of workerRoutes) {
            try {
              console.log(`Deleting worker route: ${route.id} (${route.pattern})`);
              const deleteRouteResult = await cf.deleteWorkerRoute(zoneId, route.id);
              
              if (deleteRouteResult.success) {
                deletionResults.routesDeleted++;
                console.log(`Successfully deleted worker route: ${route.id}`);
              } else {
                const error = `Failed to delete worker route ${route.id}: ${JSON.stringify(deleteRouteResult.errors)}`;
                console.error(error);
                deletionResults.errors.push(error);
              }
            } catch (routeError) {
              const error = `Error deleting worker route ${route.id}: ${(routeError as Error).message}`;
              console.error(error);
              deletionResults.errors.push(error);
            }
          }
        }
      } catch (routesError) {
        const error = `Error listing worker routes: ${(routesError as Error).message}`;
        console.error(error);
        deletionResults.errors.push(error);
      }
    }
    
    // Delete the worker script itself
    try {
      console.log(`Deleting worker script: ${workerScriptName}`);
      const deleteWorkerResult = await cf.deleteWorker(workerScriptName);
      
      if (deleteWorkerResult.success) {
        deletionResults.workerDeleted = true;
        console.log(`Successfully deleted worker: ${workerScriptName}`);
      } else {
        const error = `Failed to delete worker ${workerScriptName}: ${JSON.stringify(deleteWorkerResult.errors)}`;
        console.error(error);
        deletionResults.errors.push(error);
      }
    } catch (workerError) {
      const error = `Error deleting worker ${workerScriptName}: ${(workerError as Error).message}`;
      console.error(error);
      deletionResults.errors.push(error);
    }
    
    return deletionResults;
    
  } catch (error) {
    console.error(`Error deleting worker and routes for ${workerScriptName}:`, error);
    throw error;
  }
}