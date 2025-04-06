'use client';

import { useState, useEffect } from 'react';
import DomainTester from './DomainTester';
import DNSChecker from './DNSChecker';
import DomainFixer from './DomainFixer';

type Domain = {
  _id: string;
  name: string;
  verificationStatus: 'pending' | 'active' | 'inactive' | 'error';
  isActive: boolean;
  cloudflareZoneId?: string;
};

export default function DiagnosticsPanel() {
  const [activeTab, setActiveTab] = useState<'domain-test' | 'dns-check' | 'fix-issues'>('domain-test');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch domains for the dropdown
  useEffect(() => {
    const fetchDomains = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/domains');
        if (!response.ok) {
          throw new Error('Failed to fetch domains');
        }
        
        const data = await response.json();
        // The data is directly an array of domains, not nested under a property
        setDomains(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching domains:', error);
        setDomains([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDomains();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Domain Diagnostics</h1>
        <p className="mb-6 text-gray-600">
          Use these tools to diagnose and fix domain routing issues with your website.
        </p>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('domain-test')}
              className={`${
                activeTab === 'domain-test'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
            >
              Domain Routing Test
            </button>

            <button
              onClick={() => setActiveTab('dns-check')}
              className={`${
                activeTab === 'dns-check'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
            >
              DNS Configuration
            </button>

            <button
              onClick={() => setActiveTab('fix-issues')}
              className={`${
                activeTab === 'fix-issues'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
            >
              Fix Issues
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-4 bg-gray-50 rounded-lg">
          {isLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading domains...</p>
            </div>
          ) : (
            <>
              {activeTab === 'domain-test' && <DomainTester domains={domains} />}
              {activeTab === 'dns-check' && <DNSChecker domains={domains} />}
              {activeTab === 'fix-issues' && <DomainFixer domains={domains} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
} 