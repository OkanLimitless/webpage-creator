import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('Testing external logging API...');
    
    // Test the same external API the worker uses - CORRECTED URL
    const logUrl = 'https://webpage-creator.vercel.app/api/jci-logs';
    
    const testData = {
      ip: '127.0.0.1',
      userAgent: 'Test-Agent/1.0',
      decision: 'SAFE_PAGE',
      reason: 'API_TEST',
      jciResponse: null,
      error: null,
      timestamp: new Date().toISOString(),
      workerVersion: 'api-test-1.0'
    };
    
    console.log('Sending test data to:', logUrl);
    console.log('Test data:', JSON.stringify(testData, null, 2));
    
    const response = await fetch(logUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'TestingAPI/1.0'
      },
      body: JSON.stringify(testData)
    });
    
    console.log('Response status:', response.status, response.statusText);
    
    if (response.ok) {
      const responseText = await response.text();
      console.log('Response body:', responseText);
      
      return NextResponse.json({
        success: true,
        message: 'Logging API test successful',
        logUrl,
        responseStatus: response.status,
        responseBody: responseText
      });
    } else {
      const errorText = await response.text();
      console.error('API test failed:', errorText);
      
      return NextResponse.json({
        success: false,
        message: 'Logging API test failed',
        logUrl,
        responseStatus: response.status,
        error: errorText
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error testing logging API:', error);
    return NextResponse.json({
      success: false,
      message: 'Error testing logging API',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 