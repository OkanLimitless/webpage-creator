// Script to redeploy all domains with the new static HTML approach
const { connectToDatabase } = require('../lib/mongodb');
const { Domain } = require('../lib/models/Domain');
const { createVercelProject, createDeployment, addDomainToVercel } = require('../lib/vercel');

// Function to wait for a specified time
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function redeployDomains() {
  try {
    console.log('Connecting to database...');
    await connectToDatabase();
    
    // Get all active domains
    console.log('Fetching active domains...');
    const domains = await Domain.find({ isActive: true });
    console.log(`Found ${domains.length} active domains to redeploy`);
    
    // Process each domain
    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i];
      console.log(`\n[${i+1}/${domains.length}] Redeploying domain ${domain.name}...`);
      
      try {
        // Step 1: Create or find project for the domain
        console.log(`  Creating/finding Vercel project for ${domain.name}...`);
        const project = await createVercelProject(domain.name, null); // Use null for static site
        
        if (!project || !project.id) {
          console.error(`  Failed to create/find project for ${domain.name}`);
          continue;
        }
        
        console.log(`  Using project: ${project.name} (${project.id})`);
        
        // Step 2: Create deployment with static HTML
        console.log(`  Creating deployment with static HTML...`);
        const deployment = await createDeployment(project.id, domain.name);
        
        if (!deployment || !deployment.id) {
          console.error(`  Failed to create deployment for ${domain.name}`);
          continue;
        }
        
        console.log(`  Deployment created with ID: ${deployment.id}`);
        
        // Step 3: Make sure domain is attached to the project
        console.log(`  Ensuring domain is attached to project...`);
        await addDomainToVercel(domain.name, project.id);
        
        // Update domain in database
        domain.deploymentId = deployment.id;
        domain.deploymentStatus = 'deployed';
        domain.lastDeployedAt = new Date();
        await domain.save();
        
        console.log(`  Domain ${domain.name} redeployed successfully!`);
        
        // Wait a bit between deployments to avoid rate limits
        if (i < domains.length - 1) {
          const waitTime = 2000; // 2 seconds
          console.log(`  Waiting ${waitTime/1000} seconds before next deployment...`);
          await wait(waitTime);
        }
      } catch (error) {
        console.error(`  Error redeploying domain ${domain.name}:`, error);
        // Continue with next domain
      }
    }
    
    console.log('\nAll domains have been redeployed!');
  } catch (error) {
    console.error('Error in redeploy script:', error);
  } finally {
    process.exit(0);
  }
}

// Run the redeploy process
redeployDomains(); 