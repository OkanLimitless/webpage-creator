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
        heroTitle: existingRootPage.heroTitle,
        features: existingRootPage.features.length,
        hasTestimonials: existingRootPage.testimonials && existingRootPage.testimonials.length > 0,
      });
      
      // You can delete it for testing if needed
      // await RootPage.findByIdAndDelete(existingRootPage._id);
      // console.log('Deleted existing root page for testing');
    } else {
      console.log('No root page found for this domain. Creating one...');
      
      // Create default features
      const defaultFeatures = [
        {
          title: 'Test Feature 1',
          description: 'This is a test feature description.',
          iconName: 'star'
        },
        {
          title: 'Test Feature 2',
          description: 'Another test feature description.',
          iconName: 'chat'
        },
      ];
      
      // Create a root page
      const rootPage = await RootPage.create({
        domainId: domain._id,
        title: `${domain.name} - Test Root Page`,
        description: `Test description for ${domain.name}`,
        isActive: true,
        
        // Hero section
        heroTitle: `Test Hero Title for ${domain.name}`,
        heroSubtitle: 'This is a test hero subtitle',
        
        // Features
        features: defaultFeatures,
      });
      
      console.log('Root page created successfully:');
      console.log({
        id: rootPage._id,
        title: rootPage.title,
        heroTitle: rootPage.heroTitle,
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