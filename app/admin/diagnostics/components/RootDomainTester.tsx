'use client';

import { useState } from 'react';

type Domain = {
  _id: string;
  name: string;
  isActive: boolean;
};

type RootDomainTesterProps = {
  domains: Domain[];
};

export default function RootDomainTester({ domains }: RootDomainTesterProps) {
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
      const response = await fetch('/api/diagnostics/test-root-domain', {
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
        error: 'Failed to test root domain connectivity'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-8 border border-orange-200 rounded-lg p-4 bg-orange-50">
      <h2 className="text-lg font-semibold mb-4">Root Domain Connectivity Tester</h2>
      <p className="mb-4 text-gray-600">
        This tool directly tests both the root domain and www subdomain connectivity to help diagnose issues.
      </p>
      
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
              className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white py-2 px-4 rounded-r-md shadow-sm"
            >
              {isLoading ? 'Testing...' : 'Test Connectivity'}
            </button>
          </div>
        </div>
      </div>
      
      {testResults && (
        <div className="border rounded-md overflow-hidden">
          <div className="bg-gray-100 p-4 font-medium border-b">Root Domain Test Results</div>
          <div className="p-4">
            {testResults.error ? (
              <div className="text-red-600">{testResults.error}</div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-gray-700">Domain Information</h3>
                  <div className="mt-2 bg-gray-50 p-3 rounded">
                    <p><span className="font-medium">Testing domain:</span> {testResults.domain}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`border rounded p-4 ${testResults.rootDomainTest.success ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                    <h3 className="font-medium mb-2">{`Root Domain (${testResults.domain})`}</h3>
                    
                    <div className="flex items-center mb-2">
                      <div className={`w-3 h-3 rounded-full mr-2 ${testResults.rootDomainTest.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <p className={`font-medium ${testResults.rootDomainTest.success ? 'text-green-600' : 'text-red-600'}`}>
                        {testResults.rootDomainTest.success ? 'Working' : 'Not Working'}
                      </p>
                    </div>
                    
                    <p className="text-sm mb-1">
                      <span className="font-medium">Status code:</span> {testResults.rootDomainTest.statusCode}
                    </p>
                    
                    {testResults.rootDomainTest.error && (
                      <p className="text-sm text-red-600">
                        <span className="font-medium">Error:</span> {testResults.rootDomainTest.error}
                      </p>
                    )}
                    
                    {testResults.rootDomainTest.headers['x-matched-path'] && (
                      <p className="text-sm mt-2">
                        <span className="font-medium">Matched path:</span> {testResults.rootDomainTest.headers['x-matched-path']}
                        {testResults.rootDomainTest.headers['x-matched-path'] === '/[subdomain]' && (
                          <span className="text-red-600 block mt-1">
                            ⚠️ Root domain is incorrectly matching the subdomain route!
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                
                  <div className={`border rounded p-4 ${testResults.wwwDomainTest.success ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                    <h3 className="font-medium mb-2">{`WWW Domain (www.${testResults.domain})`}</h3>
                    
                    <div className="flex items-center mb-2">
                      <div className={`w-3 h-3 rounded-full mr-2 ${testResults.wwwDomainTest.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <p className={`font-medium ${testResults.wwwDomainTest.success ? 'text-green-600' : 'text-red-600'}`}>
                        {testResults.wwwDomainTest.success ? 'Working' : 'Not Working'}
                      </p>
                    </div>
                    
                    <p className="text-sm mb-1">
                      <span className="font-medium">Status code:</span> {testResults.wwwDomainTest.statusCode}
                    </p>
                    
                    {testResults.wwwDomainTest.error && (
                      <p className="text-sm text-red-600">
                        <span className="font-medium">Error:</span> {testResults.wwwDomainTest.error}
                      </p>
                    )}
                    
                    {testResults.wwwDomainTest.redirect && (
                      <p className="text-sm text-green-600 mt-1">
                        <span className="font-medium">Redirects to:</span> {testResults.wwwDomainTest.redirect}
                      </p>
                    )}
                  </div>
                </div>
                
                {testResults.issues && testResults.issues.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700">Issues</h3>
                    <div className="mt-2 bg-red-50 border border-red-100 p-3 rounded">
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
                    <div className="mt-2 bg-blue-50 border border-blue-100 p-3 rounded">
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