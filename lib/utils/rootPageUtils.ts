import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { RootPage } from '@/lib/models/RootPage';
import mongoose from 'mongoose';
import { generateRootPageHtml } from '@/lib/rootPageGenerator';

/**
 * Create a root page for a domain if it doesn't already exist
 * @param domainIdOrObject The domain ID or Domain object
 * @returns Result of the root page creation
 */
export async function createDomainRootPage(domainIdOrObject: string | any): Promise<{
  success: boolean;
  message: string;
  rootPage?: any;
  alreadyExists?: boolean;
}> {
  const startTime = Date.now();
  try {
    console.log(`[${new Date().toISOString()}] createDomainRootPage: Starting root page creation process`);
    
    await connectToDatabase();
    
    // Get the domain
    let domain;
    if (typeof domainIdOrObject === 'string') {
      console.log(`[${new Date().toISOString()}] createDomainRootPage: Looking up domain with ID: ${domainIdOrObject}`);
      domain = await Domain.findById(domainIdOrObject);
    } else {
      console.log(`[${new Date().toISOString()}] createDomainRootPage: Using provided domain object`);
      domain = domainIdOrObject;
    }
    
    if (!domain) {
      console.error(`[${new Date().toISOString()}] createDomainRootPage: Domain not found`);
      return {
        success: false,
        message: 'Domain not found'
      };
    }
    
    console.log(`[${new Date().toISOString()}] createDomainRootPage: Found domain: ${domain.name}`);
    
    // Check if a root page already exists for this domain
    const existingRootPage = await RootPage.findOne({ domainId: domain._id });
    if (existingRootPage) {
      console.log(`[${new Date().toISOString()}] createDomainRootPage: Root page already exists for domain ${domain.name}`);
      return {
        success: true,
        message: 'A root page already exists for this domain',
        rootPage: existingRootPage.toJSON(),
        alreadyExists: true
      };
    }
    
    // Extract the company name from the domain
    const companyName = domain.name.split('.')[0].charAt(0).toUpperCase() + domain.name.split('.')[0].slice(1);
    
    // Create default features for the root page
    const defaultFeatures = [
      {
        title: 'High Quality',
        description: 'We pride ourselves on delivering products and services of the highest quality.',
        iconName: 'star'
      },
      {
        title: 'Excellent Support',
        description: 'Our support team is available 24/7 to assist you with any questions or concerns.',
        iconName: 'chat'
      },
      {
        title: 'Secure & Reliable',
        description: 'Your security is our priority. We use the latest technology to protect your data.',
        iconName: 'shield'
      }
    ];
    
    // Create a default testimonial
    const defaultTestimonials = [
      {
        name: 'John Smith',
        role: 'Satisfied Customer',
        comment: 'I\'ve been using this service for months and I\'m extremely satisfied with the results.',
      }
    ];
    
    // Create the root page with default values
    console.log(`[${new Date().toISOString()}] createDomainRootPage: Creating root page for domain ${domain.name}`);
    
    // Use default primary color
    const primaryColor = '#3b82f6'; // Blue color
    
    const rootPage = await RootPage.create({
      domainId: domain._id,
      title: `${domain.name} - Official Website`,
      description: `Welcome to the official website of ${companyName}`,
      content: `
        <h1>${companyName}</h1>
        <p>Welcome to our website. We provide quality products and services to meet your needs.</p>
        
        <div class="my-8">
          <h2>Our Services</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 30px 0;">
            <div class="my-4 p-4 bg-gray-100 border border-gray-300 rounded">
              <h3>High Quality</h3>
              <p>We pride ourselves on delivering products and services of the highest quality.</p>
            </div>
            <div class="my-4 p-4 bg-gray-100 border border-gray-300 rounded">
              <h3>Excellent Support</h3>
              <p>Our support team is available 24/7 to assist you with any questions or concerns.</p>
            </div>
            <div class="my-4 p-4 bg-gray-100 border border-gray-300 rounded">
              <h3>Secure & Reliable</h3>
              <p>Your security is our priority. We use the latest technology to protect your data.</p>
            </div>
          </div>
        </div>
        
        <div class="my-8">
          <h2>Testimonials</h2>
          <div class="my-4 p-4 bg-gray-100 border border-gray-300 rounded">
            <p>"I've been using this service for months and I'm extremely satisfied with the results."</p>
            <p style="font-weight: bold; margin-top: 10px;">- John Smith, Satisfied Customer</p>
          </div>
        </div>
        
        <div class="my-8">
          <h2>Contact Us</h2>
          <p>Email: <a href="mailto:info@${domain.name}">info@${domain.name}</a></p>
        </div>
      `,
      isActive: true,
      metaTags: [
        `keywords:${domain.name},website,services,products`,
        'robots:index,follow'
      ],
      redirectWwwToNonWww: true,
      customHead: '',
      customCss: `
        a {
          color: ${primaryColor};
        }
        h2 {
          color: ${primaryColor};
        }
      `
    });
    
    console.log(`[${new Date().toISOString()}] createDomainRootPage: Root page created successfully for domain ${domain.name} (took ${Date.now() - startTime}ms)`);
    
    return {
      success: true,
      message: `Default root page created successfully for ${domain.name}`,
      rootPage: rootPage.toJSON()
    };
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] createDomainRootPage: Error creating root page (took ${Date.now() - startTime}ms):`, error);
    return {
      success: false,
      message: `Failed to create root page: ${error.message || 'Unknown error'}`
    };
  }
} 