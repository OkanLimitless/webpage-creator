'use client';

import { useState } from 'react';

type Domain = {
  _id: string;
  name: string;
  isActive: boolean;
};

type DomainTesterProps = {
  domains: Domain[];
};

export default function DomainTester({ domains }: DomainTesterProps) {
  const [domainToTest, setDomainToTest] = useState<string>('');
  const [customDomain, setCustomDomain] = useState<string>('');
  const [useCustomDomain, setUseCustomDomain] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Determine which domain to test
    const domainValue = useCustomDomain ? customDomain : domainToTest;
    
    if (!domainValue) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/diagnostics/test-domain-routing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain: domainValue }),
      });
      
      const data = await response.json();
      setTestResults(data.results);
    } catch (error) {
      console.error('Error testing domain:', error);
      setTestResults({
        error: 'Failed to test domain routing',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Domain Routing Test</h2>
      <p className="mb-4 text-gray-600">
        This tool simulates how your domain is processed by the application's routing system.
        It helps diagnose issues where domains might be incorrectly handled.
      </p>
      
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="mb-4">
          <div className="flex items-center mb-2">
            <input
              type="radio"
              id="selectDomain"
              name="domainSource"
              checked={!useCustomDomain}
              onChange={() => setUseCustomDomain(false)}
              className="mr-2"
            />
            <label htmlFor="selectDomain" className="text-sm text-gray-700">
              Select from your domains
            </label>
          </div>
          
          <select
            value={domainToTest}
            onChange={(e) => setDomainToTest(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            disabled={useCustomDomain || isLoading}
          >
            <option value="">Select a domain</option>
            {domains.map((domain) => (
              <option key={domain._id} value={domain.name}>
                {domain.name} {!domain.isActive && '(inactive)'}
              </option>
            ))}
          </select>
        </div>
        
        <div className="mb-4">
          <div className="flex items-center mb-2">
            <input
              type="radio"
              id="customDomain"
              name="domainSource"
              checked={useCustomDomain}
              onChange={() => setUseCustomDomain(true)}
              className="mr-2"
            />
            <label htmlFor="customDomain" className="text-sm text-gray-700">
              Enter a custom domain
            </label>
          </div>
          
          <input
            type="text"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="Enter domain (e.g., example.com)"
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            disabled={!useCustomDomain || isLoading}
          />
        </div>
        
        <button
          type="submit"
          disabled={(!domainToTest && !useCustomDomain) || (useCustomDomain && !customDomain) || isLoading}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-2 px-4 rounded-md shadow-sm"
        >
          {isLoading ? 'Testing...' : 'Test Domain Routing'}
        </button>
      </form>
      
      {testResults && (
        <div className="border rounded-md overflow-hidden">
          <div className="bg-gray-100 p-4 font-medium border-b">Test Results</div>
          <div className="p-4">
            {testResults.error ? (
              <div className="text-red-600">{testResults.error}</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-700">1. Middleware Processing</h3>
                  <div className="mt-2 bg-gray-50 p-3 rounded text-sm font-mono whitespace-pre-wrap">
                    {testResults.middleware && (
                      <>
                        <div>Has subdomain: {testResults.middleware.hasSubdomain ? 'Yes' : 'No'}</div>
                        <div>Extracted subdomain: {testResults.middleware.subdomain || 'None'}</div>
                        <div>Routing to: {testResults.middleware.routingTo}</div>
                      </>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-700">2. Domain Extraction</h3>
                  <div className="mt-2 bg-gray-50 p-3 rounded text-sm font-mono whitespace-pre-wrap">
                    {testResults.extraction && (
                      <>
                        <div>Original domain: {testResults.extraction.original}</div>
                        <div>After www removal: {testResults.extraction.afterWwwRemoval}</div>
                        <div>Domain parts: [{testResults.extraction.parts.join(', ')}]</div>
                        <div>Valid format: {testResults.extraction.isValid ? 'Yes' : 'No'}</div>
                      </>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-700">3. Database Lookup</h3>
                  <div className="mt-2 bg-gray-50 p-3 rounded text-sm font-mono whitespace-pre-wrap">
                    {testResults.database && (
                      <>
                        <div>Domain found: {testResults.database.found ? 'Yes' : 'No'}</div>
                        {testResults.database.found && (
                          <>
                            <div>Domain ID: {testResults.database.id}</div>
                            <div>Is active: {testResults.database.isActive ? 'Yes' : 'No'}</div>
                            <div>Has root page: {testResults.database.hasRootPage ? 'Yes' : 'No'}</div>
                          </>
                        )}
                        {!testResults.database.found && (
                          <div className="text-red-600 mt-2">
                            Domain not found in database. This will result in a "Domain not found" error.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                
                {testResults.issues && testResults.issues.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700">Issues Detected</h3>
                    <div className="mt-2 bg-red-50 border border-red-100 p-3 rounded text-sm">
                      <ul className="list-disc list-inside space-y-1 text-red-700">
                        {testResults.issues.map((issue: string, index: number) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                
                {testResults.recommendations && (
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