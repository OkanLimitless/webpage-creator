import { generateUniqueFilename, uploadImageToVercelBlob } from '../lib/vercelBlobStorage';

async function testVercelBlobStorage() {
  console.log('Testing Vercel Blob Storage integration...');
  
  try {
    // Use a test image URL
    const testImageUrl = 'https://via.placeholder.com/800x600?text=Test+Image';
    
    // Generate a unique filename
    const filename = generateUniqueFilename('test');
    
    console.log(`Uploading test image to Vercel Blob Storage with filename: ${filename}...`);
    
    // Upload to Vercel Blob
    const blobUrl = await uploadImageToVercelBlob(testImageUrl, filename);
    
    console.log('Upload successful!');
    console.log(`Test image available at: ${blobUrl}`);
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testVercelBlobStorage(); 