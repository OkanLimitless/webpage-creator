import { NextRequest, NextResponse } from 'next/server';

// This is a simplified version of the set-primary-domain.js script for use in the admin dashboard
export async function POST(request: NextRequest) {
  try {
    // Get domain from request body
    const body = await request.json();
    const { domain } = body;
    
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain is required' },
        { status: 400 }
      );
    }
    
    // Get Vercel API credentials
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
      return NextResponse.json(
        { error: 'VERCEL_TOKEN and VERCEL_PROJECT_ID environment variables must be set' },
        { status: 500 }
      );
    }
    
    // Check if the environment variable already exists
    let url = `https://api.vercel.com/v8/projects/${VERCEL_PROJECT_ID}/env`;
    if (VERCEL_TEAM_ID) {
      url += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to get environment variables: ${JSON.stringify(data)}` },
        { status: 500 }
      );
    }
    
    // Find if PRIMARY_DOMAIN already exists
    const primaryDomainEnv = data.envs.find((env: any) => env.key === 'PRIMARY_DOMAIN');
    let result;
    
    // If it exists, update it. Otherwise, create it.
    if (primaryDomainEnv) {
      const updateUrl = `https://api.vercel.com/v8/projects/${VERCEL_PROJECT_ID}/env/${primaryDomainEnv.id}`;
      const updateQueryParams = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
      
      const updateResponse = await fetch(`${updateUrl}${updateQueryParams}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          value: domain,
          target: ['production', 'preview', 'development']
        })
      });
      
      const updateData = await updateResponse.json();
      
      if (updateResponse.ok) {
        result = {
          success: true,
          action: 'updated',
          previousValue: primaryDomainEnv.value,
          newValue: domain
        };
      } else {
        return NextResponse.json(
          { error: `Failed to update PRIMARY_DOMAIN: ${JSON.stringify(updateData)}` },
          { status: 500 }
        );
      }
    } else {
      let createUrl = `https://api.vercel.com/v8/projects/${VERCEL_PROJECT_ID}/env`;
      if (VERCEL_TEAM_ID) {
        createUrl += `?teamId=${VERCEL_TEAM_ID}`;
      }
      
      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: 'PRIMARY_DOMAIN',
          value: domain,
          target: ['production', 'preview', 'development'],
          type: 'plain'
        })
      });
      
      const createData = await createResponse.json();
      
      if (createResponse.ok) {
        result = {
          success: true,
          action: 'created',
          value: domain
        };
      } else {
        return NextResponse.json(
          { error: `Failed to create PRIMARY_DOMAIN: ${JSON.stringify(createData)}` },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json({
      ...result,
      message: 'PRIMARY_DOMAIN has been set. To apply these changes, you need to redeploy the application.',
      domain
    });
  } catch (error: any) {
    console.error('Error setting PRIMARY_DOMAIN:', error);
    return NextResponse.json(
      { error: `Error setting PRIMARY_DOMAIN: ${error.message}` },
      { status: 500 }
    );
  }
} 