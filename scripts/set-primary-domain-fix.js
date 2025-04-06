// Set the PRIMARY_DOMAIN environment variable in Vercel
// This script fixes the "Domain not found: com" error
require('dotenv').config();
const fetch = require('node-fetch');

// Your domain (update this)
const PRIMARY_DOMAIN = 'yourfavystore.com';

async function setPrimaryDomain() {
  console.log('Setting PRIMARY_DOMAIN Environment Variable');
  console.log('=======================================');
  
  const vercelToken = process.env.VERCEL_TOKEN;
  const vercelTeamId = process.env.VERCEL_TEAM_ID;
  const vercelProjectId = process.env.VERCEL_PROJECT_ID;
  
  if (!vercelToken || !vercelProjectId) {
    console.error('❌ Missing required environment variables (VERCEL_TOKEN, VERCEL_PROJECT_ID)');
    process.exit(1);
  }
  
  console.log(`Setting PRIMARY_DOMAIN to: ${PRIMARY_DOMAIN}`);
  
  // 1. Get existing environment variables
  console.log('\n1. Checking existing environment variables...');
  
  let url = `https://api.vercel.com/v9/projects/${vercelProjectId}/env`;
  if (vercelTeamId) {
    url += `?teamId=${vercelTeamId}`;
  }
  
  try {
    const getEnvResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!getEnvResponse.ok) {
      throw new Error(`Failed to get environment variables: ${getEnvResponse.statusText}`);
    }
    
    const data = await getEnvResponse.json();
    
    // Find if PRIMARY_DOMAIN already exists
    const primaryDomainEnv = data.envs.find(env => env.key === 'PRIMARY_DOMAIN');
    
    if (primaryDomainEnv) {
      // Update existing PRIMARY_DOMAIN
      console.log(`Found existing PRIMARY_DOMAIN: ${primaryDomainEnv.value}`);
      console.log('\n2. Updating PRIMARY_DOMAIN...');
      
      const updateResponse = await fetch(
        `https://api.vercel.com/v9/projects/${vercelProjectId}/env/${primaryDomainEnv.id}${
          vercelTeamId ? `?teamId=${vercelTeamId}` : ''
        }`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${vercelToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            value: PRIMARY_DOMAIN,
          }),
        }
      );
      
      if (!updateResponse.ok) {
        const updateData = await updateResponse.json();
        console.error(`❌ Failed to update PRIMARY_DOMAIN: ${JSON.stringify(updateData)}`);
        return;
      }
      
      console.log(`✅ Updated PRIMARY_DOMAIN to: ${PRIMARY_DOMAIN}`);
    } else {
      // Create new PRIMARY_DOMAIN
      console.log('PRIMARY_DOMAIN not found, creating it...');
      console.log('\n2. Creating PRIMARY_DOMAIN...');
      
      const createResponse = await fetch(
        `https://api.vercel.com/v9/projects/${vercelProjectId}/env${
          vercelTeamId ? `?teamId=${vercelTeamId}` : ''
        }`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${vercelToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'plain',
            key: 'PRIMARY_DOMAIN',
            value: PRIMARY_DOMAIN,
            target: ['production', 'preview', 'development'],
          }),
        }
      );
      
      if (!createResponse.ok) {
        const createData = await createResponse.json();
        console.error(`❌ Failed to create PRIMARY_DOMAIN: ${JSON.stringify(createData)}`);
        return;
      }
      
      console.log(`✅ Created PRIMARY_DOMAIN: ${PRIMARY_DOMAIN}`);
    }
    
    console.log('\n✅ SUCCESS: PRIMARY_DOMAIN environment variable has been set.');
    console.log('\nIMPORTANT: You need to redeploy your application for this change to take effect.');
  } catch (error) {
    console.error('❌ Error setting PRIMARY_DOMAIN:', error);
  }
}

setPrimaryDomain(); 