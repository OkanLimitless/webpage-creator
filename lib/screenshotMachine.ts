import { generateUniqueFilename, uploadImageToVercelBlob } from './vercelBlobStorage';

// Flag to check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
const isVercel = process.env.VERCEL === '1';

// ScreenshotMachine API key
const SCREENSHOT_MACHINE_KEY = process.env.SCREENSHOT_MACHINE_KEY || 'b7bbb0'; // Fallback to provided key

// Default placeholder images (public URLs that always work)
const DEFAULT_DESKTOP_PLACEHOLDER = 'https://via.placeholder.com/1366x768?text=Desktop+Placeholder';
const DEFAULT_MOBILE_PLACEHOLDER = 'https://via.placeholder.com/375x667?text=Mobile+Placeholder';

/**
 * Generate a URL for the ScreenshotMachine API
 */
export function generateScreenshotUrl(options: {
  url: string;
  dimension?: string;
  device?: 'desktop' | 'phone' | 'tablet';
  format?: 'png' | 'jpg' | 'gif';
  cacheLimit?: string;
  delay?: string;
  zoom?: string;
}) {
  const {
    url,
    dimension = '1366x768',
    device = 'desktop',
    format = 'png',
    cacheLimit = '0', // No cache, always fresh screenshots
    delay = '2000', // 2 seconds delay for loading resources
    zoom = '100',
  } = options;

  // Construct query parameters
  const params = new URLSearchParams({
    key: SCREENSHOT_MACHINE_KEY,
    url,
    dimension,
    device,
    format,
    cacheLimit,
    delay,
    zoom,
  });

  return `https://api.screenshotmachine.com/?${params.toString()}`;
}

/**
 * Take screenshots of a URL using ScreenshotMachine and store in Vercel Blob Storage
 */
export async function takeScreenshots(url: string, id: string) {
  try {
    // Define filenames
    const desktopFilename = generateUniqueFilename(`${id}_desktop`);
    const mobileFilename = generateUniqueFilename(`${id}_mobile`);

    // Generate desktop screenshot URL from ScreenshotMachine
    const desktopScreenshotUrl = generateScreenshotUrl({
      url,
      dimension: '1366x768',
      device: 'desktop',
      format: 'png',
    });

    // Generate mobile screenshot URL from ScreenshotMachine
    const mobileScreenshotUrl = generateScreenshotUrl({
      url,
      dimension: '375x667',
      device: 'phone',
      format: 'png',
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
    
    // Upload desktop screenshot to Vercel Blob
    const desktopBlobUrl = await uploadImageToVercelBlob(
      desktopScreenshotUrl, 
      desktopFilename
    );
    
    // Upload mobile screenshot to Vercel Blob
    const mobileBlobUrl = await uploadImageToVercelBlob(
      mobileScreenshotUrl,
      mobileFilename
    );
    
    console.log('Successfully uploaded screenshots to Vercel Blob Storage');
    
    return {
      desktopUrl: desktopBlobUrl,
      mobileUrl: mobileBlobUrl
    };
  } catch (error) {
    console.error('Error taking screenshots:', error);
    
    // Fallback to placeholder values
    return {
      desktopUrl: DEFAULT_DESKTOP_PLACEHOLDER,
      mobileUrl: DEFAULT_MOBILE_PLACEHOLDER
    };
  }
} 