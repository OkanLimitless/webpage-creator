// Script to redeploy a single domain with the new static HTML approach
const { connectToDatabase } = require('../lib/mongodb');
const { Domain } = require('../lib/models/Domain');
const { createVercelProject, createDeployment, addDomainToVercel } = require('../lib/vercel');

async function fixDomain() {
  // Get domain name from command line arguments
  const domainName = process.argv[2];
  
  if (!domainName) {
    console.error('Please provide a domain name');
    console.error('Usage: node scripts/fix-domain.js your-domain.com');
    process.exit(1);
  }
  
  try {
    console.log(`Starting fix for domain: ${domainName}`);
    
    // Connect to database
    console.log('Connecting to database...');
    await connectToDatabase();
    
    // Find the domain
    console.log(`Looking up domain ${domainName} in database...`);
    const domain = await Domain.findOne({ name: domainName.toLowerCase() });
    
    if (!domain) {
      console.error(`Domain ${domainName} not found in database`);
      process.exit(1);
    }
    
    console.log(`Found domain: ${domain.name} (ID: ${domain._id})`);
    
    // Step 1: Create or find project for the domain
    console.log('Creating/finding Vercel project...');
    const project = await createVercelProject(domain.name, null); // Use null for static site
    
    if (!project || !project.id) {
      console.error('Failed to create/find project');
      process.exit(1);
    }
    
    console.log(`Using project: ${project.name} (${project.id})`);
    
    // Step 2: Create deployment with static HTML
    console.log('Creating deployment with static HTML...');
    const deployment = await createDeployment(project.id, domain.name);
    
    if (!deployment || !deployment.id) {
      console.error('Failed to create deployment');
      process.exit(1);
    }
    
    console.log(`Deployment created with ID: ${deployment.id}`);
    
    // Step 3: Make sure domain is attached to the project
    console.log('Ensuring domain is attached to project...');
    const domainResult = await addDomainToVercel(domain.name, project.id);
    
    console.log('Domain attachment result:', domainResult.message || 'Success');
    
    // Update domain in database
    domain.deploymentId = deployment.id;
    domain.deploymentStatus = 'deployed';
    domain.lastDeployedAt = new Date();
    await domain.save();
    
    console.log(`\nDomain ${domain.name} has been fixed!`);
    console.log(`Visit https://${domain.name} to verify the fix.`);
    console.log(`The page should show your root page content without any redirects.`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error fixing domain:', error);
    process.exit(1);
  }
}

// Run the fix
fixDomain(); 