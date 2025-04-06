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

// Fix DNS records for all domains or a specific domain
async function fixRootDomainDns() {
  try {
    await connectToDatabase();
    
    console.log('Root Domain DNS Fixer Tool');
    console.log('=========================');
    
    // Get domain from command line arguments or fix all domains
    const targetDomain = process.argv[2];
    
    const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
    
    if (!CF_API_TOKEN) {
      console.error('Error: Cloudflare API token not set in environment variables');
      return;
    }
    
    // Find domains to process
    let domains;
    if (targetDomain) {
      domains = await Domain.find({ name: targetDomain }).select('name cloudflareZoneId isActive');
      if (domains.length === 0) {
        console.error(`Domain ${targetDomain} not found in database`);
        return;
      }
    } else {
      domains = await Domain.find({}).select('name cloudflareZoneId isActive');
    }
    
    console.log(`Found ${domains.length} domains to process`);
    
    // Process each domain
    for (const domain of domains) {
      if (!domain.cloudflareZoneId) {
        console.log(`⚠️ Domain ${domain.name} has no Cloudflare Zone ID. Skipping.`);
        continue;
      }
      
      console.log(`\nProcessing domain: ${domain.name} (Zone ID: ${domain.cloudflareZoneId})`);
      
      // Check existing DNS records
      console.log(`Checking existing DNS records...`);
      const dnsResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.cloudflareZoneId}/dns_records`, {
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
      });
      
      const dnsData = await dnsResponse.json();
      
      if (!dnsData.success) {
        console.error(`❌ Failed to retrieve DNS records: ${JSON.stringify(dnsData.errors)}`);
        continue;
      }
      
      // Find existing A and CNAME records for root domain
      const rootRecords = dnsData.result.filter(record => 
        (record.type === 'A' || record.type === 'CNAME') && 
        (record.name === domain.name || record.name === `${domain.name}.` || record.name === '@')
      );
      
      console.log(`Found ${rootRecords.length} root domain records`);
      rootRecords.forEach(record => {
        console.log(`- ${record.type} record: ${record.name} → ${record.content}`);
      });
      
      // Check if there's already a CNAME pointing to Vercel
      const vercelCname = rootRecords.find(record => 
        record.type === 'CNAME' && record.content.includes('vercel')
      );
      
      if (vercelCname) {
        console.log(`✅ Domain already has CNAME record pointing to Vercel: ${vercelCname.content}`);
        continue;
      }
      
      // Find A record pointing to Vercel IP
      const vercelARecord = rootRecords.find(record => 
        record.type === 'A' && record.content === '76.76.21.21'
      );
      
      // If there's an A record but no CNAME, try to add CNAME
      if (vercelARecord) {
        console.log(`Found A record pointing to Vercel IP (76.76.21.21)`);
        console.log(`Attempting to add CNAME record for better reliability...`);
        
        try {
          const cnameResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.cloudflareZoneId}/dns_records`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${CF_API_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              type: 'CNAME',
              name: '@',
              content: 'cname.vercel-dns.com',
              ttl: 1,
              proxied: false
            })
          });
          
          const cnameData = await cnameResponse.json();
          
          if (cnameData.success) {
            console.log(`✅ Added CNAME record for root domain pointing to cname.vercel-dns.com`);
            
            // Ask if the user wants to delete the A record
            console.log(`\n⚠️ You now have both A and CNAME records for the root domain.`);
            console.log(`It's recommended to delete the A record if the CNAME works.`);
            console.log(`To delete the A record manually, run:`);
            console.log(`curl -X DELETE "https://api.cloudflare.com/client/v4/zones/${domain.cloudflareZoneId}/dns_records/${vercelARecord.id}" -H "Authorization: Bearer ${CF_API_TOKEN}" -H "Content-Type: application/json"`);
          } else {
            console.error(`❌ Failed to add CNAME record: ${JSON.stringify(cnameData.errors)}`);
            console.log(`Keeping A record as fallback.`);
          }
        } catch (error) {
          console.error(`❌ Error adding CNAME record: ${error.message}`);
        }
      } else {
        // No existing Vercel records, add CNAME
        console.log(`No Vercel DNS records found. Adding CNAME record...`);
        
        try {
          const cnameResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.cloudflareZoneId}/dns_records`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${CF_API_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              type: 'CNAME',
              name: '@',
              content: 'cname.vercel-dns.com',
              ttl: 1,
              proxied: false
            })
          });
          
          const cnameData = await cnameResponse.json();
          
          if (cnameData.success) {
            console.log(`✅ Added CNAME record for root domain pointing to cname.vercel-dns.com`);
          } else {
            console.error(`❌ Failed to add CNAME record: ${JSON.stringify(cnameData.errors)}`);
            
            // Try A record as fallback
            console.log(`Trying A record as fallback...`);
            
            const aResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.cloudflareZoneId}/dns_records`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${CF_API_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                type: 'A',
                name: '@',
                content: '76.76.21.21',
                ttl: 1,
                proxied: false
              })
            });
            
            const aData = await aResponse.json();
            
            if (aData.success) {
              console.log(`✅ Added A record for root domain pointing to 76.76.21.21 (fallback)`);
            } else {
              console.error(`❌ Failed to add A record: ${JSON.stringify(aData.errors)}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error adding DNS records: ${error.message}`);
        }
      }
    }
    
    console.log('\nDNS update process complete');
    console.log('It may take some time for DNS changes to propagate (up to 24-48 hours)');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

// Run the script
fixRootDomainDns(); 