import { NextRequest, NextResponse } from 'next/server';
import { getDomainDeployments } from '@/lib/services/domainDeploymentService';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const domainId = params.id;
  
  if (!domainId) {
    return NextResponse.json(
      { error: 'Domain ID is required' },
      { status: 400 }
    );
  }
  
  try {
    // Get all deployments for the domain
    const result = await getDomainDeployments(domainId);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      deployments: result.deployments
    });
  } catch (error: any) {
    console.error('Error getting domain deployments:', error);
    return NextResponse.json(
      { error: `Failed to get domain deployments: ${error.message}` },
      { status: 500 }
    );
  }
} 