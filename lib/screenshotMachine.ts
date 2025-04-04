import { generateUniqueFilename, uploadImageFromUrl } from './gcsStorage';

// Flag to check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';
const isVercel = process.env.VERCEL === '1';

// ScreenshotMachine API key
const SCREENSHOT_MACHINE_KEY = process.env.SCREENSHOT_MACHINE_KEY || 'b7bbb0'; // Fallback to provided key

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
 * Take screenshots of a URL using ScreenshotMachine and store in Google Cloud Storage
 */
export async function takeScreenshots(url: string, id: string) {
  try {
    // Generate desktop screenshot URL
    const desktopUrl = generateScreenshotUrl({
      url,
      dimension: '1366x768',
      device: 'desktop',
      format: 'png',
    });

    // Generate mobile screenshot URL
    const mobileUrl = generateScreenshotUrl({
      url,
      dimension: '375x667',
      device: 'phone',
      format: 'png',
    });

    // Define filenames
    const desktopFilename = generateUniqueFilename(`${id}_desktop`);
    const mobileFilename = generateUniqueFilename(`${id}_mobile`);

    try {
      // Upload both screenshots to Google Cloud Storage
      const [desktopScreenshotUrl, mobileScreenshotUrl] = await Promise.all([
        uploadImageFromUrl(desktopUrl, desktopFilename),
        uploadImageFromUrl(mobileUrl, mobileFilename),
      ]);

      return {
        desktopUrl: desktopScreenshotUrl,
        mobileUrl: mobileScreenshotUrl,
      };
    } catch (error) {
      // In development or Vercel, fallback to placeholder URLs
      console.warn('Failed to upload screenshots, using placeholder URLs:', error);
      const bucketName = process.env.GCS_BUCKET_NAME || 'webpage-creator-screenshots';
      return {
        desktopUrl: `https://storage.googleapis.com/${bucketName}/screenshots/${desktopFilename}`,
        mobileUrl: `https://storage.googleapis.com/${bucketName}/screenshots/${mobileFilename}`,
      };
    }
  } catch (error) {
    console.error('Error taking screenshots:', error);
    
    // In development or Vercel, fallback to placeholder values
    const desktopFilename = generateUniqueFilename(`${id}_desktop`);
    const mobileFilename = generateUniqueFilename(`${id}_mobile`);
    const bucketName = process.env.GCS_BUCKET_NAME || 'webpage-creator-screenshots';

    return {
      desktopUrl: `https://storage.googleapis.com/${bucketName}/screenshots/${desktopFilename}`,
      mobileUrl: `https://storage.googleapis.com/${bucketName}/screenshots/${mobileFilename}`,
    };
  }
} 