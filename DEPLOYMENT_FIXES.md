# Domain Deployment Fixes

This document provides an overview of the changes we've made to fix issues with domain deployments, particularly the "ERR_TOO_MANY_REDIRECTS" error that was occurring with custom domains.

## Recent Fixes

We've implemented several fixes to address the redirect loop issues:

1. **Fixed the Next.js deployment template**:
   - Removed problematic `has` conditions in rewrites that caused build errors
   - Implemented a simple, reliable client-side redirect using React's `useEffect` hook
   - Added appropriate cache control headers to prevent redirection caching
   - Eliminated the server-side redirect that was contributing to redirection loops

2. **Ensured Cloudflare DNS compatibility**:
   - Created a tool to automatically check and fix DNS proxy settings 
   - Forced DNS-only (gray cloud) configuration for all Vercel DNS records
   - Added checks to prevent proxy mode which conflicts with Vercel SSL

3. **Improved error handling and logging**:
   - Enhanced deployment scripts with better error handling
   - Added extensive logging throughout the process
   - Created more robust timeouts and retries

4. **Added automatic root page creation**:
   - Domains now automatically get a root page when deployed
   - No more redirection to the main site - each domain now has its own landing page
   - Root pages are generated with a default template that includes:
     - Services/features section
     - Testimonials
     - Contact information

## How to Fix Domains with Redirect Issues

### Option 1: Use Our Fix Script (Recommended)

The easiest way to fix a domain experiencing the ERR_TOO_MANY_REDIRECTS error is to use our fix script:

```bash
node scripts/fix-domain-redirects.js your-domain.com
```

This script will:
1. Check your Cloudflare DNS settings and ensure they're set to DNS-only mode
2. Create or update the Vercel project for your domain
3. Deploy our fixed template that prevents redirect loops
4. Wait for the deployment to be ready (or warn you if it's taking longer than expected)
5. Automatically create a root page for the domain if one doesn't exist yet

### Option 2: Manual Fix

If you prefer to fix the domain manually:

1. Check your Cloudflare DNS settings:
   - Log in to your Cloudflare account
   - Go to the DNS settings for your domain
   - Ensure all Vercel DNS records (CNAME or A records pointing to Vercel) have the gray cloud (DNS-only)

2. Redeploy the domain:
   - Use our deployDomainToVercel function from lib/vercel.ts
   - OR remove the domain from Vercel and add it back using our system

3. Create a root page (if needed):
   - Go to the Domains management interface
   - Click "Generate Root Page" button for your domain

## Managing Root Pages

Each domain now automatically gets its own root page when deployed, but you can still customize it:

1. Go to the Admin Dashboard
2. Navigate to Domains
3. Find your domain in the list
4. Click "Manage" to access domain settings
5. Select the "Root Page" tab to edit content

## Verifying the Fix

After applying the fix, you should:

1. Wait 5-10 minutes for DNS and deployment changes to propagate
2. Clear your browser cache completely (or try a different browser/incognito mode)
3. Visit your domain

You should now see a proper landing page instead of a redirect message.

If you still see redirect errors:
- Try waiting longer (DNS changes can take up to 24-48 hours to fully propagate)
- Check if your browser has cached the redirects
- Verify that the DNS settings in Cloudflare show the gray cloud (DNS-only), not orange (proxied)

## Technical Details

### Why This Fix Works

The fix addresses three key issues that were causing the redirect loop:

1. **Multiple Redirects**: Our previous deployment was using both rewrites in next.config.js AND redirects in getServerSideProps, creating multiple redirects that could loop infinitely.

2. **Cloudflare Proxy Conflicts**: When Cloudflare proxies traffic (orange cloud), it handles SSL and can interfere with Vercel's own SSL and redirect handling.

3. **Missing Cache Headers**: Without proper cache headers, browsers would cache redirects and get stuck in redirect loops.

The new deployment template provides a single, clean redirection method with appropriate cache headers, and ensures that Cloudflare's proxy is disabled for Vercel DNS records.

Additionally, we now automatically create a root page for every domain, eliminating the need for redirects entirely.

## Further Assistance

If you continue to experience issues with a specific domain after using our fix script, please provide:

1. The domain name
2. The output of the fix script
3. Screenshots of the Cloudflare DNS settings
4. Any error messages you're seeing in the browser

We can then provide more targeted assistance for your specific issue. 