import { NextRequest, NextResponse } from 'next/server';

// Simple test endpoint for debugging worker logging
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headers = Object.fromEntries(request.headers.entries());
    
    console.log('🧪 Test logging endpoint received request:', {
      body,
      headers,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Test logging successful',
      receivedAt: new Date().toISOString(),
      bodyLength: body.length
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
    
  } catch (error) {
    console.error('❌ Test logging error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Test failed' 
      }, 
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    );
  }
}

// Handle preflight OPTIONS requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 