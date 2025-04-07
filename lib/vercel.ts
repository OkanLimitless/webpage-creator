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

export interface DeploymentResponse extends VercelResponse {
  id: string;
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
  const startTime = Date.now();
  try {
    const targetProjectId = projectId || VERCEL_PROJECT_ID;
    console.log(`[${new Date().toISOString()}] addDomainToVercel: Adding domain ${domainName} to Vercel project ${targetProjectId}...`);
    
    // In development with missing credentials, return mock success
    if (isDevelopment && (!process.env.VERCEL_TOKEN || (!targetProjectId && !process.env.VERCEL_PROJECT_ID))) {
      console.log('[${new Date().toISOString()}] Using mock Vercel domain addition in development mode');
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
    console.log(`[${new Date().toISOString()}] addDomainToVercel: Making API request to add domain...`);
    const apiStartTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: domainName })
    });
    console.log(`[${new Date().toISOString()}] addDomainToVercel: API request completed in ${Date.now() - apiStartTime}ms`);
    
    const data: AddDomainResponse = await response.json();
    console.log(`[${new Date().toISOString()}] addDomainToVercel: Vercel domain addition response (completed in ${Date.now() - startTime}ms):`, JSON.stringify(data));
    
    // Handle domain_already_in_use error as a success case if it's the same project
    if (!response.ok) {
      if (data.error && data.error.code === 'domain_already_in_use') {
        // Check if domain is already in use by the target project
        if (data.error.projectId === targetProjectId) {
          console.log(`[${new Date().toISOString()}] addDomainToVercel: Domain ${domainName} is already in use by this project (${targetProjectId}), treating as a success case (took ${Date.now() - startTime}ms)`);
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
          console.log(`[${new Date().toISOString()}] addDomainToVercel: Domain ${domainName} is already in use by project ${data.error.projectId}, cannot add to project ${targetProjectId} (took ${Date.now() - startTime}ms)`);
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
    
    console.log(`[${new Date().toISOString()}] addDomainToVercel: Domain added successfully (took ${Date.now() - startTime}ms)`);
    
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
    console.error(`[${new Date().toISOString()}] addDomainToVercel: Error adding domain ${domainName} to Vercel (took ${Date.now() - startTime}ms):`, error);
    throw error;
  }
}

/**
 * Verify domain in Vercel project
 * @param domainName The domain name to verify
 * @param projectId Optional project ID (uses VERCEL_PROJECT_ID from env if not provided)
 * @returns Response from Vercel API
 */
export async function verifyDomainInVercel(domainName: string, projectId?: string) {
  try {
    const targetProjectId = projectId || VERCEL_PROJECT_ID;
    console.log(`Verifying domain ${domainName} in Vercel project ${targetProjectId}...`);
    
    // In development with missing credentials, return mock success
    if (isDevelopment && (!process.env.VERCEL_TOKEN || (!targetProjectId && !process.env.VERCEL_PROJECT_ID))) {
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
    let url = `https://api.vercel.com/v9/projects/${targetProjectId}/domains/${domainName}/verify`;
    
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
  const startTime = Date.now();
  try {
    console.log(`[${new Date().toISOString()}] createVercelProject: Starting project creation for ${domainName}...`);
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    if (!VERCEL_TOKEN) {
      throw new Error('Vercel API token not set');
    }
    
    // Use direct domain name as the project name to align with Vercel's behavior
    const projectName = domainName;
    console.log(`[${new Date().toISOString()}] createVercelProject: Using direct domain name as project name: ${projectName}`);
    
    // First, check if the domain is already attached to any project
    console.log(`[${new Date().toISOString()}] createVercelProject: Checking if domain ${domainName} is already attached to a project...`);
    try {
      const existingProject = await findProjectByDomain(domainName);
      if (existingProject && existingProject.id) {
        console.log(`[${new Date().toISOString()}] createVercelProject: Domain ${domainName} is already attached to project ${existingProject.id} (${existingProject.name})`);
        return existingProject;
      }
    } catch (error) {
      console.warn(`[${new Date().toISOString()}] createVercelProject: Error checking for existing projects with domain ${domainName}:`, error);
      // Continue with project creation
    }
    
    // Second, check if a project with the direct domain name already exists
    console.log(`[${new Date().toISOString()}] createVercelProject: Checking if project with name ${projectName} already exists...`);
    try {
      const existingProject = await findProjectByName(projectName);
      if (existingProject && existingProject.id) {
        console.log(`[${new Date().toISOString()}] createVercelProject: Project with name ${projectName} already exists (ID: ${existingProject.id})`);
        
        // Ensure the domain is attached to this project
        try {
          console.log(`[${new Date().toISOString()}] createVercelProject: Ensuring domain ${domainName} is attached to existing project ${existingProject.id}...`);
          await addDomainToProject(existingProject.id, domainName);
          console.log(`[${new Date().toISOString()}] createVercelProject: Domain attachment confirmed for ${existingProject.id}`);
        } catch (domainError: any) {
          console.warn(`[${new Date().toISOString()}] createVercelProject: Failed to attach domain to existing project: ${domainError.message}`);
          // Continue anyway, as we'll try again later
        }
        
        return existingProject;
      }
    } catch (error) {
      console.warn(`[${new Date().toISOString()}] createVercelProject: Error checking for existing project with name ${projectName}:`, error);
      // Continue with project creation
    }
    
    // For backwards compatibility, also check if a project with our old standard naming exists
    const standardProjectName = `domain-${domainName.replace(/\./g, '-')}`;
    console.log(`[${new Date().toISOString()}] createVercelProject: Checking if project with standard name ${standardProjectName} exists...`);
    try {
      const standardProject = await findProjectByName(standardProjectName);
      if (standardProject && standardProject.id) {
        console.log(`[${new Date().toISOString()}] createVercelProject: Project with standard name ${standardProjectName} exists (ID: ${standardProject.id})`);
        
        // Ensure the domain is attached to this project
        try {
          console.log(`[${new Date().toISOString()}] createVercelProject: Ensuring domain ${domainName} is attached to standard-named project ${standardProject.id}...`);
          await addDomainToProject(standardProject.id, domainName);
          console.log(`[${new Date().toISOString()}] createVercelProject: Domain attachment confirmed for ${standardProject.id}`);
        } catch (domainError: any) {
          console.warn(`[${new Date().toISOString()}] createVercelProject: Failed to attach domain to standard project: ${domainError.message}`);
        }
        
        return standardProject;
      }
    } catch (error) {
      console.warn(`[${new Date().toISOString()}] createVercelProject: Error checking for standard-named project:`, error);
    }
    
    // If we reach here, we need to create a new project with the direct domain name
    console.log(`[${new Date().toISOString()}] createVercelProject: Creating new project ${projectName} for domain ${domainName}...`);
    
    // Construct the API URL
    let apiUrl = 'https://api.vercel.com/v9/projects';
    if (VERCEL_TEAM_ID) {
      apiUrl += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    // Make the API request to create the project
    console.log(`[${new Date().toISOString()}] createVercelProject: Making API request to create project...`);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: projectName, // Use direct domain name instead of standardized name
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
        console.log(`[${new Date().toISOString()}] createVercelProject: Project with name ${projectName} already exists during creation, trying to find it...`);
        try {
          const existingProject = await findProjectByName(projectName);
          if (existingProject && existingProject.id) {
            console.log(`[${new Date().toISOString()}] createVercelProject: Found existing project: ${existingProject.id}`);
            return existingProject;
          }
        } catch (findError) {
          console.warn(`[${new Date().toISOString()}] createVercelProject: Error finding existing project after creation failure:`, findError);
        }
      }
      
      throw new Error(`Failed to create Vercel project: ${data.error?.message || 'Unknown error'}`);
    }
    
    // Project was successfully created, now add the domain to it
    console.log(`[${new Date().toISOString()}] createVercelProject: Project created with ID ${data.id}, now adding domain ${domainName} to it`);
    try {
      if (data.id) {  // Add null check
        await addDomainToProject(data.id, domainName);
        console.log(`[${new Date().toISOString()}] createVercelProject: Domain ${domainName} successfully added to project ${data.id}`);
      }
    } catch (domainError: any) {
      console.warn(`[${new Date().toISOString()}] createVercelProject: Warning: Failed to add domain to project: ${domainError.message}`);
      // Continue anyway as we have the project
    }
    
    console.log(`[${new Date().toISOString()}] createVercelProject: Project creation complete in ${Date.now() - startTime}ms`);
    return data;
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] createVercelProject: Error creating Vercel project (took ${Date.now() - startTime}ms):`, error);
    throw error;
  }
}

/**
 * Get details of a single Vercel project
 */
async function getProject(projectId: string): Promise<any> {
  try {
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    if (!VERCEL_TOKEN) {
      throw new Error('Vercel API token not set');
    }
    
    // Construct the API URL
    let apiUrl = `https://api.vercel.com/v9/projects/${projectId}`;
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
      throw new Error(`Failed to get project ${projectId}: ${data.error?.message || 'Unknown error'}`);
    }
    
    return data;
  } catch (error: any) {
    console.error(`Error getting project ${projectId}:`, error);
    throw error;
  }
}

/**
 * Find a project that has a specific domain attached
 */
async function findProjectByDomain(domainName: string): Promise<any | null> {
  const startTime = Date.now();
  try {
    console.log(`[${new Date().toISOString()}] findProjectByDomain: Looking for project with domain ${domainName}...`);
    const getAllProjectsStartTime = Date.now();
    const projects = await getAllProjects();
    console.log(`[${new Date().toISOString()}] findProjectByDomain: Found ${projects.length} projects to check (took ${Date.now() - getAllProjectsStartTime}ms)`);
    
    // For each project, check if it has the domain attached
    for (const project of projects) {
      try {
        console.log(`[${new Date().toISOString()}] findProjectByDomain: Checking project ${project.id} (${project.name}) for domain...`);
        const getDomainsStartTime = Date.now();
        const domains = await getProjectDomains(project.id);
        console.log(`[${new Date().toISOString()}] findProjectByDomain: Retrieved ${domains.length} domains for project ${project.id} (took ${Date.now() - getDomainsStartTime}ms)`);
        
        const hasDomain = domains.some((d: any) => 
          d.name.toLowerCase() === domainName.toLowerCase());
        
        if (hasDomain) {
          console.log(`[${new Date().toISOString()}] findProjectByDomain: Found domain ${domainName} attached to project ${project.id} (${project.name}) (took ${Date.now() - startTime}ms)`);
          return project;
        }
      } catch (error) {
        console.warn(`[${new Date().toISOString()}] findProjectByDomain: Error checking domains for project ${project.id} (continuing to next project):`, error);
        // Continue to next project
      }
    }
    
    console.log(`[${new Date().toISOString()}] findProjectByDomain: No project found with domain ${domainName} (took ${Date.now() - startTime}ms)`);
    return null;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] findProjectByDomain: Error finding project by domain ${domainName} (took ${Date.now() - startTime}ms):`, error);
    throw error;
  }
}

/**
 * Find a project by its name
 */
async function findProjectByName(projectName: string): Promise<any | null> {
  const startTime = Date.now();
  try {
    console.log(`[${new Date().toISOString()}] findProjectByName: Looking for project named ${projectName}...`);
    const getAllProjectsStartTime = Date.now();
    const projects = await getAllProjects();
    console.log(`[${new Date().toISOString()}] findProjectByName: Found ${projects.length} projects to check (took ${Date.now() - getAllProjectsStartTime}ms)`);
    
    const project = projects.find(p => p.name === projectName);
    
    if (project) {
      console.log(`[${new Date().toISOString()}] findProjectByName: Found project with name ${projectName} (ID: ${project.id}) (took ${Date.now() - startTime}ms)`);
    } else {
      console.log(`[${new Date().toISOString()}] findProjectByName: No project found with name ${projectName} (took ${Date.now() - startTime}ms)`);
    }
    
    return project || null;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] findProjectByName: Error finding project by name ${projectName} (took ${Date.now() - startTime}ms):`, error);
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
  const startTime = Date.now();
  try {
    console.log(`[${new Date().toISOString()}] createDeployment: Creating deployment for project ${projectId} with domain ${domainName}...`);
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
    console.log(`[${new Date().toISOString()}] createDeployment: Preparing deployment configuration...`);
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
    console.log(`[${new Date().toISOString()}] createDeployment: Making API request to create deployment...`);
    const apiStartTime = Date.now();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(deploymentConfig)
    });
    console.log(`[${new Date().toISOString()}] createDeployment: API request completed in ${Date.now() - apiStartTime}ms`);
    
    const data: DeploymentResponse = await response.json();
    
    if (!response.ok) {
      console.error(`[${new Date().toISOString()}] createDeployment: Failed to create deployment (took ${Date.now() - startTime}ms):`, JSON.stringify(data));
      throw new Error(`Failed to create deployment: ${data.error?.message || 'Unknown error'}`);
    }
    
    console.log(`[${new Date().toISOString()}] createDeployment: Deployment created successfully with ID ${data.id} (took ${Date.now() - startTime}ms)`);
    return data;
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] createDeployment: Error creating deployment (took ${Date.now() - startTime}ms):`, error);
    throw error;
  }
}

/**
 * Check the status of a deployment
 */
export async function getDeploymentStatus(deploymentId: string): Promise<DeploymentResponse> {
  const startTime = Date.now();
  try {
    console.log(`[${new Date().toISOString()}] getDeploymentStatus: Checking status for deployment ${deploymentId}...`);
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
    console.log(`[${new Date().toISOString()}] getDeploymentStatus: Making API request to check deployment status...`);
    const apiStartTime = Date.now();
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log(`[${new Date().toISOString()}] getDeploymentStatus: API request completed in ${Date.now() - apiStartTime}ms`);
    
    const data: DeploymentResponse = await response.json();
    
    if (!response.ok) {
      console.error(`[${new Date().toISOString()}] getDeploymentStatus: Failed to get deployment status (took ${Date.now() - startTime}ms):`, JSON.stringify(data));
      throw new Error(`Failed to get deployment status: ${data.error?.message || 'Unknown error'}`);
    }
    
    console.log(`[${new Date().toISOString()}] getDeploymentStatus: Status check successful, state: ${data.readyState || data.state} (took ${Date.now() - startTime}ms)`);
    return data;
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] getDeploymentStatus: Error getting deployment status for ${deploymentId} (took ${Date.now() - startTime}ms):`, error);
    throw error;
  }
}

/**
 * Get all projects from Vercel
 */
export async function getAllProjects(): Promise<any[]> {
  const startTime = Date.now();
  try {
    console.log(`[${new Date().toISOString()}] getAllProjects: Fetching all Vercel projects...`);
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    // Provide a clear error message if token is missing
    if (!VERCEL_TOKEN) {
      console.error('[${new Date().toISOString()}] getAllProjects: Vercel API token is not set in environment variables');
      throw new Error('VERCEL_TOKEN environment variable is missing or empty. Please set it in your environment.');
    }
    
    // Construct the API URL
    let apiUrl = 'https://api.vercel.com/v9/projects';
    if (VERCEL_TEAM_ID) {
      apiUrl += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    // Make the API request
    console.log(`[${new Date().toISOString()}] getAllProjects: Making API request to fetch projects...`);
    const apiStartTime = Date.now();
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log(`[${new Date().toISOString()}] getAllProjects: API request completed in ${Date.now() - apiStartTime}ms`);
    
    const data = await response.json();
    
    if (!response.ok) {
      const errorMsg = data.error?.message || 'Unknown error';
      console.error(`[${new Date().toISOString()}] getAllProjects: Vercel API error fetching projects (took ${Date.now() - startTime}ms): ${errorMsg}`);
      throw new Error(`Failed to get projects: ${errorMsg}`);
    }
    
    console.log(`[${new Date().toISOString()}] getAllProjects: Successfully fetched ${data.projects?.length || 0} projects (took ${Date.now() - startTime}ms)`);
    return data.projects || [];
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] getAllProjects: Error getting projects from Vercel (took ${Date.now() - startTime}ms):`, error);
    throw error;
  }
}

/**
 * Get all domains for a specific project
 */
export async function getProjectDomains(projectId: string): Promise<any[]> {
  const startTime = Date.now();
  try {
    console.log(`[${new Date().toISOString()}] getProjectDomains: Fetching domains for project ${projectId}...`);
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    // Provide a clear error message if token is missing
    if (!VERCEL_TOKEN) {
      console.error('[${new Date().toISOString()}] getProjectDomains: Vercel API token is not set in environment variables');
      throw new Error('VERCEL_TOKEN environment variable is missing or empty. Please set it in your environment.');
    }
    
    // Construct the API URL
    let apiUrl = `https://api.vercel.com/v9/projects/${projectId}/domains`;
    if (VERCEL_TEAM_ID) {
      apiUrl += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    // Make the API request
    console.log(`[${new Date().toISOString()}] getProjectDomains: Making API request to fetch domains...`);
    const apiStartTime = Date.now();
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log(`[${new Date().toISOString()}] getProjectDomains: API request completed in ${Date.now() - apiStartTime}ms`);
    
    const data = await response.json();
    
    if (!response.ok) {
      const errorMsg = data.error?.message || 'Unknown error';
      console.error(`[${new Date().toISOString()}] getProjectDomains: Vercel API error fetching domains for project ${projectId} (took ${Date.now() - startTime}ms): ${errorMsg}`);
      throw new Error(`Failed to get domains for project ${projectId}: ${errorMsg}`);
    }
    
    console.log(`[${new Date().toISOString()}] getProjectDomains: Successfully fetched ${data.domains?.length || 0} domains for project ${projectId} (took ${Date.now() - startTime}ms)`);
    return data.domains || [];
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] getProjectDomains: Error getting domains for project ${projectId} (took ${Date.now() - startTime}ms):`, error);
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
 * Remove a domain from all projects (except the specified target project)
 */
async function removeDomainFromAllProjects(domainName: string, exceptProjectId?: string): Promise<boolean> {
  try {
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    if (!VERCEL_TOKEN) {
      throw new Error('Vercel API token not set');
    }
    
    console.log(`Removing domain ${domainName} from all projects (except ${exceptProjectId || 'none'})...`);
    
    // In development mode, just return success
    if (isDevelopment && (!process.env.VERCEL_TOKEN || !process.env.VERCEL_PROJECT_ID)) {
      console.log('Running in development mode, skipping domain removal');
      return true;
    }
    
    // First, get a list of all projects
    const projects = await getAllProjects();
    console.log(`Found ${projects.length} projects to check for domain ${domainName}`);
    
    // Track if we found and removed the domain from any project
    let foundAndRemoved = false;
    
    // For each project, check if it has the domain
    for (const project of projects) {
      // Skip the excepted project if provided
      if (exceptProjectId && project.id === exceptProjectId) {
        console.log(`Skipping specified project ${project.id} (${project.name})`);
        continue;
      }
      
      try {
        // First check if this project has the domain
        const domains = await getProjectDomains(project.id);
        
        const hasDomain = domains.some((d: any) => 
          d.name.toLowerCase() === domainName.toLowerCase());
        
        if (hasDomain) {
          console.log(`Found domain ${domainName} in project ${project.id} (${project.name})`);
          
          // Prepare API endpoint for deletion
          let url = `https://api.vercel.com/v9/projects/${project.id}/domains/${domainName}`;
          if (VERCEL_TEAM_ID) {
            url += `?teamId=${VERCEL_TEAM_ID}`;
          }
          
          // Delete the domain from this project
          const response = await fetch(url, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${VERCEL_TOKEN}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.status === 204 || response.ok) {
            console.log(`Successfully removed domain ${domainName} from project ${project.id} (${project.name})`);
            foundAndRemoved = true;
          } else {
            const errorData = await response.json();
            console.warn(`Failed to remove domain from project ${project.id}: ${JSON.stringify(errorData)}`);
          }
        } else {
          console.log(`Domain ${domainName} not found in project ${project.id} (${project.name})`);
        }
      } catch (projectError) {
        console.warn(`Error checking project ${project.id} for domain: ${projectError}`);
        // Continue to next project
      }
    }
    
    return foundAndRemoved;
  } catch (error) {
    console.error(`Error removing domain ${domainName} from projects:`, error);
    return false;
  }
}

/**
 * Remove a domain from a specific project
 */
async function removeDomainFromProject(projectId: string, domainName: string): Promise<boolean> {
  try {
    console.log(`[${new Date().toISOString()}] removeDomainFromProject: Removing domain ${domainName} from project ${projectId}...`);
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    if (!VERCEL_TOKEN) {
      throw new Error('Vercel API token not set');
    }
    
    // Construct the API URL
    let apiUrl = `https://api.vercel.com/v8/projects/${projectId}/domains/${domainName}`;
    if (VERCEL_TEAM_ID) {
      apiUrl += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    // Make the DELETE request
    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`
      }
    });
    
    if (response.status === 204) {
      console.log(`[${new Date().toISOString()}] removeDomainFromProject: Successfully removed domain ${domainName} from project ${projectId}`);
      return true;
    }
    
    // Parse response for error details
    try {
      const data = await response.json();
      console.warn(`[${new Date().toISOString()}] removeDomainFromProject: Error removing domain:`, data);
    } catch (parseError) {
      // Response might be empty for 204
    }
    
    return false;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] removeDomainFromProject: Error:`, error);
    return false;
  }
}

/**
 * Utility function to find or create a project for a domain
 * This centralizes the logic for project selection to avoid inconsistencies
 */
async function findOrCreateProjectForDomain(domainName: string): Promise<any> {
  console.log(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Finding appropriate project for domain ${domainName}...`);
  const startTime = Date.now();
  
  // Generate the standard project name for consistency
  const standardProjectName = `domain-${domainName.replace(/\./g, '-')}`;
  
  // Priority order for project selection:
  // 1. Project that already has the domain attached
  // 2. Project with the standard naming pattern
  // 3. Project with direct domain name (which might have been created by Vercel)
  // 4. Create a new project with standard naming
  
  let project = null;
  
  // 1. First check if domain is already attached to any project
  try {
    console.log(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Checking if domain is attached to any project...`);
    const existingProject = await findProjectByDomain(domainName);
    if (existingProject && existingProject.id) {
      console.log(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Domain ${domainName} is already attached to project ${existingProject.id} (${existingProject.name})`);
      
      // If this project doesn't follow our naming convention, log a warning
      if (existingProject.name !== standardProjectName) {
        console.warn(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Project name mismatch - expected "${standardProjectName}" but found "${existingProject.name}"`);
      }
      
      return existingProject;
    }
  } catch (error) {
    console.warn(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Error checking for existing projects with domain:`, error);
  }
  
  // 2. Check for project with standard naming pattern
  try {
    console.log(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Looking for project with standard naming ${standardProjectName}...`);
    const standardProject = await findProjectByName(standardProjectName);
    if (standardProject && standardProject.id) {
      console.log(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Found project with standard naming: ${standardProject.id}`);
      
      // Ensure the domain is attached to this project
      try {
        console.log(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Ensuring domain is attached to standard project...`);
        await addDomainToProject(standardProject.id, domainName);
        console.log(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Domain attachment confirmed for standard project`);
      } catch (domainError) {
        console.warn(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Failed to attach domain to standard project:`, domainError);
      }
      
      return standardProject;
    }
  } catch (error) {
    console.warn(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Error finding project by standard name:`, error);
  }
  
  // 3. Check for project with direct domain name
  try {
    console.log(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Looking for project with direct name ${domainName}...`);
    const directNameProject = await findProjectByName(domainName);
    if (directNameProject && directNameProject.id) {
      console.log(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Found project with direct name: ${directNameProject.id}`);
      
      // Ensure the domain is attached to this project
      try {
        console.log(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Ensuring domain is attached to direct name project...`);
        await addDomainToProject(directNameProject.id, domainName);
        console.log(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Domain attachment confirmed for direct name project`);
      } catch (domainError) {
        console.warn(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Failed to attach domain to direct name project:`, domainError);
      }
      
      return directNameProject;
    }
  } catch (error) {
    console.warn(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Error finding project by direct name:`, error);
  }
  
  // 4. If no project found, clean up any potential conflicts and create a new one
  console.log(`[${new Date().toISOString()}] findOrCreateProjectForDomain: No suitable project found, creating new one...`);
  
  // First clean up any existing domain associations
  try {
    console.log(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Cleaning up domain from any projects...`);
    await removeDomainFromAllProjects(domainName);
  } catch (cleanupError) {
    console.warn(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Error during domain cleanup:`, cleanupError);
  }
  
  // Create new project using the standard naming convention
  try {
    console.log(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Creating new project with standard name ${standardProjectName}...`);
    project = await createVercelProject(domainName);
    
    if (!project || !project.id) {
      throw new Error(`Failed to create a valid project for domain ${domainName}`);
    }
    
    console.log(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Created new project: ${project.id}`);
    
    // Verify the domain is attached
    try {
      const domains = await getProjectDomains(project.id);
      const hasDomain = domains.some(d => d.name.toLowerCase() === domainName.toLowerCase());
      
      if (!hasDomain) {
        console.log(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Domain not attached to new project, attaching now...`);
        await addDomainToProject(project.id, domainName);
      }
    } catch (verifyError) {
      console.warn(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Error verifying domain attachment:`, verifyError);
    }
    
    return project;
  } catch (createError) {
    console.error(`[${new Date().toISOString()}] findOrCreateProjectForDomain: Error creating new project:`, createError);
    throw createError;
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
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting deployment process for domain: ${domainName}`);
  
  try {
    // First, aggressively search for any existing project with the exact domain name
    // This catches projects that Vercel might have automatically created
    console.log(`[${new Date().toISOString()}] Checking if Vercel has already created a project for domain: ${domainName}`);
    let project: CreateProjectResponse | null = null;
    
    try {
      // Direct search by exact domain name - highest priority
      const exactNameProject = await findProjectByName(domainName);
      if (exactNameProject && exactNameProject.id) {
        console.log(`[${new Date().toISOString()}] Found existing project with exact domain name: ${exactNameProject.id} (${exactNameProject.name})`);
        project = exactNameProject;
      }
    } catch (searchError) {
      console.warn(`[${new Date().toISOString()}] Error searching for project with exact domain name:`, searchError);
      // Continue with normal flow
    }
    
    // If no exact match found, use the standard workflow to find or create a project
    if (!project) {
      console.log(`[${new Date().toISOString()}] No automatically created project found, using standard find/create workflow...`);
      project = await findOrCreateProjectForDomain(domainName);
    }
    
    if (!project || !project.id) {
      throw new Error(`Failed to find or create a valid project for domain ${domainName}`);
    }
    
    console.log(`[${new Date().toISOString()}] Using project with ID: ${project.id} (${project.name}) - total time so far: ${Date.now() - startTime}ms`);
    
    // Before proceeding, check if there are any other projects with the same domain or similar names
    // that we should clean up to avoid duplicates
    console.log(`[${new Date().toISOString()}] Checking for potential duplicate projects...`);
    try {
      const allProjects = await getAllProjects();
      
      // Find possible duplicates (excluding the selected project)
      const possibleDuplicates = allProjects.filter(p => 
        p.id !== project.id && 
        (p.name === domainName || p.name.includes(domainName.replace(/\./g, '-')))
      );
      
      if (possibleDuplicates.length > 0) {
        console.log(`[${new Date().toISOString()}] Found ${possibleDuplicates.length} potential duplicate projects. Will check domain associations.`);
        
        // Check which projects have the domain attached
        for (const dupProject of possibleDuplicates) {
          if (dupProject.id) {
            try {
              const domains = await getProjectDomains(dupProject.id);
              const hasDomain = domains.some(d => d.name.toLowerCase() === domainName.toLowerCase());
              
              if (hasDomain) {
                console.log(`[${new Date().toISOString()}] WARNING: Domain ${domainName} is also attached to project ${dupProject.id} (${dupProject.name})`);
                
                // If this is the automatically created project with the domain already attached,
                // switch to using this project instead of our selected one
                if (dupProject.name === domainName) {
                  console.log(`[${new Date().toISOString()}] Switching to automatically created project ${dupProject.id} which already has the domain attached`);
                  project = dupProject;
                  break;
                } else {
                  // Otherwise, try to remove the domain from this duplicate
                  console.log(`[${new Date().toISOString()}] Removing domain ${domainName} from duplicate project ${dupProject.id}...`);
                  try {
                    const domainRemoved = await removeDomainFromProject(dupProject.id, domainName);
                    if (domainRemoved) {
                      console.log(`[${new Date().toISOString()}] Successfully removed domain from duplicate project ${dupProject.id}`);
                    } else {
                      console.log(`[${new Date().toISOString()}] Failed to remove domain from duplicate project ${dupProject.id}`);
                    }
                  } catch (error) {
                    console.warn(`[${new Date().toISOString()}] Error removing domain from duplicate project:`, error);
                  }
                }
              }
            } catch (error) {
              console.warn(`[${new Date().toISOString()}] Error checking domains for project ${dupProject.id}:`, error);
            }
          }
        }
      } else {
        console.log(`[${new Date().toISOString()}] No potential duplicate projects found.`);
      }
    } catch (error) {
      console.warn(`[${new Date().toISOString()}] Error checking for duplicate projects: ${error}`);
      // Continue with deployment process
    }
    
    // Double-check that the domain is still properly attached to our selected project
    console.log(`[${new Date().toISOString()}] Double-checking domain ${domainName} is attached to project ${project.id}...`);
    const addDomainStartTime = Date.now();
    try {
      const domainAddResult = await addDomainToVercel(domainName, project.id);
      
      // If domain is still in use by a different project
      if (!domainAddResult.success && 
          domainAddResult.error && 
          domainAddResult.error.code === 'domain_already_in_use_by_different_project') {
        
        console.error(`[${new Date().toISOString()}] Domain ${domainName} is still in use by project ${domainAddResult.error.projectId}.
          Cannot proceed with deployment to a different project. (took ${Date.now() - addDomainStartTime}ms)`);
          
        // If domain is already on a different project, switch to that project instead of failing
        if (domainAddResult.error.projectId) {
          console.log(`[${new Date().toISOString()}] Switching to project ${domainAddResult.error.projectId} which already has the domain`);
          try {
            const projectWithDomain = await getProject(domainAddResult.error.projectId);
            if (projectWithDomain && projectWithDomain.id) {
              console.log(`[${new Date().toISOString()}] Switched to project ${projectWithDomain.id} (${projectWithDomain.name})`);
              // Use the project that already has the domain attached
              project = projectWithDomain;
            }
          } catch (error) {
            console.error(`[${new Date().toISOString()}] Error fetching project with domain: ${error}`);
            throw new Error(`Cannot proceed with deployment: ${domainName} is in use by project ${domainAddResult.error.projectId}`);
          }
        } else {
          throw new Error(`Cannot proceed with deployment: ${domainName} is in use by project ${domainAddResult.error.projectId}`);
        }
      }
      
      console.log(`[${new Date().toISOString()}] Domain ${domainName} successfully added/confirmed to project ${project.id} (took ${Date.now() - addDomainStartTime}ms)`);
    } catch (domainError: any) {
      console.error(`[${new Date().toISOString()}] Failed to add domain to project (took ${Date.now() - addDomainStartTime}ms): ${domainError.message}`);
      throw new Error(`Domain configuration failed: ${domainError.message}`);
    }
    
    // Create a deployment for the project
    console.log(`[${new Date().toISOString()}] Creating deployment for project ${project.id}...`);
    const createDeploymentStartTime = Date.now();
    const deployment = await createDeployment(project.id, domainName);
    
    if (!deployment || !deployment.id) {
      throw new Error(`Failed to create deployment for project ${project.id}`);
    }
    
    console.log(`[${new Date().toISOString()}] Deployment created with ID: ${deployment.id} (took ${Date.now() - createDeploymentStartTime}ms)`);
    
    // Wait a bit longer for deployment to initialize
    console.log(`[${new Date().toISOString()}] Waiting for deployment to initialize (10 seconds)...`);
    const waitStartTime = Date.now();
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log(`[${new Date().toISOString()}] Finished waiting (took ${Date.now() - waitStartTime}ms)`);
    
    // Check deployment status to ensure it's ready
    let deploymentStatus;
    const checkStatusStartTime = Date.now();
    try {
      console.log(`[${new Date().toISOString()}] Checking initial deployment status...`);
      deploymentStatus = await getDeploymentStatus(deployment.id);
      console.log(`[${new Date().toISOString()}] Deployment status check complete: ${deploymentStatus.readyState} (took ${Date.now() - checkStatusStartTime}ms)`);
    } catch (statusError) {
      console.error(`[${new Date().toISOString()}] Error checking deployment status (took ${Date.now() - checkStatusStartTime}ms):`, statusError);
    }
    
    // Set the custom domain as an alias for the deployment
    console.log(`[${new Date().toISOString()}] Setting alias ${domainName} for deployment ${deployment.id}...`);
    const setAliasStartTime = Date.now();
    try {
      await setDeploymentAlias(deployment.id, domainName);
      console.log(`[${new Date().toISOString()}] Alias set successfully for ${domainName} (took ${Date.now() - setAliasStartTime}ms)`);
    } catch (aliasError) {
      console.error(`[${new Date().toISOString()}] Error setting deployment alias (took ${Date.now() - setAliasStartTime}ms):`, aliasError);
      // Continue anyway as the domain might be set up through the earlier process
    }
    
    // Verify the domain to ensure it's properly configured
    const verifyStartTime = Date.now();
    try {
      console.log(`[${new Date().toISOString()}] Verifying domain ${domainName} for project ${project.id}...`);
      const verificationResult = await verifyDomainInVercel(domainName, project.id);
      console.log(`[${new Date().toISOString()}] Domain verification initiated (took ${Date.now() - verifyStartTime}ms): ${JSON.stringify(verificationResult)}`);
    } catch (verifyError: any) {
      console.warn(`[${new Date().toISOString()}] Error during domain verification (continuing anyway - took ${Date.now() - verifyStartTime}ms): ${verifyError.message}`);
    }
    
    // Double-check that the domain is still attached to the project after deployment
    console.log(`[${new Date().toISOString()}] Double-checking domain is attached to project ${project.id}...`);
    try {
      const domains = await getProjectDomains(project.id);
      const hasDomain = domains.some(d => d.name.toLowerCase() === domainName.toLowerCase());
      
      if (!hasDomain) {
        console.warn(`[${new Date().toISOString()}] Domain ${domainName} is not attached to project ${project.id} after deployment. Attempting to re-attach...`);
        await addDomainToVercel(domainName, project.id);
      } else {
        console.log(`[${new Date().toISOString()}] Confirmed domain ${domainName} is attached to project ${project.id}`);
      }
    } catch (error) {
      console.warn(`[${new Date().toISOString()}] Error checking domain attachment after deployment: ${error}`);
    }
    
    // Generate URLs for both the Vercel deployment and the custom domain
    const vercelUrl = deployment.url ? `https://${deployment.url}` : undefined;
    const customDomain = `https://${domainName}`;
    
    const totalTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] deployDomain function complete in ${totalTime}ms`);
    
    return {
      projectId: project.id,
      deploymentId: deployment.id,
      deploymentUrl: customDomain, // Primary URL to use
      customDomain: customDomain,  // Explicit custom domain URL
      vercelUrl: vercelUrl,        // Fallback Vercel URL
      status: deploymentStatus?.readyState || deployment?.readyState || 'INITIALIZING'
    };
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] Error deploying domain (took ${totalTime}ms):`, error);
    throw error;
  }
}

/**
 * Clean up empty projects that have no deployments and no domains
 * This is useful to remove projects that were created but not fully deployed
 */
export async function cleanupEmptyProjects(): Promise<{
  success: boolean;
  cleanedProjects: number;
  message: string;
}> {
  try {
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    if (!VERCEL_TOKEN) {
      throw new Error('Vercel API token not set');
    }
    
    console.log('Starting cleanup of empty projects...');
    
    // Get all projects
    const projects = await getAllProjects();
    console.log(`Found ${projects.length} projects to check`);
    
    let cleanedCount = 0;
    
    // For each project, check if it has any domains or deployments
    for (const project of projects) {
      try {
        // Skip if this is the main project
        if (project.id === process.env.VERCEL_PROJECT_ID) {
          console.log(`Skipping main project: ${project.id} (${project.name})`);
          continue;
        }
        
        // Check if the project has any domains
        const domains = await getProjectDomains(project.id);
        
        // If the project has domains, skip it
        if (domains.length > 0) {
          console.log(`Project ${project.id} (${project.name}) has ${domains.length} domains, skipping`);
          continue;
        }
        
        // Check if the project has any deployments
        const deployments = await getProjectDeployments(project.id);
        
        // If the project has deployments but no domains, check if the deployments are recent
        // We only want to delete projects that have no domains and no recent deployments
        const hasRecentDeployments = deployments.some((deployment: any) => {
          // Check if deployment is less than 24 hours old
          const deploymentDate = new Date(deployment.created);
          const hoursSinceDeployment = (Date.now() - deploymentDate.getTime()) / (1000 * 60 * 60);
          return hoursSinceDeployment < 24;
        });
        
        if (deployments.length > 0 && hasRecentDeployments) {
          console.log(`Project ${project.id} (${project.name}) has ${deployments.length} recent deployments, skipping`);
          continue;
        }
        
        // If we get here, the project has no domains and no recent deployments, so it's safe to delete
        console.log(`Deleting empty project ${project.id} (${project.name})`);
        
        // Construct the API URL for deletion
        let url = `https://api.vercel.com/v9/projects/${project.id}`;
        if (VERCEL_TEAM_ID) {
          url += `?teamId=${VERCEL_TEAM_ID}`;
        }
        
        // Make the API request to delete the project
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${VERCEL_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.status === 204 || response.ok) {
          console.log(`Successfully deleted empty project ${project.id} (${project.name})`);
          cleanedCount++;
        } else {
          const errorData = await response.json();
          console.warn(`Failed to delete project ${project.id}: ${JSON.stringify(errorData)}`);
        }
      } catch (projectError) {
        console.warn(`Error processing project ${project.id}: ${projectError}`);
        // Continue to next project
      }
    }
    
    return {
      success: true,
      cleanedProjects: cleanedCount,
      message: `Cleaned up ${cleanedCount} empty projects`
    };
  } catch (error: any) {
    console.error('Error cleaning up empty projects:', error);
    return {
      success: false,
      cleanedProjects: 0,
      message: `Error cleaning up projects: ${error.message}`
    };
  }
}

/**
 * Get all deployments for a project
 */
async function getProjectDeployments(projectId: string): Promise<any[]> {
  try {
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    if (!VERCEL_TOKEN) {
      throw new Error('Vercel API token not set');
    }
    
    // Construct the API URL
    let apiUrl = `https://api.vercel.com/v6/deployments?projectId=${projectId}`;
    if (VERCEL_TEAM_ID) {
      apiUrl += `&teamId=${VERCEL_TEAM_ID}`;
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
      throw new Error(`Failed to get deployments for project ${projectId}: ${data.error?.message || 'Unknown error'}`);
    }
    
    return data.deployments || [];
  } catch (error: any) {
    console.error(`Error getting deployments for project ${projectId}:`, error);
    throw error;
  }
} 