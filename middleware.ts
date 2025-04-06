import { NextRequest, NextResponse } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // Set up detailed logging for debugging
  console.log('----------- MIDDLEWARE START -----------');
  
  // Get hostname from request (e.g. demo.example.com, demo.localhost:3000)
  const hostname = request.headers.get('host') || '';
  
  // Get the pathname from the URL (e.g. /api/landing-pages, /about, etc.)
  const pathname = request.nextUrl.pathname;
  
  console.log(`[Middleware] Processing request: ${hostname}${pathname}`);
  console.log('[Middleware] Full URL:', request.url);
  
  // If it's a request to the public assets or API, skip routing middleware
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/vercel') ||
    pathname.startsWith('/favicon')
  ) {
    console.log('[Middleware] Skipping middleware for asset/API path');
    console.log('----------- MIDDLEWARE END -----------');
    return NextResponse.next();
  }

  // For Vercel preview URLs, just pass through (handled in route handlers)
  if (hostname.includes('vercel.app')) {
    console.log('[Middleware] Vercel preview URL detected, passing through');
    console.log('----------- MIDDLEWARE END -----------');
    return NextResponse.next();
  }

  // Fix for localhost with port
  let cleanHostname = hostname;
  if (hostname.includes(':')) {
    cleanHostname = hostname.split(':')[0];
  }
  
  // Check if the hostname has a subdomain
  const hasSubdomain = hasValidSubdomain(cleanHostname);
  
  // If no subdomain or www, explicitly route to the root domain handler
  if (!hasSubdomain || cleanHostname.startsWith('www.')) {
    // Root domain request - explicitly rewrite to (root) route handler
    console.log(`[Middleware] Root domain request: ${cleanHostname}${pathname}`);
    
    try {
      // Create an absolute URL using the current URL's origin for the rewrite
      // This ensures we maintain the correct protocol and domain when rewriting
      const url = new URL(request.url);
      
      // Build the full path to the root route handler
      let rootPath = pathname;
      if (!rootPath.startsWith('/')) {
        rootPath = `/${rootPath}`;
      }
      
      const rewritePath = `/(root)${rootPath}`;
      
      console.log(`[Middleware] Rewriting root domain request to: ${rewritePath}`);
      
      // Explicitly rewrite to the (root) group route with the full URL including origin
      const rewriteUrl = new URL(rewritePath, url.origin);
      console.log(`[Middleware] Full rewrite URL: ${rewriteUrl.toString()}`);
      
      console.log('----------- MIDDLEWARE END -----------');
      return NextResponse.rewrite(rewriteUrl);
    } catch (error) {
      console.error(`[Middleware] Error rewriting URL: ${error}`);
      console.log('----------- MIDDLEWARE ERROR END -----------');
      return NextResponse.next();
    }
  }
  
  // For requests with a subdomain (e.g., landing.example.com), rewrite to subdomain route
  const subdomain = getSubdomain(cleanHostname);
  console.log(`[Middleware] Subdomain request: ${subdomain}.${cleanHostname}${pathname}`);
  
  try {
    // Rewrite the URL to include the subdomain in the path
    const rewriteUrl = new URL(`/${subdomain}${pathname}`, request.url);
    console.log(`[Middleware] Rewriting to: ${rewriteUrl.toString()}`);
    console.log('----------- MIDDLEWARE END -----------');
    return NextResponse.rewrite(rewriteUrl);
  } catch (error) {
    console.error(`[Middleware] Error rewriting URL: ${error}`);
    console.log('----------- MIDDLEWARE ERROR END -----------');
    return NextResponse.next();
  }
}

// Function to check if a hostname has a valid subdomain
function hasValidSubdomain(hostname: string): boolean {
  // Skip for localhost (direct development without subdomains)
  if (hostname.includes('localhost')) return false;
  
  // Skip for IP addresses
  if (/^(\d{1,3}\.){3}\d{1,3}/.test(hostname)) return false;
  
  // For Vercel preview URLs, we don't have a real subdomain structure
  if (hostname.endsWith('vercel.app')) return false;
  
  // Extract parts
  const parts = hostname.split('.');
  
  // Check for direct localhost access with port, e.g., localhost:3000
  if (parts[0] === 'localhost') return false;
  
  // If hostname is just 'example.com' or 'www.example.com', there's no subdomain
  // Check length to ensure we have at least example.com (2 parts)
  if (parts.length < 3) return false;
  
  // Check if it's www (not a real subdomain for our routing purposes)
  if (parts[0] === 'www') return false;
  
  // Validate if it's a known subdomain type
  const validPrefixes = ['landing', 'app', 'dashboard', 'admin'];
  return validPrefixes.includes(parts[0]);
}

// Function to extract the subdomain from a hostname
function getSubdomain(hostname: string): string {
  // Skip for non-production environments
  if (hostname.includes('localhost')) return '';
  if (hostname.endsWith('vercel.app')) return '';
  
  // Extract the subdomain part (first segment of the hostname)
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0];
  }
  
  return '';
}

// Specify paths this middleware should run on
export const config = {
  matcher: [
    // Apply to all paths except static files, api routes and _next internal paths
    '/((?!api/|_next/static|_next/image|favicon.ico).*)',
  ],
}; 