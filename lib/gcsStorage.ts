import crypto from 'crypto';

/**
 * Generate a unique filename
 * This is the only function we need to export for the current implementation
 */
export function generateUniqueFilename(prefix: string, extension: string = 'png'): string {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  return `${prefix}_${timestamp}_${randomString}.${extension}`;
} 