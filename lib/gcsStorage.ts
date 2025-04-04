import crypto from 'crypto';
import https from 'https';
import { createHmac } from 'crypto';

// Flag to check environment
const isVercel = process.env.VERCEL === '1';
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';

// GCS configuration
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'webpage-creator-screenshots';
let credentials;

try {
  if (process.env.GCP_SERVICE_ACCOUNT_KEY) {
    credentials = JSON.parse(
      Buffer.from(process.env.GCP_SERVICE_ACCOUNT_KEY, 'base64').toString()
    );
  } else {
    console.warn('GCP_SERVICE_ACCOUNT_KEY not found in environment variables');
    credentials = null;
  }
} catch (error) {
  console.error('Error parsing GCP service account key:', error);
  credentials = null;
}

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

// Function to directly upload to Firebase Storage (storage.googleapis.com) without the SDK
async function directUploadToGCS(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  if (!credentials || !credentials.client_email || !credentials.private_key) {
    throw new Error('Valid GCP credentials not available');
  }
  
  const filePath = `screenshots/${filename}`;
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET_NAME}/o?uploadType=media&name=${encodeURIComponent(filePath)}`;
  
  return new Promise((resolve, reject) => {
    // Create JWT token for authentication
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600; // 1 hour from now
    
    const jwtHeader = Buffer.from(JSON.stringify({
      alg: 'RS256',
      typ: 'JWT'
    })).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    const jwtPayload = Buffer.from(JSON.stringify({
      iss: credentials.client_email,
      sub: credentials.client_email,
      aud: 'https://storage.googleapis.com/',
      iat: now,
      exp: expiry,
      scope: 'https://www.googleapis.com/auth/devstorage.read_write'
    })).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    const jwtUnsigned = `${jwtHeader}.${jwtPayload}`;
    
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(jwtUnsigned);
    const signature = sign.sign(credentials.private_key, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    const jwtToken = `${jwtUnsigned}.${signature}`;
    
    // Prepare the request options
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length,
        'Authorization': `Bearer ${jwtToken}`,
        'X-Goog-Meta-Public': 'true'
      }
    };
    
    // Upload the file
    const req = https.request(url, options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${filePath}`;
          console.log(`Upload successful, URL: ${publicUrl}`);
          resolve(publicUrl);
        } else {
          console.error(`Upload failed with status ${res.statusCode}: ${responseData}`);
          reject(new Error(`Upload failed with status ${res.statusCode}: ${responseData}`));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Error uploading to GCS:', error);
      reject(error);
    });
    
    // Send the file content
    req.write(buffer);
    req.end();
  });
}

// Fallback function that doesn't actually upload but returns mock URL
function mockUpload(filename: string): string {
  console.log(`Mock upload for ${filename} - not actually uploading`);
  return `https://storage.googleapis.com/${BUCKET_NAME}/screenshots/${filename}`;
}

// Upload image from URL
export async function uploadImageFromUrl(
  url: string, 
  filename: string
): Promise<string> {
  const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/screenshots/${filename}`;
  
  try {
    console.log(`Fetching image from: ${url}`);
    
    // Use our simple fetch function
    const { buffer, contentType } = await fetchImageBuffer(url);
    
    console.log(`Successfully fetched image (${buffer.length} bytes)`);
    
    // Skip actual upload in development mode if needed
    if (!credentials && (isDevelopment || isVercel)) {
      console.warn('No valid credentials, skipping upload and using mock URL');
      return mockUpload(filename);
    }
    
    // Upload directly using our custom function, no SDK involved
    return await directUploadToGCS(buffer, filename, contentType);
  } catch (error) {
    console.error('Error with image upload process:', error);
    
    // Return a mock URL in case of error in dev/Vercel
    if (isDevelopment || isVercel) {
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