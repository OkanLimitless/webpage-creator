// Set development environment
process.env.NODE_ENV = 'development';

// Import required libraries
const fetch = require('node-fetch');
require('dotenv').config();

// Run the script
async function addVercelDnsToCloudflare() {
  try {
    console.log('Add Vercel DNS to Cloudflare Tool');
    console.log('===============================');
    
    // Get domain from command line arguments
    const domain = process.argv[2];
    
    if (!domain) {
      console.error('Error: No domain specified');
      console.log('Usage: node add-vercel-dns-to-cloudflare.js <domain>');
      return;
    }
    
    console.log(`\nAdding Vercel DNS records for domain: ${domain}`);
    
    const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
    const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
    
    if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
      console.error('Error: Cloudflare API token or account ID not set in environment variables');
      return;
    }
    
    // 1. Get zone ID for the domain
    console.log('1. Getting Cloudflare zone ID...');
    
    const zoneResponse = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${domain}`, {
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const zoneData = await zoneResponse.json();
    
    if (!zoneData.success || !zoneData.result || zoneData.result.length === 0) {
      console.error(`❌ Domain not found in Cloudflare account`);
      console.log(`Recommendation: Add the domain to Cloudflare first`);
      return;
    }
    
    const zoneId = zoneData.result[0].id;
    console.log(`✅ Found zone ID: ${zoneId}`);
    
    // 2. Check existing DNS records
    console.log('\n2. Checking existing DNS records...');
    
    const dnsResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const dnsData = await dnsResponse.json();
    
    if (!dnsData.success) {
      console.error(`❌ Could not retrieve DNS records`);
      return;
    }
    
    // Check if there's already a Vercel record
    const vercelRecords = dnsData.result.filter(record => 
      (record.type === 'CNAME' && record.content.includes('vercel')) ||
      (record.type === 'A' && record.content === '76.76.21.21')
    );
    
    if (vercelRecords.length > 0) {
      console.log(`Found existing Vercel DNS record(s): ${vercelRecords.length}`);
      vercelRecords.forEach(record => {
        console.log(`   - ${record.type} record for ${record.name} → ${record.content}`);
      });
      
      const continueAnyway = process.argv.includes('--force');
      
      if (!continueAnyway) {
        console.log('\n⚠️ Vercel DNS records already exist. Use --force to add them anyway.');
        return;
      }
    }
    
    // 3. Add CNAME record for root domain (or A record as fallback)
    console.log('\n3. Adding CNAME record for root domain...');
    
    try {
      // First try with CNAME record (optimal for Vercel)
      const rootCnameData = {
        type: 'CNAME',
        name: '@',
        content: 'cname.vercel-dns.com',
        ttl: 3600,
        proxied: true
      };
      
      const rootCnameResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(rootCnameData)
      });
      
      const rootCnameResult = await rootCnameResponse.json();
      
      if (rootCnameResult.success) {
        console.log(`✅ Added CNAME record for root domain (${domain} → cname.vercel-dns.com)`);
      } else {
        console.error(`❌ Failed to add CNAME record for root domain: ${rootCnameResult.errors[0]?.message || 'Unknown error'}`);
        
        // If CNAME failed, try with A record as fallback (some DNS providers don't allow CNAME at root)
        console.log('Attempting to create A record as fallback...');
        
        const rootARecordData = {
          type: 'A',
          name: '@',
          content: '76.76.21.21',
          ttl: 3600,
          proxied: true
        };
        
        const rootARecordResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(rootARecordData)
        });
        
        const rootARecordResult = await rootARecordResponse.json();
        
        if (rootARecordResult.success) {
          console.log(`✅ Added A record for root domain (${domain} → 76.76.21.21) as fallback`);
        } else {
          console.error(`❌ Failed to add A record for root domain: ${rootARecordResult.errors[0]?.message || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error adding DNS record for root domain: ${error.message}`);
    }
    
    // 4. Add CNAME record for 'www' subdomain
    console.log('\n4. Adding CNAME record for www subdomain...');
    
    const wwwRecordData = {
      type: 'CNAME',
      name: 'www',
      content: 'cname.vercel-dns.com',
      ttl: 3600,
      proxied: true
    };
    
    try {
      const wwwRecordResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(wwwRecordData)
      });
      
      const wwwRecordResult = await wwwRecordResponse.json();
      
      if (wwwRecordResult.success) {
        console.log(`✅ Added CNAME record for www subdomain (www.${domain} → cname.vercel-dns.com)`);
      } else {
        console.error(`❌ Failed to add CNAME record for www subdomain: ${wwwRecordResult.errors[0]?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`❌ Error adding CNAME record: ${error.message}`);
    }
    
    console.log('\n✅ Process complete!');
    console.log('It may take some time for DNS changes to propagate.');
    console.log('You should now be able to access your root domain website at:');
    console.log(`   https://${domain}`);
    console.log(`   https://www.${domain}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
addVercelDnsToCloudflare(); 