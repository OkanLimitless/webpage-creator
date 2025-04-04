import { NextRequest, NextResponse } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // Clone the request headers
  const requestHeaders = new Headers(request.headers);
  
  // Add x-url header for debugging
  requestHeaders.set('x-url', request.url);
  
  // Get the host name from the request
  const host = request.headers.get('host') || '';
  console.log('Middleware processing host:', host);
  console.log('Middleware processing URL:', request.url);
  console.log('Middleware processing path:', request.nextUrl.pathname);
  
  // Check if we should bypass the middleware (for API calls, etc.)
  if (request.nextUrl.pathname.startsWith('/api/') || 
      request.nextUrl.pathname.startsWith('/_next/') ||
      request.nextUrl.pathname.includes('favicon.ico')) {
    console.log('Bypassing middleware for API/next call');
    return NextResponse.next();
  }
  
  // Extract subdomain and domain from host
  const hostParts = host.split('.');
  
  // Check if this is a custom domain (not vercel.app, localhost, etc.)
  const isVercelDomain = host.includes('vercel.app');
  const isLocalhost = host.includes('localhost');
  const isCustomDomain = !isVercelDomain && !isLocalhost;
  
  // Handle subdomains on custom domains
  if (isCustomDomain && hostParts.length > 2) {
    const subdomain = hostParts[0];
    console.log(`Detected subdomain: ${subdomain} on custom domain`);
    
    // Only rewrite for root path requests
    if (request.nextUrl.pathname === '/') {
      console.log(`Rewriting to subdomain route handler: /[subdomain]`);
      
      // Pass through to the [subdomain] route handler with all headers
      return NextResponse.rewrite(new URL(`/${subdomain}`, request.url), {
        request: {
          headers: requestHeaders,
        },
      });
    }
  }
  // Handle subdomain params in Vercel preview URLs
  else if ((isVercelDomain || isLocalhost) && request.nextUrl.pathname.startsWith('/') && 
           request.nextUrl.pathname.length > 1 && !request.nextUrl.pathname.includes('/api/')) {
    
    // Extract potential subdomain from the first path segment
    const pathParts = request.nextUrl.pathname.split('/');
    if (pathParts.length > 1) {
      const potentialSubdomain = pathParts[1];
      console.log(`Detected potential subdomain in path: ${potentialSubdomain}`);
      
      // Check if this looks like a subdomain (no further path segments, no file extension)
      if (pathParts.length === 2 && !potentialSubdomain.includes('.')) {
        console.log(`Handling as subdomain route: ${potentialSubdomain}`);
        
        // This is already the right URL format for the [subdomain] dynamic route
        return NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });
      }
    }
  }
  
  // For all other requests, just continue normally
  return NextResponse.next();
}

// Specify paths this middleware should run on
export const config = {
  matcher: [
    // Apply to all paths except static files, api routes and _next internal paths
    '/((?!api/|_next/static|_next/image|favicon.ico).*)',
  ],
}; 