// Set the PRIMARY_DOMAIN environment variable in Vercel
process.env.NODE_ENV = 'development';

// Import required libraries
const fetch = require('node-fetch');
require('dotenv').config();

async function setPrimaryDomain() {
  try {
    console.log('Set PRIMARY_DOMAIN Environment Variable');
    console.log('=====================================');
    
    // Get domain from command line arguments
    const primaryDomain = process.argv[2];
    
    if (!primaryDomain) {
      console.error('Error: No domain specified');
      console.log('Usage: node set-primary-domain.js <domain>');
      return;
    }
    
    console.log(`Setting PRIMARY_DOMAIN to: ${primaryDomain}`);
    
    // Get Vercel API credentials
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
      console.error('❌ Error: VERCEL_TOKEN and VERCEL_PROJECT_ID must be set in .env file');
      return;
    }
    
    // First, check if the environment variable already exists
    console.log('\n1. Checking existing environment variables...');
    
    let url = `https://api.vercel.com/v8/projects/${VERCEL_PROJECT_ID}/env`;
    if (VERCEL_TEAM_ID) {
      url += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`❌ Failed to get environment variables: ${JSON.stringify(data)}`);
      return;
    }
    
    // Find if PRIMARY_DOMAIN already exists
    const primaryDomainEnv = data.envs.find(env => env.key === 'PRIMARY_DOMAIN');
    
    // If it exists, update it. Otherwise, create it.
    if (primaryDomainEnv) {
      console.log(`Found existing PRIMARY_DOMAIN: ${primaryDomainEnv.value}`);
      console.log('\n2. Updating PRIMARY_DOMAIN...');
      
      // For updating, we need to use the environment variable ID
      const updateUrl = `https://api.vercel.com/v8/projects/${VERCEL_PROJECT_ID}/env/${primaryDomainEnv.id}`;
      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          value: primaryDomain,
          target: ['production', 'preview', 'development']
        })
      });
      
      const updateData = await updateResponse.json();
      
      if (updateResponse.ok) {
        console.log(`✅ Updated PRIMARY_DOMAIN to: ${primaryDomain}`);
      } else {
        console.error(`❌ Failed to update PRIMARY_DOMAIN: ${JSON.stringify(updateData)}`);
      }
    } else {
      console.log('PRIMARY_DOMAIN not found, creating it...');
      console.log('\n2. Creating PRIMARY_DOMAIN...');
      
      let createUrl = `https://api.vercel.com/v8/projects/${VERCEL_PROJECT_ID}/env`;
      if (VERCEL_TEAM_ID) {
        createUrl += `?teamId=${VERCEL_TEAM_ID}`;
      }
      
      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: 'PRIMARY_DOMAIN',
          value: primaryDomain,
          target: ['production', 'preview', 'development'],
          type: 'plain'
        })
      });
      
      const createData = await createResponse.json();
      
      if (createResponse.ok) {
        console.log(`✅ Created PRIMARY_DOMAIN: ${primaryDomain}`);
      } else {
        console.error(`❌ Failed to create PRIMARY_DOMAIN: ${JSON.stringify(createData)}`);
      }
    }
    
    console.log('\n3. Deploying to apply changes...');
    console.log('⚠️ To apply these changes, you need to redeploy the application in Vercel.');
    console.log('   You can do this from the Vercel dashboard or by pushing a new commit.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
setPrimaryDomain(); 