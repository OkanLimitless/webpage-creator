// Set development environment
process.env.NODE_ENV = 'development';

// Import required libraries
const fetch = require('node-fetch');
require('dotenv').config();

// Run the test
async function verifyDomainConfig() {
  try {
    console.log('Domain Configuration Verification Tool');
    console.log('=====================================');
    
    // Get domain from command line arguments or use default
    const domainToVerify = process.argv[2] || 'yourfavystore.com';
    console.log(`\nVerifying domain: ${domainToVerify}`);
    
    // 1. Check Cloudflare configuration
    console.log('\n1. Checking Cloudflare configuration...');
    
    const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
    const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
    
    if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
      console.error('Error: Cloudflare API token or account ID not set in environment variables');
      return;
    }
    
    // Get zone details
    try {
      const zoneResponse = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${domainToVerify}`, {
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      const zoneData = await zoneResponse.json();
      
      if (!zoneData.success || !zoneData.result || zoneData.result.length === 0) {
        console.error(`❌ Domain not found in Cloudflare account`);
        console.log(`Recommendation: Add the domain to Cloudflare`);
      } else {
        const zone = zoneData.result[0];
        console.log(`✅ Domain found in Cloudflare`);
        console.log(`   Zone ID: ${zone.id}`);
        console.log(`   Status: ${zone.status}`);
        console.log(`   Name Servers:`);
        zone.name_servers.forEach(ns => console.log(`   - ${ns}`));
        
        // Check if nameservers are active
        if (zone.status === 'active') {
          console.log(`✅ Nameservers active`);
        } else {
          console.error(`❌ Nameservers not active`);
          console.log(`Recommendation: Update DNS nameservers for ${domainToVerify} to the Cloudflare nameservers listed above`);
        }
        
        // Check DNS records to see if Vercel is configured
        const dnsResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone.id}/dns_records`, {
          headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        
        const dnsData = await dnsResponse.json();
        
        if (!dnsData.success) {
          console.error(`❌ Could not retrieve DNS records`);
        } else {
          // Look for A/CNAME records that point to Vercel
          const vercelRecords = dnsData.result.filter(record => 
            (record.type === 'CNAME' && record.content.includes('vercel'))
            || (record.type === 'A' && (record.content === '76.76.21.21'))
          );
          
          if (vercelRecords.length > 0) {
            console.log(`✅ DNS records found that point to Vercel: ${vercelRecords.length}`);
            vercelRecords.forEach(record => {
              console.log(`   - ${record.type} record for ${record.name} → ${record.content}`);
            });
          } else {
            console.error(`❌ No DNS records found that point to Vercel`);
            console.log(`Recommendation: Add a CNAME record for ${domainToVerify} pointing to cname.vercel-dns.com`);
            console.log(`               Or an A record pointing to 76.76.21.21`);
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error checking Cloudflare: ${error.message}`);
    }
    
    // 2. Check Vercel configuration
    console.log('\n2. Checking Vercel configuration...');
    
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
    
    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
      console.error('Error: Vercel token or project ID not set in environment variables');
      return;
    }
    
    try {
      // Construct the API URL
      let apiUrl = `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains`;
      if (VERCEL_TEAM_ID) {
        apiUrl += `?teamId=${VERCEL_TEAM_ID}`;
      }
      
      // Make the API request
      const vercelResponse = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      const vercelData = await vercelResponse.json();
      
      if (!vercelData.domains) {
        console.error(`❌ Could not retrieve domains from Vercel`);
      } else {
        // Find the domain
        const domainRecord = vercelData.domains.find(d => d.name === domainToVerify);
        
        if (!domainRecord) {
          console.error(`❌ Domain not found in Vercel project`);
          console.log(`Recommendation: Add the domain to your Vercel project`);
          
          // Show how to add the domain
          console.log(`\nTo add the domain to Vercel, run:`);
          let addDomainCmd = `curl -X POST "https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains"`;
          if (VERCEL_TEAM_ID) {
            addDomainCmd += `?teamId=${VERCEL_TEAM_ID}`;
          }
          addDomainCmd += ` -H "Authorization: Bearer ${VERCEL_TOKEN}" -H "Content-Type: application/json" -d '{"name":"${domainToVerify}"}'`;
          console.log(addDomainCmd);
        } else {
          console.log(`✅ Domain found in Vercel project`);
          console.log(`   Verification: ${domainRecord.verification.length ? 'Required' : 'Not required'}`);
          console.log(`   Status: ${domainRecord.verified ? 'Verified' : 'Not verified'}`);
          
          if (!domainRecord.verified) {
            console.error(`❌ Domain not verified in Vercel`);
            
            if (domainRecord.verification && domainRecord.verification.length > 0) {
              const verification = domainRecord.verification[0];
              console.log(`\nVerification required. Please add the following verification record:`);
              console.log(`   Type: ${verification.type}`);
              console.log(`   Name: ${verification.name}`);
              console.log(`   Value: ${verification.value}`);
              console.log(`   Domain: ${verification.domain}`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error checking Vercel: ${error.message}`);
    }
    
    console.log('\nVerification complete.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the verification
verifyDomainConfig(); 