import { NextRequest, NextResponse } from 'next/server';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const TRAFFIC_LOGS_NAMESPACE_ID = process.env.TRAFFIC_LOGS_NAMESPACE_ID;

export async function DELETE(request: NextRequest) {
  try {
    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !TRAFFIC_LOGS_NAMESPACE_ID) {
      return NextResponse.json({
        success: false,
        error: 'Missing Cloudflare configuration'
      }, { status: 500 });
    }

    // Delete the test record
    const testKey = 'test_fresh_namespace_2025-06-19T08:17:25.000Z_test123';
    
    const deleteUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${TRAFFIC_LOGS_NAMESPACE_ID}/values/${encodeURIComponent(testKey)}`;
    
    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'Test record deleted successfully'
      });
    } else {
      const errorData = await response.text();
      return NextResponse.json({
        success: false,
        error: `Failed to delete test record: ${response.status} ${errorData}`
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error deleting test record:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete test record'
    }, { status: 500 });
  }
} 