import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { RootPage } from '@/lib/models/RootPage';
import { addDomainToVercel } from '@/lib/vercel';
import { createDnsRecord } from '@/lib/cloudflare';

interface Params {
  params: {
    id: string;
  };
}

// Mark this route as dynamic to prevent static optimization issues
export const dynamic = 'force-dynamic';

// POST /api/domains/[id]/create-root-page - Create a default root page for a domain
export async function POST(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    console.log(`Creating root page for domain with ID: ${params.id}`);
    
    // Find the domain
    const domain = await Domain.findById(params.id);
    if (!domain) {
      console.error(`Domain with ID ${params.id} not found`);
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }
    
    console.log(`Found domain: ${domain.name}`);
    
    // Check if a root page already exists for this domain
    const existingRootPage = await RootPage.findOne({ domainId: domain._id });
    if (existingRootPage) {
      console.log(`Root page already exists for domain ${domain.name}`);
      return NextResponse.json(
        { error: 'A root page already exists for this domain', rootPageId: existingRootPage._id },
        { status: 400 }
      );
    }
    
    // Get parameters from request body (if any) or use defaults
    const body = await request.json().catch(() => ({}));
    const { companyName, primaryColor } = body;
    
    // Ensure domain is properly registered with Vercel
    console.log(`Ensuring domain ${domain.name} is registered with Vercel...`);
    let vercelResult;
    try {
      vercelResult = await addDomainToVercel(domain.name);
      console.log(`Domain ${domain.name} registered with Vercel:`, vercelResult);
    } catch (error) {
      console.error(`Error registering domain with Vercel:`, error);
      // Continue even if Vercel registration fails - we'll show a warning
    }
    
    // Ensure proper DNS records exist in Cloudflare
    console.log(`Ensuring DNS records exist for domain ${domain.name}...`);
    let dnsResult = { 
      success: false, 
      messages: [] as string[] 
    };
    
    // Check if domain has a Cloudflare Zone ID
    if (!domain.cloudflareZoneId) {
      console.warn(`Domain ${domain.name} has no Cloudflare Zone ID. DNS records cannot be created.`);
      dnsResult.messages.push('Domain has no Cloudflare Zone ID. Please update domain zone ID first.');
    } else {
      try {
        // Create A record for root domain pointing to Vercel using direct Cloudflare API
        // Since our createDnsRecord function only supports CNAME, we'll manually add the A record
        const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
        if (!CF_API_TOKEN) {
          throw new Error('Cloudflare API token is not configured');
        }
        
        // First, create the A record for the root domain
        console.log(`Creating A record for root domain ${domain.name}...`);
        const aRecordResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.cloudflareZoneId}/dns_records`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'A',
            name: '@',
            content: '76.76.21.21',
            ttl: 1,
            proxied: false
          })
        });
        
        const aRecordData = await aRecordResponse.json();
        if (aRecordData.success) {
          dnsResult.messages.push(`Created A record for ${domain.name} pointing to 76.76.21.21`);
        } else {
          console.error(`Failed to create A record: ${JSON.stringify(aRecordData.errors)}`);
          dnsResult.messages.push(`Failed to create A record: ${JSON.stringify(aRecordData.errors)}`);
        }
        
        // Then, create the CNAME record for www subdomain
        await createDnsRecord('www', domain.name, 'CNAME', 'cname.vercel-dns.com', domain.cloudflareZoneId);
        dnsResult.messages.push(`Created CNAME record for www.${domain.name} pointing to cname.vercel-dns.com`);
        
        dnsResult.success = true;
      } catch (error: any) {
        console.error(`Error creating DNS records for ${domain.name}:`, error);
        dnsResult.messages.push(`Failed to create DNS records: ${error.message || 'Unknown error'}`);
      }
    }
    
    // Create default features
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
    console.log(`Creating root page for domain ${domain.name}...`);
    const rootPage = await RootPage.create({
      domainId: domain._id,
      title: `${domain.name} - Official Website`,
      description: `Welcome to the official website of ${companyName || domain.name}`,
      isActive: true,
      
      // Hero section
      heroTitle: `Welcome to ${companyName || domain.name}`,
      heroSubtitle: 'Providing quality products and services to meet your needs',
      heroButtonText: 'Learn More',
      heroButtonUrl: '#features',
      
      // Features
      features: defaultFeatures,
      
      // Testimonials
      testimonials: defaultTestimonials,
      
      // Contact info
      contactTitle: 'Get In Touch',
      contactEmail: `info@${domain.name}`,
      
      // Company info
      companyName: companyName || domain.name,
      privacyPolicyUrl: `/privacy`,
      termsUrl: `/terms`,
      
      // Styling
      primaryColor: primaryColor || '#3b82f6',
    });
    
    console.log(`Root page created successfully for domain ${domain.name}`);
    
    return NextResponse.json({
      success: true,
      rootPage: rootPage.toJSON(),
      vercelStatus: vercelResult ? 'configured' : 'error',
      dnsStatus: dnsResult,
      message: `Default root page created successfully for ${domain.name}`,
      nextSteps: [
        'The root page has been created successfully in the database',
        ...(!vercelResult ? ['The domain could not be registered with Vercel. Please check your Vercel configuration.'] : []),
        ...(!dnsResult.success ? ['DNS records could not be created. Please add them manually.'] : []),
        'It may take some time for DNS changes to propagate (up to 24-48 hours)',
        'If the page is not accessible, please check your domain configuration in Cloudflare and Vercel'
      ]
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating default root page:', error);
    return NextResponse.json(
      { error: 'Failed to create default root page', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
} 