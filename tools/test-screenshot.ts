import { takeScreenshots } from '../lib/screenshot';

async function testScreenshotMachine() {
  console.log('Testing enhanced ScreenshotMachine integration...');
  
  // Test URLs - one simple, one complex
  const urls = [
    'https://www.example.com',
    'https://www.nytimes.com',  // A more complex page for testing
  ];
  
  for (const url of urls) {
    console.log(`\nTesting screenshot generation for: ${url}`);
    
    try {
      console.time(`Screenshot time for ${url}`);
      const result = await takeScreenshots(url, `test_${new Date().getTime()}`);
      console.timeEnd(`Screenshot time for ${url}`);
      
      console.log('Screenshot result:');
      console.log(`Desktop URL: ${result.desktopUrl}`);
      console.log(`Mobile URL: ${result.mobileUrl}`);
      
      // Check if we got actual URLs or fallback placeholders
      const isSuccess = 
        !result.desktopUrl.includes('placeholder.com') && 
        !result.mobileUrl.includes('placeholder.com');
      
      if (isSuccess) {
        console.log('✅ Test completed successfully!');
      } else {
        console.log('⚠️ Test resulted in fallback placeholder images');
      }
    } catch (error) {
      console.error(`❌ Test failed for ${url}:`, error);
    }
  }
}

// Run the test
testScreenshotMachine(); 