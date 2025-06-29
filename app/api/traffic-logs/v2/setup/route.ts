import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
    const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      return NextResponse.json({
        success: false,
        error: 'Missing Cloudflare configuration'
      }, { status: 500 });
    }

    console.log('Setting up Traffic Logs V2 system...');

    // Step 1: Create new KV namespace for V2
    const createNamespaceResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Traffic Logs V2 - Clean Architecture'
        })
      }
    );

    if (!createNamespaceResponse.ok) {
      throw new Error(`Failed to create KV namespace: ${createNamespaceResponse.statusText}`);
    }

    const namespaceData = await createNamespaceResponse.json();
    const namespaceId = namespaceData.result.id;

    console.log(`Created new KV namespace: ${namespaceId}`);

    // Step 2: Initialize metadata keys
    const metadataKeys = [
      {
        key: 'meta:system:version',
        value: JSON.stringify({
          version: '2.0',
          created: new Date().toISOString(),
          batch_size: 100,
          retention_hours: 48,
          description: 'Traffic Logs V2 - Clean Architecture'
        })
      },
      {
        key: 'meta:cleanup:last_run',
        value: JSON.stringify({
          timestamp: new Date().toISOString(),
          status: 'initial_setup'
        })
      },
      {
        key: 'meta:stats:counters', 
        value: JSON.stringify({
          total_batches: 0,
          total_requests: 0,
          last_updated: new Date().toISOString()
        })
      }
    ];

    // Initialize metadata
    for (const meta of metadataKeys) {
      await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${namespaceId}/values/${meta.key}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: meta.value
        }
      );
    }

    console.log('Initialized metadata keys');

    return NextResponse.json({
      success: true,
      data: {
        namespace_id: namespaceId,
        title: 'Traffic Logs V2 - Clean Architecture',
        version: '2.0',
        features: [
          'Smart batching (100 requests per batch)',
          'Automatic TTL cleanup (48 hours)',
          'Efficient key naming strategy',
          'Overflow protection',
          'Real-time analytics'
        ],
        next_steps: [
          'Add TRAFFIC_LOGS_V2_NAMESPACE_ID to Vercel environment variables',
          'Update worker script to use V2 logging',
          'Deploy updated workers with new KV binding',
          'Test with sample traffic'
        ],
        environment_variable: {
          name: 'TRAFFIC_LOGS_V2_NAMESPACE_ID',
          value: namespaceId
        }
      }
    });

  } catch (error) {
    console.error('Traffic Logs V2 setup error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to setup Traffic Logs V2'
    }, { status: 500 });
  }
} 