// Test script for Vercel Blob Storage deletion

// Set development environment
process.env.NODE_ENV = 'development';

// Import functions
const { getBlobFilenameFromUrl, deleteFromVercelBlob } = require('../lib/vercelBlobStorage');

async function testBlobDeletion() {
  console.log('Testing Vercel Blob Storage deletion functionality');
  
  // Test URLs
  const testUrls = [
    // Valid Vercel Blob URL structure (replace with your actual URL format if needed)
    'https://public.blob.vercel-storage.com/example/test-image-xOd9J3k.webp',
    // Invalid URL (not a Vercel Blob)
    'https://example.com/image.webp',
    // Invalid format
    'not-a-url',
  ];
  
  // Test filename extraction
  console.log('\n1. Testing filename extraction from URLs:');
  for (const url of testUrls) {
    const filename = getBlobFilenameFromUrl(url);
    console.log(`URL: ${url}`);
    console.log(`Extracted filename: ${filename || 'None (invalid URL)'}`);
    console.log('---');
  }
  
  // Test deletion functionality (simulation only in this test)
  console.log('\n2. Simulating file deletion (no actual deletion in test mode):');
  
  // In a real scenario, you would use:
  // const result = await deleteFromVercelBlob(testUrls[0]);
  // But for testing, we'll just log what would happen
  
  for (const url of testUrls) {
    console.log(`URL: ${url}`);
    console.log(`Would delete: ${getBlobFilenameFromUrl(url) || 'None (invalid URL)'}`);
    console.log('---');
  }
  
  console.log('\nTest completed. To perform actual deletion, uncomment the code in the script.');
}

// Run the test
testBlobDeletion(); 