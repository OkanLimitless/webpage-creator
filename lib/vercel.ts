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
 * Add a domain to Vercel project
 * @param domainName The domain name to add
 * @returns Response from Vercel API
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
        message: 'Domain added to Vercel (mock)'
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
    
    return {
      success: true,
      domainName,
      vercelDomain: data,
      message: 'Domain added to Vercel successfully'
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