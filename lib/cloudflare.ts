const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN as string;
const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID as string;
const CLOUDFLARE_EMAIL = process.env.CLOUDFLARE_EMAIL as string;

if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID || !CLOUDFLARE_EMAIL) {
  throw new Error('Please define all Cloudflare environment variables');
}

// Initialize Cloudflare client with different method
// Directly work with the API
const cf = {
  async getZone() {
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
    throw error;
  }
}

// Get DNS records for a domain
export async function getDnsRecords(domain: string) {
  try {
    return await cf.getDnsRecords(domain);
  } catch (error) {
    console.error('Error getting DNS records:', error);
    throw error;
  }
} 