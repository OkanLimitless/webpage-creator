// Test script for WebP screenshot generation

// Set development environment for testing
process.env.NODE_ENV = 'development';

// Run the test
async function testWebpScreenshots() {
  try {
    // Import the screenshot module
    const { generateScreenshotUrl } = require('../lib/screenshotMachine');
    
    console.log('Testing WebP screenshot generation...');
    
    // Test URL
    const TEST_URL = 'https://www.example.com';
    
    // Generate WebP screenshot URLs
    const desktopUrl = generateScreenshotUrl({
      url: TEST_URL,
      dimension: '1366x768',
      device: 'desktop',
      format: 'webp', // WebP format
    });
    
    const mobileUrl = generateScreenshotUrl({
      url: TEST_URL,
      dimension: '375x667',
      device: 'phone',
      format: 'webp', // WebP format
    });
    
    console.log('\nGenerated WebP screenshot URLs:');
    console.log(`Desktop (WebP): ${desktopUrl}`);
    console.log(`Mobile (WebP): ${mobileUrl}`);
    
    // Verify format parameter is included correctly
    const hasWebpParam = desktopUrl.includes('format=webp');
    console.log(`\nVerification - WebP format parameter included: ${hasWebpParam ? '✅ Yes' : '❌ No'}`);
    
    console.log('\nTest completed. Paste the URLs in a browser to verify WebP generation.');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testWebpScreenshots(); 