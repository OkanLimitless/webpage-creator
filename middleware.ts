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
  
  // Check if we should bypass the middleware (for API calls, etc.)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    console.log('Bypassing middleware for API call');
    return NextResponse.next();
  }
  
  // Check if this is a custom domain (not vercel.app, localhost, etc.)
  const isCustomDomain = !host.includes('vercel.app') && !host.includes('localhost');
  
  // If it's a custom domain with subdomains, let the route handler process it
  if (isCustomDomain && host.split('.').length > 2) {
    console.log('Processing custom subdomain:', host);
    // Don't do anything, just pass through to route handler
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }
  
  // For all other requests, just continue normally
  return NextResponse.next();
}

// Specify paths this middleware should run on
export const config = {
  matcher: [
    // Apply to all paths except static files, api routes and _next internal paths
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 