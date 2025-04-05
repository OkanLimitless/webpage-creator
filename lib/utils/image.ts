/**
 * Fetches an image from a URL and returns it as binary data
 * @param url URL of the image to fetch
 * @param timeoutMs Timeout in milliseconds (default: 15000 = 15 seconds)
 */
export async function getImageAsBinary(url: string, timeoutMs = 15000): Promise<Buffer | null> {
  try {
    // Create an abort controller for implementing timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    // Fetch the image with timeout
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'Accept': 'image/*'
      }
    });
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    // Check content type to confirm we received an image
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('image/')) {
      // If not an image, it might be an error message from the API
      const text = await response.text();
      throw new Error(`Received non-image response (${contentType}): ${text.substring(0, 200)}`);
    }
    
    // Get the image as an ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();
    
    // Convert to Buffer
    return Buffer.from(arrayBuffer);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`Timeout error fetching image from ${url} after ${timeoutMs}ms`);
      return null;
    }
    
    console.error(`Error fetching image from ${url}:`, error);
    return null;
  }
} 