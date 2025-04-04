import { Storage } from '@google-cloud/storage';
import crypto from 'crypto';
import https from 'https';

// Flag to check environment
const isVercel = process.env.VERCEL === '1';

// Initialize Google Cloud Storage
let storage: Storage;

// For Vercel, use credentials from environment variable
if (isVercel) {
  try {
    const credentials = JSON.parse(
      Buffer.from(process.env.GCP_SERVICE_ACCOUNT_KEY || '', 'base64').toString()
    );
    
    storage = new Storage({
      projectId: credentials.project_id,
      credentials,
    });
  } catch (error) {
    console.error('Error initializing Google Cloud Storage:', error);
    // Initialize with empty config as fallback
    storage = new Storage();
  }
} else {
  // For local development, use credentials file or ADC
  storage = new Storage();
}

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'webpage-creator-screenshots';

// Simpler function to fetch image data as a buffer
function fetchImageBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to fetch image: ${response.statusCode}`));
        return;
      }
      
      const contentType = response.headers['content-type'] || 'image/png';
      const chunks: Buffer[] = [];
      
      response.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ buffer, contentType });
      });
      
      response.on('error', (err) => {
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Alternative implementation using a direct HTTP upload approach
export async function uploadImageFromUrl(
  url: string, 
  filename: string
): Promise<string> {
  const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/screenshots/${filename}`;
  
  try {
    console.log(`Fetching image from: ${url}`);
    
    // Use our simple fetch function instead of the global fetch
    const { buffer, contentType } = await fetchImageBuffer(url);
    
    console.log(`Successfully fetched image (${buffer.length} bytes), uploading to GCS...`);
    
    // Use simple file upload without streaming
    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(`screenshots/${filename}`);
    
    // Use the simpler upload method to avoid AbortSignal issues
    await new Promise<void>((resolve, reject) => {
      file.createWriteStream({
        metadata: {
          contentType: contentType,
          predefinedAcl: 'publicRead'
        }
      })
      .on('error', (err) => {
        console.error('Error in upload stream:', err);
        reject(err);
      })
      .on('finish', () => {
        console.log('Upload successful');
        resolve();
      })
      .end(buffer);
    });
    
    console.log(`Upload complete, public URL: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('Error uploading image to GCS:', error);
    
    // Return a mock URL in case of error
    if (process.env.NODE_ENV === 'development' || isVercel) {
      console.warn('Returning mock URL due to upload failure');
      return publicUrl;
    }
    
    throw error;
  }
}

// Generate a unique filename
export function generateUniqueFilename(prefix: string, extension: string = 'png'): string {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  return `${prefix}_${timestamp}_${randomString}.${extension}`;
} 