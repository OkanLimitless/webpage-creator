'use client';

import { useState } from 'react';

type Domain = {
  _id: string;
  name: string;
  verificationStatus: 'pending' | 'active' | 'inactive' | 'error';
  isActive: boolean;
  cloudflareZoneId?: string;
};

type DomainTesterProps = {
  domains: Domain[];
};

export default function DomainTester({ domains }: DomainTesterProps) {
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [customDomain, setCustomDomain] = useState<string>('');
  const [useCustomDomain, setUseCustomDomain] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showTldTest, setShowTldTest] = useState<boolean>(false);
  const [tldTestDomain, setTldTestDomain] = useState<string>('');
  const [showWwwTest, setShowWwwTest] = useState<boolean>(false);
  const [wwwTestDomain, setWwwTestDomain] = useState<string>('');

  const handleTest = async () => {
    const domainToTest = useCustomDomain ? customDomain : selectedDomain;
    
    if (!domainToTest) {
      alert('Please select or enter a domain to test');
      return;
    }
    
    setIsLoading(true);
    setTestResults(null);
    
    try {
      const response = await fetch('/api/diagnostics/test-domain-routing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain: domainToTest }),
      });
      
      const data = await response.json();
      setTestResults(data.results);
    } catch (error) {
      console.error('Error testing domain:', error);
      setTestResults({
        error: 'Failed to test domain routing'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTldTest = async () => {
    if (!tldTestDomain) {
      alert('Please enter a domain to extract TLD from');
      return;
    }
    
    // Extract just the TLD from the domain
    const parts = tldTestDomain.toLowerCase().split('.');
    if (parts.length < 2) {
      alert('Please enter a valid domain (e.g., example.com)');
      return;
    }
    
    const tld = parts[parts.length - 1];
    
    setIsLoading(true);
    setTestResults(null);
    
    try {
      const response = await fetch('/api/diagnostics/test-domain-routing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain: tld }),
      });
      
      const data = await response.json();
      setTestResults({
        ...data.results,
        note: `Testing with TLD "${tld}" extracted from "${tldTestDomain}"`
      });
    } catch (error) {
      console.error('Error testing TLD:', error);
      setTestResults({
        error: 'Failed to test TLD routing'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWwwTest = async () => {
    if (!wwwTestDomain) {
      alert('Please enter a domain to test with www prefix');
      return;
    }
    
    // Ensure the domain doesn't already have www prefix
    let domain = wwwTestDomain.toLowerCase();
    if (domain.startsWith('www.')) {
      domain = domain.substring(4);
    }
    
    // Add www prefix for testing
    const wwwDomain = `www.${domain}`;
    
    setIsLoading(true);
    setTestResults(null);
    
    try {
      const response = await fetch('/api/diagnostics/test-domain-routing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain: wwwDomain }),
      });
      
      const data = await response.json();
      setTestResults({
        ...data.results,
        note: `Testing with www prefix: "${wwwDomain}"`
      });
    } catch (error) {
      console.error('Error testing www domain:', error);
      setTestResults({
        error: 'Failed to test www routing'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Domain Route Tester</h2>
      <p className="mb-4 text-gray-600">
        Test how a domain will be processed by the routing system.
      </p>
      
      {/* Testing options */}
      <div className="mb-6 bg-blue-50 border border-blue-200 p-4 rounded-md">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Domain Testing Options</h3>
            <div className="mt-2 text-sm text-blue-700 space-y-2">
              <p>
                Choose the type of domain test to run:
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                <button 
                  className={`text-blue-800 text-xs font-medium px-2 py-1 rounded-full ${!showTldTest && !showWwwTest ? 'bg-blue-200' : 'bg-white border border-blue-300'}`}
                  onClick={() => {
                    setShowTldTest(false);
                    setShowWwwTest(false);
                  }}
                >
                  Standard Test
                </button>
                <button 
                  className={`text-blue-800 text-xs font-medium px-2 py-1 rounded-full ${showTldTest ? 'bg-blue-200' : 'bg-white border border-blue-300'}`}
                  onClick={() => {
                    setShowTldTest(true);
                    setShowWwwTest(false);
                  }}
                >
                  TLD-only Test
                </button>
                <button 
                  className={`text-blue-800 text-xs font-medium px-2 py-1 rounded-full ${showWwwTest ? 'bg-blue-200' : 'bg-white border border-blue-300'}`}
                  onClick={() => {
                    setShowTldTest(false);
                    setShowWwwTest(true);
                  }}
                >
                  WWW Test
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {showTldTest ? (
        <div className="mb-6 p-4 border border-gray-200 rounded-md bg-gray-50">
          <h3 className="text-md font-medium mb-3">TLD-only Test</h3>
          <p className="text-sm text-gray-600 mb-3">
            Enter a domain to extract its TLD (e.g., "example.com" will test with just "com").
            This simulates what happens when your server only receives the TLD portion of a domain.
          </p>
          
          <div className="mb-4">
            <label htmlFor="tldTestDomain" className="block text-sm font-medium text-gray-700 mb-1">
              Domain to extract TLD from
            </label>
            <div className="flex">
              <input
                type="text"
                id="tldTestDomain"
                value={tldTestDomain}
                onChange={(e) => setTldTestDomain(e.target.value)}
                placeholder="example.com"
                className="flex-1 p-2 border border-gray-300 rounded-l-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              />
              <button
                onClick={handleTldTest}
                disabled={isLoading || !tldTestDomain}
                className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-400 text-white py-2 px-4 rounded-r-md shadow-sm"
              >
                {isLoading ? 'Testing...' : 'Test TLD'}
              </button>
            </div>
          </div>
        </div>
      ) : showWwwTest ? (
        <div className="mb-6 p-4 border border-gray-200 rounded-md bg-gray-50">
          <h3 className="text-md font-medium mb-3">WWW Subdomain Test</h3>
          <p className="text-sm text-gray-600 mb-3">
            Enter a domain to test with the www prefix (e.g., "www.example.com").
            This tests how your application handles www-prefixed domains.
          </p>
          
          <div className="mb-4">
            <label htmlFor="wwwTestDomain" className="block text-sm font-medium text-gray-700 mb-1">
              Domain to test with www prefix
            </label>
            <div className="flex">
              <input
                type="text"
                id="wwwTestDomain"
                value={wwwTestDomain}
                onChange={(e) => setWwwTestDomain(e.target.value)}
                placeholder="example.com"
                className="flex-1 p-2 border border-gray-300 rounded-l-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              />
              <button
                onClick={handleWwwTest}
                disabled={isLoading || !wwwTestDomain}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white py-2 px-4 rounded-r-md shadow-sm"
              >
                {isLoading ? 'Testing...' : 'Test WWW'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6">
          <div className="mb-4">
            <div className="flex items-center mb-2">
              <input
                type="radio"
                id="useExistingDomain"
                checked={!useCustomDomain}
                onChange={() => setUseCustomDomain(false)}
                className="mr-2"
                disabled={isLoading}
              />
              <label htmlFor="useExistingDomain" className="text-sm font-medium text-gray-700">
                Test existing domain
              </label>
            </div>
            
            <select
              id="domainSelect"
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 mb-4"
              disabled={useCustomDomain || isLoading}
            >
              <option value="">Select a domain</option>
              {domains.map((domain) => (
                <option key={domain._id} value={domain.name}>
                  {domain.name}
                </option>
              ))}
            </select>
            
            <div className="flex items-center mb-2">
              <input
                type="radio"
                id="useCustomDomain"
                checked={useCustomDomain}
                onChange={() => setUseCustomDomain(true)}
                className="mr-2"
                disabled={isLoading}
              />
              <label htmlFor="useCustomDomain" className="text-sm font-medium text-gray-700">
                Test custom domain
              </label>
            </div>
            
            <div className="flex">
              <input
                type="text"
                id="customDomain"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="Enter domain to test (e.g., example.com)"
                className="flex-1 p-2 border border-gray-300 rounded-l-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={!useCustomDomain || isLoading}
              />
              <button
                onClick={handleTest}
                disabled={isLoading || (useCustomDomain ? !customDomain : !selectedDomain)}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-2 px-4 rounded-r-md shadow-sm"
              >
                {isLoading ? 'Testing...' : 'Test'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {testResults && (
        <div className="border rounded-md overflow-hidden">
          <div className="bg-gray-100 p-4 font-medium border-b">Test Results</div>
          <div className="p-4">
            {testResults.error ? (
              <div className="text-red-600">{testResults.error}</div>
            ) : (
              <div className="space-y-4">
                {testResults.note && (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded text-amber-800 text-sm">
                    {testResults.note}
                  </div>
                )}
                
                <div>
                  <h3 className="font-medium text-gray-700">Domain Information</h3>
                  <div className="mt-2 bg-gray-50 p-3 rounded">
                    <p><span className="font-medium">Domain:</span> {testResults.domain}</p>
                    {testResults.domain.startsWith('www.') && (
                      <p className="text-blue-600 text-sm mt-1">
                        This is a www subdomain which will be handled by the root domain handler.
                      </p>
                    )}
                    {testResults.tldOnly && (
                      <div className="mt-2 text-amber-600 text-sm">
                        <p className="font-bold">⚠️ TLD-only domain detected!</p>
                        <p>This appears to be just a TLD without a domain name.</p>
                        {testResults.tldOnly.primaryDomainSet ? (
                          <p className="text-green-600">
                            PRIMARY_DOMAIN is set to: {testResults.primaryDomain.value}
                          </p>
                        ) : (
                          <p>
                            Using database-based domain fallback for TLD-only requests.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-700">Domain Extraction</h3>
                  <div className="mt-2 bg-gray-50 p-3 rounded text-sm">
                    <p><span className="font-medium">Original:</span> {testResults.extraction.original}</p>
                    <p><span className="font-medium">After processing:</span> {testResults.extraction.afterWwwRemoval}</p>
                    {testResults.extraction.original !== testResults.extraction.afterWwwRemoval && (
                      <p className="text-blue-600">
                        www prefix was detected and removed during processing.
                      </p>
                    )}
                    <p>
                      <span className="font-medium">Valid format:</span> 
                      <span className={testResults.extraction.isValid ? 'text-green-600' : 'text-red-600'}>
                        {testResults.extraction.isValid ? 'Yes' : 'No'}
                      </span>
                    </p>
                    {testResults.extraction.isTLD && (
                      <p className="text-red-600 font-medium">This is just a TLD without a domain name.</p>
                    )}
                    {testResults.extraction.fallbackOptions.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium">Fallback options:</p>
                        <ul className="list-disc list-inside">
                          {testResults.extraction.fallbackOptions.map((option: string, index: number) => (
                            <li key={index} className={option.includes('No PRIMARY_DOMAIN') ? 'text-red-600' : 'text-green-600'}>
                              {option}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-700">Middleware Routing</h3>
                  <div className="mt-2 bg-gray-50 p-3 rounded text-sm">
                    <p>
                      <span className="font-medium">Has subdomain:</span> 
                      {testResults.middleware.hasSubdomain ? 'Yes' : 'No'}
                    </p>
                    {testResults.domain.startsWith('www.') && (
                      <p className="text-blue-600">
                        www prefix detected and will be handled by the root domain handler.
                      </p>
                    )}
                    {testResults.middleware.hasSubdomain && !testResults.domain.startsWith('www.') && (
                      <p>
                        <span className="font-medium">Subdomain:</span> {testResults.middleware.subdomain}
                        {testResults.middleware.isValidSubdomain === false && (
                          <span className="text-red-600 ml-2">(Invalid subdomain type)</span>
                        )}
                      </p>
                    )}
                    <p><span className="font-medium">Routes to:</span> {testResults.middleware.routingTo}</p>
                    {testResults.middleware.issues && testResults.middleware.issues.length > 0 && (
                      <div className="mt-2 text-red-600">
                        <p className="font-medium">Issues detected:</p>
                        <ul className="list-disc list-inside">
                          {testResults.middleware.issues.map((issue: string, index: number) => (
                            <li key={index}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-700">Database Check</h3>
                  <div className="mt-2 bg-gray-50 p-3 rounded text-sm">
                    {testResults.usedPrimaryDomainForDbCheck && (
                      <p className="text-amber-600 mb-2">
                        Using PRIMARY_DOMAIN for database check because the input was TLD-only.
                      </p>
                    )}
                    {testResults.usedDomainWithMatchingTLD && (
                      <p className="text-amber-600 mb-2">
                        Using domain with matching TLD for database check: {testResults.matchingTldDomain}
                      </p>
                    )}
                    {testResults.database.found ? (
                      <>
                        <p className="text-green-600 font-medium">Domain found in database</p>
                        <p><span className="font-medium">Name:</span> {testResults.database.name}</p>
                        <p>
                          <span className="font-medium">Active:</span> 
                          <span className={testResults.database.isActive ? 'text-green-600' : 'text-red-600'}>
                            {testResults.database.isActive ? 'Yes' : 'No'}
                          </span>
                        </p>
                        <p>
                          <span className="font-medium">Verification status:</span> 
                          <span className={testResults.database.verificationStatus === 'active' ? 'text-green-600' : 'text-amber-600'}>
                            {testResults.database.verificationStatus}
                          </span>
                        </p>
                        <p>
                          <span className="font-medium">Root page:</span> 
                          <span className={testResults.database.hasRootPage ? 'text-green-600' : 'text-red-600'}>
                            {testResults.database.hasRootPage ? 'Yes' : 'No'}
                          </span>
                        </p>
                        {testResults.database.hasRootPage && (
                          <>
                            <p>
                              <span className="font-medium">Root page active:</span> 
                              <span className={testResults.database.rootPageActive ? 'text-green-600' : 'text-red-600'}>
                                {testResults.database.rootPageActive ? 'Yes' : 'No'}
                              </span>
                            </p>
                            {testResults.database.redirectWwwToNonWww !== undefined && (
                              <p>
                                <span className="font-medium">WWW to non-WWW redirect:</span> 
                                <span className={testResults.database.redirectWwwToNonWww ? 'text-green-600' : 'text-amber-600'}>
                                  {testResults.database.redirectWwwToNonWww ? 'Enabled' : 'Disabled'}
                                </span>
                              </p>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <p className="text-red-600 font-medium">Domain not found in database</p>
                    )}
                  </div>
                </div>
                
                {testResults.issues && testResults.issues.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700">Issues</h3>
                    <div className="mt-2 bg-red-50 border border-red-100 p-3 rounded text-sm">
                      <ul className="list-disc list-inside space-y-1 text-red-700">
                        {testResults.issues.map((issue: string, index: number) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                
                {testResults.recommendations && testResults.recommendations.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700">Recommendations</h3>
                    <div className="mt-2 bg-blue-50 border border-blue-100 p-3 rounded text-sm">
                      <ul className="list-disc list-inside space-y-1 text-blue-700">
                        {testResults.recommendations.map((rec: string, index: number) => (
                          <li key={index}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 