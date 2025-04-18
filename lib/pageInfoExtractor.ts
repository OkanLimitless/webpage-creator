import fetch from 'node-fetch';

/**
 * Extracts the title from a webpage
 * @param url The URL to fetch the title from
 * @returns The title of the webpage or null if it couldn't be extracted
 */
export async function extractPageTitle(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const html = await response.text();
    
    // Extract title from HTML using regex
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim();
    }
    
    return null;
  } catch (error) {
    console.error(`Error extracting page title from ${url}:`, error);
    return null;
  }
} 