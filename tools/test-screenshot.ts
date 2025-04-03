import { takeScreenshots } from '../lib/screenshot';

async function testScreenshotMachine() {
  console.log('Testing ScreenshotMachine integration...');
  
  try {
    const result = await takeScreenshots('https://www.example.com', 'test');
    console.log('Screenshot result:', result);
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testScreenshotMachine(); 