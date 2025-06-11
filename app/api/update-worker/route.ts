import { NextRequest, NextResponse } from 'next/server';
import { generateJciWorkerScript } from '../../../lib/cloudflare';

export async function POST(request: NextRequest) {
  try {
    const { workerName, moneyUrl, targetCountries, excludeCountries } = await request.json();
    
    if (!workerName) {
      return NextResponse.json({ error: 'Worker name is required' }, { status: 400 });
    }
    
    // Generate the fixed worker script
    const workerScript = generateJciWorkerScript({
      safeUrl: 'https://your-domain.com', // This gets replaced anyway
      moneyUrl: moneyUrl || 'https://example.com',
      targetCountries: targetCountries || ['US', 'CA', 'GB', 'AU'],
      excludeCountries: excludeCountries || []
    });
    
    // Deploy to Cloudflare
    const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
    const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
    
    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
      return NextResponse.json({ error: 'Cloudflare credentials not configured' }, { status: 500 });
    }
    
    console.log(`Updating worker: ${workerName} with fixed script`);
    
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${workerName}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/javascript',
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
      body: workerScript,
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('Failed to update worker:', result);
      return NextResponse.json({ 
        error: 'Failed to update worker', 
        details: result 
      }, { status: 500 });
    }
    
    console.log(`Worker ${workerName} updated successfully with fixed script`);
    
    return NextResponse.json({ 
      success: true, 
      message: `Worker ${workerName} updated with fixed JCI script`,
      workerName,
      version: 'fixed-syntax-1.1'
    });
    
  } catch (error) {
    console.error('Error updating worker:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update worker' }, 
      { status: 500 }
    );
  }
} 