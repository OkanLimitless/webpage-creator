import { generateUniqueFilename, uploadImageToVercelBlob } from './vercelBlobStorage';
import crypto from 'crypto';

// Flag to check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
const isVercel = process.env.VERCEL === '1';

// ScreenshotMachine API key and secret
const SCREENSHOT_MACHINE_KEY = process.env.SCREENSHOT_MACHINE_KEY || 'b7bbb0'; // Fallback to provided key
const SCREENSHOT_MACHINE_SECRET = process.env.SCREENSHOT_MACHINE_SECRET || ''; // Secret for hash generation

// Default placeholder images (public URLs that always work)
const DEFAULT_DESKTOP_PLACEHOLDER = 'https://via.placeholder.com/1366x768?text=Desktop+Placeholder';
const DEFAULT_MOBILE_PLACEHOLDER = 'https://via.placeholder.com/375x667?text=Mobile+Placeholder';

/**
 * Ensures a URL is properly formatted with protocol
 */
function normalizeUrl(url: string): string {
  if (!url) return '';
  
  // Add protocol if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  
  return url;
}

/**
 * Generates a hash for the ScreenshotMachine API request
 */
function generateHash(url: string): string | undefined {
  if (!SCREENSHOT_MACHINE_SECRET) return undefined;
  
  // Generate MD5 hash of URL and secret as per API docs
  return crypto.createHash('md5').update(url + SCREENSHOT_MACHINE_SECRET).digest('hex');
}

/**
 * Generate a URL for the ScreenshotMachine API
 */
export function generateScreenshotUrl(options: {
  url: string;
  dimension?: string;
  device?: 'desktop' | 'phone' | 'tablet';
  format?: 'webp' | 'png' | 'jpg' | 'gif';
  cacheLimit?: string;
  delay?: string;
  zoom?: string;
}) {
  const {
    url: rawUrl,
    dimension = '1366x768',
    device = 'desktop',
    format = 'webp',
    cacheLimit = '0', // No cache, always fresh screenshots
    delay = '5000', // Increased delay to 5 seconds for better reliability
    zoom = '100',
  } = options;
  
  // Normalize and validate URL
  const url = normalizeUrl(rawUrl);
  if (!url) {
    throw new Error('Invalid URL provided to screenshot generator');
  }
  
  // Prepare parameters
  const params: Record<string, string> = {
    key: SCREENSHOT_MACHINE_KEY,
    url,
    dimension,
    device,
    format,
    cacheLimit,
    delay,
    zoom,
  };
  
  // Add hash parameter if secret is available
  const hash = generateHash(url);
  if (hash) {
    params.hash = hash;
  }
  
  // Add options to hide GDPR/cookie banners
  params.hide = '.cookie-banner,#cookie-banner,.gdpr-banner,#gdpr-banner,.consent-banner,#consent-banner';
  
  // For full page screenshots, set a longer delay
  if (dimension.includes('full')) {
    params.delay = '5000'; // 5 seconds for full page screenshots
  }
  
  // Add desktop-specific optimization
  if (device === 'desktop') {
    // Use click parameter to auto-dismiss common popups
    params.click = '.accept-cookies,.cookie-accept,#accept-cookies,#cookie-accept';
  }
  
  // Construct query parameters
  const searchParams = new URLSearchParams(params);
  
  const apiUrl = `https://api.screenshotmachine.com/?${searchParams.toString()}`;
  console.log(`Generated screenshot URL: ${apiUrl.substring(0, 100)}...`);
  
  return apiUrl;
}

/**
 * Take screenshots of a URL using ScreenshotMachine and store in Vercel Blob Storage
 * @param url The URL to screenshot
 * @param id Unique identifier for the screenshot files
 */
export async function takeScreenshots(url: string, id: string) {
  try {
    // Validate input
    if (!url) {
      console.error('No URL provided for screenshot');
      return {
        desktopUrl: DEFAULT_DESKTOP_PLACEHOLDER,
        mobileUrl: DEFAULT_MOBILE_PLACEHOLDER
      };
    }
    
    console.log(`Taking screenshots of URL: ${url}`);
    
    // Define filenames with webp extension
    const desktopFilename = generateUniqueFilename(`${id}_desktop`, 'webp');
    const mobileFilename = generateUniqueFilename(`${id}_mobile`, 'webp');

    // Generate desktop screenshot URL from ScreenshotMachine - using webp
    const desktopScreenshotUrl = generateScreenshotUrl({
      url,
      dimension: '1366x768',
      device: 'desktop',
      format: 'webp',
      delay: '3000', // 3 seconds
    });

    // Generate mobile screenshot URL from ScreenshotMachine - using webp
    const mobileScreenshotUrl = generateScreenshotUrl({
      url,
      dimension: '375x667',
      device: 'phone',
      format: 'webp',
      delay: '3000', // 3 seconds
    });

    // In development or if not on Vercel, just return the ScreenshotMachine URLs directly
    if (isDevelopment || !isVercel) {
      console.log('Development or non-Vercel environment, using ScreenshotMachine URLs directly');
      return {
        desktopUrl: desktopScreenshotUrl,
        mobileUrl: mobileScreenshotUrl
      };
    }
    
    console.log('Vercel environment detected, uploading screenshots to Vercel Blob Storage');
    
    // Upload desktop screenshot to Vercel Blob with longer timeout for larger images
    console.log('Fetching desktop screenshot...');
    const desktopBlobUrl = await uploadImageToVercelBlob(
      desktopScreenshotUrl, 
      desktopFilename,
      30000, // 30 second timeout for desktop
      'image/webp' // Set content type to WebP
    );
    
    // Upload mobile screenshot to Vercel Blob
    console.log('Fetching mobile screenshot...');
    const mobileBlobUrl = await uploadImageToVercelBlob(
      mobileScreenshotUrl,
      mobileFilename,
      30000, // 30 second timeout for mobile
      'image/webp' // Set content type to WebP
    );
    
    console.log('Successfully uploaded screenshots to Vercel Blob Storage');
    
    return {
      desktopUrl: desktopBlobUrl || DEFAULT_DESKTOP_PLACEHOLDER,
      mobileUrl: mobileBlobUrl || DEFAULT_MOBILE_PLACEHOLDER
    };
  } catch (error) {
    console.error('Error taking screenshots:', error);
    
    // Provide more diagnostic information in logs
    if (error instanceof Error) {
      console.error(`Screenshot error details: ${error.message}`);
      console.error(`Stack trace: ${error.stack}`);
    }
    
    // Fallback to placeholder values
    return {
      desktopUrl: DEFAULT_DESKTOP_PLACEHOLDER,
      mobileUrl: DEFAULT_MOBILE_PLACEHOLDER
    };
  }
} 