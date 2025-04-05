"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Domain type
interface Domain {
  _id: string;
  name: string;
  cloudflareNameservers: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  cloudflareZoneId?: string;
  verificationStatus: string;
  verificationKey?: string;
}

// Landing page type
interface LandingPage {
  _id: string;
  name: string;
  domainId: string | { _id: string, name: string };
  subdomain: string;
  affiliateUrl: string;
  originalUrl: string;
  desktopScreenshotUrl: string;
  mobileScreenshotUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function Home() {
  // State
  const [activeTab, setActiveTab] = useState<'domains' | 'landingPages'>('domains');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  
  // Form state
  const [domainName, setDomainName] = useState('');
  const [landingPageName, setLandingPageName] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  
  // Loading state
  const [loading, setLoading] = useState(false);
  
  // Fetch domains and landing pages
  useEffect(() => {
    fetchDomains();
    fetchLandingPages();
  }, []);
  
  // Fetch domains
  const fetchDomains = async () => {
    try {
      const response = await fetch('/api/domains');
      const data = await response.json();
      // Ensure we always have an array, even if the API returns something unexpected
      setDomains(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching domains:', error);
      // Set an empty array on error
      setDomains([]);
    }
  };
  
  // Fetch landing pages
  const fetchLandingPages = async () => {
    try {
      const response = await fetch('/api/landing-pages');
      const data = await response.json();
      // Ensure we always have an array, even if the API returns something unexpected
      setLandingPages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching landing pages:', error);
      // Set an empty array on error
      setLandingPages([]);
    }
  };
  
  // Add a domain
  const addDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!domainName) {
      alert('Please enter a domain name');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch('/api/domains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: domainName }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setDomainName('');
        // Add new domain to state
        setDomains(prev => [...prev, data]);
        alert('Domain added successfully. Please update your domain nameservers to the ones shown in the table.');
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to add domain'}`);
      }
    } catch (error) {
      console.error('Error adding domain:', error);
      alert('An error occurred while adding the domain');
    } finally {
      setLoading(false);
    }
  };
  
  // Add a landing page
  const addLandingPage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!landingPageName || !selectedDomainId || !subdomain || !affiliateUrl || !originalUrl) {
      alert('Please fill in all fields');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch('/api/landing-pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: landingPageName,
          domainId: selectedDomainId,
          subdomain,
          affiliateUrl,
          originalUrl,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setLandingPageName('');
        setSelectedDomainId('');
        setSubdomain('');
        setAffiliateUrl('');
        setOriginalUrl('');
        // Add new landing page to state
        setLandingPages(prev => [...prev, data]);
        alert('Landing page created successfully. It will be available in a few minutes.');
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to create landing page'}`);
      }
    } catch (error) {
      console.error('Error adding landing page:', error);
      alert('An error occurred while adding the landing page');
    } finally {
      setLoading(false);
    }
  };
  
  // Delete a domain
  const deleteDomain = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this domain? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/domains/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Remove domain from state
        setDomains(prev => prev.filter(domain => domain._id !== id));
        alert('Domain deleted successfully');
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to delete domain'}`);
      }
    } catch (error) {
      console.error('Error deleting domain:', error);
      alert('An error occurred while deleting the domain');
    }
  };
  
  // Delete a landing page
  const deleteLandingPage = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this landing page? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/landing-pages/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Remove landing page from state
        setLandingPages(prev => prev.filter(page => page._id !== id));
        alert('Landing page deleted successfully');
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to delete landing page'}`);
      }
    } catch (error) {
      console.error('Error deleting landing page:', error);
      alert('An error occurred while deleting the landing page');
    }
  };
  
  // Helper function to get landing page URL
  const getLandingPageUrl = (page: LandingPage) => {
    // Extract domain name
    let domainName = '';
    if (typeof page.domainId === 'string') {
      // Find domain by ID
      const domain = domains.find(d => d._id === page.domainId);
      if (domain) {
        domainName = domain.name;
      }
    } else {
      // Domain object is already embedded
      domainName = page.domainId.name;
    }
    
    return `https://${page.subdomain}.${domainName}`;
  };
  
  // Add this function to check verification status
  const checkVerification = async (id: string) => {
    try {
      const response = await fetch(`/api/domains/${id}/verify`);
      
      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        // Refresh domains list to update status
        fetchDomains();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to check verification status'}`);
      }
    } catch (error) {
      console.error('Error checking verification:', error);
      alert('An error occurred while checking verification status');
    }
  };
  
  // Add this function to update zone ID
  const updateZoneId = async (id: string) => {
    try {
      const response = await fetch(`/api/domains/${id}/update-zone`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        // Refresh domains list to update status
        fetchDomains();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to update zone ID'}`);
      }
    } catch (error) {
      console.error('Error updating zone ID:', error);
      alert('An error occurred while updating zone ID');
    }
  };
  
  // Add this function to check landing page configuration
  const checkLandingPageConfig = async (id: string, repair: boolean = false) => {
    try {
      const response = await fetch(`/api/landing-pages/${id}/check-config${repair ? '?repair=true' : ''}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Create a readable message based on the response
        let message = data.message;
        if (repair && data.repair?.result?.success) {
          message += "\n\nRepair successful! The domain has been added to Vercel.";
        } else if (repair && !data.repair?.result?.success) {
          message += "\n\nRepair failed. You may need to add the domain manually in Vercel.";
        }
        
        alert(message);
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to check landing page configuration'}`);
      }
    } catch (error) {
      console.error('Error checking landing page configuration:', error);
      alert('An error occurred while checking landing page configuration');
    }
  };
  
  // Add this function to check domain configuration
  const checkDomainFullConfig = async (id: string, repair: boolean = false) => {
    try {
      const response = await fetch(`/api/domains/${id}/check-full-config${repair ? '?repair=true' : ''}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Format the next steps as bullet points
        const nextStepsList = data.nextSteps.map((step: string) => `• ${step}`).join("\n");
        
        // Create a detailed message
        let message = `Domain: ${data.domain}\n\n`;
        message += `Overall Status: ${data.overallStatus === 'fully_configured' ? '✅ Fully Configured' : '⚠️ Issues Detected'}\n\n`;
        message += `Cloudflare Status: ${data.cloudflare.active ? '✅ Active' : '❌ Not Active'}\n`;
        message += `Vercel Status: ${data.vercel.exists ? (data.vercel.configured ? '✅ Configured' : '⚠️ Not Verified') : '❌ Not Added'}\n\n`;
        message += `Next Steps:\n${nextStepsList}`;
        
        if (repair && data.repair?.performed) {
          message += "\n\nRepair Actions Taken:";
          if (data.repair.results.cloudflare) {
            message += `\n• Cloudflare: ${data.repair.results.cloudflare.action} (${data.repair.results.cloudflare.success ? 'Success' : 'Failed'})`;
          }
          if (data.repair.results.vercel) {
            message += `\n• Vercel: ${data.repair.results.vercel.action} (${data.repair.results.vercel.success ? 'Success' : 'Failed'})`;
          }
        }
        
        alert(message);
        
        // Refresh domains if a repair was performed
        if (repair) {
          fetchDomains();
        }
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to check domain configuration'}`);
      }
    } catch (error) {
      console.error('Error checking domain configuration:', error);
      alert('An error occurred while checking domain configuration');
    }
  };
  
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 font-sans">
      <header className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-800">Webpage Creator</h1>
      </header>
      
      <div className="flex mb-6 border-b border-gray-200">
        <div 
          className={`px-4 py-3 cursor-pointer mr-2 ${
            activeTab === 'domains'
              ? 'border-b-2 border-blue-500 font-semibold'
              : 'text-gray-600 hover:text-gray-800'
          }`}
          onClick={() => setActiveTab('domains')}
        >
          Domains
        </div>
        <div 
          className={`px-4 py-3 cursor-pointer mr-2 ${
            activeTab === 'landingPages'
              ? 'border-b-2 border-blue-500 font-semibold'
              : 'text-gray-600 hover:text-gray-800'
          }`}
          onClick={() => setActiveTab('landingPages')}
        >
          Landing Pages
        </div>
      </div>
      
      {activeTab === 'domains' && (
        <>
          <div className="bg-white p-6 mb-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Add Domain</h2>
            <form onSubmit={addDomain} className="space-y-4">
              <input
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                type="text"
                placeholder="Domain name (e.g., example.com)"
                value={domainName}
                onChange={(e) => setDomainName(e.target.value)}
              />
              <button 
                className={`px-4 py-2 rounded-md text-white font-medium ${
                  loading 
                    ? 'bg-blue-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                }`}
                type="submit"
                disabled={loading}
              >
                {loading ? 'Adding...' : 'Add Domain'}
              </button>
            </form>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Your Domains</h2>
            {domains.length === 0 ? (
              <p className="text-gray-500">No domains yet. Add your first domain above.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nameservers</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verification</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {domains.map((domain) => (
                      <tr key={domain._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{domain.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <ul className="list-disc pl-5">
                            {Array.isArray(domain.cloudflareNameservers) ? (
                              domain.cloudflareNameservers.map((ns, i) => (
                                <li key={i}>{ns}</li>
                              ))
                            ) : (
                              <li>Nameservers not available</li>
                            )}
                          </ul>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            domain.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {domain.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex flex-wrap gap-2 items-center">
                            {domain.verificationStatus === 'pending' && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>
                            )}
                            {domain.verificationStatus === 'active' && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Verified</span>
                            )}
                            {domain.verificationStatus === 'inactive' && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Not Verified</span>
                            )}
                            {domain.verificationStatus === 'error' && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Error</span>
                            )}
                            <button 
                              className="ml-2 inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              onClick={() => checkVerification(domain._id)}
                            >
                              Check
                            </button>
                            <button 
                              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                              onClick={() => updateZoneId(domain._id)}
                            >
                              Update Zone ID
                            </button>
                            <button 
                              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-cyan-700 bg-cyan-100 hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
                              onClick={() => checkDomainFullConfig(domain._id)}
                            >
                              Full Config Check
                            </button>
                            <button 
                              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-orange-700 bg-orange-100 hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                              onClick={() => checkDomainFullConfig(domain._id, true)}
                            >
                              Repair Config
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button 
                            className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            onClick={() => deleteDomain(domain._id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
      
      {activeTab === 'landingPages' && (
        <>
          <div className="bg-white p-6 mb-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Create Landing Page</h2>
            <form onSubmit={addLandingPage} className="space-y-4">
              <input
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                type="text"
                placeholder="Name"
                value={landingPageName}
                onChange={(e) => setLandingPageName(e.target.value)}
              />
              
              <select
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={selectedDomainId}
                onChange={(e) => setSelectedDomainId(e.target.value)}
              >
                <option value="">Select a domain</option>
                {domains.map((domain) => (
                  <option key={domain._id} value={domain._id}>
                    {domain.name}
                  </option>
                ))}
              </select>
              
              <input
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                type="text"
                placeholder="Subdomain"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
              />
              
              <input
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                type="text"
                placeholder="Affiliate URL"
                value={affiliateUrl}
                onChange={(e) => setAffiliateUrl(e.target.value)}
              />
              
              <input
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                type="text"
                placeholder="Original URL"
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
              />
              
              <button 
                className={`px-4 py-2 rounded-md text-white font-medium ${
                  loading 
                    ? 'bg-blue-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                }`}
                type="submit"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Landing Page'}
              </button>
            </form>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Your Landing Pages</h2>
            {landingPages.length === 0 ? (
              <p className="text-gray-500">No landing pages yet. Create your first landing page above.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Affiliate URL</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {landingPages.map((page) => (
                      <tr key={page._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{page.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-500 hover:text-blue-700">
                          <a href={getLandingPageUrl(page)} target="_blank" rel="noopener noreferrer">
                            {getLandingPageUrl(page)}
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-500 hover:text-blue-700">
                          <a href={page.affiliateUrl} target="_blank" rel="noopener noreferrer">
                            Affiliate Link
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            page.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {page.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex space-x-2">
                            <button 
                              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                              onClick={() => deleteLandingPage(page._id)}
                            >
                              Delete
                            </button>
                            <button 
                              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                              onClick={() => checkLandingPageConfig(page._id)}
                            >
                              Check Config
                            </button>
                            <button 
                              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                              onClick={() => checkLandingPageConfig(page._id, true)}
                            >
                              Repair
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
} 