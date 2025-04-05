import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { RootPage } from '@/lib/models/RootPage';
import { Domain } from '@/lib/models/Domain';
import { generateRootPageHtml } from '@/lib/rootPageGenerator';

// Mark this route as dynamic to prevent static optimization issues
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Set up detailed logging for debugging
  console.log('----------- ROOT DOMAIN ROUTE HANDLER START -----------');
  console.log('Request URL:', request.url);
  console.log('Request host:', request.headers.get('host'));
  
  try {
    await connectToDatabase();
    
    // Get the host from the request
    const host = request.headers.get('host') || '';
    console.log('Processing host:', host);
    
    // Extract domain (remove www. if present)
    let domain = host.replace(/^www\./i, '');
    
    // Extra check for Vercel preview URLs (e.g., project-name.vercel.app) or localhost
    if (host.includes('vercel.app') || host.includes('localhost')) {
      console.log('Detected Vercel preview URL or localhost');
      // For preview/dev, use the PRIMARY_DOMAIN env var or fallback
      domain = process.env.PRIMARY_DOMAIN || 'yourfavystore.com';
      console.log(`Using primary domain for preview URL: ${domain}`);
    }
    
    console.log(`Looking up domain '${domain}' in database`);
    
    // Find the domain in our database
    const domainDoc = await Domain.findOne({ name: domain });
    
    if (!domainDoc) {
      console.error(`Domain not found in database: ${domain}`);
      return new NextResponse(`Domain not found: ${domain}`, { status: 404 });
    }
    
    console.log(`Found domain in database: ${domainDoc.name} (ID: ${domainDoc._id})`);
    
    // Find the root page for this domain
    console.log(`Looking up root page for domain ID ${domainDoc._id}`);
    const rootPage = await RootPage.findOne({ domainId: domainDoc._id });
    
    if (!rootPage) {
      console.log(`No custom root page found for domain: ${domain}`);
      
      // Return a simple placeholder HTML if no custom root page exists
      return new NextResponse(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${domain}</title>
          <style>
            body { 
              font-family: system-ui, sans-serif; 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              height: 100vh; 
              margin: 0;
              padding: 20px;
              text-align: center;
              background-color: #f9fafb;
            }
            h1 { color: #3b82f6; margin-bottom: 10px; }
            p { color: #6b7280; max-width: 500px; }
          </style>
        </head>
        <body>
          <div>
            <h1>${domain}</h1>
            <p>Welcome to our website. We're working on adding content to make your experience better.</p>
          </div>
        </body>
        </html>
      `, {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    
    console.log(`Found root page: ${rootPage.title} (ID: ${rootPage._id})`);
    
    // Generate the HTML for the root page
    console.log('Generating root page HTML');
    const html = generateRootPageHtml(rootPage);
    
    console.log('----------- ROOT DOMAIN ROUTE HANDLER END -----------');
    
    // Return the HTML with correct content type and headers
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    console.error('Error serving root page:', error);
    console.log('----------- ROOT DOMAIN ROUTE HANDLER ERROR END -----------');
    return new NextResponse('Internal Server Error: ' + (error.message || 'Unknown error'), { 
      status: 500,
      headers: {
        'Content-Type': 'text/html',
      }
    });
  }
} 