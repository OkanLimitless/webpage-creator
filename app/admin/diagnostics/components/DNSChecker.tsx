'use client';

import { useState } from 'react';

type Domain = {
  _id: string;
  name: string;
  isActive: boolean;
  cloudflareZoneId?: string;
};

type DNSCheckerProps = {
  domains: Domain[];
};

export default function DNSChecker({ domains }: DNSCheckerProps) {
  const [selectedDomainId, setSelectedDomainId] = useState<string>('');
  const [dnsResults, setDnsResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleCheck = async () => {
    if (!selectedDomainId) return;
    
    setIsLoading(true);
    setDnsResults(null);
    
    try {
      const response = await fetch(`/api/diagnostics/check-dns/${selectedDomainId}`);
      const data = await response.json();
      
      setDnsResults(data);
    } catch (error) {
      console.error('Error checking DNS:', error);
      setDnsResults({
        success: false,
        error: 'Failed to check DNS configuration'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">DNS Configuration Check</h2>
      <p className="mb-4 text-gray-600">
        This tool checks your domain's DNS configuration in Cloudflare and verifies it's correctly set up for Vercel.
      </p>
      
      <div className="mb-6">
        <label htmlFor="domainSelect" className="block text-sm font-medium text-gray-700 mb-2">
          Select Domain
        </label>
        <div className="flex gap-4">
          <select
            id="domainSelect"
            value={selectedDomainId}
            onChange={(e) => setSelectedDomainId(e.target.value)}
            className="flex-grow p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          >
            <option value="">Select a domain</option>
            {domains.map((domain) => (
              <option
                key={domain._id}
                value={domain._id}
                disabled={!domain.cloudflareZoneId}
              >
                {domain.name} {!domain.cloudflareZoneId && '(no Cloudflare Zone ID)'}
              </option>
            ))}
          </select>
          
          <button
            onClick={handleCheck}
            disabled={!selectedDomainId || isLoading}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-2 px-4 rounded-md shadow-sm"
          >
            {isLoading ? 'Checking...' : 'Check DNS'}
          </button>
        </div>
      </div>
      
      {dnsResults && (
        <div className="border rounded-md overflow-hidden">
          <div className="bg-gray-100 p-4 font-medium border-b">DNS Check Results</div>
          <div className="p-4">
            {dnsResults.error ? (
              <div className="text-red-600">{dnsResults.error}</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-700">Domain Information</h3>
                  <div className="mt-2 bg-gray-50 p-3 rounded">
                    <div><span className="font-medium">Domain:</span> {dnsResults.domain?.name}</div>
                    <div><span className="font-medium">Cloudflare Zone ID:</span> {dnsResults.domain?.cloudflareZoneId}</div>
                    <div><span className="font-medium">Active:</span> {dnsResults.domain?.isActive ? 'Yes' : 'No'}</div>
                  </div>
                </div>
                
                {dnsResults.cloudflare && (
                  <div>
                    <h3 className="font-medium text-gray-700">Cloudflare Configuration</h3>
                    <div className="mt-2 bg-gray-50 p-3 rounded">
                      <div><span className="font-medium">SSL Mode:</span> {dnsResults.cloudflare.ssl || 'Unknown'}</div>
                      <div><span className="font-medium">Zone Status:</span> {dnsResults.cloudflare.zoneStatus || 'Unknown'}</div>
                    </div>
                  </div>
                )}
                
                {dnsResults.dnsRecords && (
                  <div>
                    <h3 className="font-medium text-gray-700">DNS Records</h3>
                    <div className="mt-2 overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Content</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proxied</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {dnsResults.dnsRecords.map((record: any, index: number) => (
                            <tr key={index}>
                              <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{record.type}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{record.name}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">{record.content}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{record.proxied ? 'Yes' : 'No'}</td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {record.isVercel ? (
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                    Vercel
                                  </span>
                                ) : (
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                    Other
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {dnsResults.vercel && (
                  <div>
                    <h3 className="font-medium text-gray-700">Vercel Configuration</h3>
                    <div className="mt-2 bg-gray-50 p-3 rounded">
                      <div>
                        <span className="font-medium">Domain registered:</span> {dnsResults.vercel.registered ? 'Yes' : 'No'}
                      </div>
                      <div>
                        <span className="font-medium">Domain verified:</span> {dnsResults.vercel.verified ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>
                )}
                
                {dnsResults.issues && dnsResults.issues.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700">Issues Detected</h3>
                    <div className="mt-2 bg-red-50 border border-red-100 p-3 rounded text-sm">
                      <ul className="list-disc list-inside space-y-1 text-red-700">
                        {dnsResults.issues.map((issue: string, index: number) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                
                {dnsResults.recommendations && dnsResults.recommendations.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700">Recommendations</h3>
                    <div className="mt-2 bg-blue-50 border border-blue-100 p-3 rounded text-sm">
                      <ul className="list-disc list-inside space-y-1 text-blue-700">
                        {dnsResults.recommendations.map((rec: string, index: number) => (
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