import { NextRequest, NextResponse } from 'next/server';
import { startDomainDeployment, getDomainDeploymentStatus } from '@/lib/services/domainDeploymentService';

export async function POST(
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
    // Start the deployment
    const result = await startDomainDeployment(domainId);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: result.message,
      deployment: result.deployment
    });
  } catch (error: any) {
    console.error('Error deploying domain:', error);
    return NextResponse.json(
      { error: `Failed to deploy domain: ${error.message}` },
      { status: 500 }
    );
  }
}

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
    // Get the deployment status
    const result = await getDomainDeploymentStatus(domainId);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      status: result.status,
      deploymentId: result.deploymentId,
      deploymentUrl: result.deploymentUrl,
      lastDeployedAt: result.lastDeployedAt,
      logs: result.logs
    });
  } catch (error: any) {
    console.error('Error getting deployment status:', error);
    return NextResponse.json(
      { error: `Failed to get deployment status: ${error.message}` },
      { status: 500 }
    );
  }
} 