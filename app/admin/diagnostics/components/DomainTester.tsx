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
      console.error('Error testing domain routing:', error);
      setTestResults({ error: 'Failed to test domain routing' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Domain Routing Test</h2>
      <p className="mb-4 text-gray-600">
        This tool simulates how your domain is processed by the application's routing system. It helps diagnose issues where domains might be incorrectly handled.
      </p>
      
      <div className="space-y-4 mb-6">
        <div className="flex items-center space-x-2">
          <input
            type="radio"
            id="selectFromDomains"
            checked={!useCustomDomain}
            onChange={() => setUseCustomDomain(false)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="selectFromDomains" className="text-sm font-medium text-gray-700">
            Select from your domains
          </label>
        </div>
        
        {!useCustomDomain && (
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          >
            <option value="">Select a domain</option>
            {domains.map((domain) => (
              <option key={domain._id} value={domain.name}>
                {domain.name}
              </option>
            ))}
          </select>
        )}
        
        <div className="flex items-center space-x-2">
          <input
            type="radio"
            id="enterCustomDomain"
            checked={useCustomDomain}
            onChange={() => setUseCustomDomain(true)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="enterCustomDomain" className="text-sm font-medium text-gray-700">
            Enter a custom domain
          </label>
        </div>
        
        {useCustomDomain && (
          <input
            type="text"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="Enter domain (e.g., example.com)"
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          />
        )}
        
        <button
          onClick={handleTest}
          disabled={isLoading || (!selectedDomain && !useCustomDomain) || (useCustomDomain && !customDomain)}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-2 px-4 rounded-md shadow-sm"
        >
          {isLoading ? 'Testing Domain Routing...' : 'Test Domain Routing'}
        </button>
      </div>
      
      {/* Results Section */}
      {testResults && (
        <div className="border rounded-md overflow-hidden">
          <div className="bg-gray-100 p-4 font-medium border-b">Test Results for {testResults.domain}</div>
          <div className="p-4">
            {testResults.error ? (
              <div className="text-red-600">{testResults.error}</div>
            ) : (
              <div className="space-y-6">
                {/* Domain Processing Overview */}
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">Domain Processing Overview</h3>
                  <div className="bg-gray-50 p-3 rounded space-y-2">
                    <div>
                      <span className="text-gray-600">Original:</span> {testResults.extraction.original}
                    </div>
                    <div>
                      <span className="text-gray-600">After www removal:</span> {testResults.extraction.afterWwwRemoval}
                    </div>
                    <div>
                      <span className="text-gray-600">Domain parts:</span> {testResults.extraction.parts.join(', ')}
                    </div>
                    <div>
                      <span className="text-gray-600">Is TLD only:</span> {testResults.extraction.isTLD ? 'Yes' : 'No'}
                    </div>
                    <div>
                      <span className="text-gray-600">Is valid format:</span> {testResults.extraction.isValid ? 'Yes' : 'No'}
                    </div>
                    <div>
                      <span className="text-gray-600">Routing to:</span> {testResults.middleware.routingTo}
                    </div>
                  </div>
                </div>

                {/* Database Status */}
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">Database Status</h3>
                  <div className="bg-gray-50 p-3 rounded">
                    {testResults.database.found ? (
                      <div className="space-y-2">
                        <div className="text-green-600 font-medium">Found in database</div>
                        <div>
                          <span className="text-gray-600">Domain Name:</span> {testResults.database.name}
                        </div>
                        <div>
                          <span className="text-gray-600">Active:</span> {testResults.database.isActive ? 'Yes' : 'No'}
                        </div>
                        <div>
                          <span className="text-gray-600">Has Root Page:</span> {testResults.database.hasRootPage ? 'Yes' : 'No'}
                        </div>
                        {testResults.database.hasRootPage && (
                          <div>
                            <span className="text-gray-600">Root Page Active:</span> {testResults.database.rootPageActive ? 'Yes' : 'No'}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-red-600">Not found in database</div>
                    )}
                  </div>
                </div>

                {/* Issues & Recommendations */}
                {(testResults.issues.length > 0 || testResults.recommendations.length > 0) && (
                  <div>
                    {testResults.issues.length > 0 && (
                      <div className="mb-4">
                        <h3 className="font-medium text-gray-700 mb-2">Issues Detected</h3>
                        <div className="bg-red-50 border border-red-100 p-3 rounded">
                          <ul className="list-disc list-inside space-y-1 text-red-700">
                            {testResults.issues.map((issue: string, index: number) => (
                              <li key={index}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                    
                    {testResults.recommendations.length > 0 && (
                      <div>
                        <h3 className="font-medium text-gray-700 mb-2">Recommendations</h3>
                        <div className="bg-blue-50 border border-blue-100 p-3 rounded">
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
                
                {testResults.issues.length === 0 && (
                  <div className="bg-green-50 border border-green-100 p-3 rounded text-green-700">
                    No routing issues detected with this domain.
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