# Domain Setup Guide

This guide will help you set up your domain to work properly with both root domain pages and landing page subdomains.

## Overview

To ensure your domain works correctly for both root domain (example.com) and subdomains (landing.example.com), you need to:

1. Register the domain in Cloudflare
2. Add the domain to your Vercel project
3. Configure DNS records in Cloudflare to point to Vercel
4. Verify the domain configuration

## Prerequisites

- A Cloudflare account with API access
- A Vercel account with API access
- Your domain registered with a domain registrar

## Step 1: Set Environment Variables

Create a `.env` file with the following variables:

```
# Cloudflare credentials
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id

# Vercel credentials
VERCEL_TOKEN=your_vercel_token
VERCEL_TEAM_ID=your_vercel_team_id (optional)
VERCEL_PROJECT_ID=your_vercel_project_id
```

## Step 2: Add Domain to Cloudflare

1. Log in to your Cloudflare account
2. Add your domain to Cloudflare
3. Update your domain's nameservers with your registrar to use Cloudflare's nameservers
4. Wait for DNS propagation (can take up to 24-48 hours)

## Step 3: Verify Domain Configuration

Run the following script to check your domain's configuration:

```bash
node scripts/verify-domain-config.js yourdomain.com
```

This will check both Cloudflare and Vercel to ensure your domain is properly configured.

## Step 4: Add Domain to Vercel

If your domain is not yet added to Vercel, run:

```bash
node scripts/add-domain-to-vercel.js yourdomain.com
```

## Step 5: Configure DNS in Cloudflare

To point your domain to Vercel, run:

```bash
node scripts/add-vercel-dns-to-cloudflare.js yourdomain.com
```

This will add the following DNS records:
- CNAME record for the root domain (@) pointing to cname.vercel-dns.com
- CNAME record for www pointing to cname.vercel-dns.com

Note: Some DNS providers don't allow CNAME records for root domains. In those cases, an A record pointing to 76.76.21.21 will be used as a fallback.

## Step 6: Create a Root Page

Once your domain is properly configured, you can create a root page in the application:

1. Go to the main dashboard
2. Select the "Domains" tab
3. Find your domain in the list
4. Click the "Generate Root Page" button

## Troubleshooting

### DNS Issues

If your domain is not resolving:

1. Check that the nameservers are correctly set to Cloudflare's nameservers
2. Verify that the DNS records are properly configured using the verification script
3. Remember that DNS changes can take up to 24-48 hours to propagate

### Vercel Issues

If your domain is not working with Vercel:

1. Ensure the domain is added to your Vercel project
2. Verify that the domain is properly verified in Vercel
3. Check that the DNS records point to Vercel's IPs/CNAMEs

## Common Error Messages

### "DNS_PROBE_STARTED"

This error indicates that the DNS resolution for your domain is failing. Possible causes:

1. Domain nameservers are not properly set to Cloudflare
2. DNS records are not properly configured
3. DNS changes haven't propagated yet

### 404 Not Found on Root Domain

If your landing pages work but the root domain shows 404:

1. Verify that you have either:
   - A CNAME record for the root domain pointing to cname.vercel-dns.com (preferred), OR
   - An A record for the root domain pointing to 76.76.21.21 (fallback)
2. Check that the domain is verified in Vercel
3. Generate a root page for the domain in the application

## Getting Help

If you continue to experience issues, check the application logs for detailed error messages and contact support with these logs. 