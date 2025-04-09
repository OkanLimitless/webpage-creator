import { NextRequest, NextResponse } from 'next/server';

// Enhanced list of common TLDs
const commonTLDs = ['com', 'net', 'org', 'io', 'app', 'dev', 'co', 'ai', 'tech', 'site', 'online'];

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // Set up detailed logging for debugging
  console.log('----------- MIDDLEWARE START -----------');
  
  // Get hostname from request (e.g. demo.example.com, demo.localhost:3000)
  const hostname = request.headers.get('host') || '';
  
  // Get the pathname from the URL (e.g. /api/landing-pages, /about, etc.)
  const pathname = request.nextUrl.pathname;
  
  console.log('[Middleware] Processing request:', request.url);
  console.log('[Middleware] Request hostname:', hostname);
  console.log('[Middleware] Request pathname:', pathname);
  
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
  
  // Force lowercase
  cleanHostname = cleanHostname.toLowerCase();
  
  console.log('[Middleware] Clean hostname:', cleanHostname);
  
  // Check if TLD only
  const isDomainJustTLD = commonTLDs.includes(cleanHostname);
  
  // Explicit root domain check - we give this highest priority
  const isRootDomain = !isDomainJustTLD && 
                       !cleanHostname.includes('localhost') && 
                       cleanHostname.includes('.') && 
                       cleanHostname.split('.').length <= 2;

  // Check for common issues - some setups might incorrectly split the domain
  // For example, we might end up with just "com" instead of "example.com"
  if (isDomainJustTLD || !cleanHostname.includes('.')) {
    console.warn(`[Middleware] CRITICAL: Hostname appears to be just a TLD or invalid: "${cleanHostname}"`);
    console.log('[Middleware] Headers:', Object.fromEntries(request.headers.entries()));
    
    // Try to get the domain from headers
    const xForwardedHost = request.headers.get('x-forwarded-host');
    if (xForwardedHost && xForwardedHost.includes('.') && !commonTLDs.includes(xForwardedHost.toLowerCase())) {
      console.log(`[Middleware] Found valid x-forwarded-host: ${xForwardedHost}`);
      
      // Rewrite the URL with this host
      try {
        const url = new URL(request.url);
        url.hostname = xForwardedHost.toLowerCase();
        console.log(`[Middleware] Rewriting URL with x-forwarded-host: ${url.toString()}`);
        
        console.log('----------- MIDDLEWARE END -----------');
        return NextResponse.rewrite(url);
      } catch (error) {
        console.error(`[Middleware] Error rewriting URL with x-forwarded-host:`, error);
      }
    }
    
    // If it's a TLD like "com" and we know the original request domain from other headers,
    // try to restore it
    const referer = request.headers.get('referer');
    if (isDomainJustTLD && referer) {
      try {
        const refererUrl = new URL(referer);
        if (refererUrl.hostname && refererUrl.hostname.includes('.')) {
          const refererParts = refererUrl.hostname.toLowerCase().split('.');
          // If the referer's TLD matches our TLD-only domain, it's likely the right domain
          if (refererParts[refererParts.length - 1] === cleanHostname) {
            console.log(`[Middleware] Detected full domain from referer: ${refererUrl.hostname}`);
            
            // Rewrite the URL with this hostname
            try {
              const url = new URL(request.url);
              url.hostname = refererUrl.hostname;
              console.log(`[Middleware] Rewriting URL with referer hostname: ${url.toString()}`);
              
              console.log('----------- MIDDLEWARE END -----------');
              return NextResponse.rewrite(url);
            } catch (error) {
              console.error(`[Middleware] Error rewriting URL with referer hostname:`, error);
            }
          }
        }
      } catch (error) {
        console.error(`[Middleware] Error parsing referer:`, error);
      }
    }
    
    // If no better option, pass through to the route handler which has more robust fallback logic
    console.log('----------- MIDDLEWARE END (passing to route handler for TLD) -----------');
    return NextResponse.next();
  }
  
  // Check if the hostname has www prefix and treat it as a root domain request
  const hasWwwPrefix = cleanHostname.startsWith('www.');
  if (hasWwwPrefix) {
    console.log(`[Middleware] WWW prefix detected, routing to root domain handler`);
    
    try {
      // Create an absolute URL using the current URL's origin for the rewrite
      const url = new URL(request.url);
      
      // Build the full path to the root route handler
      let rootPath = pathname;
      if (!rootPath.startsWith('/')) {
        rootPath = `/${rootPath}`;
      }
      
      const rewritePath = `/(root)${rootPath}`;
      
      console.log(`[Middleware] Rewriting www request to root handler: ${rewritePath}`);
      
      // Explicitly rewrite to the (root) group route with the full URL including origin
      const rewriteUrl = new URL(rewritePath, url.origin);
      console.log(`[Middleware] Full rewrite URL: ${rewriteUrl.toString()}`);
      
      console.log('----------- MIDDLEWARE END -----------');
      return NextResponse.rewrite(rewriteUrl);
    } catch (error) {
      console.error(`[Middleware] Error rewriting URL for www: ${error}`);
      console.log('----------- MIDDLEWARE ERROR END -----------');
      return NextResponse.next();
    }
  }
  
  // Handle explicit root domain with highest priority (non-www, no subdomain)
  if (isRootDomain) {
    console.log(`[Middleware] Explicit root domain detected: ${cleanHostname}`);
    try {
      // Create an absolute URL using the current URL's origin for the rewrite
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
      console.error(`[Middleware] Error rewriting URL for root domain: ${error}`);
      console.log('----------- MIDDLEWARE ERROR END -----------');
      return NextResponse.next();
    }
  }
  
  // Check if the hostname has a subdomain (excluding www which we already handled)
  const hasSubdomain = hasValidSubdomain(cleanHostname);
  
  // If no subdomain, explicitly route to the root domain handler
  if (!hasSubdomain) {
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
  console.log(`[Middleware] Subdomain request: ${subdomain}.${getBaseDomain(cleanHostname)}${pathname}`);
  
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

  // Check for authentication for main application (except on subdomain requests)
  // We'll check if the request is NOT for a subdomain page before requiring auth
  const isSubdomainHostname = hasValidSubdomain(hostname);
  
  // Only check auth for regular routes and admin routes
  if (!isSubdomainHostname) {
    // Check for authentication token in cookies
    const authCookie = request.cookies.get('auth_token');
    
    // If there's no auth token and this isn't the root path, redirect to root for login
    if (!authCookie && pathname !== '/') {
      console.log('[Middleware] Unauthenticated request to protected route, redirecting to login');
      console.log('----------- MIDDLEWARE END -----------');
      return NextResponse.redirect(new URL('/', request.url));
    }
  }
}

// Get the base domain without subdomain
function getBaseDomain(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    // Remove the first part (subdomain) and join the rest
    return parts.slice(1).join('.');
  }
  return hostname;
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