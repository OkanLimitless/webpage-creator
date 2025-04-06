import { NextRequest } from 'next/server';
import { getAllProjects, getProjectDomains } from '@/lib/vercel';

/**
 * API route that analyzes projects with streaming output
 * This uses Server-Sent Events (SSE) to stream the analysis results back to the client
 * GET /api/maintenance/run-cleanup-script
 * 
 * Query parameters:
 * - checkOnly: If set to 'true', the script will only analyze projects without making changes
 */
export async function GET(request: NextRequest) {
  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const checkOnly = searchParams.get('checkOnly') === 'true';
  
  // Set up for server-sent events response
  const encoder = new TextEncoder();
  
  // Create a custom stream
  const stream = new ReadableStream({
    async start(controller) {
      // Helper function to send event data
      const sendEvent = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      
      try {
        // Send initial message
        sendEvent({ 
          output: `Starting ${checkOnly ? 'analysis' : 'cleanup'} (${new Date().toISOString()})` 
        });
        
        // Get all necessary Vercel tokens from environment
        const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
        const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
        const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
        
        if (!VERCEL_TOKEN) {
          sendEvent({ output: 'Error: Vercel token not set in environment variables' });
          sendEvent({ complete: true });
          controller.close();
          return;
        }
        
        if (VERCEL_PROJECT_ID) {
          sendEvent({ 
            output: `Main project ID: ${VERCEL_PROJECT_ID} (Note: Domains should NOT be moved to this project)` 
          });
        }
        
        // Get all projects
        sendEvent({ output: 'Fetching all Vercel projects...' });
        const projects = await getAllProjects();
        sendEvent({ output: `Found ${projects.length} projects` });
        
        // Find all domain-* projects
        const domainProjects = projects.filter(p => 
          p.name.startsWith('domain-')
        );
        
        sendEvent({ output: `\nFound ${domainProjects.length} domain-specific projects to analyze` });
        
        // Array to collect projects that will be affected by cleanup
        const projectsToClean = [];
        
        // Find empty domain projects (no domains attached)
        const emptyProjects = [];
        
        // Process the projects
        for (const project of domainProjects) {
          sendEvent({ output: `\nAnalyzing project: ${project.name} (${project.id})` });
          
          // Skip main project
          if (project.id === VERCEL_PROJECT_ID) {
            sendEvent({ output: `Skipping main project ${VERCEL_PROJECT_ID}` });
            continue;
          }
          
          try {
            // Get domains for this project
            const projectDomains = await getProjectDomains(project.id);
            sendEvent({ output: `Project has ${projectDomains.length} domains:` });
            
            // Add this project to the list of projects that would be affected
            projectsToClean.push({
              id: project.id,
              name: project.name,
              domains: projectDomains.map(d => ({
                name: d.name,
                verified: d.verified
              }))
            });
            
            // If project has no domains, mark it for cleanup
            if (projectDomains.length === 0) {
              emptyProjects.push(project);
              sendEvent({ output: 'No domains found. This project can be safely deleted.' });
            } else {
              projectDomains.forEach(d => {
                sendEvent({ output: `- ${d.name} (${d.verified ? 'verified' : 'unverified'})` });
              });
              
              // Extract the domain name from the project name (domain-example-com => example.com)
              const domainFromName = project.name.replace('domain-', '').replace(/-/g, '.');
              
              // Check if this project has its expected domain
              const hasExpectedDomain = projectDomains.some(d => d.name === domainFromName);
              if (!hasExpectedDomain) {
                sendEvent({ output: `WARNING: This project doesn't have its expected domain (${domainFromName})` });
              } else {
                sendEvent({ output: `✓ Project correctly has its domain (${domainFromName})` });
              }
            }
          } catch (error: any) {
            sendEvent({ output: `Error checking domains for project ${project.id}: ${error.message}` });
          }
        }
        
        // Send the list of projects to clean
        sendEvent({ projectsToClean });
        
        // Summary of empty projects
        if (emptyProjects.length > 0) {
          sendEvent({ output: `\nFound ${emptyProjects.length} empty domain projects that can be safely deleted:` });
          emptyProjects.forEach(p => sendEvent({ output: `- ${p.name} (${p.id})` }));
        } else {
          sendEvent({ output: `\nNo empty domain projects found to clean up` });
        }
        
        // If not in check-only mode and there are empty projects, delete them
        if (!checkOnly && emptyProjects.length > 0) {
          sendEvent({ output: '\nStarting cleanup of empty projects...' });
          
          // Track cleanup success
          let cleanedCount = 0;
          
          // Delete the empty projects
          for (const project of emptyProjects) {
            try {
              sendEvent({ output: `Deleting empty project ${project.name} (${project.id})...` });
              
              // Construct the API URL for deletion
              let url = `https://api.vercel.com/v9/projects/${project.id}`;
              if (VERCEL_TEAM_ID) {
                url += `?teamId=${VERCEL_TEAM_ID}`;
              }
              
              // Make the API request to delete the project
              const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${VERCEL_TOKEN}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (response.status === 204 || response.ok) {
                sendEvent({ output: `Successfully deleted empty project ${project.id} (${project.name})` });
                cleanedCount++;
              } else {
                const errorData = await response.json();
                sendEvent({ output: `Failed to delete project ${project.id}: ${JSON.stringify(errorData)}` });
              }
            } catch (deleteError: any) {
              sendEvent({ output: `Error deleting project ${project.id}: ${deleteError.message}` });
            }
          }
          
          sendEvent({ 
            output: cleanedCount > 0 
              ? `Cleaned up ${cleanedCount} empty projects` 
              : "No projects were deleted"
          });
        }
        
        // Complete the stream
        sendEvent({ 
          output: `${checkOnly ? 'Analysis' : 'Cleanup'} completed! (${new Date().toISOString()})`,
          complete: true
        });
      } catch (error: any) {
        console.error('Error in cleanup process:', error);
        sendEvent({ 
          output: `Error: ${error.message || 'An unexpected error occurred'}`,
          complete: true
        });
      } finally {
        controller.close();
      }
    }
  });
  
  // Return the response with appropriate headers for SSE
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
} 