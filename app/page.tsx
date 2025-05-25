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
  verificationStatus: 'pending' | 'active' | 'inactive' | 'error' | 'verified';
  verificationKey?: string;
  landingPageCount?: number;
  banCount?: number;
  dnsManagement?: 'cloudflare' | 'external';
  targetCname?: string;
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
  banCount: number;
}

export default function Home() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // State
  const [activeTab, setActiveTab] = useState<'domains' | 'landingPages'>('domains');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  
  // Form state
  const [domainName, setDomainName] = useState('');
  const [dnsManagement, setDnsManagement] = useState<'cloudflare' | 'external'>('cloudflare');
  const [landingPageName, setLandingPageName] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  
  // Bulk domain import state
  const [bulkDomains, setBulkDomains] = useState('');
  const [bulkDnsManagement, setBulkDnsManagement] = useState<'cloudflare' | 'external'>('cloudflare');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkResults, setBulkResults] = useState<{
    success: string[], 
    failed: {domain: string, reason: string}[],
    nonVerified?: {domain: string, reason: string}[]
  }>({
    success: [],
    failed: [],
    nonVerified: []
  });
  const [bulkLoading, setBulkLoading] = useState(false);
  
  // Loading state
  const [loading, setLoading] = useState(false);
  
  // Custom dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // New state variables for manual screenshots
  const [useManualScreenshots, setUseManualScreenshots] = useState(false);
  const [desktopScreenshotFile, setDesktopScreenshotFile] = useState<File | null>(null);
  const [mobileScreenshotFile, setMobileScreenshotFile] = useState<File | null>(null);
  const [desktopScreenshotUrl, setDesktopScreenshotUrl] = useState<string | null>(null);
  const [mobileScreenshotUrl, setMobileScreenshotUrl] = useState<string | null>(null);
  const [uploadingScreenshots, setUploadingScreenshots] = useState(false);
  
  // Preview URLs for the selected files
  const [desktopPreviewUrl, setDesktopPreviewUrl] = useState<string | null>(null);
  const [mobilePreviewUrl, setMobilePreviewUrl] = useState<string | null>(null);
  
  // State for bulk selection of landing pages
  const [selectedLandingPages, setSelectedLandingPages] = useState<string[]>([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  
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
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setIsAuthenticated(true);
        setPassword('');
      } else {
        setLoginError(data.error || 'Login failed. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };
  
  // Handle logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
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
        body: JSON.stringify({ 
          name: domainName,
          dnsManagement 
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setDomainName('');
        // Add new domain to state
        setDomains(prev => [...prev, data]);
        
        if (dnsManagement === 'external') {
          alert(data.message || 'External domain added successfully. Please create the required DNS record.');
        } else {
          alert('Domain added successfully. Please update your domain nameservers to the ones shown in the table.');
        }
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
  
  // Add bulk domains
  const addBulkDomains = async () => {
    if (!bulkDomains.trim()) {
      alert('Please enter at least one domain');
      return;
    }
    
    // Split the domains by newline and remove empty lines
    const domainsList = bulkDomains
      .split('\n')
      .map(d => d.trim())
      .filter(d => d.length > 0);
    
    if (domainsList.length === 0) {
      alert('Please enter at least one domain');
      return;
    }
    
    setBulkLoading(true);
    setBulkResults({ success: [], failed: [], nonVerified: [] });
    
    try {
      const response = await fetch('/api/domains/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          domains: domainsList,
          dnsManagement: bulkDnsManagement 
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setBulkResults(data.results);
        
        // Add successful domains to the domains state
        if (data.results.success.length > 0) {
          // Fetch all domains again to ensure we have the latest data
          fetchDomains();
        }
        
        // Clear the input if all domains were successfully added
        if (data.results.failed.length === 0 && data.results.nonVerified.length === 0) {
          setBulkDomains('');
        }
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to add domains'}`);
      }
    } catch (error) {
      console.error('Error adding bulk domains:', error);
      alert('An error occurred while adding the domains');
    } finally {
      setBulkLoading(false);
    }
  };
  
  // Add a landing page
  const addLandingPage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if selected domain is external
    const isExternal = isSelectedDomainExternal();
    
    // Check required fields based on screenshot mode and domain type
    if (!landingPageName || !selectedDomainId || !affiliateUrl) {
      alert('Please fill in all required fields');
      return;
    }
    
    // For external domains, subdomain is not required (will be empty)
    // For regular domains, subdomain is required
    if (!isExternal && !subdomain) {
      alert('Please enter a subdomain');
      return;
    }
    
    // For automatic screenshots, original URL is required
    if (!useManualScreenshots && !originalUrl) {
      alert('Original URL is required for automatic screenshots');
      return;
    }
    
    // Check if manual screenshots are required but not provided
    if (useManualScreenshots && (!desktopScreenshotFile || !mobileScreenshotFile)) {
      alert('Please upload both desktop and mobile screenshots');
      return;
    }
    
    setLoading(true);
    
    try {
      // First, upload screenshots if using manual mode
      let screenshotUrls: { desktopUrl: string | null; mobileUrl: string | null } = { 
        desktopUrl: null, 
        mobileUrl: null 
      };
      
      if (useManualScreenshots) {
        setUploadingScreenshots(true);
        screenshotUrls = await uploadScreenshots();
        setUploadingScreenshots(false);
        
        // Verify both screenshots were uploaded
        if (!screenshotUrls.desktopUrl || !screenshotUrls.mobileUrl) {
          setLoading(false);
          return;
        }
      }
      
      // Then create the landing page with the screenshot URLs
      const response = await fetch('/api/landing-pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: landingPageName,
          domainId: selectedDomainId,
          subdomain: isExternal ? '' : subdomain, // Empty subdomain for external domains
          affiliateUrl,
          originalUrl,
          manualScreenshots: useManualScreenshots,
          desktopScreenshotUrl: screenshotUrls.desktopUrl,
          mobileScreenshotUrl: screenshotUrls.mobileUrl,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setLandingPageName('');
        setSelectedDomainId('');
        setSubdomain('');
        setAffiliateUrl('');
        setOriginalUrl('');
        
        // Reset screenshot state
        setUseManualScreenshots(false);
        setDesktopScreenshotFile(null);
        setMobileScreenshotFile(null);
        setDesktopScreenshotUrl(null);
        setMobileScreenshotUrl(null);
        setDesktopPreviewUrl(null);
        setMobilePreviewUrl(null);
        
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
  
  // Delete a landing page and its associated domain
  const deleteLandingPageWithDomain = async (id: string) => {
    const page = landingPages.find(p => p._id === id);
    if (!page) {
      alert('Landing page not found');
      return;
    }
    
    // Extract domain name
    let domainName = '';
    let domainId = '';
    if (typeof page.domainId === 'string') {
      // Find domain by ID
      const domain = domains.find(d => d._id === page.domainId);
      if (domain) {
        domainName = domain.name;
        domainId = domain._id;
      }
    } else {
      // Domain object is already embedded
      domainName = page.domainId.name;
      domainId = page.domainId._id;
    }
    
    if (!domainName) {
      alert('Could not determine the domain for this landing page');
      return;
    }
    
    if (!window.confirm(`Are you sure you want to delete this landing page AND its root domain (${domainName})? Both will be permanently deleted and this action cannot be undone.`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/landing-pages/${id}/delete-with-domain`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Remove landing page from state
        setLandingPages(prev => prev.filter(page => page._id !== id));
        // Remove domain from state
        setDomains(prev => prev.filter(domain => domain._id !== domainId));
        alert(`Landing page and domain ${domainName} deleted successfully`);
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to delete landing page and domain'}`);
      }
    } catch (error) {
      console.error('Error deleting landing page and domain:', error);
      alert('An error occurred while deleting the landing page and domain');
    }
  };
  
  // Helper function to get landing page URL
  const getLandingPageUrl = (page: LandingPage) => {
    // Extract domain name and check if it's external
    let domainName = '';
    let isExternal = false;
    
    if (typeof page.domainId === 'string') {
      // Find domain by ID
      const domain = domains.find(d => d._id === page.domainId);
      if (domain) {
        domainName = domain.name;
        isExternal = domain.dnsManagement === 'external';
      }
    } else {
      // Domain object is already embedded
      domainName = page.domainId.name;
      // We don't have dnsManagement info in embedded object, 
      // but we can infer from empty subdomain
      isExternal = !page.subdomain;
    }
    
    // For external domains, use the domain directly
    // For regular domains, use subdomain.domain format
    if (isExternal || !page.subdomain) {
      return `https://${domainName}`;
    } else {
      return `https://${page.subdomain}.${domainName}`;
    }
  };
  
  // Function to increment ban count for a landing page
  const incrementBanCount = async (id: string) => {
    try {
      const response = await fetch(`/api/landing-pages/${id}/increment-ban`, {
        method: 'POST',
      });
      
      if (response.ok) {
        // Update the landing page in the state with the new ban count
        const data = await response.json();
        const updatedPages = landingPages.map(page => 
          page._id === id ? { ...page, banCount: data.banCount } : page
        );
        setLandingPages(updatedPages);
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to update ban count'}`);
      }
    } catch (error) {
      console.error('Error updating ban count:', error);
      alert('An error occurred while updating ban count');
    }
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
  
  // Function to get eligible domains for landing pages
  // Only show domains that:
  // 1. Are active (verified with Cloudflare) OR verified external domains
  // 2. Have no landing pages deployed
  const getEligibleDomains = (): Domain[] => {
    return domains.filter(domain => 
      // Active domains have verification status "active" OR external domains with "verified" status
      (domain.verificationStatus === 'active' || 
       (domain.dnsManagement === 'external' && domain.verificationStatus === 'verified')) &&
      // No landing pages at all
      (domain.landingPageCount || 0) === 0
    );
  };
  
  // Function to get verified domains
  const getVerifiedDomains = (): Domain[] => {
    return domains.filter(domain => 
      domain.verificationStatus === 'active' || 
      (domain.dnsManagement === 'external' && domain.verificationStatus === 'verified')
    );
  };
  
  // Function to get pending domains that need nameserver changes
  const getPendingDomains = (): Domain[] => {
    return domains.filter(domain => domain.verificationStatus === 'pending');
  };
  
  // Function to get domains with other statuses (inactive, error)
  const getOtherDomains = (): Domain[] => {
    return domains.filter(domain => 
      domain.verificationStatus !== 'active' && 
      domain.verificationStatus !== 'pending' &&
      domain.dnsManagement !== 'external'
    );
  };
  
  // Function to get external domains
  const getExternalDomains = (): Domain[] => {
    return domains.filter(domain => 
      domain.dnsManagement === 'external' && 
      domain.verificationStatus !== 'verified'
    );
  };
  
  // Function to check if selected domain is external
  const isSelectedDomainExternal = (): boolean => {
    if (!selectedDomainId) return false;
    const domain = domains.find(d => d._id === selectedDomainId);
    return domain?.dnsManagement === 'external';
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
  
  // Handle file selection for desktop screenshot
  const handleDesktopScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setDesktopScreenshotFile(file);
    
    // Create a preview URL
    if (file) {
      const url = URL.createObjectURL(file);
      setDesktopPreviewUrl(url);
    } else {
      setDesktopPreviewUrl(null);
    }
  };
  
  // Handle file selection for mobile screenshot
  const handleMobileScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setMobileScreenshotFile(file);
    
    // Create a preview URL
    if (file) {
      const url = URL.createObjectURL(file);
      setMobilePreviewUrl(url);
    } else {
      setMobilePreviewUrl(null);
    }
  };
  
  // Upload a screenshot file to the server
  const uploadScreenshot = async (file: File, type: 'desktop' | 'mobile'): Promise<string | null> => {
    if (!file) return null;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    try {
      const response = await fetch('/api/upload-screenshot', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.url;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload screenshot');
      }
    } catch (error) {
      console.error(`Error uploading ${type} screenshot:`, error);
      alert(`Failed to upload ${type} screenshot. Please try again.`);
      return null;
    }
  };
  
  // Upload both screenshots if manual mode is enabled
  const uploadScreenshots = async (): Promise<{
    desktopUrl: string | null;
    mobileUrl: string | null;
  }> => {
    if (!useManualScreenshots) {
      return { desktopUrl: null, mobileUrl: null };
    }
    
    if (!desktopScreenshotFile || !mobileScreenshotFile) {
      alert('Please select both desktop and mobile screenshots');
      return { desktopUrl: null, mobileUrl: null };
    }
    
    setUploadingScreenshots(true);
    
    try {
      // Upload both files in parallel
      const [desktopUrl, mobileUrl] = await Promise.all([
        uploadScreenshot(desktopScreenshotFile, 'desktop'),
        uploadScreenshot(mobileScreenshotFile, 'mobile')
      ]);
      
      setDesktopScreenshotUrl(desktopUrl);
      setMobileScreenshotUrl(mobileUrl);
      
      return { desktopUrl, mobileUrl };
    } catch (error) {
      console.error('Error uploading screenshots:', error);
      return { desktopUrl: null, mobileUrl: null };
    } finally {
      setUploadingScreenshots(false);
    }
  };
  
  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      if (desktopPreviewUrl) URL.revokeObjectURL(desktopPreviewUrl);
      if (mobilePreviewUrl) URL.revokeObjectURL(mobilePreviewUrl);
    };
  }, [desktopPreviewUrl, mobilePreviewUrl]);
  
  // Clear originalUrl when manual screenshots are enabled
  useEffect(() => {
    if (useManualScreenshots) {
      setOriginalUrl('');
    }
  }, [useManualScreenshots]);
  
  // Select/deselect all landing pages
  const toggleSelectAllLandingPages = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLandingPages(landingPages.map(page => page._id));
    } else {
      setSelectedLandingPages([]);
    }
  };
  
  // Toggle selection of a single landing page
  const toggleLandingPageSelection = (id: string) => {
    if (selectedLandingPages.includes(id)) {
      setSelectedLandingPages(prev => prev.filter(pageId => pageId !== id));
    } else {
      setSelectedLandingPages(prev => [...prev, id]);
    }
  };
  
  // Bulk delete landing pages
  const bulkDeleteLandingPages = async () => {
    if (selectedLandingPages.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to delete ${selectedLandingPages.length} landing page(s)? This action cannot be undone.`)) {
      return;
    }
    
    try {
      setBulkDeleteLoading(true);
      
      const response = await fetch('/api/landing-pages/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: selectedLandingPages }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Remove deleted landing pages from state
        setLandingPages(prev => prev.filter(page => !selectedLandingPages.includes(page._id)));
        setSelectedLandingPages([]);
        
        alert(`Successfully deleted ${result.results.success.length} landing page(s).
${result.results.failed.length > 0 ? `Failed to delete ${result.results.failed.length} landing page(s).` : ''}`);
      } else {
        alert(`Error: ${result.error || 'Failed to delete landing pages'}`);
      }
    } catch (error) {
      console.error('Error bulk deleting landing pages:', error);
      alert('An error occurred while deleting the landing pages');
    } finally {
      setBulkDeleteLoading(false);
    }
  };
  
  // Verify external domain DNS
  const verifyExternalDomain = async (id: string) => {
    try {
      const response = await fetch(`/api/domains/${id}/verify-external`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.success && data.verified) {
        // Update domain status in local state
        setDomains(prev => prev.map(domain => 
          domain._id === id 
            ? { ...domain, verificationStatus: 'active' }
            : domain
        ));
        alert('Domain verified successfully! DNS is correctly pointing to Vercel.');
      } else if (data.success && !data.verified) {
        alert(`Domain verification failed: ${data.message}\n\nExpected targets: ${data.expectedTargets?.join(' or ')}`);
      } else {
        alert(`Verification failed: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error verifying external domain:', error);
      alert('An error occurred while verifying the domain');
    }
  };
  
  // Login form component
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
              disabled={isLoggingIn}
              className={`w-full py-3 px-4 ${isLoggingIn ? 'bg-primary-light/50' : 'bg-primary hover:bg-primary-dark'} text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-primary-light focus:ring-offset-2 focus:ring-offset-dark-card transition-colors duration-200`}
            >
              {isLoggingIn ? 'Logging in...' : 'Login'}
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
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  DNS Management
                </label>
                <select 
                  value={dnsManagement}
                  onChange={(e) => setDnsManagement(e.target.value as 'cloudflare' | 'external')}
                  className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white"
                >
                  <option value="cloudflare">Cloudflare (Full Control)</option>
                  <option value="external">External/Third-Party DNS</option>
                </select>
              </div>

              {dnsManagement === 'external' && (
                <div className="p-4 bg-blue-900/30 border border-blue-700 rounded-md">
                  <h4 className="font-medium text-blue-300 mb-2">📋 Setup Instructions</h4>
                  <div className="text-sm text-blue-200 space-y-2">
                    <p>After adding this domain, you'll need to create a DNS record:</p>
                    <div className="bg-blue-800/50 p-2 rounded font-mono text-xs text-blue-100">
                      CNAME {domainName || '[your-domain]'} → cname.vercel-dns.com
                    </div>
                    <p className="text-xs text-blue-300">
                      Ask your domain provider to create this CNAME record pointing to Vercel.
                    </p>
                  </div>
                </div>
              )}

              {dnsManagement === 'cloudflare' && (
                <div className="p-4 bg-green-900/30 border border-green-700 rounded-md">
                  <h4 className="font-medium text-green-300 mb-2">⚡ Cloudflare Management</h4>
                  <p className="text-sm text-green-200">
                    We'll create a Cloudflare zone and configure DNS records automatically. 
                    You'll need to update your nameservers to the ones provided.
                  </p>
                </div>
              )}
              
              <div className="flex space-x-2">
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
                <button 
                  type="button"
                  onClick={() => setIsBulkModalOpen(true)}
                  className="px-4 py-2 rounded-md text-white font-medium bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-dark-card transition-colors duration-200"
                >
                  Bulk Import
                </button>
              </div>
            </form>
          </div>
          
          {/* Bulk Import Modal */}
          {isBulkModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-dark-card p-6 rounded-lg shadow-lg border border-dark-accent w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4 text-white">Bulk Import Domains</h3>
                <p className="text-gray-400 text-sm mb-4">
                  Enter one domain per line (e.g., example.com)
                </p>
                
                {/* DNS Management Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-white mb-2">DNS Management</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`relative flex items-center p-3 border rounded-md cursor-pointer transition-colors duration-200 ${
                      bulkDnsManagement === 'cloudflare' 
                        ? 'border-primary bg-primary/10 text-white' 
                        : 'border-dark-light bg-dark-lighter text-gray-300 hover:bg-dark-light'
                    }`}>
                      <input
                        type="radio"
                        name="bulkDnsManagement"
                        value="cloudflare"
                        checked={bulkDnsManagement === 'cloudflare'}
                        onChange={(e) => setBulkDnsManagement(e.target.value as 'cloudflare' | 'external')}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                        bulkDnsManagement === 'cloudflare' ? 'border-primary' : 'border-gray-400'
                      }`}>
                        {bulkDnsManagement === 'cloudflare' && (
                          <div className="w-2 h-2 rounded-full bg-primary"></div>
                        )}
                      </div>
                      <span className="text-sm font-medium">Cloudflare DNS</span>
                    </label>
                    <label className={`relative flex items-center p-3 border rounded-md cursor-pointer transition-colors duration-200 ${
                      bulkDnsManagement === 'external' 
                        ? 'border-primary bg-primary/10 text-white' 
                        : 'border-dark-light bg-dark-lighter text-gray-300 hover:bg-dark-light'
                    }`}>
                      <input
                        type="radio"
                        name="bulkDnsManagement"
                        value="external"
                        checked={bulkDnsManagement === 'external'}
                        onChange={(e) => setBulkDnsManagement(e.target.value as 'cloudflare' | 'external')}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                        bulkDnsManagement === 'external' ? 'border-primary' : 'border-gray-400'
                      }`}>
                        {bulkDnsManagement === 'external' && (
                          <div className="w-2 h-2 rounded-full bg-primary"></div>
                        )}
                      </div>
                      <span className="text-sm font-medium">External DNS</span>
                    </label>
                  </div>
                  
                  {/* Instructions based on selection */}
                  <div className="mt-2 p-3 bg-dark-lighter border border-dark-light rounded-md">
                    {bulkDnsManagement === 'cloudflare' ? (
                      <p className="text-xs text-gray-400">
                        <span className="text-green-300">Cloudflare DNS:</span> Domains will be added to Cloudflare. You'll need to update nameservers at your registrar.
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">
                        <span className="text-blue-300">External DNS:</span> For third-party domains where you can't change nameservers. You'll need to create CNAME records pointing to Vercel.
                      </p>
                    )}
                  </div>
                </div>
                
                <textarea
                  className="w-full p-3 h-40 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500 mb-4"
                  placeholder="domain1.com&#10;domain2.com&#10;domain3.com"
                  value={bulkDomains}
                  onChange={(e) => setBulkDomains(e.target.value)}
                ></textarea>
                
                {/* Results display */}
                {(bulkResults.success.length > 0 || bulkResults.failed.length > 0 || (bulkResults.nonVerified && bulkResults.nonVerified.length > 0)) && (
                  <div className="mb-4">
                    <h4 className="text-white font-medium mb-2">Results:</h4>
                    {bulkResults.success.length > 0 && (
                      <div className="mb-2">
                        <p className="text-green-400 text-sm">{bulkResults.success.length} domains added successfully:</p>
                        <ul className="text-gray-300 text-xs ml-4 list-disc">
                          {bulkResults.success.map((domain, index) => (
                            <li key={index}>{domain}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {bulkResults.nonVerified && bulkResults.nonVerified.length > 0 && (
                      <div className="mb-2">
                        <p className="text-yellow-400 text-sm">{bulkResults.nonVerified.length} domains not verified (DNS not pointing to Vercel):</p>
                        <ul className="text-gray-300 text-xs ml-4 list-disc">
                          {bulkResults.nonVerified.map((item, index) => (
                            <li key={index}>{item.domain}: {item.reason}</li>
                          ))}
                        </ul>
                        <p className="text-yellow-300 text-xs mt-2">
                          💡 These domains need DNS configuration before they can be added. Create CNAME records pointing to cname.vercel-dns.com
                        </p>
                      </div>
                    )}
                    {bulkResults.failed.length > 0 && (
                      <div>
                        <p className="text-red-400 text-sm">{bulkResults.failed.length} domains failed:</p>
                        <ul className="text-gray-300 text-xs ml-4 list-disc">
                          {bulkResults.failed.map((item, index) => (
                            <li key={index}>{item.domain}: {item.reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => {
                      setIsBulkModalOpen(false);
                      setBulkResults({ success: [], failed: [], nonVerified: [] });
                      if (bulkResults.success.length > 0) {
                        setBulkDomains('');
                      }
                    }}
                    className="px-4 py-2 rounded-md text-white font-medium bg-gray-600 hover:bg-gray-700 transition-colors duration-200"
                  >
                    Close
                  </button>
                  <button
                    onClick={addBulkDomains}
                    disabled={bulkLoading}
                    className={`px-4 py-2 rounded-md text-white font-medium ${
                      bulkLoading 
                        ? 'bg-primary-light/50 cursor-not-allowed' 
                        : 'bg-primary hover:bg-primary-dark transition-colors duration-200'
                    }`}
                  >
                    {bulkLoading ? 'Importing...' : 'Import Domains'}
                  </button>
                </div>
              </div>
            </div>
          )}
          
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
              <>
                {/* Verified Domains */}
                {getVerifiedDomains().length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-medium mb-4 text-green-300 flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                      </svg>
                      Verified Domains ({getVerifiedDomains().length})
                    </h3>
                    <div className="overflow-x-auto rounded-lg border border-dark-accent">
                      <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-dark-accent">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Domain</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Verification</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-dark-lighter divide-y divide-gray-700">
                          {getVerifiedDomains().map((domain) => (
                            <tr key={domain._id} className="hover:bg-dark-light transition-colors duration-150">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{domain.name}</td>
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
                                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-900 text-green-300">Verified</span>
                                  <Link 
                                    href="/admin/diagnostics" 
                                    className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-blue-300 bg-dark-light hover:bg-dark transition-colors duration-150"
                                  >
                                    Advanced Options
                                  </Link>
                                </div>
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
                  </div>
                )}
                
                {/* Pending Domains */}
                {getPendingDomains().length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-medium mb-2 text-yellow-300 flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
                      </svg>
                      Pending Domains ({getPendingDomains().length})
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">
                      These domains need nameserver changes to complete verification. Update your domain's nameservers at your registrar.
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-dark-accent">
                      <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-dark-accent">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Domain</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Nameservers (Update Required)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-dark-lighter divide-y divide-gray-700">
                          {getPendingDomains().map((domain) => (
                            <tr key={domain._id} className="hover:bg-dark-light transition-colors duration-150">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{domain.name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-300">
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
                                <div className="flex flex-wrap gap-2 items-center">
                                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-900 text-yellow-300">Pending</span>
                                  <button 
                                    className="ml-2 inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-primary-light bg-dark-light hover:bg-dark transition-colors duration-150"
                                    onClick={() => checkVerification(domain._id)}
                                  >
                                    Check
                                  </button>
                                </div>
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
                  </div>
                )}
                
                {/* Other Domains (inactive, error) */}
                {getOtherDomains().length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-4 text-red-300 flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
                      </svg>
                      Problem Domains ({getOtherDomains().length})
                    </h3>
                    <div className="overflow-x-auto rounded-lg border border-dark-accent">
                      <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-dark-accent">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Domain</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Nameservers</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Verification</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-dark-lighter divide-y divide-gray-700">
                          {getOtherDomains().map((domain) => (
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
                  </div>
                )}
                
                {/* External Domains */}
                {getExternalDomains().length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-medium mb-2 text-blue-300 flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"></path>
                      </svg>
                      External DNS Domains ({getExternalDomains().length})
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">
                      These domains use external DNS management. Create the required DNS records at your domain provider.
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-dark-accent">
                      <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-dark-accent">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Domain</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">DNS Setup Required</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-dark-lighter divide-y divide-gray-700">
                          {getExternalDomains().map((domain) => (
                            <tr key={domain._id} className="hover:bg-dark-light transition-colors duration-150">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{domain.name}</td>
                              <td className="px-6 py-4 text-sm text-blue-300">
                                <div className="space-y-1">
                                  <div className="font-mono text-xs bg-blue-900/30 p-2 rounded">
                                    CNAME {domain.name} → cname.vercel-dns.com
                                  </div>
                                  <p className="text-xs text-gray-400">
                                    Create this DNS record at your domain provider
                                  </p>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  domain.verificationStatus === 'active'
                                    ? 'bg-green-900 text-green-300' 
                                    : 'bg-yellow-900 text-yellow-300'
                                }`}>
                                  {domain.verificationStatus === 'active' ? 'Verified' : 'Pending DNS'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                <div className="flex space-x-2">
                                  {domain.verificationStatus !== 'active' && (
                                    <button 
                                      className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-blue-300 bg-dark-light hover:bg-dark transition-colors duration-150"
                                      onClick={() => verifyExternalDomain(domain._id)}
                                    >
                                      Verify DNS
                                    </button>
                                  )}
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
                  </div>
                )}
              </>
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
            <p className="text-gray-400 text-sm mb-4">
              Note: You can only create landing pages on domains that are verified (status: active) and have no landing pages already deployed.
              <br />
              <span className="text-blue-300">External domains:</span> Landing page will be created directly on the domain (e.g., medvi.example.com)
              <br />
              <span className="text-green-300">Regular domains:</span> Landing page will be created on a subdomain (e.g., offer.example.com)
            </p>
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
                    {selectedDomainId ? getDomainNameById(selectedDomainId) : 'Select a domain (verified domains with no landing pages)'}
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
                    
                    {getEligibleDomains().length > 0 ? (
                      getEligibleDomains().map((domain) => (
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
                      ))
                    ) : (
                      <div className="p-3 text-gray-400">
                        No eligible domains available. Domains must be verified and have no landing pages.
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Subdomain field - only show for non-external domains */}
              {!isSelectedDomainExternal() ? (
                <input
                  className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500"
                  type="text"
                  placeholder="Subdomain"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                />
              ) : (
                <div className="p-3 bg-blue-900/30 border border-blue-700 rounded-md">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-blue-300" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path>
                    </svg>
                    <span className="text-blue-300 text-sm font-medium">External Domain</span>
                  </div>
                  <p className="text-blue-200 text-sm mt-1">
                    This landing page will be created directly on: <span className="font-mono">{getDomainNameById(selectedDomainId)}</span>
                  </p>
                </div>
              )}
              
              <input
                className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500"
                type="text"
                placeholder="Affiliate URL"
                value={affiliateUrl}
                onChange={(e) => setAffiliateUrl(e.target.value)}
              />
              
              <input
                className={`w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500 ${useManualScreenshots ? 'opacity-50 cursor-not-allowed' : ''}`}
                type="text"
                placeholder={useManualScreenshots ? "Not required for manual screenshots" : "Original URL"}
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
                disabled={useManualScreenshots}
              />
              
              {/* Manual Screenshots Toggle */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="manualScreenshots"
                  checked={useManualScreenshots}
                  onChange={(e) => setUseManualScreenshots(e.target.checked)}
                  className="w-4 h-4 text-primary bg-dark-lighter border-dark-light rounded focus:ring-primary"
                />
                <label htmlFor="manualScreenshots" className="text-gray-300 text-sm">
                  Manually upload screenshots (for sites that don't work with automatic capture)
                </label>
              </div>
              
              {/* Manual Screenshot Upload Fields */}
              {useManualScreenshots && (
                <div className="space-y-4 p-4 border border-dark-accent rounded-md bg-dark-light">
                  <h3 className="text-white text-sm font-medium">Upload Screenshots</h3>
                  
                  {/* Desktop Screenshot */}
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Desktop Screenshot (16:9 ratio recommended)</label>
                    <div className="flex flex-col space-y-2">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleDesktopScreenshotChange}
                        className="text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary file:text-white hover:file:bg-primary-dark"
                      />
                      {desktopPreviewUrl && (
                        <div className="mt-2 relative">
                          <img 
                            src={desktopPreviewUrl} 
                            alt="Desktop Preview" 
                            className="max-h-40 rounded-md border border-dark-accent"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setDesktopScreenshotFile(null);
                              setDesktopPreviewUrl(null);
                            }}
                            className="absolute top-1 right-1 bg-red-600 rounded-full text-white text-xs p-1"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Mobile Screenshot */}
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Mobile Screenshot (9:16 ratio recommended)</label>
                    <div className="flex flex-col space-y-2">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleMobileScreenshotChange}
                        className="text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary file:text-white hover:file:bg-primary-dark"
                      />
                      {mobilePreviewUrl && (
                        <div className="mt-2 relative">
                          <img 
                            src={mobilePreviewUrl} 
                            alt="Mobile Preview" 
                            className="max-h-40 rounded-md border border-dark-accent"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setMobileScreenshotFile(null);
                              setMobilePreviewUrl(null);
                            }}
                            className="absolute top-1 right-1 bg-red-600 rounded-full text-white text-xs p-1"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <button 
                className={`px-4 py-2 rounded-md text-white font-medium ${
                  loading || uploadingScreenshots
                    ? 'bg-primary-light/50 cursor-not-allowed' 
                    : 'bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-light focus:ring-offset-2 focus:ring-offset-dark-card transition-colors duration-200'
                }`}
                type="submit"
                disabled={loading || uploadingScreenshots}
              >
                {loading 
                  ? 'Creating...' 
                  : uploadingScreenshots 
                    ? 'Uploading screenshots...' 
                    : 'Create Landing Page'}
              </button>
            </form>
          </div>
          
          <div className="bg-dark-card p-6 rounded-lg shadow-dark-md border border-dark-accent">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <svg className="w-5 h-5 mr-2 text-primary" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M10.496 2.132a1 1 0 00-.992 0l-7 4A1 1 0 003 8v7a1 1 0 100 2h14a1 1 0 100-2V8a1 1 0 00.496-1.868l-7-4zM6 9a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1zm3 1a1 1 0 012 0v3a1 1 0 11-2 0v-3zm5-1a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1z" clipRule="evenodd"></path>
                </svg>
                Your Landing Pages
              </h2>
              
              {selectedLandingPages.length > 0 && (
                <button
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors duration-150 flex items-center"
                  onClick={bulkDeleteLandingPages}
                  disabled={bulkDeleteLoading}
                >
                  {bulkDeleteLoading ? 'Deleting...' : `Delete Selected (${selectedLandingPages.length})`}
                </button>
              )}
            </div>
            
            {landingPages.length === 0 ? (
              <p className="text-gray-400">No landing pages yet. Create your first landing page above.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-dark-accent">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-dark-accent">
                    <tr>
                      <th className="px-2 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider w-10">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-primary bg-dark-lighter border-dark-light rounded focus:ring-primary"
                          checked={selectedLandingPages.length === landingPages.length && landingPages.length > 0}
                          onChange={toggleSelectAllLandingPages}
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">URL</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Google Ads Account ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-dark-lighter divide-y divide-gray-700">
                    {landingPages.map((page) => (
                      <tr key={page._id} className={`hover:bg-dark-light transition-colors duration-150 ${selectedLandingPages.includes(page._id) ? 'bg-dark-light' : ''}`}>
                        <td className="px-2 py-4 whitespace-nowrap text-center">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-primary bg-dark-lighter border-dark-light rounded focus:ring-primary"
                            checked={selectedLandingPages.includes(page._id)}
                            onChange={() => toggleLandingPageSelection(page._id)}
                          />
                        </td>
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
                            <button 
                              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-orange-300 bg-dark-light hover:bg-dark transition-colors duration-150"
                              onClick={() => deleteLandingPageWithDomain(page._id)}
                              title="Delete this landing page and its root domain"
                            >
                              <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"></path>
                              </svg>
                              Delete with domain
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