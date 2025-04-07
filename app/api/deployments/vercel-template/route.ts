import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { DomainDeployment } from '@/lib/models/DomainDeployment';
import { createVercelProject, addDomainToVercel } from '@/lib/vercel';
import fetch from 'node-fetch';

// Mark this route as dynamic to prevent static optimization
export const dynamic = 'force-dynamic';

// POST /api/deployments/vercel-template
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { domainId, wordpressApiUrl = 'https://nowshipping.store/wp-json' } = body;
    
    if (!domainId) {
      return NextResponse.json(
        { error: 'Domain ID is required' },
        { status: 400 }
      );
    }
    
    // Find the domain
    const domain = await Domain.findById(domainId);
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }
    
    // Create a deployment record
    const deployment = new DomainDeployment({
      domainId: domain._id,
      domainName: domain.name,
      deploymentId: `template_${Date.now()}`,
      status: 'pending',
      logs: [{
        message: `Starting WordPress template deployment for ${domain.name}`,
        level: 'info',
        timestamp: new Date()
      }]
    });
    
    await deployment.save();
    
    // Update domain status
    domain.deploymentStatus = 'deploying';
    await domain.save();
    
    // Start the deployment in the background
    deployWordpressTemplate(domain.name, domain._id.toString(), deployment._id.toString(), wordpressApiUrl)
      .catch(error => {
        console.error(`Background deployment error for ${domain.name}:`, error);
      });
    
    return NextResponse.json({
      success: true,
      message: 'WordPress template deployment started',
      deploymentId: deployment._id,
      domainName: domain.name
    });
    
  } catch (error: any) {
    console.error('Error initiating template deployment:', error);
    return NextResponse.json(
      { error: `Failed to start deployment: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * Process the WordPress template deployment
 */
async function deployWordpressTemplate(
  domainName: string,
  domainId: string,
  deploymentId: string,
  wordpressApiUrl: string
): Promise<void> {
  console.log(`Starting WordPress template deployment for ${domainName}`);
  
  try {
    // 1. Create a new Vercel project for this domain
    const deployment = await DomainDeployment.findById(deploymentId);
    if (!deployment) {
      throw new Error('Deployment record not found');
    }
    
    deployment.addLog(`Creating Vercel project for ${domainName}...`, 'info');
    await deployment.save();
    
    // Create the Vercel project
    const project = await createVercelProject(domainName, 'nextjs');
    
    if (!project || !project.id) {
      throw new Error('Failed to create Vercel project');
    }
    
    deployment.vercelProjectId = project.id;
    deployment.addLog(`Vercel project created successfully (ID: ${project.id})`, 'info');
    await deployment.save();
    
    // 2. Deploy the WordPress ISR blog template through Vercel API
    deployment.addLog(`Deploying NextJS WordPress ISR blog template...`, 'info');
    await deployment.save();
    
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    if (!VERCEL_TOKEN) {
      throw new Error('Vercel API token not set');
    }
    
    // Construct the deployment API URL
    let deploymentUrl = `https://api.vercel.com/v13/deployments`;
    if (VERCEL_TEAM_ID) {
      deploymentUrl += `?teamId=${VERCEL_TEAM_ID}&projectId=${project.id}`;
    } else {
      deploymentUrl += `?projectId=${project.id}`;
    }
    
    deployment.addLog(`Using WordPress API URL: ${wordpressApiUrl}`, 'info');
    await deployment.save();
    
    // Create deployment configuration for WordPress Template
    const deploymentConfig = {
      name: domainName,
      target: 'production',
      source: 'cli',
      projectSettings: {
        framework: "nextjs",
        devCommand: null,
        buildCommand: null,
        outputDirectory: ".next",
        rootDirectory: null,
        nodeVersion: "18.x"
      },
      env: {
        WORDPRESS_API_URL: wordpressApiUrl
      },
      gitMetadata: {
        commitAuthorName: "Vercel Template Deployer",
        commitMessage: "Deploy from WordPress template"
      },
      template: "nextjs-wordpress-isr-blog"
    };
    
    deployment.addLog(`Sending request to Vercel API for template deployment...`, 'info');
    await deployment.save();
    
    // Make the API request to create the deployment
    const response = await fetch(deploymentUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(deploymentConfig)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      deployment.addLog(`Failed to create deployment: ${JSON.stringify(data.error)}`, 'error');
      await deployment.save();
      throw new Error(`Vercel API error: ${data.error?.message || 'Unknown error'}`);
    }
    
    if (!data.id) {
      deployment.addLog(`Deployment response missing ID: ${JSON.stringify(data)}`, 'error');
      await deployment.save();
      throw new Error('Deployment response missing ID');
    }
    
    // Update deployment record with the deployment ID
    deployment.deploymentId = data.id;
    deployment.addLog(`Template deployment initiated successfully (ID: ${data.id})`, 'info');
    await deployment.save();
    
    // Add the domain to the project
    const domainResult = await addDomainToVercel(domainName, project.id);
    if (!domainResult.success) {
      deployment.addLog(`Warning: Failed to add domain to project: ${JSON.stringify(domainResult.error)}`, 'warning');
    } else {
      deployment.addLog(`Domain ${domainName} added to project`, 'info');
    }
    
    // Add log with URL information
    if (data.url) {
      deployment.addLog(`Deployment URL: https://${data.url}`, 'info');
    }
    
    deployment.status = 'deployed';
    deployment.completedAt = new Date();
    await deployment.save();
    
    // Update the domain record
    const domain = await Domain.findById(domainId);
    if (domain) {
      domain.deploymentStatus = 'deployed';
      domain.lastDeployedAt = new Date();
      domain.deploymentUrl = `https://${domainName}`;
      domain.vercelProjectId = project.id;
      await domain.save();
    }
    
  } catch (error: any) {
    console.error(`Error in WordPress template deployment for ${domainName}:`, error);
    
    // Try to update the deployment record if something went wrong
    try {
      const deployment = await DomainDeployment.findById(deploymentId);
      if (deployment) {
        deployment.addLog(`Deployment failed: ${error.message}`, 'error');
        deployment.status = 'failed';
        deployment.completedAt = new Date();
        await deployment.save();
      }
      
      // Update domain status
      const domain = await Domain.findById(domainId);
      if (domain) {
        domain.deploymentStatus = 'failed';
        await domain.save();
      }
    } catch (updateError) {
      console.error('Error updating records after failure:', updateError);
    }
  }
} 