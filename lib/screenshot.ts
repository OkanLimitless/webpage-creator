import { takeScreenshots as takeScreenshotsMachine } from './screenshotMachine';

export interface ScreenshotResult {
  desktopUrl: string;
  mobileUrl: string;
}

/**
 * Generates a placeholder image URL with the target website embedded in the text
 * Used as a fallback in case screenshot generation fails
 */
function generatePlaceholderUrl(width: number, height: number, url: string): string {
  // Clean the URL for display (remove http/https and encode special characters)
  const cleanUrl = url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9.-]/g, '+');
  
  // Create a placeholder with the site name
  return `https://via.placeholder.com/${width}x${height}?text=Preview+of+${cleanUrl}`;
}

export async function takeScreenshots(url: string, id: string): Promise<ScreenshotResult> {
  try {
    // Use the screenshot machine which now handles Vercel Blob Storage
    return await takeScreenshotsMachine(url, id);
  } catch (error) {
    console.error('Error in screenshot generation:', error);
    
    // Fallback to basic placeholders if any error occurs
    return {
      desktopUrl: generatePlaceholderUrl(1366, 768, url),
      mobileUrl: generatePlaceholderUrl(375, 667, url)
    };
  }
} 