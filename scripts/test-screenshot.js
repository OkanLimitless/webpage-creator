// Simple test script for ScreenshotMachine

// URL to test
const TEST_URL = 'https://www.example.com';

// Set fake development environment
process.env.NODE_ENV = 'development';

// Run the test
async function testScreenshot() {
  try {
    console.log('Testing screenshot functionality with enhanced settings...');
    console.log(`Test URL: ${TEST_URL}`);
    
    // Import the screenshot module
    const { generateScreenshotUrl } = require('../lib/screenshotMachine');
    
    // Generate screenshot URLs
    const desktopUrl = generateScreenshotUrl({
      url: TEST_URL,
      dimension: '1366x768',
      device: 'desktop',
      format: 'png',
      delay: '3000',
    });
    
    const mobileUrl = generateScreenshotUrl({
      url: TEST_URL,
      dimension: '375x667',
      device: 'phone',
      format: 'png',
      delay: '3000',
    });
    
    console.log('\nGenerated screenshot URLs:');
    console.log(`Desktop: ${desktopUrl}`);
    console.log(`Mobile: ${mobileUrl}`);
    
    console.log('\nTest completed - check the URLs to ensure they work in a browser');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testScreenshot(); 