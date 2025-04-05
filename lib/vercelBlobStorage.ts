import { put } from '@vercel/blob';
import crypto from 'crypto';
import { getImageAsBinary } from './utils/image';

/**
 * Generate a unique filename
 */
export function generateUniqueFilename(prefix: string, extension: string = 'png'): string {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  return `${prefix}_${timestamp}_${randomString}.${extension}`;
}

/**
 * Upload an image to Vercel Blob Storage
 * @param imageUrl URL of the image to upload
 * @param filename Filename to use for the blob
 * @param timeoutMs Timeout in milliseconds for fetching the image
 * @param contentType Content type of the image (default: 'image/png')
 * @returns URL of the uploaded blob or null if failed
 */
export async function uploadImageToVercelBlob(
  imageUrl: string, 
  filename: string, 
  timeoutMs = 15000,
  contentType = 'image/png'
): Promise<string | null> {
  try {
    // Fetch the image as binary data
    const imageData = await getImageAsBinary(imageUrl, timeoutMs);
    
    if (!imageData) {
      console.error(`Failed to fetch image data from ${imageUrl}`);
      return null;
    }
    
    // Upload to Vercel Blob Storage with the specified content type
    const blob = await put(filename, imageData, {
      access: 'public',
      contentType: contentType
    });
    
    return blob.url;
  } catch (error) {
    console.error(`Error uploading image to Vercel Blob:`, error);
    return null;
  }
} 