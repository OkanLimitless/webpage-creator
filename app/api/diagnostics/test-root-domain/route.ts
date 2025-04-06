import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import fetch from 'node-fetch';

// Define types to fix linting issues
type TestResult = {
  success: boolean;
  statusCode: number | null;
  headers: Record<string, string>;
  error: string | null;
  redirect?: string;
};

type TestResults = {
  domain: string;
  rootDomainTest: TestResult;
  wwwDomainTest: TestResult;
  issues: string[];
  recommendations: string[];
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain } = body;
    
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain is required' },
        { status: 400 }
      );
    }
    
    const cleanDomain = domain.replace(/^www\./i, '').toLowerCase();
    
    const results: TestResults = {
      domain: cleanDomain,
      rootDomainTest: { success: false, statusCode: null, headers: {}, error: null },
      wwwDomainTest: { success: false, statusCode: null, headers: {}, error: null },
      issues: [],
      recommendations: []
    };

    // Test root domain (non-www)
    try {
      const rootUrl = `https://${cleanDomain}`;
      console.log(`Testing root domain: ${rootUrl}`);
      
      const response = await fetch(rootUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Domain-Tester/1.0'
        },
        redirect: 'manual'
      });
      
      results.rootDomainTest.success = response.status < 400;
      results.rootDomainTest.statusCode = response.status;
      
      // Collect headers
      response.headers.forEach((value: string, name: string) => {
        results.rootDomainTest.headers[name] = value;
      });
      
      if (response.status === 404 && (
          response.headers.get('server') === 'Vercel' || 
          response.headers.get('x-vercel-id'))) {
        results.issues.push('Root domain returns 404 from Vercel - domain is configured but not routing correctly');
        results.recommendations.push('Check that your middleware is correctly routing root domain requests');
        results.recommendations.push('Make sure your domains are added in Vercel project settings');
      } else if (response.status >= 400) {
        results.issues.push(`Root domain returns error status ${response.status}`);
      }
    } catch (error: any) {
      results.rootDomainTest.success = false;
      results.rootDomainTest.error = error.message;
      results.issues.push(`Error testing root domain: ${error.message}`);
    }
    
    // Test www domain
    try {
      const wwwUrl = `https://www.${cleanDomain}`;
      console.log(`Testing www domain: ${wwwUrl}`);
      
      const response = await fetch(wwwUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Domain-Tester/1.0'
        },
        redirect: 'manual'
      });
      
      results.wwwDomainTest.success = response.status < 400;
      results.wwwDomainTest.statusCode = response.status;
      
      // Collect headers
      response.headers.forEach((value: string, name: string) => {
        results.wwwDomainTest.headers[name] = value;
      });
      
      // Check if www redirects to non-www (which is common)
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location) {
          results.wwwDomainTest.redirect = location;
          
          try {
            const redirectUrl = new URL(location);
            if (redirectUrl.hostname === cleanDomain) {
              results.recommendations.push(`www subdomain redirects to non-www version (${response.status} redirect) - this is good`);
            }
          } catch (e) {
            // Invalid URL in location header
          }
        }
      } else if (response.status === 404 && (
          response.headers.get('server') === 'Vercel' || 
          response.headers.get('x-vercel-id'))) {
        results.issues.push('www domain returns 404 from Vercel - subdomain is configured but not routing correctly');
      } else if (response.status >= 400) {
        results.issues.push(`www domain returns error status ${response.status}`);
      }
    } catch (error: any) {
      results.wwwDomainTest.success = false;
      results.wwwDomainTest.error = error.message;
      results.issues.push(`Error testing www domain: ${error.message}`);
    }
    
    // Add recommendations based on test results
    if (!results.rootDomainTest.success && !results.wwwDomainTest.success) {
      results.recommendations.push('Both root domain and www subdomain are not working - check DNS configuration');
      results.recommendations.push('Make sure domain is added to Vercel and DNS points to Vercel');
    } else if (!results.rootDomainTest.success && results.wwwDomainTest.success) {
      results.recommendations.push('Root domain is not working but www subdomain is - check root domain DNS record');
      results.recommendations.push('Use the Fix Domain feature in the admin panel to correct root domain issues');
    } else if (results.rootDomainTest.success && !results.wwwDomainTest.success) {
      results.recommendations.push('Root domain is working but www subdomain is not - check www subdomain DNS record');
    }
    
    // Check for x-matched-path header which indicates the Next.js route being matched
    if (results.rootDomainTest.headers['x-matched-path']) {
      const matchedPath = results.rootDomainTest.headers['x-matched-path'];
      
      if (matchedPath === '/[subdomain]') {
        results.issues.push('Root domain is being incorrectly matched to the [subdomain] route');
        results.recommendations.push('Your middleware needs to be fixed to correctly route root domain requests');
      }
    }
    
    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Error testing root domain:', error);
    return NextResponse.json(
      { error: `Error testing root domain: ${error.message}` },
      { status: 500 }
    );
  }
} 