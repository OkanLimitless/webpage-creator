import { NextRequest, NextResponse } from 'next/server';
import { startDomainDeployment, getDomainDeploymentStatus } from '@/lib/services/domainDeploymentService';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { deployDomainToVercel } from '@/lib/vercel';

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
    // Get the retry count from query parameters
    const searchParams = request.nextUrl.searchParams;
    const retryCount = parseInt(searchParams.get('retry') || '0');
    
    // Add max retries to prevent infinite loops
    if (retryCount > 5) {
      console.log(`Maximum retry count (5) reached for domain deployment ${params.id}. Stopping retry loop.`);
      return NextResponse.json({
        error: 'Maximum retry count reached. Domain deployment is still in progress but will continue in the background.',
        retryCount,
        domainId: params.id
      }, { status: 429 });
    }
    
    // Connect to database
    await connectToDatabase();
    
    // Find the domain
    const domain = await Domain.findById(params.id);
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }
    
    // Log the attempt
    console.log(`Deploying domain ${domain.name} (ID: ${params.id}) - Attempt #${retryCount + 1}`);
    
    // Deploy the domain to Vercel
    const result = await deployDomainToVercel(domain.name);
    
    // Update the domain record with the deployment URL
    if (result.success) {
      domain.deploymentUrl = result.customDomain 
        ? `https://${result.customDomain}` 
        : (result.vercelUrl ? `https://${result.vercelUrl}` : '');
      domain.deploymentStatus = 'deployed';
      domain.lastDeployedAt = new Date();
      domain.vercelProjectId = result.projectId;
      
      await domain.save();
      
      return NextResponse.json({
        success: true,
        deploymentUrl: domain.deploymentUrl,
        vercelProjectId: result.projectId,
        message: `Domain ${domain.name} deployed successfully` 
      });
    } else {
      // If there was an issue with the domain, update its status
      domain.deploymentStatus = 'failed';
      await domain.save();
      
      return NextResponse.json({
        success: false,
        error: result.error || 'Unknown error during deployment',
        result
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error deploying domain:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to deploy domain' },
      { status: 500 }
    );
  }
} 