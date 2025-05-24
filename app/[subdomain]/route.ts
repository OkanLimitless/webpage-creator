import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/lib/mongodb';
import { LandingPage } from '@/lib/models/LandingPage';
import { Domain } from '@/lib/models/Domain';
import { generateLandingPageHtml } from '@/lib/landingPageGenerator';

// Mark this route as dynamic to prevent static optimization issues
export const dynamic = 'force-dynamic';

interface Params {
  params: {
    subdomain: string;
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  // Set up detailed logging for debugging
  console.log('----------- SUBDOMAIN ROUTE HANDLER START -----------');
  console.log('Request URL:', request.url);
  console.log('Request host:', request.headers.get('host'));
  console.log('Params:', params);
  
  try {
    await connectToDatabase();
    
    // Get the host from the request
    const host = request.headers.get('host') || '';
    console.log('Processing host:', host);
    
    // Extract domain and subdomain
    const hostParts = host.split('.');
    let subdomain, domain;
    
    if (hostParts.length >= 2) {
      subdomain = hostParts[0];
      // For domains like sub.domain.com, we need to join all parts after the first
      domain = hostParts.slice(1).join('.');
      
      console.log(`Parsed from host header - Subdomain: ${subdomain}, Domain: ${domain}`);
    } else {
      // If we can't parse the host, use the params
      subdomain = params.subdomain;
      
      // Try to extract domain from request URL
      const url = new URL(request.url);
      domain = url.hostname.replace(`${subdomain}.`, '');
      
      console.log(`Parsed from params - Subdomain: ${subdomain}, Domain: ${domain}`);
    }
    
    // Extra check for Vercel preview URLs (e.g., project-name.vercel.app)
    if (host.includes('vercel.app') || host.includes('localhost')) {
      console.log('Detected Vercel preview URL or localhost');
      // In this case, the subdomain param is the actual subdomain we want
      subdomain = params.subdomain;
      
      // We need to determine the domain some other way
      // For now, let's hard code the production domain or fetch it from env
      domain = process.env.PRIMARY_DOMAIN || 'yourfavystore.com';
      console.log(`Using primary domain for preview URL: ${domain}`);
    }
    
    console.log(`Final values - Subdomain: ${subdomain}, Domain: ${domain}`);
    
    // For external domains, the full domain (including subdomain) might be stored in the database
    // So we need to check both the full domain and the base domain
    console.log(`Looking up domain in database. Trying full domain first: '${host.replace(/:\d+$/, '')}'`);
    
    // First try to find the full domain (for external domains like medvi.wellnesstoday180.org)
    let domainDoc = await Domain.findOne({ name: host.replace(/:\d+$/, '') });
    
    if (!domainDoc) {
      // If not found, try the base domain (for regular domains)
      console.log(`Full domain not found, trying base domain: '${domain}'`);
      domainDoc = await Domain.findOne({ name: domain });
    }
    
    if (!domainDoc) {
      console.error(`Domain not found in database. Tried: '${host.replace(/:\d+$/, '')}' and '${domain}'`);
      return new NextResponse(`Domain not found: ${domain}`, { status: 404 });
    }
    
    console.log(`Found domain in database: ${domainDoc.name} (ID: ${domainDoc._id})`);
    
    // For external domains, the subdomain field will be empty, so we search differently
    let landingPage;
    
    if (domainDoc.dnsManagement === 'external') {
      // For external domains, there's only one landing page per domain (no subdomain)
      console.log(`External domain detected, looking for landing page without subdomain filter`);
      landingPage = await LandingPage.findOne({
        domainId: domainDoc._id,
      });
    } else {
      // For regular domains, find by subdomain
      console.log(`Regular domain detected, looking up landing page for subdomain '${subdomain}' on domain ID ${domainDoc._id}`);
      landingPage = await LandingPage.findOne({
        domainId: domainDoc._id,
        subdomain: subdomain,
      });
    }
    
    if (!landingPage) {
      console.error(`Landing page not found for subdomain: ${subdomain}`);
      return new NextResponse(`Landing page not found for subdomain: ${subdomain}`, { status: 404 });
    }
    
    console.log(`Found landing page: ${landingPage.name} (ID: ${landingPage._id})`);
    
    // Generate the HTML
    console.log('Generating landing page HTML');
    const html = await generateLandingPageHtml(landingPage);
    
    console.log('----------- SUBDOMAIN ROUTE HANDLER END -----------');
    
    // Return the HTML with correct content type and headers
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    console.error('Error serving landing page:', error);
    console.log('----------- SUBDOMAIN ROUTE HANDLER ERROR END -----------');
    return new NextResponse('Internal Server Error: ' + (error.message || 'Unknown error'), { 
      status: 500,
      headers: {
        'Content-Type': 'text/html',
      }
    });
  }
} 