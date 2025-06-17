# Webpage Creator

A self-hosted system for managing domains and creating landing pages with cookie consent overlays, inspired by the Filtriapps system.

## Recent Updates

### Traffic Logs System Optimization (2025-06-17)
- **Fixed 1k Limit Issue**: Replaced inefficient key fetching with cursor-based pagination
- **Performance**: Now shows most recent 300 logs instead of attempting to load all 30k+
- **Auto-Refresh**: Updates every 30 seconds automatically when viewing traffic logs  
- **Bulk Operations**: Uses Cloudflare KV bulk GET operations for faster loading
- **Enhanced UX**: Added manual refresh button, last update timestamp, and status indicators
- **Scalability**: System now efficiently handles large traffic datasets without timeouts

## Features

- Domain management with Cloudflare integration
- Landing page creation with customizable cookie consent overlays
- Affiliate link management
- Automatic subdomain creation
- Background screenshot capture of original landing pages using ScreenshotMachine
- Advanced cloaking system with bot detection
- Traffic logging and analytics
- Phone number management for call ads

## Tech Stack

- Next.js (App Router)
- MongoDB for data storage
- Cloudflare API for DNS management
- Vercel for deployment
- ScreenshotMachine for webpage screenshots
- TypeScript

## Setup and Deployment

This project is designed to be deployed on Vercel with MongoDB Atlas integration.

1. Clone the repository
2. Install dependencies with `npm install`
3. Set up environment variables
4. Deploy to Vercel

## Environment Variables

The following environment variables need to be set up in your Vercel project:

- `MONGODB_URI`: Your MongoDB connection string
- `CLOUDFLARE_API_TOKEN`: API token for Cloudflare
- `CLOUDFLARE_ZONE_ID`: Zone ID for your Cloudflare account
- `CLOUDFLARE_EMAIL`: Email associated with your Cloudflare account
- `SCREENSHOT_MACHINE_KEY`: Your ScreenshotMachine API key (optional, default is provided) 