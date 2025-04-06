// Fix Cloudflare SSL settings and DNS records for compatibility with Vercel
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

// Fix Cloudflare settings for a specific domain or all domains
async function fixCloudflareSSL() {
  try {
    await connectToDatabase();
    
    console.log('Cloudflare SSL and DNS Fixer Tool');
    console.log('================================');
    
    // Get domain from command line arguments
    const targetDomain = process.argv[2];
    const unproxy = process.argv.includes('--unproxy');
    const sslMode = process.argv.includes('--full-strict') ? 'full_strict' : 
                    process.argv.includes('--full') ? 'full' : null;
    
    if (!targetDomain) {
      console.error('Error: No domain specified');
      console.log('Usage: node fix-cloudflare-ssl.js <domain> [--unproxy] [--full-strict|--full]');
      console.log('  --unproxy: Disable Cloudflare proxying for Vercel DNS records');
      console.log('  --full-strict: Set SSL mode to Full (Strict)');
      console.log('  --full: Set SSL mode to Full');
      return;
    }
    
    console.log(`\nFixing Cloudflare settings for domain: ${targetDomain}`);
    
    // Find the domain
    const domain = await Domain.findOne({ 
      name: { $regex: new RegExp(`^${targetDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
    });
    
    if (!domain) {
      console.error(`❌ Domain '${targetDomain}' not found in database`);
      const allDomains = await Domain.find({}).select('name isActive');
      console.log('\nAvailable domains:');
      allDomains.forEach(d => {
        console.log(`- ${d.name} (${d.isActive ? 'active' : 'inactive'})`);
      });
      return;
    }
    
    console.log(`✅ Domain found: ${domain.name} (ID: ${domain._id})`);
    console.log(`   Active: ${domain.isActive ? 'Yes' : 'No'}`);
    
    if (!domain.cloudflareZoneId) {
      console.error(`❌ Domain ${domain.name} has no Cloudflare Zone ID. Cannot proceed.`);
      return;
    }
    
    console.log(`   Cloudflare Zone ID: ${domain.cloudflareZoneId}`);
    
    // Get Cloudflare API token
    const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
    if (!CF_API_TOKEN) {
      console.error('❌ Cloudflare API token not set in environment variables');
      return;
    }
    
    // 1. Get current Cloudflare settings
    console.log('\n1. Getting current Cloudflare settings...');
    
    // 1.1 Get SSL settings
    let sslSettings;
    try {
      const sslResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.cloudflareZoneId}/settings/ssl`, {
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      const sslData = await sslResponse.json();
      if (!sslData.success) {
        console.error(`❌ Failed to get SSL settings: ${JSON.stringify(sslData.errors)}`);
      } else {
        sslSettings = sslData.result;
        console.log(`✅ Current SSL mode: ${sslSettings.value}`);
      }
    } catch (error) {
      console.error(`❌ Error getting SSL settings: ${error.message}`);
    }
    
    // 1.2 Get DNS records
    let dnsRecords;
    try {
      const dnsResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.cloudflareZoneId}/dns_records`, {
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      const dnsData = await dnsResponse.json();
      if (!dnsData.success) {
        console.error(`❌ Failed to get DNS records: ${JSON.stringify(dnsData.errors)}`);
        return;
      }
      
      dnsRecords = dnsData.result;
      console.log(`✅ Found ${dnsRecords.length} DNS records`);
    } catch (error) {
      console.error(`❌ Error getting DNS records: ${error.message}`);
      return;
    }
    
    // 2. Fix SSL Settings if requested
    if (sslMode) {
      console.log(`\n2. Updating SSL mode to ${sslMode === 'full_strict' ? 'Full (Strict)' : 'Full'}...`);
      
      try {
        const updateResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.cloudflareZoneId}/settings/ssl`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            value: sslMode
          })
        });
        
        const updateData = await updateResponse.json();
        if (!updateData.success) {
          console.error(`❌ Failed to update SSL settings: ${JSON.stringify(updateData.errors)}`);
        } else {
          console.log(`✅ SSL mode updated to ${updateData.result.value}`);
        }
      } catch (error) {
        console.error(`❌ Error updating SSL settings: ${error.message}`);
      }
    }
    
    // 3. Fix DNS Records if requested
    if (unproxy) {
      console.log('\n3. Updating DNS records to disable proxying for Vercel records...');
      
      // Find records pointing to Vercel
      const vercelRecords = dnsRecords.filter(record => 
        (record.type === 'CNAME' && record.content.includes('vercel')) ||
        (record.type === 'A' && record.content === '76.76.21.21')
      );
      
      if (vercelRecords.length === 0) {
        console.log('No Vercel DNS records found');
      } else {
        console.log(`Found ${vercelRecords.length} Vercel DNS records`);
        
        for (const record of vercelRecords) {
          if (record.proxied) {
            console.log(`Updating record: ${record.type} ${record.name} -> ${record.content} (currently proxied)`);
            
            try {
              const updateResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.cloudflareZoneId}/dns_records/${record.id}`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${CF_API_TOKEN}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  type: record.type,
                  name: record.name,
                  content: record.content,
                  ttl: record.ttl,
                  proxied: false // Disable proxying for Vercel records
                })
              });
              
              const updateData = await updateResponse.json();
              if (!updateData.success) {
                console.error(`❌ Failed to update DNS record: ${JSON.stringify(updateData.errors)}`);
              } else {
                console.log(`✅ DNS record updated to disable proxying`);
              }
            } catch (error) {
              console.error(`❌ Error updating DNS record: ${error.message}`);
            }
          } else {
            console.log(`✅ Record already not proxied: ${record.type} ${record.name} -> ${record.content}`);
          }
        }
      }
    }
    
    // 4. Summary and Recommendations
    console.log('\nSummary and Recommendations:');
    console.log('----------------------------');
    
    // Check for potential issues
    const rootVercelRecords = dnsRecords.filter(record => 
      (record.name === domain.name || record.name === '@') && 
      ((record.type === 'CNAME' && record.content.includes('vercel')) ||
       (record.type === 'A' && record.content === '76.76.21.21'))
    );
    
    if (rootVercelRecords.length === 0) {
      console.log('⚠️ No Vercel DNS records found for the root domain. Add one of:');
      console.log('    - CNAME record for @ pointing to cname.vercel-dns.com');
      console.log('    - A record for @ pointing to 76.76.21.21');
    } else {
      const proxiedRootRecords = rootVercelRecords.filter(r => r.proxied);
      
      if (proxiedRootRecords.length > 0 && sslSettings?.value === 'full_strict') {
        console.log('⚠️ You have proxied Vercel DNS records with Full (Strict) SSL mode. This may cause SSL issues.');
        console.log('   Recommendation: Either disable proxying for these records or change SSL mode to "Full" (not strict).');
        console.log('   Run: node fix-cloudflare-ssl.js ' + domain.name + ' --unproxy');
        console.log('   Or:  node fix-cloudflare-ssl.js ' + domain.name + ' --full');
      } else if (proxiedRootRecords.length > 0) {
        console.log('ℹ️ You have proxied Vercel DNS records. This works with "Full" SSL mode but not with "Full (Strict)".');
      } else if (sslSettings?.value === 'full_strict') {
        console.log('✅ Your configuration looks good: non-proxied Vercel DNS records with Full (Strict) SSL mode.');
      } else {
        console.log('✅ Your DNS records are properly configured for Vercel (not proxied).');
      }
    }
    
    const wwwRecord = dnsRecords.find(record => 
      (record.name === `www.${domain.name}` || record.name === 'www') &&
      record.type === 'CNAME' && 
      record.content.includes('vercel')
    );
    
    if (!wwwRecord) {
      console.log('⚠️ No CNAME record found for www subdomain. Consider adding one.');
    }
    
    console.log('\nNext steps:');
    console.log('1. Make sure your domain is properly added to Vercel project');
    console.log('2. Ensure SSL certificate is issued for your domain on Vercel');
    console.log('3. If still having SSL issues with Cloudflare "Full (Strict)", try switching to "Full" mode');
    console.log('   Run: node fix-cloudflare-ssl.js ' + domain.name + ' --full');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the script
fixCloudflareSSL(); 