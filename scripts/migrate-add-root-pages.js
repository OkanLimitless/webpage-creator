// Migration script to add root pages to all domains that don't have one yet
const { connectToDatabase } = require('../lib/mongodb');
const { Domain } = require('../lib/models/Domain');
const { RootPage } = require('../lib/models/RootPage');
const { createDomainRootPage } = require('../lib/utils/rootPageUtils');

async function migrateRootPages() {
  try {
    // Connect to the database
    console.log(`Connecting to database...`);
    await connectToDatabase();
    
    // Get all active domains
    console.log(`Finding all active domains...`);
    const domains = await Domain.find({ isActive: true });
    console.log(`Found ${domains.length} active domains`);
    
    // Get all domains that already have a root page
    console.log(`Finding domains with existing root pages...`);
    const rootPages = await RootPage.find();
    const domainIdsWithRootPages = rootPages.map(page => page.domainId.toString());
    console.log(`Found ${rootPages.length} existing root pages`);
    
    // Filter domains that don't have a root page
    const domainsWithoutRootPages = domains.filter(
      domain => !domainIdsWithRootPages.includes(domain._id.toString())
    );
    
    console.log(`Found ${domainsWithoutRootPages.length} domains without root pages`);
    
    // Create root pages for domains that don't have one
    for (let i = 0; i < domainsWithoutRootPages.length; i++) {
      const domain = domainsWithoutRootPages[i];
      console.log(`[${i+1}/${domainsWithoutRootPages.length}] Creating root page for ${domain.name}...`);
      
      try {
        const result = await createDomainRootPage(domain);
        console.log(`  Result: ${result.success ? 'Success' : 'Failed'} - ${result.message}`);
      } catch (error) {
        console.error(`  Error creating root page for ${domain.name}:`, error);
      }
    }
    
    console.log(`Root page migration complete!`);
  } catch (error) {
    console.error(`Error in migration:`, error);
  } finally {
    process.exit(0);
  }
}

// Run the migration
migrateRootPages(); 