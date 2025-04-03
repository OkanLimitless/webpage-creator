// Get Cloudflare credentials with fallbacks for development
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || 'development_key';
const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || 'development_zone';
const CLOUDFLARE_EMAIL = process.env.CLOUDFLARE_EMAIL || 'development@example.com';

// Flag to check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';

// Warn if environment variables are missing in production
if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ZONE_ID || !process.env.CLOUDFLARE_EMAIL) {
  if (!isDevelopment) {
    console.warn('Cloudflare environment variables are missing. DNS functionality will be limited.');
  }
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
        'X-Auth-Email': CLOUDFLARE_EMAIL,
        'X-Auth-Key': CLOUDFLARE_API_TOKEN,
      },
    });
    return response.json();
  },

  async createDnsRecord(data: any) {
    // In development with missing credentials, return mock success
    if (isDevelopment && (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ZONE_ID)) {
      return {
        success: true,
        result: {
          id: 'mock-record-id',
          ...data
        }
      };
    }

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Email': CLOUDFLARE_EMAIL,
        'X-Auth-Key': CLOUDFLARE_API_TOKEN,
      },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async deleteDnsRecord(recordId: string) {
    // In development with missing credentials, return mock success
    if (isDevelopment && (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ZONE_ID)) {
      return {
        success: true
      };
    }

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${recordId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Email': CLOUDFLARE_EMAIL,
        'X-Auth-Key': CLOUDFLARE_API_TOKEN,
      },
    });
    return response.json();
  },

  async getDnsRecords(name: string) {
    // In development with missing credentials, return mock data
    if (isDevelopment && (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ZONE_ID)) {
      return [{
        id: 'mock-record-id',
        name: name,
        type: 'CNAME',
        content: 'alias.vercel.com'
      }];
    }

    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records?name=${name}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Email': CLOUDFLARE_EMAIL,
        'X-Auth-Key': CLOUDFLARE_API_TOKEN,
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
    const response = await cf.getZone();
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

// Create a DNS record for a subdomain
export async function createDnsRecord(
  subdomain: string, 
  domain: string,
  type: 'CNAME' = 'CNAME', 
  content: string = 'alias.vercel.com'
) {
  try {
    const name = `${subdomain}.${domain}`;
    const response = await cf.createDnsRecord({
      type,
      name,
      content,
      ttl: 1, // Auto TTL
      proxied: true,
    });
    
    return response;
  } catch (error) {
    console.error('Error creating DNS record:', error);
    // Return mock success in case of error
    if (isDevelopment) {
      return { success: true };
    }
    throw error;
  }
}

// Delete a DNS record
export async function deleteDnsRecord(recordId: string) {
  try {
    const response = await cf.deleteDnsRecord(recordId);
    return response;
  } catch (error) {
    console.error('Error deleting DNS record:', error);
    // Return mock success in case of error
    if (isDevelopment) {
      return { success: true };
    }
    throw error;
  }
}

// Get DNS records for a domain
export async function getDnsRecords(domain: string) {
  try {
    return await cf.getDnsRecords(domain);
  } catch (error) {
    console.error('Error getting DNS records:', error);
    // Return mock data in case of error
    if (isDevelopment) {
      return [{
        id: 'mock-record-id',
        name: domain,
        type: 'CNAME',
        content: 'alias.vercel.com'
      }];
    }
    throw error;
  }
} 