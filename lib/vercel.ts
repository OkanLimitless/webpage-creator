// Vercel API integration for domain management

import fetch from 'node-fetch';

interface VercelResponse {
  error?: {
    code: string;
    message: string;
    projectId?: string;
    domain?: any;
  };
  [key: string]: any;
}

interface AddDomainResponse extends VercelResponse {
  name?: string;
  verified?: boolean;
  verification?: Array<{
    type: string;
    domain: string;
    value: string;
    reason: string;
  }>;
}

interface CreateProjectResponse extends VercelResponse {
  id?: string;
  name?: string;
  accountId?: string;
  createdAt?: string;
}

interface DeploymentResponse extends VercelResponse {
  id?: string;
  url?: string;
  createdAt?: string;
  readyState?: 'READY' | 'ERROR' | 'BUILDING' | 'INITIALIZING' | 'QUEUED' | 'CANCELED';
  state?: 'READY' | 'ERROR' | 'BUILDING' | 'INITIALIZING' | 'QUEUED' | 'CANCELED';
}

// Get Vercel credentials
const VERCEL_TOKEN = process.env.VERCEL_TOKEN || '';
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || '';
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID || '';

// Flag to check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development';

// Validate Vercel credentials
if (!process.env.VERCEL_TOKEN || !process.env.VERCEL_PROJECT_ID) {
  if (!isDevelopment) {
    console.warn('Vercel API token or project ID is missing. Domain functionality with Vercel will be limited.');
  }
}

/**
 * Add a domain to Vercel project and get DNS configuration requirements
 * @param domainName The domain name to add
 * @param projectId Optional project ID to add the domain to (uses VERCEL_PROJECT_ID from env if not provided)
 * @returns Response from Vercel API including required DNS records
 */
export async function addDomainToVercel(domainName: string, projectId?: string): Promise<any> {
  try {
    const targetProjectId = projectId || VERCEL_PROJECT_ID;
    console.log(`Adding domain ${domainName} to Vercel project ${targetProjectId}...`);
    
    // In development with missing credentials, return mock success
    if (isDevelopment && (!process.env.VERCEL_TOKEN || (!targetProjectId && !process.env.VERCEL_PROJECT_ID))) {
      console.log('Using mock Vercel domain addition in development mode');
      return {
        success: true,
        domainName,
        message: 'Domain added to Vercel (mock)',
        configurationDnsRecords: [
          {
            name: domainName.includes('.') ? domainName.split('.')[0] : '@', // @ for root, subdomain name otherwise
            type: 'CNAME',
            value: 'cname.vercel-dns.com'
          }
        ]
      };
    }
    
    // Prepare API endpoint
    let url = `https://api.vercel.com/v9/projects/${targetProjectId}/domains`;
    
    // Add team ID if available
    if (VERCEL_TEAM_ID) {
      url += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    // Make API request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: domainName })
    });
    
    const data: AddDomainResponse = await response.json();
    console.log(`Vercel domain addition response:`, JSON.stringify(data));
    
    // Handle domain_already_in_use error as a success case if it's the same project
    if (!response.ok) {
      if (data.error && data.error.code === 'domain_already_in_use') {
        // Check if domain is already in use by the target project
        if (data.error.projectId === targetProjectId) {
          console.log(`Domain ${domainName} is already in use by this project (${targetProjectId}), treating as a success case`);
          return {
            success: true,
            domainName,
            alreadyConfigured: true,
            vercelDomain: data.error.domain || {},
            configurationDnsRecords: [
              {
                name: domainName.includes('.') ? domainName.split('.')[0] : '@',
                type: 'CNAME',
                value: 'cname.vercel-dns.com'
              }
            ],
            message: `Domain ${domainName} is already registered with this project`
          };
        } else {
          // Domain is in use by a different project
          console.log(`Domain ${domainName} is already in use by project ${data.error.projectId}, cannot add to project ${targetProjectId}`);
          return {
            success: false,
            domainName,
            error: {
              code: 'domain_already_in_use_by_different_project',
              message: `Domain ${domainName} is already in use by another project (${data.error.projectId})`,
              projectId: data.error.projectId
            },
            configurationDnsRecords: []
          };
        }
      }
      
      throw new Error(`Failed to add domain to Vercel: ${JSON.stringify(data)}`);
    }
    
    // Get the verification records if available
    let configurationRecords: Array<{name: string; type: string; value: string;}> = [];
    if (data.verification && Array.isArray(data.verification)) {
      configurationRecords = data.verification.map((record: any) => ({
        name: record.domain.split('.')[0] === domainName ? '@' : record.domain.split('.')[0],
        type: record.type,
        value: record.value
      }));
    }
    
    return {
      success: true,
      domainName,
      vercelDomain: data,
      configurationDnsRecords: configurationRecords.length > 0 ? configurationRecords : [
        {
          name: domainName.includes('.') ? domainName.split('.')[0] : '@',
          type: 'CNAME',
          value: 'cname.vercel-dns.com'
        }
      ],
      message: 'Domain added to Vercel successfully. Check the configurationDnsRecords for required DNS settings.'
    };
  } catch (error) {
    console.error(`Error adding domain ${domainName} to Vercel:`, error);
    throw error;
  }
}

/**
 * Verify domain in Vercel project
 * @param domainName The domain name to verify
 * @returns Response from Vercel API
 */
export async function verifyDomainInVercel(domainName: string) {
  try {
    console.log(`Verifying domain ${domainName} in Vercel...`);
    
    // In development with missing credentials, return mock success
    if (isDevelopment && (!process.env.VERCEL_TOKEN || !process.env.VERCEL_PROJECT_ID)) {
      console.log('Using mock Vercel domain verification in development mode');
      return {
        success: true,
        domainName,
        verification: {
          status: 'VALID'
        }
      };
    }
    
    // Prepare API endpoint
    let url = `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains/${domainName}/verify`;
    
    // Add team ID if available
    if (VERCEL_TEAM_ID) {
      url += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    // Make API request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log(`Vercel domain verification response:`, JSON.stringify(data));
    
    return {
      success: response.ok,
      domainName,
      verification: data,
      message: response.ok ? 'Domain verification initiated in Vercel' : `Verification issue: ${JSON.stringify(data)}`
    };
  } catch (error) {
    console.error(`Error verifying domain ${domainName} in Vercel:`, error);
    throw error;
  }
}

/**
 * Delete a domain from Vercel project
 * @param domainName The domain name to delete
 * @returns Response from Vercel API
 */
export async function deleteDomainFromVercel(domainName: string) {
  try {
    console.log(`Deleting domain ${domainName} from Vercel project...`);
    
    // In development with missing credentials, return mock success
    if (isDevelopment && (!process.env.VERCEL_TOKEN || !process.env.VERCEL_PROJECT_ID)) {
      console.log('Using mock Vercel domain deletion in development mode');
      return {
        success: true,
        domainName,
        message: 'Domain deleted from Vercel (mock)'
      };
    }
    
    // Prepare API endpoint
    let url = `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains/${domainName}`;
    
    // Add team ID if available
    if (VERCEL_TEAM_ID) {
      url += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    // Make API request
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 204) {
      // Success, no content
      return {
        success: true,
        domainName,
        message: 'Domain deleted from Vercel successfully'
      };
    }
    
    const data = await response.json();
    console.log(`Vercel domain deletion response:`, JSON.stringify(data));
    
    return {
      success: false,
      domainName,
      error: data,
      message: `Failed to delete domain from Vercel: ${JSON.stringify(data)}`
    };
  } catch (error) {
    console.error(`Error deleting domain ${domainName} from Vercel:`, error);
    throw error;
  }
}

/**
 * Check if a domain exists in Vercel project
 * @param domainName The domain name to check
 * @returns Status of the domain in Vercel
 */
export async function checkDomainInVercel(domainName: string) {
  try {
    console.log(`Checking if domain ${domainName} exists in Vercel project...`);
    
    // In development with missing credentials, return mock success
    if (isDevelopment && (!process.env.VERCEL_TOKEN || !process.env.VERCEL_PROJECT_ID)) {
      console.log('Using mock Vercel domain check in development mode');
      return {
        exists: true,
        configured: true,
        domainName,
        message: 'Domain exists in Vercel (mock)'
      };
    }
    
    // Prepare API endpoint
    let url = `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains/${domainName}`;
    
    // Add team ID if available
    if (VERCEL_TEAM_ID) {
      url += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    // Make API request
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    // If 404, domain doesn't exist
    if (response.status === 404) {
      return {
        exists: false,
        configured: false,
        domainName,
        message: `Domain ${domainName} is not configured in Vercel`
      };
    }
    
    const data = await response.json();
    console.log(`Vercel domain check response:`, JSON.stringify(data));
    
    return {
      exists: true,
      configured: data.verified === true,
      domainName,
      vercelDomain: data,
      message: data.verified 
        ? `Domain ${domainName} is properly configured in Vercel` 
        : `Domain ${domainName} exists in Vercel but is not verified`
    };
  } catch (error) {
    console.error(`Error checking domain ${domainName} in Vercel:`, error);
    return {
      exists: false,
      configured: false,
      domainName,
      error,
      message: `Error checking domain in Vercel: ${error}`
    };
  }
}

/**
 * Add both a domain and its subdomain to Vercel
 * @param domain The main domain
 * @param subdomain The subdomain part
 * @returns Results of both operations
 */
export async function addDomainAndSubdomainToVercel(domain: string, subdomain: string) {
  try {
    console.log(`Adding domain ${domain} and subdomain ${subdomain}.${domain} to Vercel...`);
    
    // In development with missing credentials, return mock success
    if (isDevelopment && (!process.env.VERCEL_TOKEN || !process.env.VERCEL_PROJECT_ID)) {
      console.log('Using mock Vercel domain addition in development mode');
      return {
        success: true,
        domain: {
          name: domain,
          status: 'added',
          configurationDnsRecords: [
            {
              name: '@',
              type: 'CNAME',
              value: 'cname.vercel-dns.com'
            }
          ]
        },
        subdomain: {
          name: `${subdomain}.${domain}`,
          status: 'added',
          configurationDnsRecords: [
            {
              name: subdomain,
              type: 'CNAME',
              value: 'cname.vercel-dns.com'
            }
          ]
        },
        message: 'Domain and subdomain added to Vercel (mock)'
      };
    }
    
    // First check if the domain already exists in Vercel
    let domainAlreadyInUse = false;
    try {
      const domainCheck = await checkDomainInVercel(domain);
      domainAlreadyInUse = domainCheck.exists;
      console.log(`Domain ${domain} exists check: ${domainAlreadyInUse}`);
    } catch (error: any) {
      console.warn(`Error checking if domain ${domain} exists, will try to add it:`, error);
    }
    
    // Add main domain first (or use existing if already configured)
    let domainResult;
    try {
      domainResult = await addDomainToVercel(domain);
      console.log(`Main domain ${domain} added to Vercel or already exists`);
    } catch (error: any) {
      console.warn(`Could not add main domain ${domain} to Vercel:`, error);
      
      // For domain_already_in_use errors with our project, treat as success
      let errorData = null;
      try {
        if (error.message && error.message.includes('{"error":')) {
          errorData = JSON.parse(error.message.substring(error.message.indexOf('{')));
        }
      } catch (parseError) {
        // Ignore parsing errors
      }
      
      // If domain already in use by our project, treat as success
      if (errorData && errorData.error && 
          errorData.error.code === 'domain_already_in_use' && 
          errorData.error.projectId === VERCEL_PROJECT_ID) {
        console.log(`Domain ${domain} is already in use by this project, continuing with subdomain setup`);
        domainResult = { 
          success: true, 
          alreadyConfigured: true,
          domainName: domain,
          vercelDomain: errorData.error.domain || {},
          configurationDnsRecords: [
            {
              name: '@',
              type: 'CNAME',
              value: 'cname.vercel-dns.com'
            }
          ]
        };
      } else {
        domainResult = { 
          success: false, 
          error,
          configurationDnsRecords: [
            {
              name: '@',
              type: 'CNAME',
              value: 'cname.vercel-dns.com'
            }
          ]
        };
      }
    }
    
    // Then add subdomain
    const fullSubdomain = `${subdomain}.${domain}`;
    let subdomainResult;
    try {
      subdomainResult = await addDomainToVercel(fullSubdomain);
      console.log(`Subdomain ${fullSubdomain} added to Vercel`);
    } catch (error: any) {
      console.warn(`Could not add subdomain ${fullSubdomain} to Vercel:`, error);
      
      // For domain_already_in_use errors with our project, treat as success
      let errorData = null;
      try {
        if (error.message && error.message.includes('{"error":')) {
          errorData = JSON.parse(error.message.substring(error.message.indexOf('{')));
        }
      } catch (parseError) {
        // Ignore parsing errors
      }
      
      // If subdomain already in use by our project, treat as success
      if (errorData && errorData.error && 
          errorData.error.code === 'domain_already_in_use' && 
          errorData.error.projectId === VERCEL_PROJECT_ID) {
        console.log(`Subdomain ${fullSubdomain} is already in use by this project, continuing with setup`);
        subdomainResult = { 
          success: true, 
          alreadyConfigured: true,
          domainName: fullSubdomain,
          vercelDomain: errorData.error.domain || {},
          configurationDnsRecords: [
            {
              name: subdomain,
              type: 'CNAME',
              value: 'cname.vercel-dns.com'
            }
          ]
        };
      } else {
        subdomainResult = { 
          success: false, 
          error,
          configurationDnsRecords: [
            {
              name: subdomain,
              type: 'CNAME',
              value: 'cname.vercel-dns.com'
            }
          ]
        };
      }
    }
    
    return {
      success: domainResult.success || subdomainResult.success,
      domain: domainResult,
      subdomain: subdomainResult,
      message: `Domain ${domain} and subdomain ${fullSubdomain} registration with Vercel attempted`,
      dnsRecords: {
        domain: domainResult.configurationDnsRecords || [],
        subdomain: subdomainResult.configurationDnsRecords || []
      }
    };
  } catch (error) {
    console.error(`Error adding domain and subdomain to Vercel:`, error);
    throw error;
  }
}

/**
 * Create a new project in Vercel for a domain
 */
export async function createVercelProject(domainName: string, framework: string = 'nextjs'): Promise<CreateProjectResponse> {
  try {
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    if (!VERCEL_TOKEN) {
      throw new Error('Vercel API token not set');
    }
    
    // Generate a project name based on the domain
    const projectName = `domain-${domainName.replace(/\./g, '-')}`;
    
    // Construct the API URL
    let apiUrl = 'https://api.vercel.com/v9/projects';
    if (VERCEL_TEAM_ID) {
      apiUrl += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    // Make the API request to create the project
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: projectName,
        framework,
        environmentVariables: [
          { 
            key: 'DOMAIN_NAME', 
            value: domainName, 
            type: 'plain',
            target: ['production', 'preview', 'development'] 
          }
        ]
      })
    });
    
    const data: CreateProjectResponse = await response.json();
    
    if (!response.ok) {
      // If project already exists with the same name, try to return that project
      if (data.error?.code === 'project_name_already_exists') {
        console.log(`Project with name ${projectName} already exists, trying to find it...`);
        // We would need to fetch existing projects and find the matching one
        // For now, throwing the error but this could be enhanced
        throw new Error(`Project already exists: ${data.error.message || 'Unknown error'}`);
      }
      
      throw new Error(`Failed to create Vercel project: ${data.error?.message || 'Unknown error'}`);
    }
    
    // Project was successfully created, now add the domain to it
    console.log(`Project created with ID ${data.id}, now adding domain ${domainName} to it`);
    try {
      await addDomainToProject(data.id!, domainName);
      console.log(`Domain ${domainName} successfully added to project ${data.id}`);
    } catch (domainError: any) {
      console.warn(`Warning: Failed to add domain to project: ${domainError.message}`);
      // Continue anyway as we have the project
    }
    
    return data;
  } catch (error: any) {
    console.error('Error creating Vercel project:', error);
    throw error;
  }
}

/**
 * Add a domain to a specific Vercel project
 */
async function addDomainToProject(projectId: string, domainName: string): Promise<AddDomainResponse> {
  try {
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    if (!VERCEL_TOKEN) {
      throw new Error('Vercel API token not set');
    }
    
    // Construct the API URL
    let apiUrl = `https://api.vercel.com/v9/projects/${projectId}/domains`;
    if (VERCEL_TEAM_ID) {
      apiUrl += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    // Make the API request
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: domainName })
    });
    
    const data: AddDomainResponse = await response.json();
    
    if (!response.ok && data.error?.code !== 'domain_already_exists') {
      throw new Error(`Failed to add domain to project: ${data.error?.message || 'Unknown error'}`);
    }
    
    return data;
  } catch (error: any) {
    console.error('Error adding domain to project:', error);
    throw error;
  }
}

/**
 * Create a new deployment for a project
 */
export async function createDeployment(projectId: string, domainName: string): Promise<DeploymentResponse> {
  try {
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    if (!VERCEL_TOKEN) {
      throw new Error('Vercel API token not set');
    }
    
    // Construct the API URL
    let apiUrl = `https://api.vercel.com/v13/deployments`;
    if (VERCEL_TEAM_ID) {
      apiUrl += `?teamId=${VERCEL_TEAM_ID}&projectId=${projectId}`;
    } else {
      apiUrl += `?projectId=${projectId}`;
    }
    
    // Create a template deployment configuration
    const deploymentConfig = {
      name: domainName,
      target: 'production',
      source: 'cli',
      files: [
        {
          file: 'package.json',
          data: JSON.stringify({
            name: `domain-${domainName.replace(/\./g, '-')}`,
            version: '1.0.0',
            private: true,
            scripts: {
              dev: 'next dev',
              build: 'next build',
              start: 'next start'
            },
            dependencies: {
              next: '^13.4.0',
              react: '^18.2.0',
              'react-dom': '^18.2.0',
              mongoose: '^7.0.0'
            }
          }),
          encoding: 'utf-8'
        },
        {
          file: 'next.config.js',
          data: `// Default URL if environment variable is not set
const mainAppUrl = process.env.MAIN_APP_URL || 'https://yourfavystore.com';

module.exports = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/:path*',
        destination: \`\${mainAppUrl}/:path*\`
      }
    ];
  }
}`,
          encoding: 'utf-8'
        },
        {
          file: 'pages/index.js',
          data: `export default function Home() {
  return <div>Loading ${domainName} content...</div>;
}

export async function getServerSideProps() {
  // Default URL if environment variable is not set
  const mainAppUrl = process.env.MAIN_APP_URL || 'https://yourfavystore.com';
  
  return {
    redirect: {
      destination: \`\${mainAppUrl}/\`,
      permanent: false,
    }
  };
}`,
          encoding: 'utf-8'
        }
      ],
      projectSettings: {
        framework: 'nextjs',
        devCommand: 'next dev',
        buildCommand: 'next build',
        outputDirectory: '.next'
      },
      env: {
        DOMAIN_NAME: domainName,
        MAIN_APP_URL: 'https://yourfavystore.com'
      }
    };
    
    // Make the API request
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(deploymentConfig)
    });
    
    const data: DeploymentResponse = await response.json();
    
    if (!response.ok) {
      throw new Error(`Failed to create deployment: ${data.error?.message || 'Unknown error'}`);
    }
    
    return data;
  } catch (error: any) {
    console.error('Error creating deployment:', error);
    throw error;
  }
}

/**
 * Check the status of a deployment
 */
export async function getDeploymentStatus(deploymentId: string): Promise<DeploymentResponse> {
  try {
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    if (!VERCEL_TOKEN) {
      throw new Error('Vercel API token not set');
    }
    
    // Construct the API URL
    let apiUrl = `https://api.vercel.com/v13/deployments/${deploymentId}`;
    if (VERCEL_TEAM_ID) {
      apiUrl += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    // Make the API request
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data: DeploymentResponse = await response.json();
    
    if (!response.ok) {
      throw new Error(`Failed to get deployment status: ${data.error?.message || 'Unknown error'}`);
    }
    
    return data;
  } catch (error: any) {
    console.error('Error getting deployment status:', error);
    throw error;
  }
}

/**
 * Get all domains for a project
 */
export async function getProjectDomains(projectId: string): Promise<any[]> {
  try {
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    if (!VERCEL_TOKEN) {
      throw new Error('Vercel API token not set');
    }
    
    // Construct the API URL
    let apiUrl = `https://api.vercel.com/v9/projects/${projectId}/domains`;
    if (VERCEL_TEAM_ID) {
      apiUrl += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    // Make the API request
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Failed to get project domains: ${data.error?.message || 'Unknown error'}`);
    }
    
    return data.domains || [];
  } catch (error: any) {
    console.error('Error getting project domains:', error);
    throw error;
  }
}

/**
 * Set a custom alias (domain) for a deployment
 */
async function setDeploymentAlias(deploymentId: string, alias: string): Promise<any> {
  try {
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    if (!VERCEL_TOKEN) {
      throw new Error('Vercel API token not set');
    }
    
    // Construct the API URL
    let apiUrl = `https://api.vercel.com/v2/deployments/${deploymentId}/aliases`;
    if (VERCEL_TEAM_ID) {
      apiUrl += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    // Make the API request
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ alias })
    });
    
    const data = await response.json();
    console.log(`Vercel alias assignment response:`, JSON.stringify(data));
    
    return data;
  } catch (error: any) {
    console.error(`Error setting deployment alias to ${alias}:`, error);
    throw error;
  }
}

/**
 * Main function to handle domain deployment
 */
export async function deployDomain(domainName: string): Promise<{
  projectId: string;
  deploymentId: string;
  deploymentUrl?: string;
  customDomain?: string;
  vercelUrl?: string;
  status: string;
}> {
  try {
    console.log(`Starting deployment process for domain: ${domainName}`);
    
    // 1. Create a project for the domain if it doesn't exist
    const project = await createVercelProject(domainName);
    console.log(`Project created/found with ID: ${project.id}`);
    
    // 2. Try to add the domain to the project explicitly
    // Note: We already add the domain to the project in createVercelProject,
    // but we'll try again here to ensure it's properly configured and to handle any errors
    try {
      console.log(`Ensuring domain ${domainName} is added to project ${project.id}`);
      const domainAddResult = await addDomainToVercel(domainName, project.id);
      
      // If domain is already in use by a different project, we need to handle that
      if (!domainAddResult.success && 
          domainAddResult.error && 
          domainAddResult.error.code === 'domain_already_in_use_by_different_project') {
        console.warn(`Cannot deploy domain ${domainName} because it's already in use by project ${domainAddResult.error.projectId}`);
        throw new Error(`Cannot add domain to project: ${domainName} is already in use by project ${domainAddResult.error.projectId}`);
      }
    } catch (domainError: any) {
      // If we can't add the domain to the project, log and continue - we might still be able to deploy
      console.warn(`Error adding domain to project, continuing with deployment: ${domainError.message}`);
    }
    
    // 3. Create a deployment for the project
    const deployment = await createDeployment(project.id!, domainName);
    console.log(`Deployment created with ID: ${deployment.id}`);
    
    // Wait a moment for deployment to initialize
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 4. Check deployment status to ensure it's ready
    let deploymentStatus;
    try {
      deploymentStatus = await getDeploymentStatus(deployment.id!);
      console.log(`Deployment status: ${deploymentStatus.readyState}`);
    } catch (statusError) {
      console.error('Error checking deployment status:', statusError);
    }
    
    // 5. Set the custom domain as an alias for the deployment
    try {
      console.log(`Setting alias ${domainName} for deployment ${deployment.id}`);
      await setDeploymentAlias(deployment.id!, domainName);
      console.log(`Alias set successfully for ${domainName}`);
    } catch (aliasError) {
      console.error('Error setting deployment alias:', aliasError);
      // Continue anyway as the domain might be set up through the earlier process
    }
    
    // Generate URLs for both the Vercel deployment and the custom domain
    const vercelUrl = deployment.url ? `https://${deployment.url}` : undefined;
    const customDomain = `https://${domainName}`;
    
    return {
      projectId: project.id!,
      deploymentId: deployment.id!,
      deploymentUrl: customDomain, // Primary URL to use
      customDomain: customDomain,  // Explicit custom domain URL
      vercelUrl: vercelUrl,        // Fallback Vercel URL
      status: deploymentStatus?.readyState || deployment.readyState || 'INITIALIZING'
    };
  } catch (error: any) {
    console.error('Error deploying domain:', error);
    throw error;
  }
} 