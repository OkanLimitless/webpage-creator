'use client';

import { useState, useEffect } from 'react';
import AddDomainForm from '@/components/AddDomainForm';
import ExternalDomainVerification from '@/components/ExternalDomainVerification';

export default function TestDomainsPage() {
  const [domains, setDomains] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDomains = async () => {
    try {
      const response = await fetch('/api/domains');
      if (response.ok) {
        const data = await response.json();
        setDomains(data);
      }
    } catch (error) {
      console.error('Error fetching domains:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  const handleDomainAdded = () => {
    fetchDomains();
  };

  const handleVerificationUpdate = () => {
    fetchDomains();
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Domain Management Test</h1>
          <p className="text-gray-600">Test the new external DNS functionality</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Add Domain Form */}
          <div>
            <AddDomainForm onDomainAdded={handleDomainAdded} />
          </div>

          {/* Domain List */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Your Domains</h2>
            {isLoading ? (
              <div className="bg-white p-6 rounded-lg shadow">
                <p>Loading domains...</p>
              </div>
            ) : domains.length === 0 ? (
              <div className="bg-white p-6 rounded-lg shadow">
                <p className="text-gray-600">No domains added yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {domains.map((domain) => (
                  <div key={domain._id} className="bg-white p-4 rounded-lg shadow">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">{domain.name}</h3>
                        <div className="flex gap-4 text-sm text-gray-600">
                          <span>
                            DNS: <span className="font-medium capitalize">
                              {domain.dnsManagement || 'cloudflare'}
                            </span>
                          </span>
                          <span>
                            Status: <span className={`font-medium ${
                              domain.verificationStatus === 'active' ? 'text-green-600' : 'text-yellow-600'
                            }`}>
                              {domain.verificationStatus}
                            </span>
                          </span>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        domain.dnsManagement === 'external' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {domain.dnsManagement === 'external' ? 'External DNS' : 'Cloudflare'}
                      </span>
                    </div>

                    {domain.dnsManagement === 'external' && (
                      <ExternalDomainVerification 
                        domain={domain} 
                        onVerificationUpdate={handleVerificationUpdate}
                      />
                    )}

                    {domain.dnsManagement === 'cloudflare' && domain.cloudflareNameservers && (
                      <div className="mt-3 p-3 bg-gray-50 rounded">
                        <h4 className="font-medium text-sm mb-2">Cloudflare Nameservers:</h4>
                        <div className="text-xs space-y-1">
                          {domain.cloudflareNameservers.map((ns: string, index: number) => (
                            <div key={index} className="font-mono">{ns}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="mt-12 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">How to Use External DNS</h2>
          <div className="space-y-4 text-sm text-gray-700">
            <div>
              <h3 className="font-medium mb-2">1. Add External Domain</h3>
              <p>Select "External/Third-Party DNS" when adding a domain like <code className="bg-gray-100 px-1 rounded">medvi.healthydomain.com</code></p>
            </div>
            <div>
              <h3 className="font-medium mb-2">2. Configure DNS</h3>
              <p>Ask your domain provider to create a CNAME record:</p>
              <div className="bg-gray-100 p-2 rounded font-mono text-xs mt-1">
                CNAME medvi.healthydomain.com → cname.vercel-dns.com
              </div>
            </div>
            <div>
              <h3 className="font-medium mb-2">3. Verify</h3>
              <p>Use the "Verify DNS" button to check if the DNS configuration is correct.</p>
            </div>
            <div>
              <h3 className="font-medium mb-2">4. Deploy</h3>
              <p>Once verified, you can create landing pages on this domain normally.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 