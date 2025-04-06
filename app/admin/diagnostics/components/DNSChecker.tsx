'use client';

import { useState } from 'react';

type Domain = {
  _id: string;
  name: string;
  verificationStatus: 'pending' | 'active' | 'inactive' | 'error';
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

  const handleCheckDNS = async () => {
    if (!selectedDomainId) {
      alert('Please select a domain');
      return;
    }
    
    setIsLoading(true);
    setDnsResults(null);
    
    try {
      const response = await fetch(`/api/diagnostics/check-dns/${selectedDomainId}`);
      
      if (!response.ok) {
        throw new Error('Failed to check DNS configuration');
      }
      
      const data = await response.json();
      setDnsResults(data);
    } catch (error) {
      console.error('Error checking DNS:', error);
      setDnsResults({ error: 'Failed to check DNS configuration' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">DNS Configuration</h2>
      <p className="mb-4 text-gray-600">
        This tool checks your domain's DNS configuration in Cloudflare and Vercel to identify any issues.
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
        
        <button
          onClick={handleCheckDNS}
          disabled={!selectedDomainId || isLoading}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-2 px-4 rounded-md shadow-sm"
        >
          {isLoading ? 'Checking DNS...' : 'Check DNS Configuration'}
        </button>
      </div>
      
      {dnsResults && (
        <div className="border rounded-md overflow-hidden">
          <div className="bg-gray-100 p-4 font-medium border-b">
            DNS Configuration for {dnsResults.domain?.name}
          </div>
          <div className="p-4">
            {dnsResults.error ? (
              <div className="text-red-600">{dnsResults.error}</div>
            ) : (
              <div className="space-y-6">
                {/* Domain Info */}
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">Domain Information</h3>
                  <div className="bg-gray-50 p-3 rounded space-y-2">
                    <div>
                      <span className="text-gray-600">Name:</span> {dnsResults.domain.name}
                    </div>
                    <div>
                      <span className="text-gray-600">Verification Status:</span>{' '}
                      <span className={
                        dnsResults.domain.verificationStatus === 'active' ? 'text-green-600' : 
                        dnsResults.domain.verificationStatus === 'pending' ? 'text-yellow-600' : 
                        'text-red-600'
                      }>
                        {dnsResults.domain.verificationStatus}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Cloudflare Zone ID:</span>{' '}
                      {dnsResults.domain.cloudflareZoneId || 'Not set'}
                    </div>
                    <div>
                      <span className="text-gray-600">Active:</span>{' '}
                      {dnsResults.domain.isActive ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>

                {/* Cloudflare Info */}
                {dnsResults.cloudflare && (
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Cloudflare Configuration</h3>
                    <div className="bg-gray-50 p-3 rounded space-y-2">
                      <div>
                        <span className="text-gray-600">Zone Status:</span>{' '}
                        {dnsResults.cloudflare.zoneStatus || 'Unknown'}
                      </div>
                      <div>
                        <span className="text-gray-600">SSL Mode:</span>{' '}
                        {dnsResults.cloudflare.ssl || 'Unknown'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Vercel Info */}
                {dnsResults.vercel && (
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Vercel Configuration</h3>
                    <div className="bg-gray-50 p-3 rounded space-y-2">
                      <div>
                        <span className="text-gray-600">Registered:</span>{' '}
                        {dnsResults.vercel.registered ? 'Yes' : 'No'}
                      </div>
                      <div>
                        <span className="text-gray-600">Verified:</span>{' '}
                        {dnsResults.vercel.verified ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>
                )}

                {/* DNS Records */}
                {dnsResults.dnsRecords && dnsResults.dnsRecords.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">DNS Records</h3>
                    <div className="bg-gray-50 p-3 rounded overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-left">Name</th>
                            <th className="px-3 py-2 text-left">Content</th>
                            <th className="px-3 py-2 text-left">Proxied</th>
                            <th className="px-3 py-2 text-left">Vercel Record</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {dnsResults.dnsRecords.map((record: any, index: number) => (
                            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-3 py-2">{record.type}</td>
                              <td className="px-3 py-2">{record.name}</td>
                              <td className="px-3 py-2 font-mono text-xs">{record.content}</td>
                              <td className="px-3 py-2">{record.proxied ? 'Yes' : 'No'}</td>
                              <td className="px-3 py-2">
                                {record.isVercel ? (
                                  <span className="text-green-600">Yes</span>
                                ) : (
                                  <span className="text-gray-500">No</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Issues */}
                {dnsResults.issues && dnsResults.issues.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Issues Detected</h3>
                    <div className="bg-red-50 border border-red-100 p-3 rounded">
                      <ul className="list-disc list-inside space-y-1 text-red-700">
                        {dnsResults.issues.map((issue: string, index: number) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {dnsResults.recommendations && dnsResults.recommendations.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Recommendations</h3>
                    <div className="bg-blue-50 border border-blue-100 p-3 rounded">
                      <ul className="list-disc list-inside space-y-1 text-blue-700">
                        {dnsResults.recommendations.map((rec: string, index: number) => (
                          <li key={index}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {dnsResults.issues.length === 0 && (
                  <div className="bg-green-50 border border-green-100 p-3 rounded text-green-700">
                    No DNS configuration issues detected.
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