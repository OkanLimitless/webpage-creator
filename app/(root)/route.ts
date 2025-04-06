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
  console.log('Request headers:', Object.fromEntries(request.headers.entries()));
  console.log('Request host:', request.headers.get('host'));
  console.log('Request method:', request.method);
  console.log('Request pathname:', request.nextUrl.pathname);
  console.log('PRIMARY_DOMAIN env var:', process.env.PRIMARY_DOMAIN || 'Not set');
  
  try {
    await connectToDatabase();
    
    // Get the host from the request
    const host = request.headers.get('host') || '';
    console.log('Processing host:', host);
    
    // Extract domain (remove www. if present)
    let domain = host.replace(/^www\./i, '');
    
    // Remove port number if present (for development)
    domain = domain.split(':')[0];
    
    // Force lowercase
    domain = domain.toLowerCase();
    
    // Original code for handling domain
    console.log('Original domain after parsing:', domain);
    
    // Enhanced TLD detection
    const commonTLDs = ['com', 'net', 'org', 'io', 'app', 'dev', 'co', 'ai', 'tech', 'site', 'online'];
    const isDomainJustTLD = commonTLDs.includes(domain);
    
    // Check for TLD-only domain problem
    if (isDomainJustTLD || !domain.includes('.')) {
      console.warn(`CRITICAL: Received domain appears to be just a TLD or invalid: "${domain}"`);
      
      // Try multiple fallback strategies
      
      // 1. Check PRIMARY_DOMAIN environment variable
      const primaryDomain = process.env.PRIMARY_DOMAIN;
      if (primaryDomain) {
        console.log(`Using PRIMARY_DOMAIN env var: ${primaryDomain}`);
        domain = primaryDomain;
      } else {
        console.warn('PRIMARY_DOMAIN environment variable not set, trying other methods');
        
        // 2. Try to extract from request URL
        try {
          const urlObj = new URL(request.url);
          console.log('URL parsed from request:', urlObj.toString());
          console.log('URL hostname:', urlObj.hostname);
          
          if (urlObj.hostname && urlObj.hostname !== domain && urlObj.hostname.includes('.')) {
            console.log(`Using hostname from URL: ${urlObj.hostname}`);
            domain = urlObj.hostname;
          }
        } catch (e) {
          console.error('Error parsing URL:', e);
        }
        
        // 3. Try to extract from headers
        try {
          // Check x-forwarded-host header (commonly used by proxies)
          const forwardedHost = request.headers.get('x-forwarded-host');
          if (forwardedHost && forwardedHost.includes('.') && !commonTLDs.includes(forwardedHost)) {
            console.log(`Using x-forwarded-host header: ${forwardedHost}`);
            domain = forwardedHost;
          }
          
          // Check referer header as last resort
          const referer = request.headers.get('referer');
          if (referer && domain === 'com') {
            try {
              const refererUrl = new URL(referer);
              if (refererUrl.hostname && refererUrl.hostname.includes('.')) {
                console.log(`Using hostname from referer: ${refererUrl.hostname}`);
                domain = refererUrl.hostname;
              }
            } catch (e) {
              console.error('Error parsing referer URL:', e);
            }
          }
        } catch (e) {
          console.error('Error extracting domain from headers:', e);
        }
        
        // 4. Fallback to a hardcoded domain as last resort
        if (domain === 'com' || !domain.includes('.')) {
          const fallbackDomain = 'yourfavystore.com';
          console.warn(`Still have invalid domain "${domain}", falling back to hardcoded domain: ${fallbackDomain}`);
          domain = fallbackDomain;
        }
      }
    }
    
    // Extra check for Vercel preview URLs or localhost
    if (host.includes('vercel.app') || host.includes('localhost')) {
      console.log('Detected Vercel preview URL or localhost');
      // For preview/dev, use the PRIMARY_DOMAIN env var or fallback
      const primaryDomain = process.env.PRIMARY_DOMAIN;
      if (primaryDomain) {
        domain = primaryDomain;
        console.log(`Using primary domain for preview URL: ${domain}`);
      } else {
        console.warn('PRIMARY_DOMAIN environment variable not set, using fallback');
        domain = 'yourfavystore.com';
        console.log(`Using fallback domain: ${domain}`);
      }
    }
    
    console.log(`Final domain after all processing: ${domain}`);
    console.log(`Looking up domain '${domain}' in database`);
    
    // Validate that we have a proper domain name with at least one dot
    if (!domain.includes('.')) {
      console.error(`Invalid domain format: ${domain}`);
      return new NextResponse(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invalid Domain</title>
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
            .error-container {
              max-width: 600px;
              padding: 40px;
              background-color: white;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            h1 { color: #ef4444; margin-bottom: 10px; }
            h2 { color: #1f2937; margin-bottom: 20px; }
            p { color: #6b7280; margin-bottom: 15px; }
            pre { white-space: pre-wrap; text-align: left; background: #f5f5f5; padding: 10px; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>Invalid Domain Format</h1>
            <h2>${domain}</h2>
            <p>The domain format is invalid. A proper domain should look like "example.com".</p>
            <p>Debug info: Request received at ${new Date().toISOString()}</p>
            <pre>
Host: ${host}
Request URL: ${request.url}
            </pre>
          </div>
        </body>
        </html>
      `, { 
        status: 400,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        }
      });
    }
    
    // Find the domain in our database with case-insensitive matching and escaping special regex characters
    const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const domainDoc = await Domain.findOne({ 
      name: { $regex: new RegExp(`^${escapedDomain}$`, 'i') } 
    });
    
    if (!domainDoc) {
      console.error(`Domain not found in database: ${domain}`);
      console.log(`Checking all domains in database...`);
      const allDomains = await Domain.find({}).select('name isActive');
      console.log('Available domains:', allDomains.map(d => `${d.name} (${d.isActive ? 'active' : 'inactive'})`));
      
      return new NextResponse(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Domain Not Found</title>
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
            .error-container {
              max-width: 600px;
              padding: 40px;
              background-color: white;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            h1 { color: #ef4444; margin-bottom: 10px; }
            h2 { color: #1f2937; margin-bottom: 20px; }
            p { color: #6b7280; margin-bottom: 15px; }
            code { 
              background-color: #f3f4f6; 
              padding: 2px 4px; 
              border-radius: 4px;
              font-family: monospace;
            }
            pre { white-space: pre-wrap; text-align: left; background: #f5f5f5; padding: 10px; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>Domain Not Found</h1>
            <h2>${domain}</h2>
            <p>This domain is not registered in our system. If you believe this is an error, please check the domain name and try again.</p>
            <p>Debug info: Request received at ${new Date().toISOString()}</p>
            <pre>
Host: ${host}
Request URL: ${request.url}
            </pre>
          </div>
        </body>
        </html>
      `, {
        status: 404,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        }
      });
    }
    
    console.log(`Found domain in database: ${domainDoc.name} (ID: ${domainDoc._id})`);
    console.log(`Domain active status: ${domainDoc.isActive ? 'Active' : 'Inactive'}`);
    console.log(`Domain verification status: ${domainDoc.verificationStatus || 'Unknown'}`);
    
    // Check if the domain is active
    if (!domainDoc.isActive) {
      console.log(`Domain ${domain} is not active`);
      return new NextResponse(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Domain Inactive</title>
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
            .error-container {
              max-width: 600px;
              padding: 40px;
              background-color: white;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            h1 { color: #f59e0b; margin-bottom: 10px; }
            h2 { color: #1f2937; margin-bottom: 20px; }
            p { color: #6b7280; margin-bottom: 15px; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>Domain Inactive</h1>
            <h2>${domain}</h2>
            <p>This domain is currently inactive. Please contact the administrator for more information.</p>
          </div>
        </body>
        </html>
      `, { 
        status: 503,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        }
      });
    }
    
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
            .container {
              max-width: 600px;
              padding: 40px;
              background-color: white;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            h1 { color: #3b82f6; margin-bottom: 10px; }
            p { color: #6b7280; margin-bottom: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${domain}</h1>
            <p>Welcome to our website. We're working on adding content to make your experience better.</p>
            <p>This domain is registered and active, but no custom root page has been created yet.</p>
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
    
    // Check if the root page is active
    if (!rootPage.isActive) {
      console.log(`Root page for domain ${domain} is not active`);
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
            .container {
              max-width: 600px;
              padding: 40px;
              background-color: white;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            h1 { color: #3b82f6; margin-bottom: 10px; }
            p { color: #6b7280; margin-bottom: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${domain}</h1>
            <p>This website is currently under maintenance.</p>
            <p>Please check back later.</p>
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
    console.log(`Root page active status: ${rootPage.isActive ? 'Active' : 'Inactive'}`);
    
    // Generate the HTML for the root page
    console.log('Generating root page HTML');
    const html = generateRootPageHtml(rootPage);
    
    console.log('HTML generated successfully, content length:', html.length);
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
    console.error('Error stack:', error.stack);
    console.log('----------- ROOT DOMAIN ROUTE HANDLER ERROR END -----------');
    
    // Return a user-friendly error page
    return new NextResponse(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error</title>
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
          .error-container {
            max-width: 600px;
            padding: 40px;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          h1 { color: #ef4444; margin-bottom: 10px; }
          p { color: #6b7280; margin-bottom: 15px; }
          .error-details {
            background-color: #f3f4f6;
            padding: 15px;
            border-radius: 8px;
            text-align: left;
            font-family: monospace;
            font-size: 14px;
            overflow-x: auto;
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1>Oops! Something went wrong</h1>
          <p>We encountered an error while processing your request. Our team has been notified.</p>
          <div class="error-details">
            Error: ${error.message || 'Unknown error'}<br>
            Request Time: ${new Date().toISOString()}
          </div>
        </div>
      </body>
      </html>
    `, { 
      status: 500,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      }
    });
  }
} 