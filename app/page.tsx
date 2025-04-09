"use client";

import { useState, useEffect, useRef } from 'react';
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
  landingPageCount?: number;
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
  googleAdsAccountId?: string;
  createdAt: string;
  updatedAt: string;
}

export default function Home() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
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
  
  // Custom dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Check authentication on page load
  useEffect(() => {
    const getCookie = (name: string): string | null => {
      const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith(`${name}=`));
      return cookieValue ? cookieValue.split('=')[1] : null;
    };
    
    const authToken = getCookie('auth_token');
    if (authToken === 'authenticated') {
      setIsAuthenticated(true);
    }
  }, []);
  
  // Handle login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get password hash from environment variable
    // If not set, default to empty (which will prevent login)
    const correctPasswordHash = process.env.NEXT_PUBLIC_PASSWORD_HASH || '';
    
    // If password hash is not set, show an error
    if (!correctPasswordHash) {
      setLoginError('Authentication is not configured properly. Please contact the administrator.');
      return;
    }
    
    // Simple hash function using crypto subtle API
    const hashPassword = async (password: string): Promise<string> => {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    };
    
    // Check password hash
    hashPassword(password).then(hashedInput => {
      if (hashedInput === correctPasswordHash) {
        // Create expiration date (7 days from now)
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 7);
        
        // Set cookie
        document.cookie = `auth_token=authenticated; expires=${expirationDate.toUTCString()}; path=/; SameSite=Strict;`;
        
        setIsAuthenticated(true);
        setLoginError('');
      } else {
        setLoginError('Incorrect password. Please try again.');
      }
    });
  };
  
  // Handle logout
  const handleLogout = () => {
    // Delete auth cookie by setting expiration in the past
    document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    setIsAuthenticated(false);
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);
  
  // Fetch domains and landing pages
  useEffect(() => {
    if (isAuthenticated) {
      fetchDomains();
      fetchLandingPages();
    }
  }, [isAuthenticated]);
  
  // Fetch domains
  const fetchDomains = async () => {
    try {
      const response = await fetch('/api/domains');
      const data = await response.json();
      
      // Ensure we always have an array, even if the API returns something unexpected
      const domainsList = Array.isArray(data) ? data : [];
      setDomains(domainsList);
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
  
  // Function to get domain name by ID
  const getDomainNameById = (id: string): string => {
    const domain = domains.find(d => d._id === id);
    return domain ? domain.name : 'Select a domain';
  };
  
  // Add this function to update Google Ads account ID
  const updateGoogleAdsAccountId = async (id: string, accountId: string) => {
    try {
      const response = await fetch(`/api/landing-pages/${id}/update-google-ads-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ googleAdsAccountId: accountId }),
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        // Refresh landing pages list to update status
        fetchLandingPages();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to update Google Ads account'}`);
      }
    } catch (error) {
      console.error('Error updating Google Ads account:', error);
      alert('An error occurred while updating Google Ads account');
    }
  };
  
  // If not authenticated, show login form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-dark-card p-8 rounded-lg shadow-lg border border-dark-accent w-full max-w-md">
          <h1 className="text-2xl font-bold text-white mb-6 flex items-center justify-center">
            <svg className="w-7 h-7 mr-2 text-primary" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"></path>
            </svg>
            Webpage Creator
          </h1>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-400 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white"
                placeholder="Enter password"
                required
              />
            </div>
            
            {loginError && (
              <p className="text-red-400 text-sm">{loginError}</p>
            )}
            
            <button
              type="submit"
              className="w-full py-3 px-4 bg-primary hover:bg-primary-dark text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-primary-light focus:ring-offset-2 focus:ring-offset-dark-card transition-colors duration-200"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 font-sans">
      <header className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700">
        <h1 className="text-2xl font-bold text-white flex items-center">
          <svg className="w-7 h-7 mr-2 text-primary" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"></path>
          </svg>
          Webpage Creator
        </h1>
        <div className="flex space-x-2">
          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-md text-white text-sm font-medium bg-gray-700 hover:bg-gray-600 transition-colors duration-200"
          >
            Logout
          </button>
          <a 
            href="/admin/domains" 
            className="px-3 py-2 rounded-md text-white text-sm font-medium bg-primary hover:bg-primary-dark transition-colors duration-200"
          >
            Advanced Admin
          </a>
        </div>
      </header>
      
      <div className="flex mb-6 border-b border-gray-700">
        <div 
          className={`px-4 py-3 cursor-pointer mr-2 ${
            activeTab === 'domains'
              ? 'border-b-2 border-primary text-white font-semibold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => setActiveTab('domains')}
        >
          Domains
        </div>
        <div 
          className={`px-4 py-3 cursor-pointer mr-2 ${
            activeTab === 'landingPages'
              ? 'border-b-2 border-primary text-white font-semibold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => setActiveTab('landingPages')}
        >
          Landing Pages
        </div>
      </div>
      
      {activeTab === 'domains' && (
        <>
          <div className="bg-dark-card p-6 mb-6 rounded-lg shadow-dark-md border border-dark-accent">
            <h2 className="text-xl font-semibold mb-4 text-white flex items-center">
              <svg className="w-5 h-5 mr-2 text-primary" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd"></path>
              </svg>
              Add Domain
            </h2>
            <form onSubmit={addDomain} className="space-y-4">
              <input
                className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500"
                type="text"
                placeholder="Domain name (e.g., example.com)"
                value={domainName}
                onChange={(e) => setDomainName(e.target.value)}
              />
              <button 
                className={`px-4 py-2 rounded-md text-white font-medium ${
                  loading 
                    ? 'bg-primary-light/50 cursor-not-allowed' 
                    : 'bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-light focus:ring-offset-2 focus:ring-offset-dark-card transition-colors duration-200'
                }`}
                type="submit"
                disabled={loading}
              >
                {loading ? 'Adding...' : 'Add Domain'}
              </button>
            </form>
          </div>
          
          <div className="bg-dark-card p-6 rounded-lg shadow-dark-md border border-dark-accent">
            <h2 className="text-xl font-semibold mb-4 text-white flex items-center">
              <svg className="w-5 h-5 mr-2 text-primary" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M10.496 2.132a1 1 0 00-.992 0l-7 4A1 1 0 003 8v7a1 1 0 100 2h14a1 1 0 100-2V8a1 1 0 00.496-1.868l-7-4zM6 9a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1zm3 1a1 1 0 012 0v3a1 1 0 11-2 0v-3zm5-1a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1z" clipRule="evenodd"></path>
              </svg>
              Your Domains
            </h2>
            {domains.length === 0 ? (
              <p className="text-gray-400">No domains yet. Add your first domain above.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-dark-accent">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-dark-accent">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Domain</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Nameservers</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Verification</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Landing Pages</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-dark-lighter divide-y divide-gray-700">
                    {domains.map((domain) => (
                      <tr key={domain._id} className="hover:bg-dark-light transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{domain.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
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
                              ? 'bg-green-900 text-green-300' 
                              : 'bg-gray-800 text-gray-300'
                          }`}>
                            {domain.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex flex-wrap gap-2 items-center">
                            {domain.verificationStatus === 'pending' && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-900 text-yellow-300">Pending</span>
                            )}
                            {domain.verificationStatus === 'active' && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-900 text-green-300">Verified</span>
                            )}
                            {domain.verificationStatus === 'inactive' && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-900 text-red-300">Not Verified</span>
                            )}
                            {domain.verificationStatus === 'error' && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-900 text-red-300">Error</span>
                            )}
                            <button 
                              className="ml-2 inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-primary-light bg-dark-light hover:bg-dark transition-colors duration-150"
                              onClick={() => checkVerification(domain._id)}
                            >
                              Check
                            </button>
                            <Link 
                              href="/admin/diagnostics" 
                              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-blue-300 bg-dark-light hover:bg-dark transition-colors duration-150"
                            >
                              Advanced Options
                            </Link>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {(domain.landingPageCount || 0) > 0 ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-900 text-blue-300">
                              {domain.landingPageCount || 0}
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-300">
                              0
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          <div className="flex space-x-2">
                            <button 
                              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-300 bg-dark-light hover:bg-dark transition-colors duration-150"
                              onClick={() => deleteDomain(domain._id)}
                            >
                              Delete
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
      
      {activeTab === 'landingPages' && (
        <>
          <div className="bg-dark-card p-6 mb-6 rounded-lg shadow-dark-md border border-dark-accent">
            <h2 className="text-xl font-semibold mb-4 text-white flex items-center">
              <svg className="w-5 h-5 mr-2 text-primary" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd"></path>
              </svg>
              Create Landing Page
            </h2>
            <form onSubmit={addLandingPage} className="space-y-4">
              <input
                className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500"
                type="text"
                placeholder="Name"
                value={landingPageName}
                onChange={(e) => setLandingPageName(e.target.value)}
              />
              
              <div className="relative" ref={dropdownRef}>
                <div 
                  className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white cursor-pointer flex justify-between items-center"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                >
                  <span className={selectedDomainId ? 'text-white' : 'text-gray-500'}>
                    {selectedDomainId ? getDomainNameById(selectedDomainId) : 'Select a domain'}
                  </span>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                
                {dropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-dark-accent border border-dark-light rounded-md shadow-lg max-h-60 overflow-auto">
                    <div 
                      className="p-3 text-gray-400 hover:bg-dark-light cursor-pointer"
                      onClick={() => {
                        setSelectedDomainId('');
                        setDropdownOpen(false);
                      }}
                    >
                      Select a domain
                    </div>
                    
                    {domains.map((domain) => (
                      <div 
                        key={domain._id} 
                        className={`p-3 hover:bg-dark-light cursor-pointer ${
                          selectedDomainId === domain._id 
                            ? 'bg-primary/20 text-primary-light font-medium' 
                            : 'text-white'
                        }`}
                        onClick={() => {
                          setSelectedDomainId(domain._id);
                          setDropdownOpen(false);
                        }}
                      >
                        {domain.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <input
                className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500"
                type="text"
                placeholder="Subdomain"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
              />
              
              <input
                className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500"
                type="text"
                placeholder="Affiliate URL"
                value={affiliateUrl}
                onChange={(e) => setAffiliateUrl(e.target.value)}
              />
              
              <input
                className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500"
                type="text"
                placeholder="Original URL"
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
              />
              
              <button 
                className={`px-4 py-2 rounded-md text-white font-medium ${
                  loading 
                    ? 'bg-primary-light/50 cursor-not-allowed' 
                    : 'bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-light focus:ring-offset-2 focus:ring-offset-dark-card transition-colors duration-200'
                }`}
                type="submit"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Landing Page'}
              </button>
            </form>
          </div>
          
          <div className="bg-dark-card p-6 rounded-lg shadow-dark-md border border-dark-accent">
            <h2 className="text-xl font-semibold mb-4 text-white flex items-center">
              <svg className="w-5 h-5 mr-2 text-primary" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M10.496 2.132a1 1 0 00-.992 0l-7 4A1 1 0 003 8v7a1 1 0 100 2h14a1 1 0 100-2V8a1 1 0 00.496-1.868l-7-4zM6 9a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1zm3 1a1 1 0 012 0v3a1 1 0 11-2 0v-3zm5-1a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1z" clipRule="evenodd"></path>
              </svg>
              Your Landing Pages
            </h2>
            {landingPages.length === 0 ? (
              <p className="text-gray-400">No landing pages yet. Create your first landing page above.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-dark-accent">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-dark-accent">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">URL</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Google Ads Account ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-dark-lighter divide-y divide-gray-700">
                    {landingPages.map((page) => (
                      <tr key={page._id} className="hover:bg-dark-light transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{page.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary-light hover:text-primary transition-colors duration-150">
                          <a href={getLandingPageUrl(page)} target="_blank" rel="noopener noreferrer">
                            {getLandingPageUrl(page)}
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            page.isActive 
                              ? 'bg-green-900 text-green-300' 
                              : 'bg-gray-800 text-gray-300'
                          }`}>
                            {page.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              placeholder="Enter Account ID"
                              value={page.googleAdsAccountId || ''}
                              onChange={(e) => {
                                // Update the landing page in state with the new value
                                const updatedPages = landingPages.map(p => 
                                  p._id === page._id ? { ...p, googleAdsAccountId: e.target.value } : p
                                );
                                setLandingPages(updatedPages);
                              }}
                              className="p-1 text-sm bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-white placeholder-gray-500 w-40"
                            />
                            <button
                              onClick={() => updateGoogleAdsAccountId(page._id, page.googleAdsAccountId || '')}
                              className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-green-300 bg-dark-light hover:bg-dark transition-colors duration-150"
                            >
                              Save
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          <div className="flex space-x-2">
                            <button 
                              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-300 bg-dark-light hover:bg-dark transition-colors duration-150"
                              onClick={() => deleteLandingPage(page._id)}
                            >
                              Delete
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