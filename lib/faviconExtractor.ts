/**
 * Utility to extract favicons from original websites
 */

// We need to install the cheerio package with: npm install cheerio
// For development only, use type any until proper types are installed
// @ts-ignore - Ignore missing cheerio module for now
import * as cheerio from 'cheerio';

/**
 * Find a favicon from a website URL
 * @param originalUrl The original URL to extract favicon from
 * @returns The favicon URL or null if not found
 */
export async function extractFavicon(originalUrl: string): Promise<string | null> {
  try {
    if (!originalUrl) return null;
    
    // Parse the URL to get the base domain
    const parsedUrl = new URL(originalUrl);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
    
    // Fetch the HTML of the original site
    console.log(`Fetching HTML from ${originalUrl} to extract favicon`);
    const response = await fetch(originalUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch ${originalUrl}: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const html = await response.text();
    
    // Parse the HTML
    // @ts-ignore - Ignore cheerio typing issues
    const $ = cheerio.load(html);
    
    // Look for favicon in different locations
    // 1. Look for link tags with rel="icon" or rel="shortcut icon"
    const iconLinks = $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"], link[rel^="icon"]');
    
    if (iconLinks.length > 0) {
      // Find the best quality favicon
      let bestIcon: string | null = null;
      let bestSize = 0;
      
      // @ts-ignore - Ignore typing issues with cheerio
      iconLinks.each((_, element: any) => {
        const href = $(element).attr('href');
        if (!href) return;
        
        // Check if sizes attribute exists
        const sizes = $(element).attr('sizes');
        if (sizes) {
          const sizeMatch = sizes.match(/(\d+)x(\d+)/);
          if (sizeMatch) {
            const size = parseInt(sizeMatch[1]);
            if (size > bestSize) {
              bestSize = size;
              bestIcon = href;
            }
          }
        } else if (!bestIcon) {
          // If no sizes, use the first one found
          bestIcon = href;
        }
      });
      
      if (bestIcon) {
        // Convert relative URL to absolute URL if needed
        if (bestIcon.startsWith('/')) {
          bestIcon = `${baseUrl}${bestIcon}`;
        } else if (!bestIcon.startsWith('http')) {
          bestIcon = `${baseUrl}/${bestIcon}`;
        }
        
        console.log(`Found favicon: ${bestIcon}`);
        return bestIcon;
      }
    }
    
    // 2. If no icon found in link tags, try the default location
    const defaultFavicon = `${baseUrl}/favicon.ico`;
    try {
      const faviconResponse = await fetch(defaultFavicon, { method: 'HEAD' });
      if (faviconResponse.ok) {
        console.log(`Found default favicon at ${defaultFavicon}`);
        return defaultFavicon;
      }
    } catch (error) {
      console.warn(`Error checking default favicon: ${error}`);
    }
    
    // 3. Could not find any favicon
    console.warn(`No favicon found for ${originalUrl}`);
    return null;
  } catch (error) {
    console.error(`Error extracting favicon: ${error}`);
    return null;
  }
} 