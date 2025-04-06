import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { RootPage } from '@/lib/models/RootPage';

// Simulate middleware function to test domain routing
function simulateMiddleware(hostname: string) {
  // Remove www. if present
  const cleanHostname = hostname.replace(/^www\./i, '');
  
  // Check if TLD only
  if (['com', 'net', 'org', 'io', 'app', 'dev', 'co', 'ai'].includes(cleanHostname)) {
    return {
      hasSubdomain: false,
      subdomain: '',
      routingTo: 'Route Handler with TLD fallback',
      issues: ['Hostname appears to be just a TLD, will use PRIMARY_DOMAIN fallback']
    };
  }
  
  // Check if it has a valid subdomain
  const parts = cleanHostname.split('.');
  
  const hasSubdomain = parts.length >= 3 && !['www'].includes(parts[0]);
  const validPrefixes = ['landing', 'app', 'dashboard', 'admin'];
  const isValidSubdomain = hasSubdomain && validPrefixes.includes(parts[0]);
  
  return {
    hasSubdomain,
    subdomain: hasSubdomain ? parts[0] : '',
    isValidSubdomain,
    routingTo: hasSubdomain ? `/${parts[0]} route` : '/(root) route',
    issues: hasSubdomain && !isValidSubdomain ? 
      [`Unknown subdomain type: ${parts[0]}. Valid types are: ${validPrefixes.join(', ')}`] : []
  };
}

// Simulate domain extraction
function simulateDomainExtraction(hostname: string) {
  // Remove www. if present
  let domain = hostname.replace(/^www\./i, '');
  
  // Remove port if present
  domain = domain.split(':')[0];
  
  // Check if it's just a TLD
  const isTLD = ['com', 'net', 'org', 'io', 'app', 'dev', 'co', 'ai'].includes(domain);
  
  // Check format
  const isValid = domain.includes('.') && !isTLD;
  
  return {
    original: hostname,
    afterWwwRemoval: domain,
    parts: domain.split('.'),
    isTLD,
    isValid,
    issues: isTLD ? ['Domain appears to be just a TLD'] : 
      (!isValid ? ['Invalid domain format'] : [])
  };
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    // Get domain from request body
    const body = await request.json();
    const { domain } = body;
    
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain is required' },
        { status: 400 }
      );
    }
    
    // Results object
    const results: any = {
      domain,
      middleware: simulateMiddleware(domain),
      extraction: simulateDomainExtraction(domain),
      database: { found: false },
      issues: [],
      recommendations: []
    };
    
    // Collect issues
    if (results.middleware.issues?.length > 0) {
      results.issues.push(...results.middleware.issues);
    }
    
    if (results.extraction.issues?.length > 0) {
      results.issues.push(...results.extraction.issues);
    }
    
    // Get the actual domain name to check in DB (after www removal and port removal)
    let domainToCheck = results.extraction.afterWwwRemoval;
    
    // Check DB for domain
    const escapedDomain = domainToCheck.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const domainDoc = await Domain.findOne({ 
      name: { $regex: new RegExp(`^${escapedDomain}$`, 'i') } 
    });
    
    if (domainDoc) {
      results.database.found = true;
      results.database.id = domainDoc._id.toString();
      results.database.name = domainDoc.name;
      results.database.isActive = domainDoc.isActive;
      
      // Check for root page
      const rootPage = await RootPage.findOne({ domainId: domainDoc._id });
      results.database.hasRootPage = !!rootPage;
      results.database.rootPageActive = rootPage ? rootPage.isActive : false;
      
      // Add issues for inactive domain or missing root page
      if (!domainDoc.isActive) {
        results.issues.push('Domain is not active in the database');
        results.recommendations.push('Activate the domain in the database');
      }
      
      if (!rootPage) {
        results.issues.push('Domain does not have a root page');
        results.recommendations.push('Create a root page for this domain');
      } else if (!rootPage.isActive) {
        results.issues.push('Root page exists but is not active');
        results.recommendations.push('Activate the root page in the database');
      }
    } else {
      results.issues.push('Domain not found in database');
      results.recommendations.push('Add this domain to the database');
    }
    
    // Handle TLD case
    if (results.extraction.isTLD) {
      // Check if PRIMARY_DOMAIN is set
      if (process.env.PRIMARY_DOMAIN) {
        results.recommendations.push(`TLD detected. System will use PRIMARY_DOMAIN: ${process.env.PRIMARY_DOMAIN}`);
      } else {
        results.issues.push('PRIMARY_DOMAIN environment variable is not set');
        results.recommendations.push('Set PRIMARY_DOMAIN environment variable to handle TLD-only requests');
      }
    }
    
    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Error testing domain routing:', error);
    return NextResponse.json(
      { error: `Error testing domain routing: ${error.message}` },
      { status: 500 }
    );
  }
} 