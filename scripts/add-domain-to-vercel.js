// Set development environment
process.env.NODE_ENV = 'development';

// Import required libraries
const fetch = require('node-fetch');
require('dotenv').config();

// Run the script
async function addDomainToVercel() {
  try {
    console.log('Add Domain to Vercel Tool');
    console.log('========================');
    
    // Get domain from command line arguments
    const domainToAdd = process.argv[2];
    
    if (!domainToAdd) {
      console.error('Error: No domain specified');
      console.log('Usage: node add-domain-to-vercel.js <domain>');
      return;
    }
    
    console.log(`\nAdding domain: ${domainToAdd}`);
    
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
    
    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
      console.error('Error: Vercel token or project ID not set in environment variables');
      return;
    }
    
    // Construct the API URL
    let apiUrl = `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains`;
    if (VERCEL_TEAM_ID) {
      apiUrl += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    // Make the API request
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: domainToAdd })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Domain added successfully!');
      console.log(`   Domain: ${data.name}`);
      
      if (data.verification && data.verification.length > 0) {
        const verification = data.verification[0];
        console.log('\nVerification required. Please add the following verification record:');
        console.log(`   Type: ${verification.type}`);
        console.log(`   Name: ${verification.name}`);
        console.log(`   Value: ${verification.value}`);
        console.log(`   Domain: ${verification.domain}`);
      }
    } else {
      console.error(`❌ Failed to add domain: ${data.error?.message || 'Unknown error'}`);
      
      if (data.error?.code === 'forbidden') {
        console.log('This could be due to:');
        console.log('1. The token does not have sufficient permissions');
        console.log('2. The project ID or team ID is incorrect');
      } else if (data.error?.code === 'domain_already_exists') {
        console.log('This domain is already added to another project');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
addDomainToVercel(); 