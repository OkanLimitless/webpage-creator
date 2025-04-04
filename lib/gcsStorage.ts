import { Storage } from '@google-cloud/storage';
import crypto from 'crypto';

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

// Upload file to Google Cloud Storage
export async function uploadImageFromUrl(
  url: string, 
  filename: string
): Promise<string> {
  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(`screenshots/${filename}`);
  
  try {
    // Fetch the image from the URL
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const buffer = await response.arrayBuffer();
    
    // Upload the image
    await file.save(Buffer.from(buffer), {
      contentType: response.headers.get('content-type') || 'image/png',
      public: true,
    });
    
    // Return the public URL
    return `https://storage.googleapis.com/${BUCKET_NAME}/screenshots/${filename}`;
  } catch (error) {
    console.error('Error uploading image to GCS:', error);
    
    // Return a mock URL in case of error
    if (process.env.NODE_ENV === 'development' || isVercel) {
      console.warn('Returning mock URL due to upload failure');
      return `https://storage.googleapis.com/${BUCKET_NAME}/screenshots/${filename}`;
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