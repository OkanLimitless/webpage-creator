import { put, del } from '@vercel/blob';
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
 * Extract filename from a Vercel Blob URL
 * @param url The full Vercel Blob Storage URL
 * @returns The filename or null if not a valid Vercel Blob URL
 */
export function getBlobFilenameFromUrl(url: string): string | null {
  if (!url) return null;
  
  try {
    // Check if this is a Vercel Blob Storage URL
    if (!url.includes('public.blob.vercel-storage.com')) {
      return null;
    }
    
    // Get the filename from the URL path
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // The last part of the path should be the filename
    const filename = pathParts[pathParts.length - 1];
    
    return filename || null;
  } catch (error) {
    console.error('Error extracting filename from Vercel Blob URL:', error);
    return null;
  }
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
  timeoutMs = 30000,
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

/**
 * Delete a file from Vercel Blob Storage
 * @param urlOrFilename URL or filename of the blob to delete
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteFromVercelBlob(urlOrFilename: string): Promise<boolean> {
  try {
    // If a full URL is provided, extract the filename
    let filename = urlOrFilename;
    if (urlOrFilename.startsWith('http')) {
      const extractedFilename = getBlobFilenameFromUrl(urlOrFilename);
      if (!extractedFilename) {
        console.error(`Invalid Vercel Blob URL: ${urlOrFilename}`);
        return false;
      }
      filename = extractedFilename;
    }
    
    console.log(`Deleting file from Vercel Blob Storage: ${filename}`);
    
    // Delete the file from Vercel Blob Storage
    await del(filename);
    
    console.log(`Successfully deleted file: ${filename}`);
    return true;
  } catch (error) {
    console.error(`Error deleting file from Vercel Blob:`, error);
    return false;
  }
} 