import { Cloudflare } from 'cloudflare';

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN as string;
const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID as string;
const CLOUDFLARE_EMAIL = process.env.CLOUDFLARE_EMAIL as string;

if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID || !CLOUDFLARE_EMAIL) {
  throw new Error('Please define all Cloudflare environment variables');
}

// Initialize Cloudflare client
const cf = new Cloudflare({
  apiKey: CLOUDFLARE_API_TOKEN,
  apiEmail: CLOUDFLARE_EMAIL,
});

export type CloudflareNameserver = string;

// Get Cloudflare nameservers for a domain
export async function getNameservers(): Promise<CloudflareNameserver[]> {
  try {
    const response = await cf.zones.get({ zone_id: CLOUDFLARE_ZONE_ID });
    return response.name_servers || [];
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
    const response = await cf.dnsRecords.add({
      zone_id: CLOUDFLARE_ZONE_ID,
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
    const response = await cf.dnsRecords.delete({
      zone_id: CLOUDFLARE_ZONE_ID,
      id: recordId
    });
    return response;
  } catch (error) {
    console.error('Error deleting DNS record:', error);
    throw error;
  }
}

// Get DNS records for a domain
export async function getDnsRecords(domain: string) {
  try {
    const response = await cf.dnsRecords.browse({
      zone_id: CLOUDFLARE_ZONE_ID,
      name: domain,
    });
    return response.result || [];
  } catch (error) {
    console.error('Error getting DNS records:', error);
    throw error;
  }
} 