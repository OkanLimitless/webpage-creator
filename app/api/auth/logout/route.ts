import { NextRequest, NextResponse } from 'next/server';

// POST /api/auth/logout - Handle logout
export async function POST(request: NextRequest) {
  try {
    // Create response 
    const response = NextResponse.json({ success: true });
    
    // Clear the auth_token cookie by setting expiration to the past
    response.cookies.set({
      name: 'auth_token',
      value: '',
      expires: new Date(0), // Immediately expire the cookie
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    return response;
  } catch (error) {
    console.error('Error in logout API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 