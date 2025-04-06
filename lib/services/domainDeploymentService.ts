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
  try {
    await connectToDatabase();
    
    // Get the deployment record
    const deploymentRecord = await DomainDeployment.findById(deploymentRecordId);
    if (!deploymentRecord) {
      console.error(`Deployment record ${deploymentRecordId} not found`);
      return;
    }
    
    // Update the status and add a log
    deploymentRecord.status = 'deploying';
    deploymentRecord.addLog('Starting Vercel deployment process', 'info');
    await deploymentRecord.save();
    
    try {
      // Start the actual deployment
      const vercelDeployment = await deployDomain(domainName);
      
      // Update the deployment record with Vercel IDs
      deploymentRecord.deploymentId = vercelDeployment.deploymentId;
      deploymentRecord.vercelProjectId = vercelDeployment.projectId;
      deploymentRecord.deploymentUrl = vercelDeployment.deploymentUrl;
      deploymentRecord.addLog(`Vercel deployment created (ID: ${vercelDeployment.deploymentId})`, 'info');
      await deploymentRecord.save();
      
      // Update the domain with the deployment info
      const domain = await Domain.findById(domainId);
      if (domain) {
        domain.deploymentId = vercelDeployment.deploymentId;
        domain.deploymentUrl = vercelDeployment.deploymentUrl;
        await domain.save();
      }
      
      // Monitor the deployment until it's complete
      await monitorDeployment(vercelDeployment.deploymentId, deploymentRecordId);
    } catch (error: any) {
      // Handle deployment failure
      deploymentRecord.status = 'failed';
      deploymentRecord.addLog(`Deployment failed: ${error.message}`, 'error', error);
      deploymentRecord.completedAt = new Date();
      await deploymentRecord.save();
      
      // Update the domain status
      const domain = await Domain.findById(domainId);
      if (domain) {
        domain.deploymentStatus = 'failed';
        await domain.save();
      }
    }
  } catch (error: any) {
    console.error(`Error processing deployment for ${domainName}:`, error);
    
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
            message: `Unhandled error in deployment process: ${error.message}`,
            level: 'error',
            data: error.toString()
          }
        }
      });
      
      await Domain.findByIdAndUpdate(domainId, {
        $set: { deploymentStatus: 'failed' }
      });
    } catch (updateError) {
      console.error('Error updating deployment records after failure:', updateError);
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
  
  try {
    let isComplete = false;
    
    while (!isComplete && (Date.now() - startTime < MAX_MONITORING_TIME)) {
      // Wait for the check interval
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
      
      // Get deployment record
      const deploymentRecord = await DomainDeployment.findById(deploymentRecordId);
      if (!deploymentRecord) {
        console.error(`Deployment record ${deploymentRecordId} not found during monitoring`);
        return;
      }
      
      // Get deployment status from Vercel
      const deploymentStatus = await getDeploymentStatus(vercelDeploymentId);
      
      // Add log entry with current status
      deploymentRecord.addLog(`Deployment status: ${deploymentStatus.readyState || deploymentStatus.state}`, 'info');
      
      // Check if the deployment is complete
      if (deploymentStatus.readyState === 'READY') {
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
        deploymentRecord.status = 'failed';
        deploymentRecord.completedAt = new Date();
        deploymentRecord.addLog(`Deployment failed with status: ${deploymentStatus.readyState}`, 'error');
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
      const deploymentRecord = await DomainDeployment.findById(deploymentRecordId);
      if (deploymentRecord) {
        deploymentRecord.status = 'failed';
        deploymentRecord.addLog('Deployment monitoring timed out', 'error');
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
    console.error(`Error monitoring deployment ${vercelDeploymentId}:`, error);
    
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
            message: `Error monitoring deployment: ${error.message}`,
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
      console.error('Error updating deployment records after monitoring failure:', updateError);
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