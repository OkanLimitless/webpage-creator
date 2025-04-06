import { NextRequest, NextResponse } from 'next/server';
import { getAllProjects, getProjectDomains } from '@/lib/vercel';

// Define type for project
interface VercelProject {
  id: string;
  name: string;
  [key: string]: any; // Allow other properties
}

/**
 * API route to clean up empty Vercel projects
 * This will find and delete projects with no domains attached
 * GET /api/maintenance/cleanup-projects
 */
export async function GET(request: NextRequest) {
  try {
    // Get all projects
    const projects = await getAllProjects();
    console.log(`Found ${projects.length} projects to check for cleanup`);
    
    // Find domain-specific projects
    const domainProjects = projects.filter((p: VercelProject) => 
      p.name.startsWith('domain-') && 
      p.id !== process.env.VERCEL_PROJECT_ID // Skip main project
    );
    console.log(`Found ${domainProjects.length} domain-specific projects`);
    
    // Track how many projects were cleaned up
    let cleanedCount = 0;
    const emptyProjects: VercelProject[] = [];
    
    // Check each domain project to see if it has domains
    for (const project of domainProjects) {
      try {
        const domains = await getProjectDomains(project.id);
        
        // If this project has no domains, it can be deleted
        if (domains.length === 0) {
          console.log(`Project ${project.id} (${project.name}) has no domains, marking for deletion`);
          emptyProjects.push(project);
        } else {
          console.log(`Project ${project.id} (${project.name}) has ${domains.length} domains, keeping it`);
        }
      } catch (error) {
        console.warn(`Error checking domains for project ${project.id}:`, error);
      }
    }
    
    // Delete the empty projects
    for (const project of emptyProjects) {
      try {
        // Construct the API URL for deletion
        let url = `https://api.vercel.com/v9/projects/${project.id}`;
        const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
        if (VERCEL_TEAM_ID) {
          url += `?teamId=${VERCEL_TEAM_ID}`;
        }
        
        // Make the API request to delete the project
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${process.env.VERCEL_TOKEN!}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.status === 204 || response.ok) {
          console.log(`Successfully deleted empty project ${project.id} (${project.name})`);
          cleanedCount++;
        } else {
          const errorData = await response.json();
          console.warn(`Failed to delete project ${project.id}: ${JSON.stringify(errorData)}`);
        }
      } catch (deleteError) {
        console.warn(`Error deleting project ${project.id}:`, deleteError);
      }
    }
    
    return NextResponse.json({
      success: true,
      cleanedProjects: cleanedCount,
      message: cleanedCount > 0 
        ? `Cleaned up ${cleanedCount} empty projects` 
        : "No empty projects found to clean up"
    });
  } catch (error: any) {
    console.error('Error in project cleanup API:', error);
    return NextResponse.json(
      { error: `Failed to clean up projects: ${error.message}` },
      { status: 500 }
    );
  }
} 