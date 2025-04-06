import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { RootPage } from '@/lib/models/RootPage';

// Enhanced list of common TLDs
const commonTLDs = ['com', 'net', 'org', 'io', 'app', 'dev', 'co', 'ai', 'tech', 'site', 'online'];

// Simulate middleware function to test domain routing
function simulateMiddleware(hostname: string) {
  // Remove www. if present
  const cleanHostname = hostname.replace(/^www\./i, '');
  
  // Force lowercase
  const lowerHostname = cleanHostname.toLowerCase();
  
  // Check if TLD only
  const isDomainJustTLD = commonTLDs.includes(lowerHostname);
  
  if (isDomainJustTLD || !lowerHostname.includes('.')) {
    return {
      hasSubdomain: false,
      subdomain: '',
      routingTo: 'Route Handler with TLD fallback',
      isTLD: true,
      issues: ['Hostname appears to be just a TLD or invalid, will use PRIMARY_DOMAIN fallback']
    };
  }
  
  // Check if it has a valid subdomain
  const parts = lowerHostname.split('.');
  
  const hasSubdomain = parts.length >= 3 && !['www'].includes(parts[0]);
  const validPrefixes = ['landing', 'app', 'dashboard', 'admin'];
  const isValidSubdomain = hasSubdomain && validPrefixes.includes(parts[0]);
  
  return {
    hasSubdomain,
    subdomain: hasSubdomain ? parts[0] : '',
    isValidSubdomain,
    isTLD: false,
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
  
  // Force lowercase
  domain = domain.toLowerCase();
  
  // Check if it's just a TLD
  const isTLD = commonTLDs.includes(domain);
  
  // Check format
  const isValid = domain.includes('.') && !isTLD;
  
  const fallbackOptions = [];
  
  // Possible fallback options
  if (isTLD || !isValid) {
    if (process.env.PRIMARY_DOMAIN) {
      fallbackOptions.push(`PRIMARY_DOMAIN: ${process.env.PRIMARY_DOMAIN}`);
    } else {
      fallbackOptions.push('No PRIMARY_DOMAIN environment variable set (fallback will fail)');
    }
  }
  
  return {
    original: hostname,
    afterWwwRemoval: domain,
    parts: domain.split('.'),
    isTLD,
    isValid,
    fallbackOptions,
    issues: isTLD ? ['Domain appears to be just a TLD (e.g., "com" instead of "example.com")'] : 
      (!isValid ? ['Invalid domain format (missing dots)'] : [])
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
    
    // Check PRIMARY_DOMAIN environment variable
    results.primaryDomain = {
      set: !!process.env.PRIMARY_DOMAIN,
      value: process.env.PRIMARY_DOMAIN || '',
    };
    
    // Collect issues
    if (results.middleware.issues?.length > 0) {
      results.issues.push(...results.middleware.issues);
    }
    
    if (results.extraction.issues?.length > 0) {
      results.issues.push(...results.extraction.issues);
    }
    
    // Check if domain is TLD only
    if (results.extraction.isTLD || !results.extraction.isValid) {
      // This is a special case - add specific info about TLD-only issues
      results.tldOnly = {
        detected: true,
        willFallbackToPrimaryDomain: !!process.env.PRIMARY_DOMAIN,
        primaryDomainSet: !!process.env.PRIMARY_DOMAIN
      };
      
      if (!process.env.PRIMARY_DOMAIN) {
        results.issues.push('No PRIMARY_DOMAIN environment variable set to handle TLD-only requests');
        results.recommendations.push('Set PRIMARY_DOMAIN environment variable to handle TLD-only requests');
      } else {
        results.recommendations.push(`Using PRIMARY_DOMAIN (${process.env.PRIMARY_DOMAIN}) as fallback for TLD-only requests`);
      }
    }
    
    // Get the actual domain name to check in DB (after www removal and port removal)
    // If it's just a TLD, use PRIMARY_DOMAIN if available for database check
    let domainToCheck = results.extraction.afterWwwRemoval;
    
    if (results.extraction.isTLD && process.env.PRIMARY_DOMAIN) {
      domainToCheck = process.env.PRIMARY_DOMAIN;
      results.usedPrimaryDomainForDbCheck = true;
    }
    
    // Check DB for domain
    if (domainToCheck.includes('.')) {  // Only check if it's a valid domain
      const escapedDomain = domainToCheck.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const domainDoc = await Domain.findOne({ 
        name: { $regex: new RegExp(`^${escapedDomain}$`, 'i') } 
      });
      
      if (domainDoc) {
        results.database.found = true;
        results.database.id = domainDoc._id.toString();
        results.database.name = domainDoc.name;
        results.database.isActive = domainDoc.isActive;
        results.database.verificationStatus = domainDoc.verificationStatus;
        
        // Check for root page
        const rootPage = await RootPage.findOne({ domainId: domainDoc._id });
        results.database.hasRootPage = !!rootPage;
        results.database.rootPageActive = rootPage ? rootPage.isActive : false;
        
        // Add issues for inactive domain or missing root page
        if (!domainDoc.isActive) {
          results.issues.push('Domain is not active in the database');
          results.recommendations.push('Activate the domain in the database');
        }
        
        if (domainDoc.verificationStatus !== 'active') {
          results.issues.push(`Domain verification status is "${domainDoc.verificationStatus}" (should be "active")`);
          results.recommendations.push('Verify domain in Cloudflare and check verification status');
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
    }
    
    // If TLD case and PRIMARY_DOMAIN is not set, make it a high priority recommendation
    if (results.extraction.isTLD && !process.env.PRIMARY_DOMAIN) {
      results.recommendations.unshift('⚠️ CRITICAL: Set PRIMARY_DOMAIN environment variable to fix "Domain not found: com" errors');
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