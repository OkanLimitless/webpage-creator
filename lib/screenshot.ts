import { takeScreenshots as takeScreenshotsMachine } from './screenshotMachine';

export interface ScreenshotResult {
  desktopUrl: string;
  mobileUrl: string;
}

/**
 * Generates a placeholder image URL with the target website embedded in the text
 */
function generatePlaceholderUrl(width: number, height: number, url: string): string {
  // Clean the URL for display (remove http/https and encode special characters)
  const cleanUrl = url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9.-]/g, '+');
  
  // Create a placeholder with the site name
  return `https://via.placeholder.com/${width}x${height}?text=Preview+of+${cleanUrl}`;
}

export async function takeScreenshots(url: string, id: string): Promise<ScreenshotResult> {
  const isVercel = process.env.VERCEL === '1';
  
  try {
    // Use placeholder images in Vercel environment to avoid storage issues
    if (isVercel) {
      console.log('Using placeholder images in Vercel environment');
      
      // Generate custom placeholders with the website URL
      const desktopPlaceholder = generatePlaceholderUrl(1366, 768, url);
      const mobilePlaceholder = generatePlaceholderUrl(375, 667, url);
      
      return {
        desktopUrl: desktopPlaceholder,
        mobileUrl: mobilePlaceholder
      };
    }
    
    // Use the normal screenshot mechanism for non-Vercel environments
    return await takeScreenshotsMachine(url, id);
  } catch (error) {
    console.error('Error in screenshot generation:', error);
    
    // Fallback to basic placeholders if any error occurs
    return {
      desktopUrl: `https://via.placeholder.com/1366x768?text=Desktop+Preview`,
      mobileUrl: `https://via.placeholder.com/375x667?text=Mobile+Preview`
    };
  }
} 