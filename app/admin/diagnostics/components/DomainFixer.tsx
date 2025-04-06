'use client';

import { useState } from 'react';

type Domain = {
  _id: string;
  name: string;
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
        alert(`Set ${domain.name} as PRIMARY_DOMAIN. The application will use this domain as a fallback for TLD-only requests.`);
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
            onClick={handleFix}
            disabled={!selectedDomainId || isLoading}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-2 px-4 rounded-md shadow-sm"
          >
            {isLoading ? 'Fixing Issues...' : 'Fix All Issues'}
          </button>
          
          <button
            onClick={updatePrimaryDomain}
            disabled={!selectedDomainId || isLoading}
            className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white py-2 px-4 rounded-md shadow-sm"
          >
            Set as PRIMARY_DOMAIN
          </button>
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
                
                {fixResults.nextSteps && (
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
                    All fixable issues have been resolved. Your domain should now be properly configured.
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