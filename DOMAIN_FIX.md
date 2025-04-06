# Fixing "Domain not found: com" Error

If you're seeing the "Domain not found: com" error when accessing your deployed domain, follow these steps to fix it:

## Root Cause

This error occurs when your application receives only the TLD (Top-Level Domain) portion of your domain (like "com" instead of "yourfavystore.com"). This is often caused by one of the following:

1. DNS configuration issues
2. Cloudflare SSL/TLS settings (if using Cloudflare)
3. Vercel domain configuration problems
4. Proxy or forwarding configuration issues

## Solution: Set the PRIMARY_DOMAIN Environment Variable

The quickest fix is to set a `PRIMARY_DOMAIN` environment variable that the application can use as a fallback when it only receives a TLD:

### Option 1: Use the Admin Panel (Recommended)

1. Log in to your admin panel at `https://yourfavystore.com/admin/diagnostics`
2. Under "Domain Diagnostics", find the "Domain Fixer" section
3. Select your primary domain from the dropdown
4. Click "Set as PRIMARY_DOMAIN"
5. After setting the environment variable, you MUST redeploy your application for the changes to take effect

### Option 2: Run the Helper Script

If you can't access the admin panel, you can run the included helper script:

1. Ensure your `.env` file contains your Vercel API credentials:
   ```
   VERCEL_TOKEN=your_vercel_token
   VERCEL_TEAM_ID=your_team_id (if applicable)
   VERCEL_PROJECT_ID=your_project_id
   ```

2. Update the `PRIMARY_DOMAIN` value in the script to your primary domain:
   ```js
   // In scripts/set-primary-domain-fix.js
   const PRIMARY_DOMAIN = 'yourfavystore.com'; // Change this to your actual domain
   ```

3. Run the script:
   ```bash
   node scripts/set-primary-domain-fix.js
   ```

4. After the script completes successfully, redeploy your application

### Option 3: Set Environment Variable Manually in Vercel Dashboard

1. Log in to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to "Settings" > "Environment Variables"
4. Add a new variable with:
   - Name: `PRIMARY_DOMAIN`
   - Value: Your primary domain (e.g., `yourfavystore.com`)
   - Environment: Select all environments (Production, Preview, Development)
5. Click "Save"
6. Redeploy your application

## Verify the Fix

After redeploying, visit your domain again. The "Domain not found: com" error should be resolved, and your website should load correctly.

## Long-term Solution

While setting the `PRIMARY_DOMAIN` environment variable is a good immediate fix, you should also investigate and fix the root cause:

1. Check your DNS configuration to ensure it's correctly set up
2. If using Cloudflare, review your SSL/TLS settings (Full or Full (Strict) is recommended)
3. Verify your domain forwarding/proxy settings
4. Ensure your Vercel domain configuration is correct

By addressing the root cause, you can ensure reliable domain resolution without relying solely on the fallback mechanism. 