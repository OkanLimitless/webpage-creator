import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Define interface for request body
interface LoginRequestBody {
  password: string;
}

// POST /api/auth/login - Handle login authentication
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: LoginRequestBody = await request.json();
    
    // Get password from request
    const { password } = body;
    
    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' }, 
        { status: 400 }
      );
    }
    
    // Get password hash from environment variable (not NEXT_PUBLIC_)
    const correctPasswordHash = process.env.PASSWORD_HASH;
    
    // If password hash is not set in environment variables, authentication fails
    if (!correctPasswordHash) {
      console.error('PASSWORD_HASH environment variable is not set');
      return NextResponse.json(
        { error: 'Authentication is not configured properly' }, 
        { status: 500 }
      );
    }
    
    // Hash the input password with SHA-256
    const hashedPassword = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');
    
    // Check if password is correct
    if (hashedPassword === correctPasswordHash) {
      // Set cookie with 7-day expiration
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7);
      
      // Set authentication cookie
      const response = NextResponse.json({ success: true });
      
      // Set HTTP-only cookie for better security
      response.cookies.set({
        name: 'auth_token',
        value: 'authenticated',
        expires: expirationDate,
        path: '/',
        httpOnly: true, // Not accessible via JavaScript
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict'
      });
      
      return response;
    } else {
      // Password is incorrect
      return NextResponse.json(
        { error: 'Invalid password' }, 
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Error in login API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 