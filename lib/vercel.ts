// Vercel API integration for domain management

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
 * @returns Response from Vercel API including required DNS records
 */
export async function addDomainToVercel(domainName: string) {
  try {
    console.log(`Adding domain ${domainName} to Vercel project...`);
    
    // In development with missing credentials, return mock success
    if (isDevelopment && (!process.env.VERCEL_TOKEN || !process.env.VERCEL_PROJECT_ID)) {
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
    let url = `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains`;
    
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
    
    const data = await response.json();
    console.log(`Vercel domain addition response:`, JSON.stringify(data));
    
    if (!response.ok) {
      throw new Error(`Failed to add domain to Vercel: ${JSON.stringify(data)}`);
    }
    
    // Get the verification records if available
    let configurationRecords = [];
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
    
    // Add main domain first
    let domainResult;
    try {
      domainResult = await addDomainToVercel(domain);
      console.log(`Main domain ${domain} added to Vercel`);
    } catch (error) {
      console.warn(`Could not add main domain ${domain} to Vercel, it might already exist:`, error);
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
    
    // Then add subdomain
    const fullSubdomain = `${subdomain}.${domain}`;
    let subdomainResult;
    try {
      subdomainResult = await addDomainToVercel(fullSubdomain);
      console.log(`Subdomain ${fullSubdomain} added to Vercel`);
    } catch (error) {
      console.warn(`Could not add subdomain ${fullSubdomain} to Vercel, it might already exist:`, error);
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