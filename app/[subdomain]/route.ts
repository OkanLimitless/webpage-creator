import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { LandingPage } from '@/lib/models/LandingPage';
import { Domain } from '@/lib/models/Domain';
import { generateLandingPageHtml } from '@/lib/landingPageGenerator';

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
    
    // Find the domain in our database
    console.log(`Looking up domain '${domain}' in database`);
    const domainDoc = await Domain.findOne({ name: domain });
    
    if (!domainDoc) {
      console.error(`Domain not found in database: ${domain}`);
      return new NextResponse(`Domain not found: ${domain}`, { status: 404 });
    }
    
    console.log(`Found domain in database: ${domainDoc.name} (ID: ${domainDoc._id})`);
    
    // Find the landing page
    console.log(`Looking up landing page for subdomain '${subdomain}' on domain ID ${domainDoc._id}`);
    const landingPage = await LandingPage.findOne({
      domainId: domainDoc._id,
      subdomain: subdomain,
    });
    
    if (!landingPage) {
      console.error(`Landing page not found for subdomain: ${subdomain}`);
      return new NextResponse(`Landing page not found for subdomain: ${subdomain}`, { status: 404 });
    }
    
    console.log(`Found landing page: ${landingPage.name} (ID: ${landingPage._id})`);
    
    // Generate the HTML
    console.log('Generating landing page HTML');
    const html = generateLandingPageHtml(landingPage);
    
    console.log('----------- SUBDOMAIN ROUTE HANDLER END -----------');
    
    // Return the HTML with correct content type and headers
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
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