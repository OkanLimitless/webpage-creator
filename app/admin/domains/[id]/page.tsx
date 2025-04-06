'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import RootPageForm from '../components/RootPageForm';
import DomainDeployment from '../components/DomainDeployment';
import { Toaster } from 'react-hot-toast';

interface Domain {
  _id: string;
  name: string;
  verificationStatus: 'pending' | 'active' | 'inactive' | 'error';
  cloudflareNameservers: string[];
  cloudflareZoneId?: string;
  deploymentStatus?: string;
  deploymentUrl?: string;
  lastDeployedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface RootPage {
  _id: string;
  domainId: string;
  title: string;
  description: string;
  content: string;
  metaTags: string[];
  redirectWwwToNonWww: boolean;
  customHead: string;
  customCss: string;
  isActive: boolean;
}

// Add a type for the RootPageForm props based on your implementation
interface RootPageFormProps {
  domainId: string;
  initialData: RootPage | null;
}

export default function DomainDetailsPage() {
  const params = useParams();
  const domainId = params.id as string;
  
  const [domain, setDomain] = useState<Domain | null>(null);
  const [rootPage, setRootPage] = useState<RootPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch domain and root page data
  useEffect(() => {
    const fetchDomainData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch domain data
        const domainResponse = await fetch(`/api/domains/${domainId}`);
        if (!domainResponse.ok) {
          throw new Error('Failed to fetch domain data');
        }
        const domainData = await domainResponse.json();
        setDomain(domainData);
        
        // Fetch root page data
        const rootPageResponse = await fetch(`/api/domains/${domainId}/root-page`);
        if (rootPageResponse.ok) {
          const rootPageData = await rootPageResponse.json();
          setRootPage(rootPageData);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load domain data');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (domainId) {
      fetchDomainData();
    }
  }, [domainId]);
  
  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading domain data...</p>
        </div>
      </div>
    );
  }
  
  if (error || !domain) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          <p className="font-medium">Error loading domain</p>
          <p className="text-sm">{error || 'Domain not found'}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4">
      <Toaster position="top-right" />
      
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{domain.name}</h1>
        <div>
          <a 
            href={`https://${domain.name}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Visit Website
          </a>
        </div>
      </div>
      
      {/* Domain Information Panel */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Domain Information</h2>
        </div>
        <div className="p-6">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
            <div>
              <dt className="text-sm font-medium text-gray-500">Domain Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{domain.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Verification Status</dt>
              <dd className="mt-1">
                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  domain.verificationStatus === 'active' 
                    ? 'bg-green-100 text-green-800' 
                    : domain.verificationStatus === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {domain.verificationStatus.charAt(0).toUpperCase() + domain.verificationStatus.slice(1)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Cloudflare Zone ID</dt>
              <dd className="mt-1 text-sm text-gray-900">{domain.cloudflareZoneId || 'Not set'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created At</dt>
              <dd className="mt-1 text-sm text-gray-900">{new Date(domain.createdAt).toLocaleString()}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-sm font-medium text-gray-500">Nameservers</dt>
              <dd className="mt-1 text-sm text-gray-900">
                <ul className="list-disc list-inside space-y-1">
                  {domain.cloudflareNameservers.map((ns, index) => (
                    <li key={index}>{ns}</li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        </div>
      </div>
      
      {/* Deployment Panel */}
      <div className="mb-8">
        <DomainDeployment domain={domain} />
      </div>
      
      {/* Root Page Panel */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Root Page Settings</h2>
        </div>
        <div className="p-6">
          {rootPage ? (
            <RootPageForm 
              domainId={domain._id}
              initialData={rootPage}
            />
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-md">
              <h3 className="text-gray-500 font-medium mb-2">No Root Page Created</h3>
              <p className="text-gray-400 mb-4">Create a root page to display content on your main domain</p>
              <RootPageForm 
                domainId={domain._id}
                initialData={undefined}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 