'use client';

import { useState } from 'react';

type Domain = {
  _id: string;
  name: string;
  verificationStatus: 'pending' | 'active' | 'inactive' | 'error';
  isActive: boolean;
  cloudflareZoneId?: string;
};

type DomainFixerProps = {
  domains: Domain[];
};

export default function DomainFixer({ domains }: DomainFixerProps) {
  const [selectedDomainId, setSelectedDomainId] = useState<string>('');
  const [fixResults, setFixResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPrimaryDomainInfo, setShowPrimaryDomainInfo] = useState<boolean>(false);

  const handleFix = async () => {
    if (!selectedDomainId) return;
    
    setIsLoading(true);
    setFixResults(null);
    
    try {
      const response = await fetch(`/api/diagnostics/fix-domain/${selectedDomainId}`, {
        method: 'POST',
      });
      
      const data = await response.json();
      setFixResults(data);
    } catch (error) {
      console.error('Error fixing domain:', error);
      setFixResults({
        success: false,
        error: 'Failed to fix domain configuration'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updatePrimaryDomain = async () => {
    if (!selectedDomainId) return;
    
    const domain = domains.find(d => d._id === selectedDomainId);
    if (!domain) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/diagnostics/set-primary-domain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain: domain.name }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(`Set ${domain.name} as PRIMARY_DOMAIN. The application will use this domain as a fallback for TLD-only requests. You need to redeploy your app for this change to take effect.`);
      } else {
        alert(`Error setting PRIMARY_DOMAIN: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error setting PRIMARY_DOMAIN:', error);
      alert('Failed to set PRIMARY_DOMAIN');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Fix Domain Issues</h2>
      <p className="mb-4 text-gray-600">
        This tool helps fix common domain configuration issues automatically.
      </p>
      
      {/* TLD-only issue info box */}
      <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-md">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-amber-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-amber-800">Fixing "Domain not found: com" Error</h3>
            <div className="mt-2 text-sm text-amber-700">
              <p>
                If you're seeing the "Domain not found: com" error, your site is only receiving the TLD instead of the full domain. 
                Set the PRIMARY_DOMAIN environment variable to fix this issue.
              </p>
              <button 
                className="text-amber-800 font-medium underline mt-2"
                onClick={() => setShowPrimaryDomainInfo(!showPrimaryDomainInfo)}
              >
                {showPrimaryDomainInfo ? 'Hide details' : 'Learn more'}
              </button>
              
              {showPrimaryDomainInfo && (
                <div className="mt-3 bg-white p-3 rounded border border-amber-100 text-gray-700">
                  <p className="mb-2">
                    This issue typically happens because of one of the following reasons:
                  </p>
                  <ul className="list-disc list-inside space-y-1 mb-2">
                    <li>Misconfiguration in the DNS settings</li>
                    <li>Problems with Cloudflare SSL settings</li>
                    <li>Issues with how the domain is processed by the middleware</li>
                  </ul>
                  <p>
                    Setting PRIMARY_DOMAIN provides a fallback domain when the system only receives a TLD.
                    After setting it, you should redeploy your application to ensure the changes take effect.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="mb-6">
        <label htmlFor="domainSelect" className="block text-sm font-medium text-gray-700 mb-2">
          Select Domain
        </label>
        <select
          id="domainSelect"
          value={selectedDomainId}
          onChange={(e) => setSelectedDomainId(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 mb-4"
          disabled={isLoading}
        >
          <option value="">Select a domain</option>
          {domains.map((domain) => (
            <option key={domain._id} value={domain._id}>
              {domain.name}
            </option>
          ))}
        </select>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={updatePrimaryDomain}
            disabled={!selectedDomainId || isLoading}
            className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-400 text-white py-2 px-4 rounded-md shadow-sm font-medium"
          >
            {isLoading ? 'Setting...' : 'Set as PRIMARY_DOMAIN'}
          </button>
          
          <button
            onClick={handleFix}
            disabled={!selectedDomainId || isLoading}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-2 px-4 rounded-md shadow-sm"
          >
            {isLoading ? 'Fixing Issues...' : 'Fix All Issues'}
          </button>
        </div>
        
        <div className="mt-2 text-xs text-gray-500">
          <p>The "Fix All Issues" button will also set PRIMARY_DOMAIN among other fixes.</p>
        </div>
      </div>
      
      {fixResults && (
        <div className="border rounded-md overflow-hidden">
          <div className="bg-gray-100 p-4 font-medium border-b">Fix Results</div>
          <div className="p-4">
            {fixResults.error ? (
              <div className="text-red-600">{fixResults.error}</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-700">Actions Performed</h3>
                  <div className="mt-2 bg-gray-50 p-3 rounded">
                    {fixResults.actions && fixResults.actions.length > 0 ? (
                      <ul className="list-disc list-inside space-y-1">
                        {fixResults.actions.map((action: any, index: number) => (
                          <li key={index} className={action.success ? 'text-green-600' : 'text-red-600'}>
                            {action.description}
                            {action.details && (
                              <span className="text-gray-600 block ml-6 text-xs mt-1">{action.details}</span>
                            )}
                            {!action.success && action.error && (
                              <span className="block ml-6 text-xs mt-1">{action.error}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No actions were performed.</p>
                    )}
                  </div>
                </div>
                
                {fixResults.remainingIssues && fixResults.remainingIssues.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700">Remaining Issues</h3>
                    <div className="mt-2 bg-red-50 border border-red-100 p-3 rounded text-sm">
                      <ul className="list-disc list-inside space-y-1 text-red-700">
                        {fixResults.remainingIssues.map((issue: string, index: number) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                
                {fixResults.nextSteps && fixResults.nextSteps.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700">Next Steps</h3>
                    <div className="mt-2 bg-blue-50 border border-blue-100 p-3 rounded text-sm">
                      <ul className="list-disc list-inside space-y-1 text-blue-700">
                        {fixResults.nextSteps.map((step: string, index: number) => (
                          <li key={index}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                
                {fixResults.success && (
                  <div className="bg-green-50 border border-green-100 p-3 rounded text-green-700 text-sm">
                    All fixable issues have been resolved. You should redeploy your site for the changes to take effect.
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