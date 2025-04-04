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
 * @returns URL of the uploaded blob
 */
export async function uploadImageToVercelBlob(imageUrl: string, filename: string): Promise<string> {
  try {
    // Fetch the image as binary data
    const imageData = await getImageAsBinary(imageUrl);
    
    if (!imageData) {
      throw new Error('Failed to fetch image data');
    }
    
    // Upload to Vercel Blob Storage
    const blob = await put(filename, imageData, {
      access: 'public',
      contentType: 'image/png'
    });
    
    return blob.url;
  } catch (error) {
    console.error(`Error uploading image to Vercel Blob:`, error);
    throw error;
  }
} 