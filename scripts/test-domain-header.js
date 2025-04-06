// Script to test domain header processing
process.env.NODE_ENV = 'development';

// Test how domain headers are processed
function testDomainHeaderProcessing() {
  console.log('Domain Header Processing Test');
  console.log('=============================');
  
  // Get domain from command line arguments
  const testDomain = process.argv[2];
  
  if (!testDomain) {
    console.error('Error: No domain specified');
    console.log('Usage: node test-domain-header.js <domain>');
    return;
  }
  
  console.log(`Testing domain header processing for: ${testDomain}`);
  
  // Test 1: Simulate middleware processing
  console.log('\n1. Middleware processing:');
  
  const hasSubdomain = hasValidSubdomain(testDomain);
  console.log(`   hasValidSubdomain('${testDomain}'): ${hasSubdomain}`);
  
  const subdomain = getSubdomain(testDomain);
  console.log(`   getSubdomain('${testDomain}'): ${subdomain ? `'${subdomain}'` : 'empty string'}`);
  
  console.log(`   Middleware would route to: ${!hasSubdomain ? 'Root domain handler' : 'Subdomain handler'}`);
  
  // Test 2: Simulate route handler processing
  console.log('\n2. Route handler domain extraction:');
  
  // Extract domain (remove www. if present)
  let domain = testDomain.replace(/^www\./i, '');
  console.log(`   After www removal: '${domain}'`);
  
  // Remove port number if present (for development)
  domain = domain.split(':')[0];
  console.log(`   After port removal: '${domain}'`);
  
  // Test domain validation
  const isValidDomain = domain.includes('.');
  console.log(`   Domain includes '.': ${isValidDomain}`);
  
  // Escape domain for regex
  const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  console.log(`   Escaped for regex: '${escapedDomain}'`);
  console.log(`   Regex pattern: /^${escapedDomain}$/i`);
  
  // Test 3: Additional checks
  console.log('\n3. Additional tests:');
  
  // Test with www prefix
  const wwwDomain = `www.${testDomain}`;
  console.log(`   www domain: '${wwwDomain}'`);
  console.log(`   hasValidSubdomain('${wwwDomain}'): ${hasValidSubdomain(wwwDomain)}`);
  
  // Test with subdomain
  const landingDomain = `landing.${testDomain}`;
  console.log(`   landing subdomain: '${landingDomain}'`);
  console.log(`   hasValidSubdomain('${landingDomain}'): ${hasValidSubdomain(landingDomain)}`);
  
  // Test domain parts extraction
  const domainParts = testDomain.split('.');
  console.log(`   Domain parts: [${domainParts.map(p => `'${p}'`).join(', ')}]`);
  console.log(`   TLD: '${domainParts[domainParts.length - 1]}'`);
  
  // Special check for TLD being mistaken for domain
  if (domainParts.length === 1) {
    console.error('\n⚠️ WARNING: The domain appears to be just a TLD. This will cause "Domain not found: [TLD]" errors.');
    console.log('   Recommendation: Use a full domain name (e.g., example.com)');
  }
  
  // Check for potential issues in processing
  console.log('\nPotential issues:');
  
  if (!isValidDomain) {
    console.log('❌ The domain does not include a dot, which would trigger the invalid domain error');
  } else {
    console.log('✅ Domain format validation would pass');
  }
  
  if (domainParts.length === 1) {
    console.log('❌ The domain has only one part, which will cause issues in database lookup');
  } else {
    console.log('✅ Domain has multiple parts (correct format)');
  }
}

// From middleware.ts - Has valid subdomain function
function hasValidSubdomain(hostname) {
  // Skip for localhost (direct development without subdomains)
  if (hostname.includes('localhost')) return false;
  
  // Skip for IP addresses
  if (/^(\d{1,3}\.){3}\d{1,3}/.test(hostname)) return false;
  
  // For Vercel preview URLs, we don't have a real subdomain structure
  if (hostname.endsWith('vercel.app')) return false;
  
  // Extract parts
  const parts = hostname.split('.');
  
  // Check for direct localhost access with port, e.g., localhost:3000
  if (parts[0] === 'localhost') return false;
  
  // If hostname is just 'example.com' or 'www.example.com', there's no subdomain
  // Check length to ensure we have at least example.com (2 parts)
  if (parts.length < 3) return false;
  
  // Check if it's www (not a real subdomain for our routing purposes)
  if (parts[0] === 'www') return false;
  
  // Validate if it's a known subdomain type
  const validPrefixes = ['landing', 'app', 'dashboard', 'admin'];
  return validPrefixes.includes(parts[0]);
}

// From middleware.ts - Get subdomain function
function getSubdomain(hostname) {
  // Skip for non-production environments
  if (hostname.includes('localhost')) return '';
  if (hostname.endsWith('vercel.app')) return '';
  
  // Extract the subdomain part (first segment of the hostname)
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0];
  }
  
  return '';
}

// Run the test
testDomainHeaderProcessing(); 