import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

/**
 * API route that runs the cleanup script with streaming output
 * This uses Server-Sent Events (SSE) to stream the script output back to the client
 * GET /api/maintenance/run-cleanup-script
 */
export async function GET(request: NextRequest) {
  // Set up for server-sent events response
  const encoder = new TextEncoder();
  
  // Create a custom stream
  const stream = new ReadableStream({
    start(controller) {
      // Get the script path
      const scriptPath = path.join(process.cwd(), 'scripts', 'cleanup-duplicate-projects.js');
      
      // Log details about the script path
      console.log(`Running cleanup script at: ${scriptPath}`);
      
      // Spawn the Node.js process to run the script
      const proc = spawn('node', [scriptPath], {
        cwd: process.cwd(),
        env: { ...process.env }
      });
      
      // Helper function to send event data
      const sendEvent = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      
      // Send initial message
      sendEvent({ output: `Starting cleanup script (${new Date().toISOString()})` });
      
      // Handle stdout data
      proc.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.filter((line: string) => line.trim().length > 0).forEach((line: string) => {
          sendEvent({ output: line });
        });
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
          output: `Script completed with code ${code} (${new Date().toISOString()})`,
          complete: true
        });
        controller.close();
      });
      
      // Handle process error
      proc.on('error', (error) => {
        sendEvent({ 
          output: `Script failed: ${error.message}`,
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