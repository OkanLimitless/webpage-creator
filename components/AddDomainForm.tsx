'use client';

import { useState } from 'react';

interface AddDomainFormProps {
  onDomainAdded: () => void;
}

export default function AddDomainForm({ onDomainAdded }: AddDomainFormProps) {
  const [domainName, setDomainName] = useState('');
  const [dnsManagement, setDnsManagement] = useState<'cloudflare' | 'external'>('cloudflare');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/domains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: domainName.trim(),
          dnsManagement
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: data.message || 'Domain added successfully!'
        });
        setDomainName('');
        onDomainAdded();
      } else {
        setMessage({ 
          type: 'error', 
          text: data.error || 'Failed to add domain'
        });
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: 'Network error. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">Add New Domain</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="domainName" className="block text-sm font-medium text-gray-700 mb-2">
            Domain Name
          </label>
          <input
            type="text"
            id="domainName"
            value={domainName}
            onChange={(e) => setDomainName(e.target.value)}
            placeholder="example.com or subdomain.example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="dnsManagement" className="block text-sm font-medium text-gray-700 mb-2">
            DNS Management
          </label>
          <select 
            id="dnsManagement"
            value={dnsManagement}
            onChange={(e) => setDnsManagement(e.target.value as 'cloudflare' | 'external')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="cloudflare">Cloudflare (Full Control)</option>
            <option value="external">External/Third-Party DNS</option>
          </select>
        </div>

        {dnsManagement === 'external' && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h4 className="font-medium text-blue-900 mb-2">📋 Setup Instructions</h4>
            <div className="text-sm text-blue-700 space-y-2">
              <p>After adding this domain, you'll need to create a DNS record:</p>
              <div className="bg-blue-100 p-2 rounded font-mono text-xs">
                CNAME {domainName || '[your-domain]'} → cname.vercel-dns.com
              </div>
              <p className="text-xs">
                Ask your domain provider to create this CNAME record pointing to Vercel.
              </p>
            </div>
          </div>
        )}

        {dnsManagement === 'cloudflare' && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <h4 className="font-medium text-green-900 mb-2">⚡ Cloudflare Management</h4>
            <p className="text-sm text-green-700">
              We'll create a Cloudflare zone and configure DNS records automatically. 
              You'll need to update your nameservers to the ones provided.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !domainName.trim()}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Adding Domain...' : 'Add Domain'}
        </button>
      </form>

      {message && (
        <div className={`mt-4 p-3 rounded-md ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-700' 
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.text}
        </div>
      )}
    </div>
  );
} 