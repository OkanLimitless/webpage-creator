import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { LandingPage } from '@/lib/models/LandingPage';
import { generateJciWorkerScript } from '@/lib/cloudflare';

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const NEW_TRAFFIC_LOGS_NAMESPACE_ID = process.env.TRAFFIC_LOGS_NAMESPACE_ID || '6c08c4dd4c20424c9045186b021487aa';

export async function POST(request: NextRequest) {
  try {
    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
      return NextResponse.json({ error: 'Missing Cloudflare credentials' }, { status: 500 });
    }

    await connectToDatabase();
    
    const body = await request.json();
    const { action } = body;
    
    if (action === 'update-all-workers-kv') {
      // Get all cloaked landing pages with workers
      const landingPages = await LandingPage.find({
        templateType: 'cloaked',
        workerScriptName: { $exists: true, $ne: null }
      }).populate('domainId');
      
      const results = [];
      
      for (const landingPage of landingPages) {
        try {
          const domain = landingPage.domainId as any;
          const scriptName = landingPage.workerScriptName;
          
          console.log(`Updating worker ${scriptName} to use new KV namespace`);
          
          // Generate the worker script with current settings
          const safeUrl = landingPage.safeUrl || `https://${landingPage.subdomain ? `${landingPage.subdomain}.${domain.name}` : domain.name}`;
          
          const workerScript = generateJciWorkerScript({
            safeUrl,
            moneyUrl: landingPage.moneyUrl,
            whitePageUrl: landingPage.safeUrl,
            targetCountries: landingPage.targetCountries || ['Germany'],
            excludeCountries: landingPage.excludeCountries || []
          });
          
          // Create FormData for multipart request
          const formData = new FormData();
          formData.append('script', new Blob([workerScript], { type: 'application/javascript' }));
          
          // Add metadata with NEW KV binding
          const metadata = {
            body_part: 'script',
            bindings: [{
              name: 'TRAFFIC_LOGS',
              type: 'kv_namespace',
              namespace_id: NEW_TRAFFIC_LOGS_NAMESPACE_ID
            }]
          };
          
          formData.append('metadata', JSON.stringify(metadata));

          // Update the worker script
          const workerResult = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${scriptName}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            },
            body: formData,
          });
          
          const workerData = await workerResult.json();
          
          if (workerData.success) {
            results.push({
              success: true,
              scriptName,
              domain: domain.name,
              subdomain: landingPage.subdomain,
              message: 'Updated successfully'
            });
          } else {
            results.push({
              success: false,
              scriptName,
              domain: domain.name,
              subdomain: landingPage.subdomain,
              error: JSON.stringify(workerData.errors)
            });
          }
          
        } catch (error) {
          results.push({
            success: false,
            scriptName: landingPage.workerScriptName,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      
      return NextResponse.json({
        success: true,
        message: `Updated ${successCount}/${results.length} workers to use new KV namespace`,
        newNamespaceId: NEW_TRAFFIC_LOGS_NAMESPACE_ID,
        results
      });
    }
    
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    
  } catch (error) {
    console.error('Error updating workers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update workers' }, 
      { status: 500 }
    );
  }
} 