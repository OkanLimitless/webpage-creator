import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { DomainDeployment } from '@/lib/models/DomainDeployment';
import { deployDomain, getDeploymentStatus } from '@/lib/vercel';
import mongoose from 'mongoose';

/**
 * Start a new deployment for a domain
 */
export async function startDomainDeployment(domainId: string): Promise<{
  success: boolean;
  message: string;
  deployment?: any;
}> {
  try {
    await connectToDatabase();
    
    // Find the domain
    const domain = await Domain.findById(domainId);
    
    if (!domain) {
      return {
        success: false,
        message: 'Domain not found'
      };
    }
    
    // Check if there's already an active deployment
    if (domain.deploymentStatus === 'deploying') {
      return {
        success: false,
        message: 'Deployment already in progress'
      };
    }
    
    // Update domain status to deploying
    domain.deploymentStatus = 'deploying';
    await domain.save();
    
    // Create a new deployment record
    const deployment = new DomainDeployment({
      domainId: domain._id,
      domainName: domain.name,
      deploymentId: `temp_${Date.now()}`,
      status: 'pending',
      logs: [{
        message: `Starting deployment for ${domain.name}`,
        level: 'info',
      }]
    });
    
    await deployment.save();
    
    // Start the deployment process asynchronously
    processDomainDeployment(domain.name, domain._id, deployment._id)
      .catch(error => {
        console.error(`Error in deployment process for ${domain.name}:`, error);
      });
    
    return {
      success: true,
      message: 'Deployment started',
      deployment: deployment.toObject()
    };
  } catch (error: any) {
    console.error('Error starting domain deployment:', error);
    return {
      success: false,
      message: `Error starting deployment: ${error.message}`
    };
  }
}

/**
 * Internal function to process the deployment
 */
async function processDomainDeployment(
  domainName: string, 
  domainId: mongoose.Types.ObjectId,
  deploymentRecordId: mongoose.Types.ObjectId
): Promise<void> {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting deployment process for ${domainName} (Deployment ID: ${deploymentRecordId})`);
  
  try {
    await connectToDatabase();
    console.log(`[${new Date().toISOString()}] Connected to database (${Date.now() - startTime}ms)`);
    
    // Get the deployment record
    const deploymentRecord = await DomainDeployment.findById(deploymentRecordId);
    if (!deploymentRecord) {
      console.error(`Deployment record ${deploymentRecordId} not found`);
      return;
    }
    console.log(`[${new Date().toISOString()}] Found deployment record (${Date.now() - startTime}ms)`);
    
    // Update the status and add a log
    deploymentRecord.status = 'deploying';
    deploymentRecord.addLog(`Starting Vercel deployment process (timestamp: ${new Date().toISOString()})`, 'info');
    await deploymentRecord.save();
    console.log(`[${new Date().toISOString()}] Updated deployment record status to 'deploying' (${Date.now() - startTime}ms)`);
    
    try {
      // Start the actual deployment
      console.log(`[${new Date().toISOString()}] Calling Vercel deployDomain function for ${domainName}...`);
      const deployStartTime = Date.now();
      const vercelDeployment = await deployDomain(domainName);
      console.log(`[${new Date().toISOString()}] Vercel deployment completed in ${Date.now() - deployStartTime}ms (total: ${Date.now() - startTime}ms)`);
      
      // Update the deployment record with Vercel IDs
      deploymentRecord.deploymentId = vercelDeployment.deploymentId;
      deploymentRecord.vercelProjectId = vercelDeployment.projectId;
      
      // Store both URLs - prefer the custom domain if available
      deploymentRecord.deploymentUrl = vercelDeployment.customDomain || vercelDeployment.deploymentUrl;
      
      // Add logs with more URL information
      deploymentRecord.addLog(`Vercel deployment created (ID: ${vercelDeployment.deploymentId}) in ${Date.now() - deployStartTime}ms`, 'info');
      if (vercelDeployment.vercelUrl) {
        deploymentRecord.addLog(`Vercel URL: ${vercelDeployment.vercelUrl}`, 'info');
      }
      if (vercelDeployment.customDomain) {
        deploymentRecord.addLog(`Custom domain URL: ${vercelDeployment.customDomain}`, 'info');
      }
      
      await deploymentRecord.save();
      console.log(`[${new Date().toISOString()}] Updated deployment record with Vercel IDs (${Date.now() - startTime}ms)`);
      
      // Update the domain with the deployment info
      const domain = await Domain.findById(domainId);
      if (domain) {
        domain.deploymentId = vercelDeployment.deploymentId;
        domain.deploymentUrl = vercelDeployment.customDomain || vercelDeployment.deploymentUrl;
        await domain.save();
        console.log(`[${new Date().toISOString()}] Updated domain with deployment info (${Date.now() - startTime}ms)`);
        
        // NEW: Configure Cloudflare DNS records for Vercel
        if (domain.cloudflareZoneId) {
          console.log(`[${new Date().toISOString()}] Setting up Cloudflare DNS records for Vercel...`);
          deploymentRecord.addLog(`Setting up Cloudflare DNS records for Vercel integration`, 'info');
          
          try {
            // Import the Cloudflare function
            const { createDnsRecord } = await import('@/lib/cloudflare');
            
            // Try to create a CNAME record for the root domain first
            try {
              console.log(`[${new Date().toISOString()}] Creating CNAME record for root domain ${domainName}...`);
              const cnameResult = await createDnsRecord('@', domainName, 'CNAME', 'cname.vercel-dns.com', domain.cloudflareZoneId, false);
              
              if (cnameResult.success) {
                console.log(`[${new Date().toISOString()}] Successfully created CNAME record for root domain`);
                deploymentRecord.addLog(`Created CNAME record for ${domainName} pointing to cname.vercel-dns.com`, 'info');
              } else {
                console.log(`[${new Date().toISOString()}] Failed to create CNAME record, trying A record as fallback...`);
                deploymentRecord.addLog(`Failed to create CNAME record: ${JSON.stringify(cnameResult.errors || 'Unknown error')}`, 'warning');
                
                // If CNAME fails, try an A record (some providers don't allow CNAME at root)
                const aRecordResult = await createDnsRecord('@', domainName, 'A', '76.76.21.21', domain.cloudflareZoneId, false);
                
                if (aRecordResult.success) {
                  console.log(`[${new Date().toISOString()}] Successfully created A record for root domain`);
                  deploymentRecord.addLog(`Created A record for ${domainName} pointing to 76.76.21.21`, 'info');
                } else {
                  console.error(`[${new Date().toISOString()}] Failed to create A record: ${JSON.stringify(aRecordResult.errors || 'Unknown error')}`);
                  deploymentRecord.addLog(`Failed to create A record: ${JSON.stringify(aRecordResult.errors || 'Unknown error')}`, 'error');
                }
              }
            } catch (rootDnsError: any) {
              console.error(`[${new Date().toISOString()}] Error setting up root domain DNS: ${rootDnsError.message}`);
              deploymentRecord.addLog(`Error setting up root domain DNS: ${rootDnsError.message}`, 'error');
            }
            
            // Always create a CNAME record for www subdomain
            try {
              console.log(`[${new Date().toISOString()}] Creating CNAME record for www.${domainName}...`);
              const wwwResult = await createDnsRecord('www', domainName, 'CNAME', 'cname.vercel-dns.com', domain.cloudflareZoneId, false);
              
              if (wwwResult.success) {
                console.log(`[${new Date().toISOString()}] Successfully created CNAME record for www subdomain`);
                deploymentRecord.addLog(`Created CNAME record for www.${domainName} pointing to cname.vercel-dns.com`, 'info');
              } else {
                console.error(`[${new Date().toISOString()}] Failed to create CNAME record for www: ${JSON.stringify(wwwResult.errors || 'Unknown error')}`);
                deploymentRecord.addLog(`Failed to create CNAME record for www: ${JSON.stringify(wwwResult.errors || 'Unknown error')}`, 'warning');
              }
            } catch (wwwDnsError: any) {
              console.error(`[${new Date().toISOString()}] Error setting up www subdomain DNS: ${wwwDnsError.message}`);
              deploymentRecord.addLog(`Error setting up www subdomain DNS: ${wwwDnsError.message}`, 'warning');
            }
            
            await deploymentRecord.save();
            console.log(`[${new Date().toISOString()}] Finished setting up Cloudflare DNS records`);
          } catch (cloudflareError: any) {
            console.error(`[${new Date().toISOString()}] Error importing or using Cloudflare functions: ${cloudflareError.message}`);
            deploymentRecord.addLog(`Failed to set up Cloudflare DNS: ${cloudflareError.message}`, 'error');
            await deploymentRecord.save();
          }
        } else {
          console.warn(`[${new Date().toISOString()}] No Cloudflare Zone ID available for ${domainName}, skipping DNS setup`);
          deploymentRecord.addLog(`No Cloudflare Zone ID available, skipping DNS setup`, 'warning');
          await deploymentRecord.save();
        }
      }
      
      // Monitor the deployment until it's complete
      console.log(`[${new Date().toISOString()}] Starting deployment monitoring for ID: ${vercelDeployment.deploymentId}`);
      const monitorStartTime = Date.now();
      await monitorDeployment(vercelDeployment.deploymentId, deploymentRecordId);
      console.log(`[${new Date().toISOString()}] Monitoring completed in ${Date.now() - monitorStartTime}ms (total: ${Date.now() - startTime}ms)`);
    } catch (error: any) {
      // Handle deployment failure
      const errorTime = Date.now();
      console.error(`[${new Date().toISOString()}] Deployment failed after ${errorTime - startTime}ms:`, error);
      deploymentRecord.status = 'failed';
      deploymentRecord.addLog(`Deployment failed after ${errorTime - startTime}ms: ${error.message}`, 'error', error);
      deploymentRecord.completedAt = new Date();
      await deploymentRecord.save();
      console.log(`[${new Date().toISOString()}] Updated deployment record to failed status (${Date.now() - startTime}ms)`);
      
      // Update the domain status
      const domain = await Domain.findById(domainId);
      if (domain) {
        domain.deploymentStatus = 'failed';
        await domain.save();
        console.log(`[${new Date().toISOString()}] Updated domain status to failed (${Date.now() - startTime}ms)`);
      }
    }
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Error processing deployment for ${domainName} after ${Date.now() - startTime}ms:`, error);
    
    // Try to update records to reflect the error
    try {
      await DomainDeployment.findByIdAndUpdate(deploymentRecordId, {
        $set: {
          status: 'failed',
          completedAt: new Date()
        },
        $push: {
          logs: {
            timestamp: new Date(),
            message: `Unhandled error in deployment process after ${Date.now() - startTime}ms: ${error.message}`,
            level: 'error',
            data: error.toString()
          }
        }
      });
      
      await Domain.findByIdAndUpdate(domainId, {
        $set: { deploymentStatus: 'failed' }
      });
      console.log(`[${new Date().toISOString()}] Updated records after error (${Date.now() - startTime}ms)`);
    } catch (updateError) {
      console.error(`[${new Date().toISOString()}] Error updating deployment records after failure (${Date.now() - startTime}ms):`, updateError);
    }
  }
}

/**
 * Monitor a deployment until it's complete
 */
async function monitorDeployment(
  vercelDeploymentId: string, 
  deploymentRecordId: mongoose.Types.ObjectId
): Promise<void> {
  // Maximum monitoring time - 15 minutes
  const MAX_MONITORING_TIME = 15 * 60 * 1000;
  const startTime = Date.now();
  
  const CHECK_INTERVAL = 10 * 1000; // 10 seconds between checks
  console.log(`[${new Date().toISOString()}] Starting deployment monitoring with ${CHECK_INTERVAL/1000}s interval (max time: ${MAX_MONITORING_TIME/60000} minutes)`);
  
  try {
    let isComplete = false;
    let checkCount = 0;
    
    while (!isComplete && (Date.now() - startTime < MAX_MONITORING_TIME)) {
      checkCount++;
      
      // Wait for the check interval
      console.log(`[${new Date().toISOString()}] Waiting ${CHECK_INTERVAL/1000}s before check #${checkCount}...`);
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
      
      // Get deployment record
      const deploymentRecord = await DomainDeployment.findById(deploymentRecordId);
      if (!deploymentRecord) {
        console.error(`[${new Date().toISOString()}] Deployment record ${deploymentRecordId} not found during monitoring (check #${checkCount})`);
        return;
      }
      
      // Get deployment status from Vercel
      console.log(`[${new Date().toISOString()}] Checking deployment status (check #${checkCount}, elapsed: ${(Date.now() - startTime)/1000}s)`);
      const statusCheckStart = Date.now();
      const deploymentStatus = await getDeploymentStatus(vercelDeploymentId);
      console.log(`[${new Date().toISOString()}] Retrieved deployment status in ${Date.now() - statusCheckStart}ms: ${deploymentStatus.readyState || deploymentStatus.state}`);
      
      // Add log entry with current status
      deploymentRecord.addLog(`Deployment status: ${deploymentStatus.readyState || deploymentStatus.state} (check #${checkCount}, elapsed: ${(Date.now() - startTime)/1000}s)`, 'info');
      
      // Check if the deployment is complete
      if (deploymentStatus.readyState === 'READY') {
        console.log(`[${new Date().toISOString()}] Deployment is READY (total time: ${(Date.now() - startTime)/1000}s)`);
        deploymentRecord.status = 'deployed';
        deploymentRecord.completedAt = new Date();
        await deploymentRecord.save();
        
        // Update the associated domain
        const domain = await Domain.findById(deploymentRecord.domainId);
        if (domain) {
          domain.deploymentStatus = 'deployed';
          domain.lastDeployedAt = new Date();
          await domain.save();
        }
        
        isComplete = true;
      } else if (deploymentStatus.readyState === 'ERROR' || deploymentStatus.readyState === 'CANCELED') {
        console.log(`[${new Date().toISOString()}] Deployment failed with status: ${deploymentStatus.readyState} (total time: ${(Date.now() - startTime)/1000}s)`);
        deploymentRecord.status = 'failed';
        deploymentRecord.completedAt = new Date();
        deploymentRecord.addLog(`Deployment failed with status: ${deploymentStatus.readyState} after ${(Date.now() - startTime)/1000}s`, 'error');
        await deploymentRecord.save();
        
        // Update the associated domain
        const domain = await Domain.findById(deploymentRecord.domainId);
        if (domain) {
          domain.deploymentStatus = 'failed';
          await domain.save();
        }
        
        isComplete = true;
      } else {
        // Still in progress, save the record with updated logs
        await deploymentRecord.save();
      }
    }
    
    // If we exited the loop due to timeout
    if (!isComplete) {
      console.log(`[${new Date().toISOString()}] Deployment monitoring timed out after ${(Date.now() - startTime)/1000}s`);
      const deploymentRecord = await DomainDeployment.findById(deploymentRecordId);
      if (deploymentRecord) {
        deploymentRecord.status = 'failed';
        deploymentRecord.addLog(`Deployment monitoring timed out after ${(Date.now() - startTime)/1000}s`, 'error');
        deploymentRecord.completedAt = new Date();
        await deploymentRecord.save();
        
        // Update the associated domain
        const domain = await Domain.findById(deploymentRecord.domainId);
        if (domain) {
          domain.deploymentStatus = 'failed';
          await domain.save();
        }
      }
    }
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Error monitoring deployment ${vercelDeploymentId} after ${(Date.now() - startTime)/1000}s:`, error);
    
    // Try to update records
    try {
      await DomainDeployment.findByIdAndUpdate(deploymentRecordId, {
        $set: {
          status: 'failed',
          completedAt: new Date()
        },
        $push: {
          logs: {
            timestamp: new Date(),
            message: `Error monitoring deployment after ${(Date.now() - startTime)/1000}s: ${error.message}`,
            level: 'error',
            data: error.toString()
          }
        }
      });
      
      // Get the domain ID from the deployment record
      const deploymentRecord = await DomainDeployment.findById(deploymentRecordId);
      if (deploymentRecord) {
        await Domain.findByIdAndUpdate(deploymentRecord.domainId, {
          $set: { deploymentStatus: 'failed' }
        });
      }
    } catch (updateError) {
      console.error(`[${new Date().toISOString()}] Error updating deployment records after monitoring failure:`, updateError);
    }
  }
}

// Define the log interface to fix the type error
interface DeploymentLog {
  timestamp: Date;
  message: string;
  level: 'info' | 'warning' | 'error';
  data?: any;
}

/**
 * Get deployment status for a domain
 */
export async function getDomainDeploymentStatus(domainId: string): Promise<{
  success: boolean;
  status?: string;
  deploymentId?: string;
  deploymentUrl?: string;
  lastDeployedAt?: Date;
  logs?: Array<any>;
  error?: string;
}> {
  try {
    await connectToDatabase();
    
    const domain = await Domain.findById(domainId);
    if (!domain) {
      return {
        success: false,
        error: 'Domain not found'
      };
    }
    
    // Get the latest deployment
    const latestDeployment = await DomainDeployment.findOne({ 
      domainId: domain._id 
    }).sort({ createdAt: -1 });
    
    if (!latestDeployment) {
      return {
        success: true,
        status: domain.deploymentStatus,
        deploymentId: domain.deploymentId,
        deploymentUrl: domain.deploymentUrl,
        lastDeployedAt: domain.lastDeployedAt,
        logs: []
      };
    }
    
    return {
      success: true,
      status: domain.deploymentStatus,
      deploymentId: domain.deploymentId,
      deploymentUrl: domain.deploymentUrl,
      lastDeployedAt: domain.lastDeployedAt,
      logs: latestDeployment.logs.map((log: {
        timestamp: Date;
        message: string;
        level: 'info' | 'warning' | 'error';
        data?: any;
      }) => ({
        timestamp: log.timestamp,
        message: log.message,
        level: log.level
      }))
    };
  } catch (error: any) {
    console.error('Error getting domain deployment status:', error);
    return {
      success: false,
      error: `Error getting deployment status: ${error.message}`
    };
  }
}

/**
 * Get all deployments for a domain
 */
export async function getDomainDeployments(domainId: string): Promise<{
  success: boolean;
  deployments?: Array<any>;
  error?: string;
}> {
  try {
    await connectToDatabase();
    
    const domain = await Domain.findById(domainId);
    if (!domain) {
      return {
        success: false,
        error: 'Domain not found'
      };
    }
    
    const deployments = await DomainDeployment.find({ 
      domainId: domain._id 
    }).sort({ createdAt: -1 });
    
    return {
      success: true,
      deployments: deployments.map((deployment: any) => ({
        id: deployment._id,
        deploymentId: deployment.deploymentId,
        status: deployment.status,
        startedAt: deployment.startedAt,
        completedAt: deployment.completedAt,
        lastLogMessage: deployment.logs.length > 0 
          ? deployment.logs[deployment.logs.length - 1].message 
          : 'No logs'
      }))
    };
  } catch (error: any) {
    console.error('Error getting domain deployments:', error);
    return {
      success: false,
      error: `Error getting deployments: ${error.message}`
    };
  }
} 