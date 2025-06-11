import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const { workerName, moneyUrl } = await request.json();
    
    if (!workerName) {
      return NextResponse.json({ error: 'Worker name is required' }, { status: 400 });
    }
    
    // Read the simple test worker script from file
    const workerScriptPath = join(process.cwd(), 'simple-test-worker.js');
    let testWorkerScript;
    
    try {
      testWorkerScript = readFileSync(workerScriptPath, 'utf8');
    } catch (fileError) {
      console.error('Failed to read simple-test-worker.js:', fileError);
      return NextResponse.json({ 
        error: 'Simple test worker script file not found' 
      }, { status: 500 });
    }
    
    // Replace money URL if provided
    if (moneyUrl) {
      testWorkerScript = testWorkerScript.replace(
        "const MONEY_URL = 'https://www.xnxx.com';",
        `const MONEY_URL = '${moneyUrl}';`
      );
    }
    
    // Deploy to Cloudflare
    const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
    const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
    
    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
      return NextResponse.json({ 
        error: 'Cloudflare API credentials not configured' 
      }, { status: 500 });
    }
    
    console.log(`Deploying SIMPLE TEST worker: ${workerName}`);
    
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${workerName}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/javascript',
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
        body: testWorkerScript,
      }
    );
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('Failed to deploy simple test worker:', result);
      return NextResponse.json({ 
        error: 'Failed to deploy simple test worker',
        details: result.errors || result
      }, { status: 500 });
    }
    
    console.log('Simple test worker deployed successfully:', result);
    
    return NextResponse.json({
      success: true,
      message: `Simple test worker ${workerName} deployed successfully`,
      workerName,
      version: 'simple-test-1.0',
      features: [
        'NO external logging (no interference)',
        'Shows JCI API response directly on page',
        'Real-time debug information',
        'Clear decision logic display',
        'Actual JCI API calls with click reduction'
      ],
      instructions: [
        '1. Visit your cloaked domain',
        '2. You will see a debug page with JCI results',
        '3. Check if JCI API call succeeded',
        '4. Verify the decision logic (type=false → money)',
        '5. Watch your JCI dashboard for click reductions'
      ]
    });
    
  } catch (error) {
    console.error('Error deploying simple test worker:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 