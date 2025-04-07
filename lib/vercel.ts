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
export async function createVercelProject(domainName: string, framework: string = 'other'): Promise<CreateProjectResponse> {
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
        buildCommand: null,
        outputDirectory: "public",
        environmentVariables: [
          { 
            key: 'DOMAIN_NAME', 
            value: domainName, 
            type: 'plain',
            target: ['production', 'preview', 'development'] 
          }
        ],
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
    
    // First, try to get the root page content from the database
    let rootPageHtml = '';
    try {
      console.log(`[${new Date().toISOString()}] createDeployment: Fetching root page content for ${domainName}...`);
      
      // Import the required modules
      const { connectToDatabase } = await import('@/lib/mongodb');
      const { Domain } = await import('@/lib/models/Domain');
      const { RootPage } = await import('@/lib/models/RootPage');
      const { generateRootPageHtml } = await import('@/lib/rootPageGenerator');
      const { createDomainRootPage } = await import('@/lib/utils/rootPageUtils');
      
      // Connect to database
      await connectToDatabase();
      
      // Find the domain
      const domain = await Domain.findOne({ name: domainName.toLowerCase() });
      
      if (domain) {
        // Look for an existing root page
        let rootPage = await RootPage.findOne({ domainId: domain._id });
        
        // If no root page exists, create one
        if (!rootPage) {
          console.log(`[${new Date().toISOString()}] createDeployment: No root page found for ${domainName}, creating one...`);
          const rootPageResult = await createDomainRootPage(domain);
          if (rootPageResult.success && rootPageResult.rootPage) {
            rootPage = rootPageResult.rootPage;
          }
        }
        
        // If we have a root page, generate HTML for it
        if (rootPage) {
          console.log(`[${new Date().toISOString()}] createDeployment: Generating HTML for root page...`);
          rootPageHtml = generateRootPageHtml(rootPage);
        }
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] createDeployment: Error fetching root page content:`, error);
      // Continue with default HTML if we failed to get the root page content
    }
    
    // If we couldn't get the root page content, use a default template
    if (!rootPageHtml) {
      console.log(`[${new Date().toISOString()}] createDeployment: Using default HTML template for ${domainName}`);
      rootPageHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${domainName}</title>
  <meta name="description" content="Welcome to ${domainName}">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
    }
    
    h1, h2, h3, h4, h5, h6 {
      color: #111;
    }
    
    a {
      color: #0070f3;
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    img {
      max-width: 100%;
      height: auto;
    }
    
    .my-8 {
      margin-top: 2rem;
      margin-bottom: 2rem;
    }
    
    .p-4 {
      padding: 1rem;
    }
    
    .bg-gray-100 {
      background-color: #f3f4f6;
    }
    
    .border {
      border: 1px solid;
    }
    
    .border-gray-300 {
      border-color: #d1d5db;
    }
    
    .rounded {
      border-radius: 0.25rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${domainName.split('.')[0].charAt(0).toUpperCase() + domainName.split('.')[0].slice(1)}</h1>
    <p>Welcome to our website. We provide quality products and services to meet your needs.</p>
    
    <div class="my-8">
      <h2>Our Services</h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 30px 0;">
        <div class="my-4 p-4 bg-gray-100 border border-gray-300 rounded">
          <h3>High Quality</h3>
          <p>We pride ourselves on delivering products and services of the highest quality.</p>
        </div>
        <div class="my-4 p-4 bg-gray-100 border border-gray-300 rounded">
          <h3>Excellent Support</h3>
          <p>Our support team is available 24/7 to assist you with any questions or concerns.</p>
        </div>
        <div class="my-4 p-4 bg-gray-100 border border-gray-300 rounded">
          <h3>Secure & Reliable</h3>
          <p>Your security is our priority. We use the latest technology to protect your data.</p>
        </div>
      </div>
    </div>
    
    <div class="my-8">
      <h2>Contact Us</h2>
      <p>Email: <a href="mailto:info@${domainName}">info@${domainName}</a></p>
    </div>
  </div>
</body>
</html>
      `.trim();
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
            dependencies: {
              "next": "^13.4.0"
            },
            scripts: {
              build: 'mkdir -p public && echo "Static site" > public/info.txt',
              start: 'echo "Static site"'
            },
            engines: {
              "node": "18.x"
            }
          }),
          encoding: 'utf-8'
        },
        {
          file: 'vercel.json',
          data: JSON.stringify({
            version: 2,
            public: true,
            cleanUrls: true,
            trailingSlash: false,
            headers: [
              {
                source: "/(.*)",
                headers: [
                  { key: "Cache-Control", value: "public, max-age=60, s-maxage=300, stale-while-revalidate=3600" },
                  { key: "X-Content-Type-Options", value: "nosniff" }
                ]
              }
            ]
          }),
          encoding: 'utf-8'
        },
        {
          file: 'public/index.html',
          data: rootPageHtml,
          encoding: 'utf-8'
        }
      ],
      projectSettings: {
        framework: "other", // Use 'other' as a supported framework type
        devCommand: null,
        buildCommand: null,
        outputDirectory: "public",
        rootDirectory: null,
        nodeVersion: "18.x"
      },
      env: {
        DOMAIN_NAME: domainName
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
    // STEP 1: Create a project with the exact domain name (to match Vercel's behavior)
    console.log(`[${new Date().toISOString()}] Creating project for domain: ${domainName}...`);
    const createProjectStartTime = Date.now();
    
    // Use direct domain name as project name
    const projectName = domainName;
    
    let project = null;
    
    // First check if project already exists with direct domain name
    try {
      console.log(`[${new Date().toISOString()}] Checking if project with name ${projectName} already exists...`);
      const existingProject = await findProjectByName(projectName);
      if (existingProject && existingProject.id) {
        console.log(`[${new Date().toISOString()}] Found existing project: ${existingProject.id} (${existingProject.name})`);
        project = existingProject;
      }
    } catch (error) {
      console.warn(`[${new Date().toISOString()}] Error finding project by name:`, error);
    }
    
    // If no existing project found, create a new one
    if (!project) {
      console.log(`[${new Date().toISOString()}] Creating new Vercel project with name: ${projectName}`);
      
      // Construct API URL
      let apiUrl = 'https://api.vercel.com/v9/projects';
      const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
      if (VERCEL_TEAM_ID) {
        apiUrl += `?teamId=${VERCEL_TEAM_ID}`;
      }
      
      const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
      if (!VERCEL_TOKEN) {
        throw new Error('Vercel API token not set');
      }
      
      // Create the project
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: projectName,
          framework: 'other',
          buildCommand: null,
          outputDirectory: "public",
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
      
      const data = await response.json();
      
      if (!response.ok) {
        if (data.error?.code === 'project_name_already_exists') {
          // Try to get that project
          try {
            const existingProject = await findProjectByName(projectName);
            if (existingProject && existingProject.id) {
              console.log(`[${new Date().toISOString()}] Found existing project after failed creation: ${existingProject.id}`);
              project = existingProject;
            } else {
              throw new Error(`Failed to create Vercel project: ${data.error?.message || 'Unknown error'}`);
            }
          } catch (findError) {
            throw new Error(`Failed to create Vercel project and couldn't find existing one: ${data.error?.message || 'Unknown error'}`);
          }
        } else {
          throw new Error(`Failed to create Vercel project: ${data.error?.message || 'Unknown error'}`);
        }
      } else {
        console.log(`[${new Date().toISOString()}] Successfully created project: ${data.id} (${data.name})`);
        project = data;
      }
    }
    
    console.log(`[${new Date().toISOString()}] Project creation/selection complete in ${Date.now() - createProjectStartTime}ms`);
    
    if (!project || !project.id) {
      throw new Error(`Failed to create or find a valid project for domain ${domainName}`);
    }
    
    const finalProjectId = project.id;
    
    // STEP 2: Create a deployment for the project
    console.log(`[${new Date().toISOString()}] Creating deployment for project ${finalProjectId}...`);
    const createDeploymentStartTime = Date.now();
    const deployment = await createDeployment(finalProjectId, domainName);
    
    if (!deployment || !deployment.id) {
      throw new Error(`Failed to create deployment for project ${finalProjectId}`);
    }
    
    console.log(`[${new Date().toISOString()}] Deployment created with ID: ${deployment.id} (took ${Date.now() - createDeploymentStartTime}ms)`);
    
    // STEP 3: Wait for the deployment to be ready
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
    
    // STEP 4: Only now add the domain to the project (AFTER creating the deployment)
    console.log(`[${new Date().toISOString()}] Now adding domain ${domainName} to project ${finalProjectId}...`);
    const addDomainStartTime = Date.now();
    try {
      const domainAddResult = await addDomainToVercel(domainName, finalProjectId);
      
      if (!domainAddResult.success) {
        if (domainAddResult.error && domainAddResult.error.code === 'domain_already_in_use_by_different_project' && domainAddResult.error.projectId) {
          console.error(`[${new Date().toISOString()}] Domain ${domainName} is already in use by project ${domainAddResult.error.projectId}`);
          
          // Check if we should switch projects
          const existingProject = await getProject(domainAddResult.error.projectId);
          if (existingProject && existingProject.id) {
            console.log(`[${new Date().toISOString()}] Domain is attached to different project ${existingProject.id} (${existingProject.name})`);
            // We'll continue with our current project and try to force move the domain
            
            // First try to remove the domain from the other project
            console.log(`[${new Date().toISOString()}] Attempting to remove domain from other project ${existingProject.id}...`);
            try {
              await removeDomainFromProject(existingProject.id, domainName);
              console.log(`[${new Date().toISOString()}] Domain removed from other project, trying to add to our project again`);
              
              // Try adding the domain to our project again
              const retryAddResult = await addDomainToVercel(domainName, finalProjectId);
              if (!retryAddResult.success) {
                console.error(`[${new Date().toISOString()}] Still failed to add domain after removing from other project:`, retryAddResult.error);
              } else {
                console.log(`[${new Date().toISOString()}] Successfully moved domain to our project ${finalProjectId}`);
              }
            } catch (removeError) {
              console.error(`[${new Date().toISOString()}] Failed to remove domain from other project:`, removeError);
            }
          }
        } else {
          console.error(`[${new Date().toISOString()}] Failed to add domain: ${JSON.stringify(domainAddResult.error)}`);
        }
      } else {
        console.log(`[${new Date().toISOString()}] Domain ${domainName} successfully added to project ${finalProjectId} (took ${Date.now() - addDomainStartTime}ms)`);
      }
    } catch (domainError: any) {
      console.error(`[${new Date().toISOString()}] Error adding domain to project (took ${Date.now() - addDomainStartTime}ms): ${domainError.message}`);
    }
    
    // STEP 5: Set up the deployment alias (domain as alias)
    console.log(`[${new Date().toISOString()}] Setting alias ${domainName} for deployment ${deployment.id}...`);
    const setAliasStartTime = Date.now();
    try {
      await setDeploymentAlias(deployment.id, domainName);
      console.log(`[${new Date().toISOString()}] Alias set successfully for ${domainName} (took ${Date.now() - setAliasStartTime}ms)`);
    } catch (aliasError) {
      console.error(`[${new Date().toISOString()}] Error setting deployment alias (took ${Date.now() - setAliasStartTime}ms):`, aliasError);
      // Continue anyway as the domain might be set up through the earlier process
    }
    
    // STEP 6: Verify the domain
    const verifyStartTime = Date.now();
    try {
      console.log(`[${new Date().toISOString()}] Verifying domain ${domainName} for project ${finalProjectId}...`);
      const verificationResult = await verifyDomainInVercel(domainName, finalProjectId);
      console.log(`[${new Date().toISOString()}] Domain verification initiated (took ${Date.now() - verifyStartTime}ms): ${JSON.stringify(verificationResult)}`);
    } catch (verifyError: any) {
      console.warn(`[${new Date().toISOString()}] Error during domain verification (continuing anyway - took ${Date.now() - verifyStartTime}ms): ${verifyError.message}`);
    }
    
    // Final check that the domain is attached to the project
    console.log(`[${new Date().toISOString()}] Double-checking domain is attached to project ${finalProjectId}...`);
    try {
      const domains = await getProjectDomains(finalProjectId);
      const hasDomain = domains.some(d => d.name.toLowerCase() === domainName.toLowerCase());
      
      if (!hasDomain) {
        console.warn(`[${new Date().toISOString()}] Domain ${domainName} is not attached to project ${finalProjectId} after deployment. Attempting to re-attach...`);
        await addDomainToVercel(domainName, finalProjectId);
      } else {
        console.log(`[${new Date().toISOString()}] Confirmed domain ${domainName} is attached to project ${finalProjectId}`);
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
      projectId: finalProjectId,
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

/**
 * Deploy a domain to Vercel with proper configuration to prevent redirect loops
 * @param domainName The domain to deploy
 * @returns Deployment response with URL and status
 */
export async function deployDomainToVercel(domainName: string): Promise<any> {
  const startTime = Date.now();
  let errorDetail = 'Unknown error';
  
  try {
    console.log(`[${new Date().toISOString()}] deployDomainToVercel: Starting deployment process for domain ${domainName}...`);
    
    // Step 1: Create a project for the domain (or reuse existing)
    console.log(`[${new Date().toISOString()}] deployDomainToVercel: Creating/finding project for ${domainName}...`);
    let project: any = null;
    try {
      project = await Promise.race([
        createVercelProject(domainName, 'other'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Project creation timed out after 60s')), 60000))
      ]);
    } catch (projectError: any) {
      errorDetail = `Project creation failed: ${projectError.message}`;
      console.error(`[${new Date().toISOString()}] deployDomainToVercel: ${errorDetail}`);
      throw projectError;
    }
    
    if (!project || !project.id) {
      errorDetail = 'Failed to create or find Vercel project';
      throw new Error(errorDetail);
    }
    
    console.log(`[${new Date().toISOString()}] deployDomainToVercel: Using project: ${project.name} (${project.id})`);
    
    // Step 2: Create a deployment for the project
    console.log(`[${new Date().toISOString()}] deployDomainToVercel: Creating deployment for project...`);
    let deployment: any = null;
    try {
      deployment = await Promise.race([
        createDeployment(project.id, domainName),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Deployment creation timed out after 90s')), 90000))
      ]);
    } catch (deploymentError: any) {
      errorDetail = `Deployment creation failed: ${deploymentError.message}`;
      console.error(`[${new Date().toISOString()}] deployDomainToVercel: ${errorDetail}`);
      throw deploymentError;
    }
    
    if (!deployment || !deployment.id) {
      errorDetail = 'Failed to create deployment';
      throw new Error(errorDetail);
    }
    
    console.log(`[${new Date().toISOString()}] deployDomainToVercel: Deployment created with ID ${deployment.id}, waiting for it to be ready...`);
    
    // Define deployment status at the top level for use throughout the function
    let deploymentStatus = deployment;
    let ready = false;
    
    // Modify the actual deployment process with timeout handling
    let deploymentCompletionTimeout: any = null;
    const deploymentPromise = new Promise<void>(async (resolve, reject) => {
      try {
        // Step 3: Wait for deployment to be ready
        let attempts = 0;
        let maxAttempts = 30; // 5 minutes (10s intervals)
        
        while (!ready && attempts < maxAttempts) {
          attempts++;
          console.log(`[${new Date().toISOString()}] deployDomainToVercel: Checking deployment status (attempt ${attempts}/${maxAttempts}), current state: ${deploymentStatus.readyState || deploymentStatus.state || 'unknown'}...`);
          
          // Wait 10 seconds between checks
          await new Promise(resolve => setTimeout(resolve, 10000));
          
          try {
            deploymentStatus = await getDeploymentStatus(deployment.id);
            
            if (deploymentStatus.readyState === 'READY' || deploymentStatus.state === 'READY') {
              ready = true;
              console.log(`[${new Date().toISOString()}] deployDomainToVercel: Deployment is ready!`);
            } else if (deploymentStatus.readyState === 'ERROR' || deploymentStatus.state === 'ERROR') {
              console.error(`[${new Date().toISOString()}] deployDomainToVercel: Deployment failed:`, JSON.stringify(deploymentStatus));
              throw new Error(`Deployment failed with status: ${deploymentStatus.readyState || deploymentStatus.state}`);
            } else {
              // Still in progress (BUILDING, INITIALIZING, etc.) - continue waiting
              console.log(`[${new Date().toISOString()}] deployDomainToVercel: Deployment still in progress, status: ${deploymentStatus.readyState || deploymentStatus.state}`);
            }
          } catch (statusError) {
            console.error(`[${new Date().toISOString()}] deployDomainToVercel: Error checking deployment status (attempt ${attempts}):`, statusError);
            // Continue to next attempt rather than breaking the loop on temporary errors
          }
        }
        
        // Continue with the domain setup even if the deployment isn't ready yet
        if (!ready) {
          console.warn(`[${new Date().toISOString()}] deployDomainToVercel: Deployment did not become ready in the allocated time (${maxAttempts * 10}s), but continuing with domain setup anyway`);
        }
        
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    
    // Set a timeout for the entire deployment process (8 minutes)
    const timeoutPromise = new Promise<void>((_, reject) => {
      deploymentCompletionTimeout = setTimeout(() => {
        reject(new Error('Deployment status check timed out after 8 minutes'));
      }, 8 * 60 * 1000);
    });
    
    // Wait for either the deployment process to complete or timeout
    try {
      await Promise.race([deploymentPromise, timeoutPromise]);
    } catch (error: any) {
      console.warn(`[${new Date().toISOString()}] deployDomainToVercel: ${error.message}, continuing with domain setup anyway`);
    } finally {
      if (deploymentCompletionTimeout) {
        clearTimeout(deploymentCompletionTimeout);
      }
    }
    
    // STEP 4: Only now add the domain to the project (AFTER creating the deployment)
    console.log(`[${new Date().toISOString()}] deployDomainToVercel: Ensuring domain ${domainName} is attached to project...`);
    const domainResult = await addDomainToVercel(domainName, project.id);
    
    // Step 5: Get DNS configuration requirements
    let dnsRecords = [];
    if (domainResult.configurationDnsRecords && Array.isArray(domainResult.configurationDnsRecords)) {
      dnsRecords = domainResult.configurationDnsRecords;
    }
    
    // Get deployment URL
    const deploymentUrl = deploymentStatus.url || `${domainName}.vercel.app`;
    
    // Step 6: Create a root page for the domain in our database
    let rootPageResult = { success: false, message: 'Root page creation not attempted' };
    try {
      console.log(`[${new Date().toISOString()}] deployDomainToVercel: Fetching domain from database to create root page...`);
      
      // Import the domain models and database connection
      const { connectToDatabase } = await import('@/lib/mongodb');
      const { Domain } = await import('@/lib/models/Domain');
      
      // Connect to the database
      await connectToDatabase();
      
      // Find the domain in the database
      const domainInDb = await Domain.findOne({ name: domainName.toLowerCase() });
      
      if (domainInDb) {
        console.log(`[${new Date().toISOString()}] deployDomainToVercel: Found domain in database, creating root page...`);
        
        // Import the root page utility
        const { createDomainRootPage } = await import('@/lib/utils/rootPageUtils');
        
        // Create the root page
        rootPageResult = await createDomainRootPage(domainInDb);
        console.log(`[${new Date().toISOString()}] deployDomainToVercel: Root page creation result:`, rootPageResult.message);
      } else {
        console.log(`[${new Date().toISOString()}] deployDomainToVercel: Domain not found in database, skipping root page creation`);
        rootPageResult = { success: false, message: 'Domain not found in database' };
      }
    } catch (rootPageError: any) {
      console.error(`[${new Date().toISOString()}] deployDomainToVercel: Error creating root page:`, rootPageError);
      rootPageResult = { 
        success: false, 
        message: `Error creating root page: ${rootPageError.message || 'Unknown error'}` 
      };
      // Continue with deployment even if root page creation fails
    }
    
    console.log(`[${new Date().toISOString()}] deployDomainToVercel: Deployment process completed in ${Date.now() - startTime}ms`);
    
    return {
      success: true,
      domain: domainName,
      projectId: project.id,
      deploymentId: deployment.id,
      url: deploymentUrl,
      dnsRecords,
      deploymentStatus: deploymentStatus.readyState || deploymentStatus.state,
      rootPage: rootPageResult,
      message: `Domain ${domainName} deployed successfully${deploymentStatus.readyState === 'READY' ? '' : ' (deployment still processing)'}`
    };
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] deployDomainToVercel: Error deploying domain ${domainName} (took ${Date.now() - startTime}ms):`, error);
    
    return {
      success: false,
      domain: domainName,
      error: error.message || errorDetail,
      errorDetail: errorDetail,
      message: `Failed to deploy domain: ${error.message || errorDetail}`
    };
  }
} 