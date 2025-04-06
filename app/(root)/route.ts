import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { RootPage } from '@/lib/models/RootPage';
import { Domain } from '@/lib/models/Domain';
import { generateRootPageHtml } from '@/lib/rootPageGenerator';

// Mark this route as dynamic to prevent static optimization issues
export const dynamic = 'force-dynamic';

// Common TLDs
const commonTLDs = ['com', 'net', 'org', 'io', 'app', 'dev', 'co', 'ai', 'tech', 'site', 'online'];

export async function GET(request: NextRequest) {
  // Set up detailed logging for debugging
  console.log('----------- ROOT DOMAIN ROUTE HANDLER START -----------');
  console.log('Request URL:', request.url);
  console.log('Request headers:', Object.fromEntries(request.headers.entries()));
  console.log('Request host:', request.headers.get('host'));
  console.log('Request method:', request.method);
  console.log('Request pathname:', request.nextUrl.pathname);
  
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
    
    console.log('Original domain after parsing:', domain);
    console.log('Host had www prefix:', host.toLowerCase().startsWith('www.'));
    
    // Check if we have a TLD-only domain issue
    const isDomainJustTLD = commonTLDs.includes(domain);
    const invalidDomainFormat = !domain.includes('.');
    
    // Handle Vercel preview and local development
    if (host.includes('vercel.app') || host.includes('localhost')) {
      console.log('Detected Vercel preview URL or localhost');
      
      // For these cases, we'll try to find an active domain in the database
      const activeDomains = await Domain.find({ isActive: true }).sort({ createdAt: -1 }).limit(1);
      
      if (activeDomains.length > 0) {
        domain = activeDomains[0].name;
        console.log(`Using most recently created active domain: ${domain}`);
      } else {
        // Fallback to a default domain
        domain = 'example.com';
        console.log(`No active domains found, using default: ${domain}`);
      }
    }
    // Handle TLD-only issue
    else if (isDomainJustTLD || invalidDomainFormat) {
      console.warn(`CRITICAL: Received domain appears to be just a TLD or invalid: "${domain}"`);
      
      // First try using x-forwarded-host header
      const forwardedHost = request.headers.get('x-forwarded-host');
      if (forwardedHost && forwardedHost.includes('.') && !commonTLDs.includes(forwardedHost.toLowerCase())) {
        console.log(`Using x-forwarded-host header: ${forwardedHost}`);
        domain = forwardedHost.toLowerCase().replace(/^www\./i, ''); // Remove www. here too
      } 
      else {
        // If TLD-only, try to find an active domain in the database that ends with this TLD
        if (isDomainJustTLD) {
          console.log(`Looking for domains with TLD: ${domain}`);
          const domainsWithTLD = await Domain.find({ 
            name: { $regex: new RegExp(`\\.${domain}$`, 'i') },
            isActive: true 
          }).sort({ createdAt: -1 });
          
          if (domainsWithTLD.length > 0) {
            domain = domainsWithTLD[0].name;
            console.log(`Using domain with matching TLD: ${domain}`);
          } else {
            // Try to find any active domain as fallback
            const fallbackDomains = await Domain.find({ isActive: true }).sort({ createdAt: -1 }).limit(1);
            
            if (fallbackDomains.length > 0) {
              domain = fallbackDomains[0].name;
              console.log(`Using fallback domain: ${domain}`);
            } else {
              console.error('No active domains found in database for fallback');
            }
          }
        }
      }
    }
    
    console.log(`Final domain after all processing: ${domain}`);
    
    // Validate that we have a proper domain name with at least one dot
    if (!domain.includes('.')) {
      console.error(`Invalid domain format: ${domain}`);
      
      // If we can't determine the domain, show an error page with all available domains
      const allDomains = await Domain.find({ isActive: true }).select('name');
      const availableDomains = allDomains.map(d => d.name).join(', ');
      
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
            <p>The domain format is invalid. Please try accessing one of our websites directly:</p>
            <p>${availableDomains || 'No active domains available'}</p>
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
    let domainDoc = await Domain.findOne({ 
      name: { $regex: new RegExp(`^${escapedDomain}$`, 'i') } 
    });
    
    // If domain not found, try to find a fallback domain
    if (!domainDoc) {
      console.error(`Domain not found in database: ${domain}`);
      
      // Try to find any active domain as fallback
      const fallbackDomains = await Domain.find({ isActive: true }).sort({ createdAt: -1 }).limit(1);
      
      if (fallbackDomains.length > 0) {
        domainDoc = fallbackDomains[0];
        console.log(`Using fallback domain: ${domainDoc.name}`);
      } else {
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
    }
    
    console.log(`Found domain in database: ${domainDoc.name} (ID: ${domainDoc._id})`);
    console.log(`Domain active status: ${domainDoc.isActive ? 'Active' : 'Inactive'}`);
    console.log(`Domain verification status: ${domainDoc.verificationStatus || 'Unknown'}`);
    
    // Check if the domain is active
    if (!domainDoc.isActive) {
      console.log(`Domain ${domainDoc.name} is not active`);
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
            <h2>${domainDoc.name}</h2>
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
      console.log(`No custom root page found for domain: ${domainDoc.name}`);
      
      // Return a simple placeholder HTML if no custom root page exists
      return new NextResponse(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${domainDoc.name}</title>
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
            <h1>${domainDoc.name}</h1>
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
      console.log(`Root page for domain ${domainDoc.name} is not active`);
      return new NextResponse(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${domainDoc.name}</title>
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
            <h1>${domainDoc.name}</h1>
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
    
    // Handle www to non-www redirection if needed
    const hasWwwPrefix = host.toLowerCase().startsWith('www.');
    const shouldRedirect = hasWwwPrefix && rootPage.redirectWwwToNonWww;
    
    if (shouldRedirect) {
      // Get the current URL and update it without the www prefix
      try {
        const url = new URL(request.url);
        url.hostname = domain; // domain is already without www
        
        console.log(`Redirecting from www to non-www: ${url.toString()}`);
        
        return NextResponse.redirect(url.toString(), {
          status: 301, // Permanent redirect for SEO
          headers: {
            'Cache-Control': 'max-age=3600',
          }
        });
      } catch (error) {
        console.error('Error creating redirect URL:', error);
        // Continue with normal page serving if redirect fails
      }
    }
    
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