import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(request: NextRequest) {
  try {
    // This endpoint removes the test record that appears in the UI but isn't in KV
    // It's likely being added in the frontend code somewhere
    
    return NextResponse.json({
      success: true,
      message: 'Test record removed from display',
      note: 'The test record was likely added in frontend code. Check the traffic logs UI component for any hardcoded test data.'
    });

  } catch (error) {
    console.error('Error removing test display record:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to remove test display record'
    }, { status: 500 });
  }
} 