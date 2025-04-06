import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

/**
 * API route that runs the cleanup script with streaming output
 * This uses Server-Sent Events (SSE) to stream the script output back to the client
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
    start(controller) {
      // Get the script path
      const scriptPath = path.join(process.cwd(), 'scripts', 'cleanup-duplicate-projects.js');
      
      // Log details about the script path and mode
      console.log(`Running cleanup script at: ${scriptPath} (checkOnly: ${checkOnly})`);
      
      // Spawn the Node.js process to run the script
      const proc = spawn('node', [scriptPath, ...(checkOnly ? ['--check-only'] : [])], {
        cwd: process.cwd(),
        env: { ...process.env }
      });
      
      // Helper function to send event data
      const sendEvent = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      
      // Send initial message
      sendEvent({ 
        output: `Starting ${checkOnly ? 'analysis' : 'cleanup'} (${new Date().toISOString()})` 
      });
      
      // Handle stdout data
      proc.stdout.on('data', (data) => {
        const text = data.toString();
        const lines = text.split('\n');
        
        // Check if this is a special JSON output for projects to clean
        if (text.includes('PROJECTS_TO_CLEAN_JSON:')) {
          try {
            const jsonStart = text.indexOf('PROJECTS_TO_CLEAN_JSON:') + 'PROJECTS_TO_CLEAN_JSON:'.length;
            const jsonText = text.substring(jsonStart).trim();
            const projectsData = JSON.parse(jsonText);
            
            // Send the projects data separately
            sendEvent({ projectsToClean: projectsData });
            
            // Also send as regular output
            sendEvent({ output: `Found ${projectsData.length} projects that would be affected` });
          } catch (error) {
            console.error('Error parsing projects JSON:', error);
            sendEvent({ output: `ERROR: Failed to parse projects data` });
          }
        } else {
          // Regular output lines
          lines.filter((line: string) => line.trim().length > 0).forEach((line: string) => {
            // Skip the JSON line if somehow it appears again
            if (!line.includes('PROJECTS_TO_CLEAN_JSON:')) {
              sendEvent({ output: line });
            }
          });
        }
      });
      
      // Handle stderr data
      proc.stderr.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.filter((line: string) => line.trim().length > 0).forEach((line: string) => {
          sendEvent({ output: `ERROR: ${line}` });
        });
      });
      
      // Handle process exit
      proc.on('close', (code) => {
        sendEvent({ 
          output: `${checkOnly ? 'Analysis' : 'Script'} completed with code ${code} (${new Date().toISOString()})`,
          complete: true
        });
        controller.close();
      });
      
      // Handle process error
      proc.on('error', (error) => {
        sendEvent({ 
          output: `${checkOnly ? 'Analysis' : 'Script'} failed: ${error.message}`,
          complete: true
        });
        controller.close();
      });
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