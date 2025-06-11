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

// Helper function to generate JCI API worker script
export function generateJciWorkerScript(options: {
  safeUrl: string;
  moneyUrl: string;
  whitePageUrl?: string;
  targetCountries: string[];
  excludeCountries?: string[];
}): string {
  const { safeUrl, moneyUrl, whitePageUrl, targetCountries, excludeCountries = [] } = options;
  
  return `// JCI API Cloaking Script for Cloudflare Workers - PRODUCTION READY
// Generated automatically by Webpage Creator
// Uses CORRECT JCI API format from documentation

const JCI_USER_ID = 'e68rqs0to5i24lfzpov5je9mr';
const MONEY_URL = '${moneyUrl}';
const TARGET_COUNTRIES = ${JSON.stringify(targetCountries)};
const EXCLUDE_COUNTRIES = ${JSON.stringify(excludeCountries)};

const SAFE_PAGE_HTML = \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coming Soon</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
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
            max-width: 500px;
        }
        h1 {
            font-size: 3rem;
            margin-bottom: 1rem;
            background: linear-gradient(45deg, #fff, #f0f0f0);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        p { font-size: 1.2rem; margin-bottom: 2rem; opacity: 0.9; }
        .loader {
            width: 50px; height: 50px;
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-top: 3px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
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
</html>\`;

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Call JCI API for click validation
  console.log('Calling JCI API...');
  const userId = 'e68rqs0to5i24lfzpov5je9mr';
  
  // Get client IP (try Cloudflare headers first, then fallback)
  const clientIP = 
    request.headers.get('CF-Connecting-IP') || 
    request.headers.get('X-Forwarded-For')?.split(',')[0] || 
    request.headers.get('X-Real-IP') || 
    '127.0.0.1';
  
  const userAgent = request.headers.get('User-Agent') || 'Unknown';
  
  // JCI API URL format from docs: https://jcibj.com/lapi/rest/r/USER_ID/IP/USERAGENT
  // NOTE: API expects unencoded user agent (URL encoding causes 404)
  // We'll use a simplified user agent to avoid URL issues
  const cleanUserAgent = userAgent.split(' ')[0] || 'Mozilla';
  const jciUrl = \`https://jcibj.com/lapi/rest/r/\${userId}/\${clientIP}/\${cleanUserAgent}\`;
  
  console.log(\`JCI API URL: \${jciUrl}\`);
  
  try {
    // Call JCI API using CORRECT format from documentation
    const jciResponse = await fetch(jciUrl, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json'
      }
    });
    
    if (!jciResponse.ok) {
      const errorText = await jciResponse.text();
      console.log(\`JCI API Error - Status: \${jciResponse.status}, Response: \${errorText}\`);
      throw new Error(\`JCI API returned status \${jciResponse.status}: \${errorText}\`);
    }
    
    const jciData = await jciResponse.json();
    console.log('JCI API Response:', JSON.stringify(jciData));
    
    // Check for API errors in the response
    if (jciData.error) {
      console.log(\`JCI API Error: \${jciData.error}\`);
      throw new Error(\`JCI API Error: \${jciData.error}\`);
    }
    
    // JCI API Logic: type="false" = PASS (money page), type="true" = BLOCK (safe page)
    if (jciData.type === 'false') {
      // Visitor approved - redirect to money page
      return Response.redirect(MONEY_URL, 302);
    } else {
      // Visitor blocked - show safe page
      return new Response(SAFE_PAGE_HTML, {
        headers: { 
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Worker-Status': 'jci-blocked'
        }
      });
    }
    
  } catch (error) {
    // On any error, show safe page
    return new Response(SAFE_PAGE_HTML, {
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Worker-Status': 'api-error'
      }
    });
  }
}`;
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