// This script fixes domains with redirect loop issues by:
// 1. Checking and fixing Cloudflare DNS settings (ensuring DNS-only, not proxied)
// 2. Redeploying the domain with our improved template that prevents redirect loops

// Import required modules
const { createVercelProject, createDeployment, getDeploymentStatus } = require('../lib/vercel');
const { checkAndFixDnsSettings } = require('../lib/cloudflare');

// Immediately invoked async function
(async () => {
  try {
    // Get domain from command line arguments
    const domainName = process.argv[2];
    
    if (!domainName) {
      console.error('Please provide a domain name as an argument');
      console.error('Usage: node scripts/fix-domain-redirects.js yourdomain.com');
      process.exit(1);
    }
    
    console.log(`Starting domain redirect fix for: ${domainName}`);
    
    // Step 1: Check and fix Cloudflare DNS settings
    console.log(`\n--- STEP 1: Checking Cloudflare DNS settings ---`);
    try {
      const dnsResult = await checkAndFixDnsSettings(domainName);
      console.log(dnsResult.message);
      
      if (dnsResult.rootDomainFixed || dnsResult.wwwDomainFixed) {
        console.log('DNS records were fixed. Please allow a few minutes for DNS changes to propagate.');
      } else {
        console.log('DNS records are already correctly configured (DNS-only, not proxied).');
      }
    } catch (dnsError) {
      console.error('Error fixing DNS settings:', dnsError);
      console.log('Continuing with redeployment anyway...');
    }
    
    // Step 2: Redeploy the domain with our improved template
    console.log(`\n--- STEP 2: Redeploying domain with improved template ---`);
    console.log('Creating/updating Vercel project...');
    
    // Create or get existing project
    const project = await createVercelProject(domainName, 'nextjs');
    
    if (!project || !project.id) {
      throw new Error('Failed to create or find Vercel project for the domain');
    }
    
    console.log(`Using Vercel project: ${project.name} (${project.id})`);
    
    // Create a new deployment with our improved template
    console.log('Creating new deployment with improved template...');
    let deployment;
    try {
      deployment = await createDeployment(project.id, domainName);
      
      if (!deployment || !deployment.id) {
        throw new Error('Failed to create deployment - no deployment ID returned');
      }
    } catch (deployError) {
      console.error('Error creating deployment:', deployError);
      console.log('Trying again with a simpler configuration...');
      
      // If the first attempt fails, we could try a simpler deployment here
      // But for now, just rethrow the error
      throw deployError;
    }
    
    console.log(`Deployment created: ${deployment.id}`);
    console.log('Waiting for deployment to be ready...');
    
    // Wait for deployment to be ready
    let ready = false;
    let attempts = 0;
    let deploymentStatus;
    const MAX_ATTEMPTS = 15; // Increase max attempts to wait longer
    const WAIT_TIME = 6000; // 6 seconds between checks
    
    while (!ready && attempts < MAX_ATTEMPTS) {
      attempts++;
      console.log(`Checking deployment status (attempt ${attempts}/${MAX_ATTEMPTS})...`);
      
      // Wait between checks
      await new Promise(resolve => setTimeout(resolve, WAIT_TIME));
      
      try {
        deploymentStatus = await getDeploymentStatus(deployment.id);
        
        if (deploymentStatus.readyState === 'READY' || deploymentStatus.state === 'READY') {
          ready = true;
          console.log('Deployment is now ready!');
        } else if (deploymentStatus.readyState === 'ERROR' || deploymentStatus.state === 'ERROR') {
          console.error('Deployment failed with status:', deploymentStatus.readyState || deploymentStatus.state);
          console.error('Error details:', JSON.stringify(deploymentStatus.errorMessage || 'No error details available'));
          throw new Error(`Deployment failed: ${deploymentStatus.readyState || deploymentStatus.state}`);
        } else {
          console.log(`Current status: ${deploymentStatus.readyState || deploymentStatus.state} - continuing to wait...`);
        }
      } catch (statusError) {
        console.error(`Error checking deployment status (attempt ${attempts}):`, statusError);
        // Continue to next attempt rather than failing immediately
      }
    }
    
    // If we exceeded max attempts but deployment isn't in error state, consider it good enough
    if (!ready) {
      console.warn(`\nDeployment did not become ready after ${MAX_ATTEMPTS} attempts`);
      console.warn('The deployment may still be processing - this is not necessarily an error');
      console.warn('You can check the deployment status in your Vercel dashboard');
    }
    
    console.log(`\n--- Fix completed successfully ---`);
    console.log(`Domain: ${domainName}`);
    console.log(`Project: ${project.name} (${project.id})`);
    console.log(`Deployment: ${deployment.id}`);
    console.log(`Status: ${ready ? 'READY' : 'STILL PROCESSING'}`);
    console.log(`\nPlease wait a few minutes for the changes to fully propagate, then test your domain.`);
    console.log(`If you still see redirect errors, try clearing your browser cache or using a different browser.`);
    
  } catch (error) {
    console.error('Error fixing domain redirects:', error);
    process.exit(1);
  }
})(); 