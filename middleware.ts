import { NextRequest, NextResponse } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // Get hostname from request (e.g. demo.example.com, demo.localhost:3000)
  const hostname = request.headers.get('host') || '';
  
  // Get the pathname from the URL (e.g. /api/landing-pages, /about, etc.)
  const pathname = request.nextUrl.pathname;
  
  // If it's a request to the public assets or API, skip routing middleware
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/vercel') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Check if the hostname has a subdomain
  const hasSubdomain = hasValidSubdomain(hostname);
  
  // If no subdomain or www, let the root domain handler take care of it
  if (!hasSubdomain || hostname.startsWith('www.')) {
    // Root domain request - pass to root page handler
    console.log(`[Middleware] Root domain request: ${hostname}${pathname}`);
    return NextResponse.next();
  }
  
  // For requests with a subdomain (e.g., landing.example.com), rewrite to subdomain route
  const subdomain = getSubdomain(hostname);
  console.log(`[Middleware] Subdomain request: ${subdomain}.${hostname}${pathname}`);
  
  // Rewrite the URL to include the subdomain in the path
  return NextResponse.rewrite(new URL(`/${subdomain}${pathname}`, request.url));
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
  
  // Extract the first part
  return hostname.split('.')[0];
}

// Specify paths this middleware should run on
export const config = {
  matcher: [
    // Apply to all paths except static files, api routes and _next internal paths
    '/((?!api/|_next/static|_next/image|favicon.ico).*)',
  ],
}; 