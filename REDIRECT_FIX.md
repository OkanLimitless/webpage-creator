# Fixing ERR_TOO_MANY_REDIRECTS Issue with Domains

This document explains how to fix the "ERR_TOO_MANY_REDIRECTS" error that can occur when setting up domains with our system.

## Root Cause

The redirect loop issue is caused by several factors:

1. **Double redirection in Next.js** - Our deployment template was using both `next.config.js` rewrites and `getServerSideProps` redirects, creating a redirection loop.

2. **Cloudflare proxy settings** - When Cloudflare proxies traffic (orange cloud), it can interfere with Vercel's SSL and redirection, creating another loop point.

3. **Missing response headers** - Without proper cache control headers, browsers can get stuck in redirect caches.

## Solution

We've made the following changes to fix this issue:

1. **Simplified the Next.js template**:
   - Removed the `getServerSideProps` redirect
   - Enhanced `next.config.js` with proper headers and conditional rewrites
   - Added client-side JavaScript redirection with a delay to prevent loops

2. **DNS configuration enforcement**:
   - Added checks to ensure Cloudflare DNS records for Vercel are set to DNS-only (gray cloud)
   - Added function to automatically fix incorrectly configured DNS records

3. **Added debugging tools**:
   - Created scripts to diagnose and fix domains with redirect issues
   - Added detailed logging throughout the deployment process

## How to Fix Existing Domains

### Option 1: Use the Fix Script

We've created a script that will automatically fix domains with redirection loop issues:

```bash
node scripts/fix-domain-redirects.js yourdomain.com
```

This script will:
1. Check and fix your Cloudflare DNS settings (ensuring DNS-only mode)
2. Redeploy the domain with our improved template that prevents redirect loops

### Option 2: Manual Fix

If you prefer to fix the issue manually:

1. **Check Cloudflare DNS settings**:
   - Log in to your Cloudflare account
   - Go to DNS settings for your domain
   - Ensure all Vercel records (pointing to `cname.vercel-dns.com` or `76.76.21.21`) have the gray cloud (DNS-only) instead of the orange cloud (proxied)

2. **Redeploy the domain**:
   - Remove the domain from your project in Vercel
   - Add it back using our system
   - The new deployment will use the improved template

## Preventing Future Issues

1. **Always use DNS-only mode with Vercel**:
   - When setting up DNS records for Vercel domains, always use DNS-only (gray cloud) mode
   - Vercel handles its own SSL, and Cloudflare proxying can interfere

2. **Use the new deployment function**:
   - We've added a new `deployDomainToVercel` function that properly sequences the steps
   - This function is recommended for all future domain deployments

## Verification

After fixing a domain, you should:

1. Clear your browser cache completely
2. Wait 5-10 minutes for all changes to propagate
3. Try accessing your domain again

If you still see the ERR_TOO_MANY_REDIRECTS error, wait a bit longer or try from a different browser or device to rule out cached redirects.

## Technical Details

### Original Issue

Our previous deployment created a Next.js app with:
1. A rewrite in `next.config.js` that redirected all requests to the main app
2. A `getServerSideProps` redirect in `pages/index.js` that also redirected to the main app

When combined with Cloudflare's proxy, this created multiple redirects that eventually resulted in a redirect loop.

### New Approach

1. We now use only one redirection method (rewrites in `next.config.js`)
2. We've added headers to control caching and prevent redirect loops
3. We've implemented a client-side redirect with a delay as a fallback
4. We enforce DNS-only mode for all Vercel DNS records

These changes ensure that redirection happens cleanly without creating loops. 