import { NextRequest, NextResponse } from 'next/server';
import { cleanupEmptyProjects } from '@/lib/vercel';

/**
 * API route to clean up empty Vercel projects
 * This can be called from the admin UI to clean up projects that were created but not used
 * GET /api/maintenance/cleanup-projects
 */
export async function GET(request: NextRequest) {
  try {
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