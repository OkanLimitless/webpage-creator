import { NextRequest, NextResponse } from 'next/server';
import { cleanupEmptyProjects } from '@/lib/vercel';

/**
 * API route to clean up empty Vercel projects
 * This can be called periodically to clean up projects that were created but not used
 * GET /api/maintenance/cleanup-projects
 */
export async function GET(request: NextRequest) {
  try {
    // Check for a secret token for basic auth
    const { searchParams } = new URL(request.url);
    const secretToken = searchParams.get('token');
    
    // Simple security check to prevent unauthorized access
    if (process.env.MAINTENANCE_SECRET && secretToken !== process.env.MAINTENANCE_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }
    
    // Run the cleanup process
    const result = await cleanupEmptyProjects();
    
    return NextResponse.json({
      success: result.success,
      cleanedProjects: result.cleanedProjects,
      message: result.message
    });
  } catch (error: any) {
    console.error('Error in project cleanup API:', error);
    return NextResponse.json(
      { error: `Failed to clean up projects: ${error.message}` },
      { status: 500 }
    );
  }
} 