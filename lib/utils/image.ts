/**
 * Fetches an image from a URL and returns it as binary data
 */
export async function getImageAsBinary(url: string): Promise<Buffer | null> {
  try {
    // Fetch the image
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    // Get the image as an ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();
    
    // Convert to Buffer
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`Error fetching image from ${url}:`, error);
    return null;
  }
} 