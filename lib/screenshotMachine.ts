import fs from 'fs';
import path from 'path';
import https from 'https';

// ScreenshotMachine API key
const SCREENSHOT_MACHINE_KEY = process.env.SCREENSHOT_MACHINE_KEY || 'b7bbb0'; // Fallback to provided key

// Directory to store screenshots
const screenshotsDir = path.join(process.cwd(), 'public', 'screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

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
 * Download an image from a URL and save it to the screenshots directory
 */
export function downloadImage(url: string, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const filepath = path.join(screenshotsDir, filename);
    const file = fs.createWriteStream(filepath);

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve(`/screenshots/${filename}`);
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {}); // Delete the file if download failed
      reject(err);
    });
  });
}

/**
 * Take screenshots of a URL using ScreenshotMachine
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
    const desktopFilename = `${id}_desktop.png`;
    const mobileFilename = `${id}_mobile.png`;

    // Download both screenshots
    const [desktopScreenshotUrl, mobileScreenshotUrl] = await Promise.all([
      downloadImage(desktopUrl, desktopFilename),
      downloadImage(mobileUrl, mobileFilename),
    ]);

    return {
      desktopPath: path.join(screenshotsDir, desktopFilename),
      mobilePath: path.join(screenshotsDir, mobileFilename),
      desktopUrl: desktopScreenshotUrl,
      mobileUrl: mobileScreenshotUrl,
    };
  } catch (error) {
    console.error('Error taking screenshots:', error);
    throw error;
  }
} 