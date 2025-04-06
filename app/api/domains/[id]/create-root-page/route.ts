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
    let vercelDnsTarget = 'cname.vercel-dns.com'; // Default DNS target
    
    try {
      // Only add if not already configured
      if (!vercelDomainStatus?.exists) {
        vercelResult = await addDomainToVercel(domain.name);
        console.log(`Domain ${domain.name} registered with Vercel:`, vercelResult);
        
        // Extract the specific DNS target that Vercel wants us to use
        if (vercelResult?.configurationDnsRecords?.length > 0) {
          const cnameRecord = vercelResult.configurationDnsRecords.find(
            (r: any) => r.type === 'CNAME'
          );
          if (cnameRecord) {
            vercelDnsTarget = cnameRecord.value;
            console.log(`Using Vercel-provided DNS target: ${vercelDnsTarget}`);
          }
        }
        
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
        
        // Even for existing domains, we should check if they have specific configuration
        if (vercelDomainStatus?.vercelDomain?.configurationDnsRecords?.length > 0) {
          const cnameRecord = vercelDomainStatus.vercelDomain.configurationDnsRecords.find(
            (r: any) => r.type === 'CNAME'
          );
          if (cnameRecord) {
            vercelDnsTarget = cnameRecord.value;
            console.log(`Using existing Vercel DNS target: ${vercelDnsTarget}`);
          }
        }
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
        
        // First, try to set up CNAME for root domain (apex domain) - some providers support this
        // Check if there's already a CNAME record for the root domain
        const rootCnameRecord = existingRecords.find((r: any) => 
          r.type === 'CNAME' && 
          (r.name === domain.name || r.name === `${domain.name}.` || r.name === '@') && 
          r.content.includes('vercel')
        );
        
        if (!rootCnameRecord) {
          // For root domain, we'll attempt to use the same approach as subdomains first
          console.log(`Setting up DNS for root domain ${domain.name} pointing to ${vercelDnsTarget}`);
          
          try {
            // Important: For Cloudflare to work properly with Vercel, proxying should be disabled
            // This allows SSL certificates to work correctly
            await createDnsRecord('@', domain.name, 'CNAME', vercelDnsTarget, domain.cloudflareZoneId);
            dnsResult.messages.push(`Created CNAME record for ${domain.name} pointing to ${vercelDnsTarget}`);
            dnsResult.messages.push(`NOTE: If using Cloudflare SSL 'Full (Strict)', ensure SSL is also configured on Vercel`);
          } catch (cnameError: any) {
            console.error(`Failed to create CNAME record for root domain: ${cnameError.message}`);
            dnsResult.messages.push(`Failed to create CNAME record for root domain: ${cnameError.message}`);
            
            // If CNAME fails, try with A record as fallback (some DNS providers don't allow CNAME at root)
            console.log(`Attempting to create A record as fallback...`);
            try {
              const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
              if (!CF_API_TOKEN) {
                throw new Error('Cloudflare API token is not configured');
              }
              
              // Vercel's recommended A record value
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
                  proxied: false // Important: Set to false for Vercel to verify domain
                })
              });
              
              const aRecordData = await aRecordResponse.json();
              if (aRecordData.success) {
                dnsResult.messages.push(`Created A record for ${domain.name} pointing to 76.76.21.21 (fallback)`);
                dnsResult.messages.push(`NOTE: If using Cloudflare SSL 'Full (Strict)', you might need to disable it or use 'Full' instead`);
              } else {
                console.error(`Failed to create A record: ${JSON.stringify(aRecordData.errors)}`);
                dnsResult.messages.push(`Failed to create A record: ${JSON.stringify(aRecordData.errors)}`);
              }
            } catch (aRecordError: any) {
              console.error(`Failed to create A record fallback: ${aRecordError.message}`);
              dnsResult.messages.push(`Failed to create A record fallback: ${aRecordError.message}`);
            }
          }
        } else {
          console.log(`CNAME record for root domain already exists: ${rootCnameRecord.content}`);
          dnsResult.messages.push(`CNAME record for ${domain.name} already exists pointing to ${rootCnameRecord.content}`);
          
          // Check if the record is proxied - for Vercel with Full Strict, it should not be
          if (rootCnameRecord.proxied) {
            dnsResult.messages.push(`WARNING: Your CNAME record is proxied through Cloudflare. This might cause SSL issues with 'Full (Strict)' mode.`);
          }
        }
        
        // Check if there's already a www CNAME record
        const wwwCnameRecord = existingRecords.find((r: any) => 
          r.type === 'CNAME' && 
          (r.name === `www.${domain.name}` || r.name === 'www') && 
          r.content.includes('vercel')
        );
        
        // Create the CNAME record for www subdomain if it doesn't exist
        if (!wwwCnameRecord) {
          await createDnsRecord('www', domain.name, 'CNAME', vercelDnsTarget, domain.cloudflareZoneId);
          dnsResult.messages.push(`Created CNAME record for www.${domain.name} pointing to ${vercelDnsTarget}`);
        } else {
          console.log(`CNAME record for www subdomain already exists: ${wwwCnameRecord.content}`);
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
      content: `
        <h1>${companyName || domain.name}</h1>
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
      customCss: primaryColor ? `
        a {
          color: ${primaryColor};
        }
        h2 {
          color: ${primaryColor};
        }
      ` : ''
    });
    
    console.log(`Root page created successfully for domain ${domain.name}`);
    
    // Add Cloudflare-specific advice for SSL settings
    let sslAdvice = '';
    if (dnsResult.messages.some(msg => msg.includes('CNAME'))) {
      sslAdvice = 'If you\'re using Cloudflare SSL "Full (Strict)" mode with a CNAME record, you may need to disable proxy for the CNAME record or switch to "Full" SSL mode.';
    }
    
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
        ...(sslAdvice ? [sslAdvice] : []),
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