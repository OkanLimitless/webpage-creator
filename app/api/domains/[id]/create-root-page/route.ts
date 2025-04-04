import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { RootPage } from '@/lib/models/RootPage';
import { addDomainToVercel, checkDomainInVercel, verifyDomainInVercel } from '@/lib/vercel';
import { createDnsRecord, getDnsRecords } from '@/lib/cloudflare';

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
    
    // First check if the domain already exists in Vercel
    console.log(`Checking if domain ${domain.name} already exists in Vercel...`);
    let vercelDomainStatus;
    try {
      vercelDomainStatus = await checkDomainInVercel(domain.name);
      console.log(`Vercel domain status:`, vercelDomainStatus);
    } catch (error) {
      console.error(`Error checking domain in Vercel:`, error);
      // Continue even if check fails
    }
    
    // Ensure domain is properly registered with Vercel
    console.log(`Ensuring domain ${domain.name} is registered with Vercel...`);
    let vercelResult;
    try {
      // Only add if not already configured
      if (!vercelDomainStatus?.exists) {
        vercelResult = await addDomainToVercel(domain.name);
        console.log(`Domain ${domain.name} registered with Vercel:`, vercelResult);
        
        // Trigger verification if domain was added
        if (vercelResult?.success) {
          console.log(`Triggering domain verification for ${domain.name} in Vercel...`);
          try {
            const verifyResult = await verifyDomainInVercel(domain.name);
            console.log(`Domain verification result:`, verifyResult);
          } catch (verifyError) {
            console.error(`Error verifying domain with Vercel:`, verifyError);
            // Continue even if verification fails
          }
        }
      } else {
        console.log(`Domain ${domain.name} already exists in Vercel, skipping registration`);
        vercelResult = { success: true, alreadyConfigured: true };
      }
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
        // Check existing DNS records first
        console.log(`Checking existing DNS records for ${domain.name}`);
        const existingRecords = await getDnsRecords(domain.name, domain.cloudflareZoneId);
        console.log(`Found ${existingRecords.length} existing DNS records`);
        
        // Check if there's already a Vercel A record for the root domain
        const rootARecord = existingRecords.find((r: any) => 
          r.type === 'A' && 
          (r.name === domain.name || r.name === '@') && 
          r.content === '76.76.21.21'
        );
        
        // Create A record for root domain pointing to Vercel only if it doesn't already exist
        if (!rootARecord) {
          console.log(`Creating A record for root domain ${domain.name}...`);
          const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
          if (!CF_API_TOKEN) {
            throw new Error('Cloudflare API token is not configured');
          }
          
          // Create the A record for the root domain
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
        } else {
          console.log(`A record for root domain already exists, skipping creation`);
          dnsResult.messages.push(`A record for ${domain.name} already exists pointing to 76.76.21.21`);
        }
        
        // Check if there's already a www CNAME record
        const wwwCnameRecord = existingRecords.find((r: any) => 
          r.type === 'CNAME' && 
          (r.name === `www.${domain.name}` || r.name === 'www') && 
          r.content.includes('vercel')
        );
        
        // Create the CNAME record for www subdomain if it doesn't exist
        if (!wwwCnameRecord) {
          await createDnsRecord('www', domain.name, 'CNAME', 'cname.vercel-dns.com', domain.cloudflareZoneId);
          dnsResult.messages.push(`Created CNAME record for www.${domain.name} pointing to cname.vercel-dns.com`);
        } else {
          console.log(`CNAME record for www subdomain already exists, skipping creation`);
          dnsResult.messages.push(`CNAME record for www.${domain.name} already exists`);
        }
        
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