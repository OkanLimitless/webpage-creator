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
    
    // First, let's import the WordPress ISR blog template from GitHub
    deployment.addLog(`Importing WordPress ISR blog template from GitHub...`, 'info');
    await deployment.save();
    
    // Construct the import API URL for Vercel
    let importUrl = `https://api.vercel.com/v1/integrations/github/repos/vercel/examples/imports`;
    if (VERCEL_TEAM_ID) {
      importUrl += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    // Make the import request to fetch the ISR blog example
    const importResponse = await fetch(importUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: domainName,
        project: project.id,
        skipInitialBuild: false,
        subfolder: 'examples/cms-wordpress', // This is the subfolder for the WordPress ISR blog example
        envVars: [
          {
            key: 'WORDPRESS_API_URL',
            value: wordpressApiUrl,
            target: ['production', 'preview', 'development']
          }
        ]
      })
    });
    
    const importData = await importResponse.json();
    
    if (!importResponse.ok) {
      deployment.addLog(`Failed to import template: ${JSON.stringify(importData.error)}`, 'error');
      await deployment.save();
      throw new Error(`Vercel API error: ${importData.error?.message || 'Unknown error'}`);
    }
    
    deployment.addLog(`WordPress template imported successfully`, 'info');
    
    // Add the domain to the project
    const domainResult = await addDomainToVercel(domainName, project.id);
    if (!domainResult.success) {
      deployment.addLog(`Warning: Failed to add domain to project: ${JSON.stringify(domainResult.error)}`, 'warning');
    } else {
      deployment.addLog(`Domain ${domainName} added to project`, 'info');
    }
    
    // Update deployment record
    deployment.deploymentId = project.id; // Using project ID since the import doesn't return a specific deployment ID
    deployment.status = 'deployed';
    deployment.completedAt = new Date();
    deployment.addLog(`Deployment triggered successfully. Vercel will now build and deploy your site.`, 'info');
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