import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const { workerName } = await request.json();
    
    if (!workerName) {
      return NextResponse.json({ error: 'Worker name is required' }, { status: 400 });
    }
    
    // Read the comprehensive debug worker script from file
    const workerScriptPath = join(process.cwd(), 'debug-worker.js');
    let debugWorkerScript;
    
    try {
      debugWorkerScript = readFileSync(workerScriptPath, 'utf8');
    } catch (fileError) {
      console.error('Failed to read debug-worker.js:', fileError);
      return NextResponse.json({ 
        error: 'Debug worker script file not found. Please ensure debug-worker.js exists in the project root.' 
      }, { status: 500 });
    }
    
    // Deploy to Cloudflare
    const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
    const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
    
    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
      return NextResponse.json({ error: 'Cloudflare credentials not configured' }, { status: 500 });
    }
    
    console.log(`Creating debug worker: ${workerName}`);
    
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${workerName}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/javascript',
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
      body: debugWorkerScript,
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('Failed to create debug worker:', result);
      return NextResponse.json({ 
        error: 'Failed to create debug worker', 
        details: result 
      }, { status: 500 });
    }
    
    console.log(`Debug worker ${workerName} created successfully`);
    
    return NextResponse.json({ 
      success: true, 
      message: `Debug worker ${workerName} created successfully`,
      workerName,
      version: 'debug-external-1.0'
    });
    
  } catch (error) {
    console.error('Error creating debug worker:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create debug worker' }, 
      { status: 500 }
    );
  }
}