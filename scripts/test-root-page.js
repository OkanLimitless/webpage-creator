// Set development environment
process.env.NODE_ENV = 'development';

// Run the test
async function testRootPage() {
  try {
    // Import required modules
    const mongoose = require('mongoose');
    require('../lib/models/RootPage');
    require('../lib/models/Domain');
    
    // Connect to database
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/webpage-creator';
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
    
    // Get models
    const Domain = mongoose.model('Domain');
    const RootPage = mongoose.model('RootPage');
    
    // Find a domain to test with
    const domain = await Domain.findOne({ isActive: true });
    
    if (!domain) {
      console.log('No active domains found for testing');
      return;
    }
    
    console.log(`Testing with domain: ${domain.name}`);
    
    // Check if domain already has a root page
    const existingRootPage = await RootPage.findOne({ domainId: domain._id });
    
    if (existingRootPage) {
      console.log('Domain already has a root page:');
      console.log({
        title: existingRootPage.title,
        content: existingRootPage.content?.substring(0, 50) + '...',
        metaTags: existingRootPage.metaTags || [],
        redirectWwwToNonWww: existingRootPage.redirectWwwToNonWww
      });
      
      // You can delete it for testing if needed
      // await RootPage.findByIdAndDelete(existingRootPage._id);
      // console.log('Deleted existing root page for testing');
    } else {
      console.log('No root page found for this domain. Creating one...');
      
      // Create a root page
      const rootPage = await RootPage.create({
        domainId: domain._id,
        title: `${domain.name} - Test Root Page`,
        description: `Test description for ${domain.name}`,
        content: `
          <h1>${domain.name}</h1>
          <p>This is a test root page content.</p>
          <div>
            <h2>Our Services</h2>
            <ul>
              <li>Test service 1</li>
              <li>Test service 2</li>
            </ul>
          </div>
        `,
        isActive: true,
        metaTags: [
          `keywords:${domain.name},test,website`,
          'robots:index,follow'
        ],
        redirectWwwToNonWww: true,
        customHead: '',
        customCss: `
          h1 { color: blue; }
          h2 { color: #333; }
        `
      });
      
      console.log('Root page created successfully:');
      console.log({
        id: rootPage._id,
        title: rootPage.title,
        contentPreview: rootPage.content.substring(0, 50) + '...'
      });
      
      console.log(`Visit your domain at: https://${domain.name}`);
    }
    
    // Close the database connection
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testRootPage(); 