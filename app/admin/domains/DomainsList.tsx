'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Domain {
  _id: string;
  name: string;
  verificationStatus: 'pending' | 'active' | 'inactive' | 'error';
  deploymentStatus?: string;
  createdAt: string;
  hasRootPage?: boolean; // Flag to indicate if a root page exists
}

export default function DomainsList() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch domains
  const fetchDomains = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/domains');
      
      if (!response.ok) {
        throw new Error('Failed to fetch domains');
      }
      
      const data = await response.json();
      
      // Fetch root pages to check which domains have one
      const rootPagesResponse = await fetch('/api/root-pages');
      const rootPages = await rootPagesResponse.json();
      
      // Create a map of domainId -> rootPage for quick lookup
      const rootPagesByDomainId = rootPages.reduce((acc: Record<string, any>, page: any) => {
        if (page.domainId) {
          acc[page.domainId.toString()] = page;
        }
        return acc;
      }, {});
      
      // Mark domains that have a root page
      const domainsWithRootPageInfo = data.map((domain: Domain) => ({
        ...domain,
        hasRootPage: !!rootPagesByDomainId[domain._id],
      }));
      
      setDomains(domainsWithRootPageInfo);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching domains');
    } finally {
      setLoading(false);
    }
  };

  // Fetch domains on component mount
  useEffect(() => {
    fetchDomains();
  }, []);

  if (loading) {
    return <div className="text-center p-4">Loading domains...</div>;
  }

  if (error) {
    return <div className="text-red-500 p-4">Error: {error}</div>;
  }

  if (domains.length === 0) {
    return <div className="text-center p-4">No domains found. Add your first domain to get started.</div>;
  }

  // Helper function to determine if a domain is verified
  const isVerified = (status: string) => status === 'active';

  // Helper function to get deployment status badge
  const getDeploymentStatusBadge = (status?: string) => {
    switch (status) {
      case 'deployed':
        return <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">Deployed</span>;
      case 'deploying':
        return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">Deploying</span>;
      case 'failed':
        return <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">Failed</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium">Not Deployed</span>;
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Manage Domains</h1>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Domain Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Deployment
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Root Page
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {domains.map((domain) => (
              <tr key={domain._id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link href={`/admin/domains/${domain._id}`}>
                    <div className="text-sm font-medium text-blue-600 hover:text-blue-800">{domain.name}</div>
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    isVerified(domain.verificationStatus) 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {isVerified(domain.verificationStatus) ? 'Verified' : 'Pending Verification'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getDeploymentStatusBadge(domain.deploymentStatus)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {domain.hasRootPage ? (
                    <span className="text-green-600">
                      Active
                    </span>
                  ) : (
                    <span className="text-gray-400">
                      Not Created
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link 
                    href={`/admin/domains/${domain._id}`}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    Manage
                  </Link>
                  {domain.hasRootPage && (
                    <a 
                      href={`https://${domain.name}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-900 ml-2"
                    >
                      View Site
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 