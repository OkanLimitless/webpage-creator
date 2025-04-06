// Set development environment
process.env.NODE_ENV = 'development';

// Import required libraries
const mongoose = require('mongoose');
const fetch = require('node-fetch');
require('dotenv').config();

// Connect to MongoDB
async function connectToDatabase() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/webpage-creator';
    
    console.log(`Connecting to MongoDB at ${MONGODB_URI}`);
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Define Domain model schema (simplified version of the app model)
const DomainSchema = new mongoose.Schema({
  name: String,
  cloudflareZoneId: String,
  isActive: Boolean
});

const Domain = mongoose.models.Domain || mongoose.model('Domain', DomainSchema);

// Define RootPage model schema
const RootPageSchema = new mongoose.Schema({
  domainId: mongoose.Schema.Types.ObjectId,
  title: String,
  isActive: Boolean
});

const RootPage = mongoose.models.RootPage || mongoose.model('RootPage', RootPageSchema);

// Test domain routing for a specific domain
async function testDomainRouting() {
  try {
    await connectToDatabase();
    
    console.log('Domain Routing Diagnostic Tool');
    console.log('==============================');
    
    // Get domain from command line arguments or test all domains
    const testDomain = process.argv[2];
    
    if (!testDomain) {
      console.error('Error: No domain specified');
      console.log('Usage: node test-domain-routing.js <domain>');
      await mongoose.disconnect();
      return;
    }
    
    console.log(`\nTesting domain routing for: ${testDomain}`);
    
    // Check if domain exists in database
    const domainDoc = await Domain.findOne({ 
      name: { $regex: new RegExp(`^${testDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    
    if (!domainDoc) {
      console.error(`❌ Domain '${testDomain}' not found in database`);
      console.log('\nAvailable domains in database:');
      
      const allDomains = await Domain.find({}).select('name isActive');
      allDomains.forEach(d => {
        console.log(`- ${d.name} (${d.isActive ? 'active' : 'inactive'})`);
      });
      
      await mongoose.disconnect();
      return;
    }
    
    console.log(`✅ Domain found in database: ${domainDoc.name} (ID: ${domainDoc._id})`);
    console.log(`   Active: ${domainDoc.isActive ? 'Yes' : 'No'}`);
    console.log(`   Cloudflare Zone ID: ${domainDoc.cloudflareZoneId || 'Not set'}`);
    
    // Check if there's a root page for this domain
    const rootPage = await RootPage.findOne({ domainId: domainDoc._id });
    
    if (!rootPage) {
      console.error(`❌ No root page found for domain '${domainDoc.name}'`);
      console.log(`   You need to create a root page for this domain. Use the admin dashboard or API.`);
    } else {
      console.log(`✅ Root page found: ${rootPage.title} (ID: ${rootPage._id})`);
      console.log(`   Active: ${rootPage.isActive ? 'Yes' : 'No'}`);
    }
    
    // Check DNS configuration
    if (domainDoc.cloudflareZoneId) {
      await checkDnsConfiguration(domainDoc.name, domainDoc.cloudflareZoneId);
    } else {
      console.error(`❌ No Cloudflare Zone ID found for this domain. Cannot check DNS configuration.`);
    }
    
    // Simulate middleware processing
    console.log('\n3. Testing middleware domain processing...');
    simulateMiddlewareProcessing(domainDoc.name);
    
    console.log('\n4. Testing route handler domain processing...');
    simulateRouteHandlerProcessing(domainDoc.name);
    
    console.log('\nDiagnostic complete. Summary:');
    console.log('---------------------------');
    
    if (!domainDoc.isActive) {
      console.log('⚠️ Domain is not active in the database. Activate it to make it accessible.');
    }
    
    if (!rootPage) {
      console.log('⚠️ No root page exists for this domain. Create one in the admin dashboard.');
    } else if (!rootPage.isActive) {
      console.log('⚠️ Root page exists but is not active. Activate it in the admin dashboard.');
    }
    
    if (!domainDoc.cloudflareZoneId) {
      console.log('⚠️ No Cloudflare Zone ID found. Update the domain record with the Zone ID.');
    }
    
    console.log('\nRecommended next steps:');
    if (!rootPage) {
      console.log('1. Create a root page for this domain using the API or admin dashboard');
    } else if (!rootPage.isActive) {
      console.log('1. Activate the existing root page');
    }
    
    if (!domainDoc.cloudflareZoneId) {
      console.log('2. Update the domain with the Cloudflare Zone ID');
    }
    
    console.log('3. Ensure DNS records are properly configured (CNAME to cname.vercel-dns.com or A to 76.76.21.21)');
    console.log('4. Ensure the domain is properly registered with Vercel');
    console.log('5. Wait for DNS propagation (can take up to 24-48 hours)');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Check DNS configuration for the domain
async function checkDnsConfiguration(domainName, zoneId) {
  console.log('\n2. Checking DNS configuration...');
  
  const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
  
  if (!CF_API_TOKEN) {
    console.error('❌ Cloudflare API token not set in environment variables');
    return;
  }
  
  try {
    const dnsResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
    });
    
    const dnsData = await dnsResponse.json();
    
    if (!dnsData.success) {
      console.error(`❌ Failed to retrieve DNS records: ${JSON.stringify(dnsData.errors)}`);
      return;
    }
    
    // Find existing A and CNAME records for root domain
    const rootRecords = dnsData.result.filter(record => 
      (record.type === 'A' || record.type === 'CNAME') && 
      (record.name === domainName || record.name === `${domainName}.` || record.name === '@')
    );
    
    if (rootRecords.length === 0) {
      console.error(`❌ No DNS records found for root domain ${domainName}`);
      console.log(`   You need to add either a CNAME record pointing to cname.vercel-dns.com`);
      console.log(`   or an A record pointing to 76.76.21.21`);
      return;
    }
    
    console.log(`✅ Found ${rootRecords.length} root domain DNS records:`);
    rootRecords.forEach(record => {
      console.log(`   - ${record.type} record: ${record.name} → ${record.content} (Proxied: ${record.proxied ? 'Yes' : 'No'})`);
    });
    
    // Check for Vercel records
    const vercelCname = rootRecords.find(record => 
      record.type === 'CNAME' && record.content.includes('vercel')
    );
    
    const vercelARecord = rootRecords.find(record => 
      record.type === 'A' && record.content === '76.76.21.21'
    );
    
    if (vercelCname) {
      console.log(`✅ Found Vercel CNAME record: ${vercelCname.content}`);
    } else if (vercelARecord) {
      console.log(`✅ Found Vercel A record: 76.76.21.21`);
    } else {
      console.error(`❌ No Vercel DNS records found for root domain`);
      console.log(`   Root domain records exist but don't point to Vercel. Update them to:`);
      console.log(`   - CNAME record pointing to cname.vercel-dns.com (preferred)`);
      console.log(`   - A record pointing to 76.76.21.21 (alternative)`);
    }
    
    // Check for www subdomain
    const wwwRecords = dnsData.result.filter(record => 
      record.name === `www.${domainName}` || record.name === 'www'
    );
    
    if (wwwRecords.length === 0) {
      console.warn(`⚠️ No DNS records found for www.${domainName}`);
      console.log(`   Consider adding a CNAME record for 'www' pointing to cname.vercel-dns.com`);
    } else {
      console.log(`✅ Found ${wwwRecords.length} DNS records for www subdomain:`);
      wwwRecords.forEach(record => {
        console.log(`   - ${record.type} record: ${record.name} → ${record.content}`);
      });
    }
    
  } catch (error) {
    console.error(`❌ Error checking DNS configuration: ${error.message}`);
  }
}

// Simulate middleware hostname processing
function simulateMiddlewareProcessing(hostname) {
  console.log(`Simulating middleware processing for: ${hostname}`);
  
  // Add www prefix to test www handling
  const wwwHostname = `www.${hostname}`;
  
  // Add subdomain to test subdomain handling
  const subdomainHostname = `landing.${hostname}`;
  
  // Test regular domain
  console.log(`\nTesting regular domain: ${hostname}`);
  const hasSubdomain1 = hasValidSubdomain(hostname);
  console.log(`Has subdomain: ${hasSubdomain1 ? 'Yes' : 'No'}`);
  console.log(`Expected routing: ${hasSubdomain1 ? 'Subdomain route' : 'Root domain route'}`);
  
  // Test www domain
  console.log(`\nTesting www domain: ${wwwHostname}`);
  const hasSubdomain2 = hasValidSubdomain(wwwHostname);
  console.log(`Has subdomain: ${hasSubdomain2 ? 'Yes' : 'No'}`);
  console.log(`Expected routing: ${hasSubdomain2 ? 'Subdomain route' : 'Root domain route'}`);
  
  // Test subdomain
  console.log(`\nTesting subdomain: ${subdomainHostname}`);
  const hasSubdomain3 = hasValidSubdomain(subdomainHostname);
  console.log(`Has subdomain: ${hasSubdomain3 ? 'Yes' : 'No'}`);
  if (hasSubdomain3) {
    const subdomain = getSubdomain(subdomainHostname);
    console.log(`Extracted subdomain: ${subdomain}`);
  }
  console.log(`Expected routing: ${hasSubdomain3 ? 'Subdomain route' : 'Root domain route'}`);
}

// Simulate route handler domain processing
function simulateRouteHandlerProcessing(hostname) {
  console.log(`Simulating route handler processing for: ${hostname}`);
  
  // Test with www prefix
  const wwwHostname = `www.${hostname}`;
  console.log(`\nProcessing www hostname: ${wwwHostname}`);
  console.log(`After www removal: ${wwwHostname.replace(/^www\./i, '')}`);
  
  // Test with port
  const portHostname = `${hostname}:3000`;
  console.log(`\nProcessing hostname with port: ${portHostname}`);
  console.log(`After port removal: ${portHostname.split(':')[0]}`);
  
  // Test validation
  console.log(`\nValidating domain format: ${hostname}`);
  console.log(`Contains dot: ${hostname.includes('.') ? 'Yes' : 'No'}`);
  console.log(`Would pass validation: ${hostname.includes('.') ? 'Yes' : 'No'}`);
  
  // Test regex escaping
  const escapedDomain = hostname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  console.log(`\nRegex escaping for database query:`);
  console.log(`Original: ${hostname}`);
  console.log(`Escaped: ${escapedDomain}`);
  console.log(`Regex pattern: ^${escapedDomain}$`);
}

// Function to check if a hostname has a valid subdomain (copied from middleware.ts)
function hasValidSubdomain(hostname) {
  // Skip for localhost (direct development without subdomains)
  if (hostname.includes('localhost')) return false;
  
  // Skip for IP addresses
  if (/^(\d{1,3}\.){3}\d{1,3}/.test(hostname)) return false;
  
  // For Vercel preview URLs, we don't have a real subdomain structure
  if (hostname.endsWith('vercel.app')) return false;
  
  // Extract parts
  const parts = hostname.split('.');
  
  // Check for direct localhost access with port, e.g., localhost:3000
  if (parts[0] === 'localhost') return false;
  
  // If hostname is just 'example.com' or 'www.example.com', there's no subdomain
  // Check length to ensure we have at least example.com (2 parts)
  if (parts.length < 3) return false;
  
  // Check if it's www (not a real subdomain for our routing purposes)
  if (parts[0] === 'www') return false;
  
  // Validate if it's a known subdomain type
  const validPrefixes = ['landing', 'app', 'dashboard', 'admin'];
  return validPrefixes.includes(parts[0]);
}

// Function to extract the subdomain from a hostname (copied from middleware.ts)
function getSubdomain(hostname) {
  // Skip for non-production environments
  if (hostname.includes('localhost')) return '';
  if (hostname.endsWith('vercel.app')) return '';
  
  // Extract the subdomain part (first segment of the hostname)
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0];
  }
  
  return '';
}

// Run the test
testDomainRouting(); 