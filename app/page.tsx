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
  googleAnalyticsId?: string;
  templateType?: 'standard' | 'call-ads' | 'cloaked';
  callAdsTemplateType?: 'travel' | 'pest-control';
  phoneNumber?: string;
  businessName?: string;
  // Cloaking specific fields
  moneyUrl?: string;
  targetCountries?: string[];
  excludeCountries?: string[];
  workerScriptName?: string;
  workerRouteId?: string;
  createdAt: string;
  updatedAt: string;
  banCount: number;
}

// Phone number type
interface PhoneNumber {
  _id: string;
  phoneNumber: string;
  industry: 'travel' | 'pest-control';
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export default function Home() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // State
  const [activeTab, setActiveTab] = useState<'landingPages' | 'domains' | 'phoneNumbers' | 'cloaking' | 'trafficLogs'>('cloaking');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  

  
  // Form state
  const [domainName, setDomainName] = useState('');
  const [dnsManagement, setDnsManagement] = useState<'cloudflare' | 'external'>('cloudflare');
  const [landingPageName, setLandingPageName] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  
  // Template form state
  const [templateType, setTemplateType] = useState<'standard' | 'call-ads'>('standard');
  const [callAdsTemplateType, setCallAdsTemplateType] = useState<'travel' | 'pest-control'>('travel');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  
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
  
  // Bulk landing page creation state
  const [isBulkLandingPageModalOpen, setIsBulkLandingPageModalOpen] = useState(false);
  const [bulkLandingPageName, setBulkLandingPageName] = useState('');
  const [bulkSubdomain, setBulkSubdomain] = useState('');
  const [bulkAffiliateUrl, setBulkAffiliateUrl] = useState('');
  const [bulkOriginalUrl, setBulkOriginalUrl] = useState('');
  const [bulkUseManualScreenshots, setBulkUseManualScreenshots] = useState(false);
  const [bulkDesktopScreenshotFile, setBulkDesktopScreenshotFile] = useState<File | null>(null);
  const [bulkMobileScreenshotFile, setBulkMobileScreenshotFile] = useState<File | null>(null);
  const [bulkDesktopPreviewUrl, setBulkDesktopPreviewUrl] = useState<string | null>(null);
  const [bulkMobilePreviewUrl, setBulkMobilePreviewUrl] = useState<string | null>(null);
  const [selectedDomainsForBulk, setSelectedDomainsForBulk] = useState<string[]>([]);
  const [bulkLandingPageLoading, setBulkLandingPageLoading] = useState(false);
  const [bulkLandingPageResults, setBulkLandingPageResults] = useState<{
    success: string[], 
    failed: {domain: string, reason: string}[]
  }>({
    success: [],
    failed: []
  });
  
  // DNS status checking state
  const [isDnsCheckModalOpen, setIsDnsCheckModalOpen] = useState(false);
  const [dnsCheckLoading, setDnsCheckLoading] = useState(false);
  const [dnsCheckResults, setDnsCheckResults] = useState<{
    summary?: {
      total: number;
      active: number;
      inactive: number;
      errors: number;
    };
    results?: {
      all: Array<{
        domain: string;
        status: 'active' | 'inactive' | 'error';
        currentTarget?: string;
        expectedTarget: string;
        error?: string;
        verificationStatus: string;
        dnsManagement: string;
      }>;
      inactive: Array<any>;
      externalInactive: Array<any>;
    };
  }>({});
  
  // Landing pages tab state
  const [landingPageTab, setLandingPageTab] = useState<'all' | 'standard' | 'travel' | 'pest-control' | 'cloaked'>('all');
  
  // Phone numbers state
  const [isPhoneNumberModalOpen, setIsPhoneNumberModalOpen] = useState(false);
  const [bulkPhoneNumbers, setBulkPhoneNumbers] = useState('');
  const [phoneNumberIndustry, setPhoneNumberIndustry] = useState<'travel' | 'pest-control'>('travel');
  const [phoneNumberDescription, setPhoneNumberDescription] = useState('');
  const [phoneNumberLoading, setPhoneNumberLoading] = useState(false);
  const [phoneNumberResults, setPhoneNumberResults] = useState<{
    success: string[];
    failed: { phoneNumber: string; reason: string; }[];
  }>({
    success: [],
    failed: []
  });
  
  // Bulk call ads creation state
  const [isBulkCallAdsModalOpen, setIsBulkCallAdsModalOpen] = useState(false);
  const [bulkCallAdsName, setBulkCallAdsName] = useState('');
  const [bulkCallAdsIndustry, setBulkCallAdsIndustry] = useState<'travel' | 'pest-control'>('travel');
  const [bulkCallAdsSubdomain, setBulkCallAdsSubdomain] = useState('');
  const [selectedDomainsForCallAds, setSelectedDomainsForCallAds] = useState<string[]>([]);
  const [bulkCallAdsLoading, setBulkCallAdsLoading] = useState(false);
  const [bulkCallAdsResults, setBulkCallAdsResults] = useState<{
    success: string[];
    failed: { domain: string; reason: string; }[];
  }>({
    success: [],
    failed: []
  });
  
  // Cloaked landing page creation state
  const [isCloakedModalOpen, setIsCloakedModalOpen] = useState(false);
  const [cloakedName, setCloakedName] = useState('');
  const [cloakedSubdomain, setCloakedSubdomain] = useState('');
  const [moneyUrl, setMoneyUrl] = useState('');
  const [whitePageUrl, setWhitePageUrl] = useState(''); // New state for white page URL
  const [targetCountries, setTargetCountries] = useState<string[]>(['Germany']);
  const [excludeCountries, setExcludeCountries] = useState<string[]>([]);
  const [selectedDomainForCloaked, setSelectedDomainForCloaked] = useState('');
  const [cloakedLoading, setCloakedLoading] = useState(false);
  const [newTargetCountry, setNewTargetCountry] = useState('');
  const [newExcludeCountry, setNewExcludeCountry] = useState('');
  
  // Common countries list for easy selection
  const commonCountries = [
    'Germany', 'United States', 'United Kingdom', 'France', 'Italy', 'Spain', 
    'Netherlands', 'Belgium', 'Austria', 'Switzerland', 'Canada', 'Australia',
    'Norway', 'Sweden', 'Denmark', 'Finland', 'Poland', 'Czech Republic',
    'Portugal', 'Ireland', 'Luxembourg', 'New Zealand', 'Japan', 'South Korea'
  ];

  // Traffic Logs state
  const [trafficLogs, setTrafficLogs] = useState<any[]>([]);
  const [trafficLogStats, setTrafficLogStats] = useState<any>(null);
  const [trafficLogsLoading, setTrafficLogsLoading] = useState(false);
  const [trafficLogFilters, setTrafficLogFilters] = useState({
    decision: '',
    domain: '',
    since: ''
  });
  const [trafficLogPage, setTrafficLogPage] = useState(1);
  const [trafficLogTotalPages, setTrafficLogTotalPages] = useState(1);
  const [trafficLogLastUpdate, setTrafficLogLastUpdate] = useState<Date | null>(null);
  
  // Check authentication on page load
  useEffect(() => {
    const getCookie = (name: string): string | null => {
      const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith(`${name}=`));
      return cookieValue ? cookieValue.split('=')[1] : null;
    };
    
    const authToken = getCookie('auth_token');
    if (authToken && authToken.startsWith('authenticated_')) {
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch traffic logs when tab is selected
  useEffect(() => {
    if (activeTab === 'trafficLogs') {
      fetchTrafficLogs(1, trafficLogFilters);
    }
  }, [activeTab]);

  // Auto-refresh traffic logs every 30 seconds when on traffic logs tab
  // This keeps the logs constantly up-to-date for real-time monitoring
  // while being respectful of API resources by only refreshing when needed
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    if (activeTab === 'trafficLogs') {
      // Refresh every 30 seconds to keep logs up to date
      intervalId = setInterval(() => {
        fetchTrafficLogs(trafficLogPage || 1, trafficLogFilters);
      }, 30000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [activeTab, trafficLogPage, trafficLogFilters]);
  
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
        body: JSON.stringify({ username, password }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setIsAuthenticated(true);
        setUsername('');
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
      fetchPhoneNumbers();
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
    
    // Check required fields based on template type
    if (!landingPageName || !selectedDomainId) {
      alert('Please fill in all required fields');
      return;
    }
    
    // For standard template, affiliate URL is required
    if (templateType === 'standard' && !affiliateUrl) {
      alert('Affiliate URL is required for standard template');
      return;
    }
    
    // For call-ads template, validate phone number and business name
    if (templateType === 'call-ads') {
      if (!phoneNumber || !businessName) {
        alert('Phone number and business name are required for call ads template');
        return;
      }
      
      // Basic phone number validation (US format)
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      const cleanedPhone = phoneNumber.replace(/\D/g, '');
      if (cleanedPhone.length < 10 || cleanedPhone.length > 11) {
        alert('Please enter a valid US phone number (10-11 digits)');
        return;
      }
    }
    
    // For external domains, subdomain is not required (will be empty)
    // For regular domains, subdomain is required
    if (!isExternal && !subdomain) {
      alert('Please enter a subdomain');
      return;
    }
    
    // For automatic screenshots, original URL is required (not needed for call-ads)
    if (!useManualScreenshots && !originalUrl && templateType !== 'call-ads') {
      alert('Original URL is required for automatic screenshots');
      return;
    }
    
    // Check if manual screenshots are required but not provided (only for standard template)
    if (useManualScreenshots && templateType === 'standard' && (!desktopScreenshotFile || !mobileScreenshotFile)) {
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
      
      if (useManualScreenshots && templateType === 'standard') {
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
          affiliateUrl: templateType === 'standard' ? affiliateUrl : undefined,
          originalUrl: originalUrl || 'https://placeholder.example.com',
          manualScreenshots: useManualScreenshots,
          desktopScreenshotUrl: screenshotUrls.desktopUrl,
          mobileScreenshotUrl: screenshotUrls.mobileUrl,
          templateType,
          callAdsTemplateType: templateType === 'call-ads' ? callAdsTemplateType : undefined,
          phoneNumber: templateType === 'call-ads' ? phoneNumber : undefined,
          businessName: templateType === 'call-ads' ? businessName : undefined,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setLandingPageName('');
        setSelectedDomainId('');
        setSubdomain('');
        setAffiliateUrl('');
        setOriginalUrl('');
        
        // Reset template fields
        setTemplateType('standard');
        setCallAdsTemplateType('travel');
        setPhoneNumber('');
        setBusinessName('');
        
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
  
  // Filter functions for landing page tabs
  const getStandardLandingPages = (): LandingPage[] => {
    return landingPages.filter(page => page.templateType === 'standard');
  };
  
  const getTravelLandingPages = (): LandingPage[] => {
    return landingPages.filter(page => {
      // Only call-ads template pages
      if (page.templateType !== 'call-ads') return false;
      
      // If callAdsTemplateType is explicitly set to pest-control, it's not travel
      if (page.callAdsTemplateType === 'pest-control') return false;
      
      // Everything else (travel or undefined) is considered travel
      return true;
    });
  };
  
  const getPestControlLandingPages = (): LandingPage[] => {
    return landingPages.filter(page => 
      page.templateType === 'call-ads' && page.callAdsTemplateType === 'pest-control'
    );
  };
  
  const getCloakedLandingPages = (): LandingPage[] => {
    return landingPages.filter(page => page.templateType === 'cloaked');
  };
  
  const getFilteredLandingPages = (): LandingPage[] => {
    switch (landingPageTab) {
      case 'standard':
        return getStandardLandingPages();
      case 'travel':
        return getTravelLandingPages();
      case 'pest-control':
        return getPestControlLandingPages();
      case 'cloaked':
        return getCloakedLandingPages();
      default:
        return landingPages;
    }
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
  
  // Add this function to update Google Analytics ID
  const updateGoogleAnalyticsId = async (id: string, analyticsId: string) => {
    try {
      const response = await fetch(`/api/landing-pages/${id}/update-google-ads-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ googleAnalyticsId: analyticsId }),
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        // Refresh landing pages list to update status
        fetchLandingPages();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to update Google Analytics ID'}`);
      }
    } catch (error) {
      console.error('Error updating Google Analytics ID:', error);
      alert('An error occurred while updating Google Analytics ID');
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
    const filteredPages = getFilteredLandingPages();
    if (e.target.checked) {
      // Add all filtered page IDs to selection, keeping any already selected pages from other tabs
      const newSelections = Array.from(new Set([...selectedLandingPages, ...filteredPages.map(page => page._id)]));
      setSelectedLandingPages(newSelections);
    } else {
      // Remove only the filtered page IDs from selection
      const filteredPageIds = filteredPages.map(page => page._id);
      setSelectedLandingPages(prev => prev.filter(id => !filteredPageIds.includes(id)));
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
  
  // Bulk landing page creation functions
  const handleBulkDesktopScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setBulkDesktopScreenshotFile(file);
    
    if (file) {
      const url = URL.createObjectURL(file);
      setBulkDesktopPreviewUrl(url);
    } else {
      setBulkDesktopPreviewUrl(null);
    }
  };
  
  const handleBulkMobileScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setBulkMobileScreenshotFile(file);
    
    if (file) {
      const url = URL.createObjectURL(file);
      setBulkMobilePreviewUrl(url);
    } else {
      setBulkMobilePreviewUrl(null);
    }
  };
  
  const toggleDomainSelectionForBulk = (domainId: string) => {
    if (selectedDomainsForBulk.includes(domainId)) {
      setSelectedDomainsForBulk(prev => prev.filter(id => id !== domainId));
    } else {
      setSelectedDomainsForBulk(prev => [...prev, domainId]);
    }
  };
  
  const toggleSelectAllDomainsForBulk = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedDomainsForBulk(getEligibleDomains().map(domain => domain._id));
    } else {
      setSelectedDomainsForBulk([]);
    }
  };
  
  const createBulkLandingPages = async () => {
    if (!bulkLandingPageName || !bulkAffiliateUrl || selectedDomainsForBulk.length === 0) {
      alert('Please fill in name, affiliate URL, and select at least one domain');
      return;
    }
    
    // Check if we need subdomain for regular domains
    const selectedDomains = getEligibleDomains().filter(d => selectedDomainsForBulk.includes(d._id));
    const hasRegularDomains = selectedDomains.some(d => d.dnsManagement !== 'external');
    
    if (hasRegularDomains && !bulkSubdomain) {
      alert('Subdomain is required when selecting regular (non-external) domains');
      return;
    }
    
    // Validate screenshot requirements
    if (!bulkUseManualScreenshots && !bulkOriginalUrl) {
      alert('Original URL is required for automatic screenshots');
      return;
    }
    
    if (bulkUseManualScreenshots && (!bulkDesktopScreenshotFile || !bulkMobileScreenshotFile)) {
      alert('Please upload both desktop and mobile screenshots for manual mode');
      return;
    }
    
    setBulkLandingPageLoading(true);
    setBulkLandingPageResults({ success: [], failed: [] });
    
    try {
      let desktopScreenshotUrl = null;
      let mobileScreenshotUrl = null;
      
      // Upload screenshots if using manual mode
      if (bulkUseManualScreenshots) {
        const uploadResults = await uploadBulkScreenshots();
        if (!uploadResults.desktopUrl || !uploadResults.mobileUrl) {
          setBulkLandingPageLoading(false);
          return;
        }
        desktopScreenshotUrl = uploadResults.desktopUrl;
        mobileScreenshotUrl = uploadResults.mobileUrl;
      }
      
      // Show progress message for large batches
      if (selectedDomainsForBulk.length > 5) {
        alert(`Creating landing pages on ${selectedDomainsForBulk.length} domains. This may take 1-2 minutes. Please wait...`);
      }
      
      const response = await fetch('/api/landing-pages/bulk-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: bulkLandingPageName,
          domainIds: selectedDomainsForBulk,
          subdomain: bulkSubdomain,
          affiliateUrl: bulkAffiliateUrl,
          originalUrl: bulkOriginalUrl,
          manualScreenshots: bulkUseManualScreenshots,
          desktopScreenshotUrl,
          mobileScreenshotUrl
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setBulkLandingPageResults(data.results);
        
        // Refresh landing pages and domains
        fetchLandingPages();
        fetchDomains();
        
        // Clear form if all successful
        if (data.results.failed.length === 0) {
          setBulkLandingPageName('');
          setBulkSubdomain('');
          setBulkAffiliateUrl('');
          setBulkOriginalUrl('');
          setSelectedDomainsForBulk([]);
          setBulkUseManualScreenshots(false);
          setBulkDesktopScreenshotFile(null);
          setBulkMobileScreenshotFile(null);
          setBulkDesktopPreviewUrl(null);
          setBulkMobilePreviewUrl(null);
        }
        
        alert(data.message);
      } else {
        alert(`Error: ${data.error || 'Failed to create landing pages'}`);
      }
    } catch (error) {
      console.error('Error creating bulk landing pages:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        alert('Request timed out. Some landing pages may have been created. Please refresh the page to see the current status.');
      } else {
        alert('An error occurred while creating landing pages. Please try again with fewer domains or check your connection.');
      }
    } finally {
      setBulkLandingPageLoading(false);
    }
  };
  
  const uploadBulkScreenshots = async (): Promise<{
    desktopUrl: string | null;
    mobileUrl: string | null;
  }> => {
    if (!bulkDesktopScreenshotFile || !bulkMobileScreenshotFile) {
      alert('Please select both desktop and mobile screenshots');
      return { desktopUrl: null, mobileUrl: null };
    }
    
    try {
      // Upload both files in parallel
      const [desktopUrl, mobileUrl] = await Promise.all([
        uploadScreenshot(bulkDesktopScreenshotFile, 'desktop'),
        uploadScreenshot(bulkMobileScreenshotFile, 'mobile')
      ]);
      
      return { desktopUrl, mobileUrl };
    } catch (error) {
      console.error('Error uploading bulk screenshots:', error);
      return { desktopUrl: null, mobileUrl: null };
    }
  };
  
  // DNS status checking function
  const checkDnsStatus = async (checkType: 'all' | 'external' | 'inactive' = 'external') => {
    setDnsCheckLoading(true);
    setDnsCheckResults({});
    
    try {
      const response = await fetch(`/api/domains/check-dns-status?type=${checkType}`);
      const data = await response.json();
      
      if (response.ok) {
        setDnsCheckResults(data);
        
        // Show summary alert
        const { summary } = data;
        if (summary) {
          const inactiveCount = summary.inactive + summary.errors;
          if (inactiveCount > 0) {
            alert(`DNS Check Complete!\n\n` +
              `Total domains checked: ${summary.total}\n` +
              `Active: ${summary.active}\n` +
              `Inactive/Issues: ${inactiveCount}\n\n` +
              `Check the results below for details on inactive domains.`);
          } else {
            alert(`All ${summary.total} domains are active and pointing to Vercel correctly!`);
          }
        }
      } else {
        alert(`Error: ${data.error || 'Failed to check DNS status'}`);
      }
    } catch (error) {
      console.error('Error checking DNS status:', error);
      alert('An error occurred while checking DNS status. Please try again.');
    } finally {
      setDnsCheckLoading(false);
    }
  };
  
  // Fetch phone numbers
  const fetchPhoneNumbers = async () => {
    try {
      const response = await fetch('/api/phone-numbers');
      const data = await response.json();
      setPhoneNumbers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching phone numbers:', error);
      setPhoneNumbers([]);
    }
  };

  // Add phone numbers function
  const addPhoneNumbers = async () => {
    if (!bulkPhoneNumbers.trim()) {
      alert('Please enter at least one phone number');
      return;
    }
    
    const phoneNumbersList = bulkPhoneNumbers
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    if (phoneNumbersList.length === 0) {
      alert('Please enter at least one phone number');
      return;
    }
    
    setPhoneNumberLoading(true);
    setPhoneNumberResults({ success: [], failed: [] });
    
    try {
      const response = await fetch('/api/phone-numbers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumbers: phoneNumbersList,
          industry: phoneNumberIndustry,
          description: phoneNumberDescription
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setPhoneNumberResults(data.results);
        
        // Refresh phone numbers list
        fetchPhoneNumbers();
        
        // Clear form if all successful
        if (data.results.failed.length === 0) {
          setBulkPhoneNumbers('');
          setPhoneNumberDescription('');
        }
        
        alert(data.message);
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to add phone numbers'}`);
      }
    } catch (error) {
      console.error('Error adding phone numbers:', error);
      alert('An error occurred while adding phone numbers');
    } finally {
      setPhoneNumberLoading(false);
    }
  };
  
  // Bulk call ads creation functions
  const toggleDomainSelectionForCallAds = (domainId: string) => {
    if (selectedDomainsForCallAds.includes(domainId)) {
      setSelectedDomainsForCallAds(prev => prev.filter(id => id !== domainId));
    } else {
      setSelectedDomainsForCallAds(prev => [...prev, domainId]);
    }
  };
  
  const toggleSelectAllDomainsForCallAds = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedDomainsForCallAds(getEligibleDomains().map(domain => domain._id));
    } else {
      setSelectedDomainsForCallAds([]);
    }
  };
  
  const createBulkCallAds = async () => {
    if (!bulkCallAdsName || selectedDomainsForCallAds.length === 0) {
      alert('Please fill in name and select at least one domain');
      return;
    }
    
    // Check if we need subdomain for regular domains
    const selectedDomains = getEligibleDomains().filter(d => selectedDomainsForCallAds.includes(d._id));
    const hasRegularDomains = selectedDomains.some(d => d.dnsManagement !== 'external');
    
    if (hasRegularDomains && !bulkCallAdsSubdomain) {
      alert('Subdomain is required when selecting regular (non-external) domains');
      return;
    }
    
    setBulkCallAdsLoading(true);
    setBulkCallAdsResults({ success: [], failed: [] });
    
    try {
      const response = await fetch('/api/landing-pages/bulk-create-call-ads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: bulkCallAdsName,
          domainIds: selectedDomainsForCallAds,
          industry: bulkCallAdsIndustry,
          subdomain: bulkCallAdsSubdomain
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setBulkCallAdsResults(data.results);
        
        // Refresh landing pages and domains
        fetchLandingPages();
        fetchDomains();
        
        // Clear form if all successful
        if (data.results.failed.length === 0) {
          setBulkCallAdsName('');
          setBulkCallAdsSubdomain('');
          setSelectedDomainsForCallAds([]);
        }
        
        alert(`${data.message}\nPhone numbers used: ${data.phoneNumbersUsed}/${data.availablePhoneNumbers}`);
      } else {
        alert(`Error: ${data.error || 'Failed to create call ads landing pages'}`);
      }
    } catch (error) {
      console.error('Error creating bulk call ads:', error);
      alert('An error occurred while creating call ads landing pages');
    } finally {
      setBulkCallAdsLoading(false);
    }
  };

  // Get phone numbers by industry
  const getPhoneNumbersByIndustry = (industry: 'travel' | 'pest-control') => {
    return phoneNumbers.filter(p => p.industry === industry && p.isActive);
  };
  
  // Create cloaked landing page
  const createCloakedLandingPage = async () => {
    if (!cloakedName || !selectedDomainForCloaked || !moneyUrl || targetCountries.length === 0) {
      alert('Please fill in all required fields: name, domain, money URL, and at least one target country.');
      return;
    }
    
    if (!moneyUrl.startsWith('http://') && !moneyUrl.startsWith('https://')) {
      alert('Money URL must start with http:// or https://');
      return;
    }
    
    setCloakedLoading(true);
    
    try {
      const selectedDomain = domains.find(d => d._id === selectedDomainForCloaked);
      if (!selectedDomain) {
        alert('Selected domain not found');
        return;
      }
      
      const isExternal = selectedDomain.dnsManagement === 'external';
      const requestData = {
        name: cloakedName,
        domainId: selectedDomainForCloaked,
        subdomain: isExternal ? '' : cloakedSubdomain,
        moneyUrl,
        whitePageUrl: whitePageUrl || undefined, // Add white page URL if provided
        targetCountries,
        excludeCountries: excludeCountries.length > 0 ? excludeCountries : undefined
      };
      
      const response = await fetch('/api/landing-pages/create-cloaked', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(`${data.message}${data.warning ? `\n\nWarning: ${data.warning}` : ''}`);
        
        // Reset form
        setCloakedName('');
        setCloakedSubdomain('');
        setMoneyUrl('');
        setWhitePageUrl(''); // Reset white page URL
        setTargetCountries(['Germany']);
        setExcludeCountries([]);
        setSelectedDomainForCloaked('');
        setIsCloakedModalOpen(false);
        
        // Refresh landing pages
        fetchLandingPages();
      } else {
        alert(`Error: ${data.error || 'Failed to create cloaked landing page'}`);
      }
    } catch (error) {
      console.error('Error creating cloaked landing page:', error);
      alert('An error occurred while creating the cloaked landing page');
    } finally {
      setCloakedLoading(false);
    }
  };
  
  // Helper functions for country management
  const addTargetCountry = () => {
    if (newTargetCountry && !targetCountries.includes(newTargetCountry)) {
      setTargetCountries([...targetCountries, newTargetCountry]);
      setNewTargetCountry('');
    }
  };
  
  const removeTargetCountry = (country: string) => {
    setTargetCountries(targetCountries.filter(c => c !== country));
  };
  
  const addExcludeCountry = () => {
    if (newExcludeCountry && !excludeCountries.includes(newExcludeCountry)) {
      setExcludeCountries([...excludeCountries, newExcludeCountry]);
      setNewExcludeCountry('');
    }
  };
  
  const removeExcludeCountry = (country: string) => {
    setExcludeCountries(excludeCountries.filter(c => c !== country));
  };

  // Function to get domains eligible for cloaking (only Cloudflare-managed domains)
  const getCloakingEligibleDomains = (): Domain[] => {
    return domains.filter(domain => 
      // Must be Cloudflare-managed (not external)
      domain.dnsManagement !== 'external' &&
      // Must be active
      domain.verificationStatus === 'active' &&
      // No landing pages at all
      (domain.landingPageCount || 0) === 0
    );
  };

  // Re-deploy cloaked page with latest code
  const reDeployCloakedPage = async (landingPageId: string) => {
    if (!confirm('Re-deploy this cloaked page with the latest code? This will update the worker script while keeping all your current settings (money URL, target countries, etc.)')) {
      return;
    }

    try {
      const response = await fetch(`/api/landing-pages/${landingPageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 're-deploy-cloaked'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.success) {
          alert(`✅ Re-deployment successful!\n\n${data.message}\n\nYour cloaked page is now running the latest code with affiliate URL protection.`);
        } else {
          alert(`❌ Re-deployment failed: ${data.message}`);
        }
      } else {
        alert(`Error: ${data.error || 'Failed to re-deploy'}`);
      }
    } catch (error) {
      console.error('Error re-deploying cloaked page:', error);
      alert('An error occurred while re-deploying the cloaked page');
    }
  };

  // Fix cloaking DNS for existing cloaked pages
  const fixCloakingDns = async (landingPageId: string) => {
    if (!confirm('Fix DNS settings for this cloaked page? This will enable Cloudflare proxying so the worker can intercept requests.')) {
      return;
    }

    try {
      const response = await fetch(`/api/landing-pages/${landingPageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'fix-cloaking-dns'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.success) {
          alert(`✅ DNS fixed successfully!\n\n${data.message}\n\nThe cloaked page should now work properly. Please test it after a few minutes.`);
        } else {
          alert(`❌ DNS fix failed: ${data.message}`);
        }
      } else {
        alert(`Error: ${data.error || 'Failed to fix DNS'}`);
      }
    } catch (error) {
      console.error('Error fixing cloaking DNS:', error);
      alert('An error occurred while fixing DNS settings');
    }
  };



  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Format IP address for display (mask for privacy)
  const formatIP = (ip: string) => {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
    return ip.substring(0, 8) + '...';
  };

  // Fetch traffic logs function
  const fetchTrafficLogs = async (page = 1, filters = trafficLogFilters) => {
    setTrafficLogsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
      });

      const response = await fetch(`/api/traffic-logs?${queryParams}`);
      const data = await response.json();

      if (data.success) {
        setTrafficLogs(data.data.logs);
        setTrafficLogStats(data.data.stats);
        setTrafficLogPage(data.data.pagination.page);
        setTrafficLogTotalPages(data.data.pagination.pages);
        setTrafficLogLastUpdate(new Date());
      } else {
        console.error('Failed to fetch traffic logs:', data.error);
      }
    } catch (error) {
      console.error('Error fetching traffic logs:', error);
    } finally {
      setTrafficLogsLoading(false);
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
              <label htmlFor="username" className="block text-sm font-medium text-gray-400 mb-1">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white"
                placeholder="Enter username"
                required
              />
            </div>
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
            activeTab === 'cloaking'
              ? 'border-b-2 border-primary text-white font-semibold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => setActiveTab('cloaking')}
        >
          🎭 Cloaking System
        </div>
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
        <div 
          className={`px-4 py-3 cursor-pointer mr-2 ${
            activeTab === 'phoneNumbers'
              ? 'border-b-2 border-primary text-white font-semibold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => setActiveTab('phoneNumbers')}
        >
          Phone Numbers
        </div>
        <div 
          className={`px-4 py-3 cursor-pointer mr-2 ${
            activeTab === 'trafficLogs'
              ? 'border-b-2 border-primary text-white font-semibold'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => setActiveTab('trafficLogs')}
        >
          📊 Traffic Logs
        </div>
      </div>
      
      {activeTab === 'cloaking' && (
        <>
          {/* Cloaking System Header */}
          <div className="bg-gradient-to-r from-purple-900 to-blue-900 p-6 mb-6 rounded-lg shadow-dark-md border border-purple-500/30">
            <h2 className="text-2xl font-bold mb-2 text-white flex items-center">
              🎭 Advanced Cloaking System
            </h2>
            <p className="text-purple-200 text-sm">
              Create sophisticated cloaked landing pages with multi-layer bot detection, VPN blocking, and geographic targeting.
            </p>
          </div>



          {/* Create New Cloaked Page */}
          <div className="bg-dark-card p-6 mb-6 rounded-lg shadow-dark-md border border-dark-accent">
            <h3 className="text-xl font-semibold mb-4 text-white flex items-center">
              ⚡ Create New Cloaked Landing Page
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Basic Settings */}
              <div className="space-y-4">
                <h4 className="text-white font-medium border-b border-gray-600 pb-2">Basic Configuration</h4>
                
                <input
                  className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-500"
                  type="text"
                  placeholder="Landing Page Name (e.g., 'Travel Deals Germany')"
                  value={cloakedName}
                  onChange={(e) => setCloakedName(e.target.value)}
                />
                
                <select
                  className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white"
                  value={selectedDomainForCloaked}
                  onChange={(e) => setSelectedDomainForCloaked(e.target.value)}
                >
                  <option value="">Select Domain</option>
                  {getCloakingEligibleDomains().map((domain) => (
                    <option key={domain._id} value={domain._id}>
                      {domain.name} ({domain.verificationStatus})
                    </option>
                  ))}
                </select>
                
                <input
                  className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-500"
                  type="text"
                  placeholder="Subdomain (optional, e.g., 'deals')"
                  value={cloakedSubdomain}
                  onChange={(e) => setCloakedSubdomain(e.target.value)}
                />
                
                <input
                  className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-500"
                  type="url"
                  placeholder="Money Page URL (where real users go)"
                  value={moneyUrl}
                  onChange={(e) => setMoneyUrl(e.target.value)}
                />
                
                <input
                  className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-gray-500"
                  type="url"
                  placeholder="Safe Page URL (where bots/reviewers go)"
                  value={whitePageUrl}
                  onChange={(e) => setWhitePageUrl(e.target.value)}
                />
              </div>

              {/* Right Column - Targeting Settings */}
              <div className="space-y-4">
                <h4 className="text-white font-medium border-b border-gray-600 pb-2">Geographic Targeting</h4>
                
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Target Countries (Allow List)</label>
                  <div className="flex space-x-2 mb-2">
                    <select
                      className="flex-1 p-2 bg-dark-lighter border border-dark-light rounded-md text-white text-sm"
                      value={newTargetCountry}
                      onChange={(e) => setNewTargetCountry(e.target.value)}
                    >
                      <option value="">Select country to add</option>
                      <option value="Germany">🇩🇪 Germany</option>
                      <option value="Netherlands">🇳🇱 Netherlands</option>
                      <option value="United States">🇺🇸 United States</option>
                      <option value="United Kingdom">🇬🇧 United Kingdom</option>
                      <option value="France">🇫🇷 France</option>
                      <option value="Italy">🇮🇹 Italy</option>
                      <option value="Spain">🇪🇸 Spain</option>
                      <option value="Belgium">🇧🇪 Belgium</option>
                      <option value="Austria">🇦🇹 Austria</option>
                      <option value="Switzerland">🇨🇭 Switzerland</option>
                      <option value="Canada">🇨🇦 Canada</option>
                      <option value="Australia">🇦🇺 Australia</option>
                    </select>
                    <button
                      type="button"
                      onClick={addTargetCountry}
                      className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
                    >
                      Add
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {targetCountries.map((country) => (
                      <span
                        key={country}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-900 text-purple-200 border border-purple-700"
                      >
                        {country}
                        <button
                          type="button"
                          onClick={() => removeTargetCountry(country)}
                          className="ml-1 text-purple-400 hover:text-purple-200"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  {targetCountries.length === 0 && (
                    <p className="text-gray-500 text-xs">No countries selected - will allow all countries</p>
                  )}
                </div>

                {/* Bot Detection Info */}
                <div className="bg-dark-lighter p-4 rounded-md border border-dark-light">
                  <h5 className="text-white text-sm font-medium mb-2">🛡️ Bot Detection Layers</h5>
                  <ul className="text-xs text-gray-400 space-y-1">
                    <li>✓ Google Ads gclid parameter check</li>
                    <li>✓ User agent pattern analysis</li>
                    <li>✓ Geographic filtering</li>
                    <li>✓ Risk score analysis (ProxyCheck.io)</li>
                    <li>✓ VPN/Proxy detection</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={createCloakedLandingPage}
                disabled={!cloakedName || !selectedDomainForCloaked || !moneyUrl || targetCountries.length === 0}
                className="px-6 py-3 rounded-md text-white font-medium bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-dark-card transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🚀 Deploy Cloaked Page
              </button>
            </div>
          </div>

          {/* Existing Cloaked Pages */}
          <div className="bg-dark-card p-6 rounded-lg shadow-dark-md border border-dark-accent">
            <h3 className="text-xl font-semibold mb-4 text-white flex items-center">
              📊 Your Cloaked Landing Pages
            </h3>
            
            {getCloakedLandingPages().length === 0 ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">🎭</div>
                <h4 className="text-xl font-medium text-white mb-2">No Cloaked Pages Yet</h4>
                <p className="text-gray-400">Create your first cloaked landing page to get started with advanced bot detection.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-dark-lighter">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Page</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Domain</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Money URL</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Target Countries</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-dark-card divide-y divide-gray-700">
                    {getCloakedLandingPages().map((page) => (
                      <tr key={page._id} className="hover:bg-dark-lighter">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-white">{page.name}</div>
                            <div className="text-sm text-gray-400 ml-2">
                              <a 
                                href={getLandingPageUrl(page)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-purple-400 hover:text-purple-300"
                              >
                                {getLandingPageUrl(page)}
                              </a>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {typeof page.domainId === 'object' ? page.domainId.name : getDomainNameById(page.domainId)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          <a href={page.moneyUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                            {page.moneyUrl}
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          <div className="flex flex-wrap gap-1">
                            {page.targetCountries?.map((country) => (
                              <span key={country} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-900 text-purple-200">
                                {country}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            page.isActive ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                          }`}>
                            {page.isActive ? '🟢 Active' : '🔴 Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          <div className="flex space-x-2">
                            <button 
                              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-green-300 bg-dark-light hover:bg-dark transition-colors duration-150"
                              onClick={() => reDeployCloakedPage(page._id)}
                              title="Re-deploy worker with latest code and same settings"
                            >
                              🚀 Re-deploy
                            </button>
                            <button 
                              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-yellow-300 bg-dark-light hover:bg-dark transition-colors duration-150"
                              onClick={() => fixCloakingDns(page._id)}
                              title="Fix DNS settings to enable Cloudflare Workers"
                            >
                              🔧 Fix DNS
                            </button>
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
                <button 
                  type="button"
                  onClick={() => setIsDnsCheckModalOpen(true)}
                  className="px-4 py-2 rounded-md text-white font-medium bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-dark-card transition-colors duration-200"
                >
                  Check DNS Status
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
            
            <div className="flex space-x-2 mb-6">
              <button 
                type="button"
                onClick={() => setIsBulkLandingPageModalOpen(true)}
                className="px-4 py-2 rounded-md text-white font-medium bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-dark-card transition-colors duration-200"
              >
                🌐 Bulk Create Standard
              </button>
              <button 
                type="button"
                onClick={() => setIsBulkCallAdsModalOpen(true)}
                className="px-4 py-2 rounded-md text-white font-medium bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-dark-card transition-colors duration-200"
              >
                📞 Bulk Create Call Ads
              </button>
              <button 
                type="button"
                onClick={() => setIsCloakedModalOpen(true)}
                className="px-4 py-2 rounded-md text-white font-medium bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-dark-card transition-colors duration-200"
              >
                🎭 Create Cloaked Page
              </button>
            </div>
            
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
              
              {/* Template Selection */}
              <div className="space-y-2">
                <label className="block text-gray-400 text-sm font-medium">Template Type</label>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-3 border rounded-md cursor-pointer transition-colors ${
                    templateType === 'standard' 
                      ? 'border-primary bg-primary/10 text-white' 
                      : 'border-dark-light bg-dark-lighter text-gray-300 hover:bg-dark-light'
                  }`}
                  onClick={() => setTemplateType('standard')}
                  >
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="templateType"
                        value="standard"
                        checked={templateType === 'standard'}
                        onChange={() => setTemplateType('standard')}
                        className="w-4 h-4 text-primary bg-dark-lighter border-dark-light rounded focus:ring-primary"
                      />
                      <div>
                        <div className="font-medium">Standard</div>
                        <div className="text-xs text-gray-400">Regular landing page with screenshots</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`p-3 border rounded-md cursor-pointer transition-colors ${
                    templateType === 'call-ads' 
                      ? 'border-primary bg-primary/10 text-white' 
                      : 'border-dark-light bg-dark-lighter text-gray-300 hover:bg-dark-light'
                  }`}
                  onClick={() => setTemplateType('call-ads')}
                  >
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="templateType"
                        value="call-ads"
                        checked={templateType === 'call-ads'}
                        onChange={() => setTemplateType('call-ads')}
                        className="w-4 h-4 text-primary bg-dark-lighter border-dark-light rounded focus:ring-primary"
                      />
                      <div>
                        <div className="font-medium">Call Ads</div>
                        <div className="text-xs text-gray-400">Simple page for verification (phone + business)</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Call Ads Template Fields */}
              {templateType === 'call-ads' && (
                <div className="space-y-4 p-4 border border-orange-500/30 rounded-md bg-orange-900/10">
                  <h3 className="text-orange-300 text-sm font-medium flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                    </svg>
                    Call Ads Configuration
                  </h3>
                  
                  {/* Industry Template Selection */}
                  <div className="space-y-2">
                    <label className="block text-orange-300 text-sm font-medium">Industry Template</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className={`p-3 border rounded-md cursor-pointer transition-colors ${
                        callAdsTemplateType === 'travel' 
                          ? 'border-orange-400 bg-orange-500/20 text-white' 
                          : 'border-orange-500/50 bg-orange-900/20 text-orange-200 hover:bg-orange-800/20'
                      }`}
                      onClick={() => setCallAdsTemplateType('travel')}
                      >
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="callAdsTemplateType"
                            value="travel"
                            checked={callAdsTemplateType === 'travel'}
                            onChange={() => setCallAdsTemplateType('travel')}
                            className="w-4 h-4 text-orange-500 bg-dark-lighter border-orange-500 rounded focus:ring-orange-500"
                          />
                          <div>
                            <div className="font-medium text-sm">✈️ Travel/Flight</div>
                            <div className="text-xs opacity-80">Flight booking & travel deals</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className={`p-3 border rounded-md cursor-pointer transition-colors ${
                        callAdsTemplateType === 'pest-control' 
                          ? 'border-orange-400 bg-orange-500/20 text-white' 
                          : 'border-orange-500/50 bg-orange-900/20 text-orange-200 hover:bg-orange-800/20'
                      }`}
                      onClick={() => setCallAdsTemplateType('pest-control')}
                      >
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="callAdsTemplateType"
                            value="pest-control"
                            checked={callAdsTemplateType === 'pest-control'}
                            onChange={() => setCallAdsTemplateType('pest-control')}
                            className="w-4 h-4 text-orange-500 bg-dark-lighter border-orange-500 rounded focus:ring-orange-500"
                          />
                          <div>
                            <div className="font-medium text-sm">🐛 Pest Control</div>
                            <div className="text-xs opacity-80">Extermination & pest services</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <input
                    className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white placeholder-gray-500"
                    type="text"
                    placeholder="Business Name (e.g., Acme Digital Marketing)"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                  
                  <input
                    className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white placeholder-gray-500"
                    type="tel"
                    placeholder="Phone Number (e.g., (555) 123-4567)"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                  
                  <div className="text-xs text-orange-200 bg-orange-900/20 p-3 rounded-md">
                    <div className="font-medium mb-1">📞 Call Ads Template</div>
                    <p>This creates a simple verification page showing your business name and phone number. Perfect for Google call-only ads that require a working landing page for verification.</p>
                  </div>
                </div>
              )}
              
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
              
              {/* Affiliate URL - only for standard template */}
              {templateType === 'standard' && (
                <input
                  className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500"
                  type="text"
                  placeholder="Affiliate URL"
                  value={affiliateUrl}
                  onChange={(e) => setAffiliateUrl(e.target.value)}
                />
              )}
              
              {/* Original URL - only required for standard template */}
              {templateType === 'standard' && (
                <input
                  className={`w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500 ${useManualScreenshots ? 'opacity-50 cursor-not-allowed' : ''}`}
                  type="text"
                  placeholder={useManualScreenshots ? "Not required for manual screenshots" : "Original URL"}
                  value={originalUrl}
                  onChange={(e) => setOriginalUrl(e.target.value)}
                  disabled={useManualScreenshots}
                />
              )}
              
              {/* Manual Screenshots Toggle - only for standard template */}
              {templateType === 'standard' && (
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
              )}
              
              {/* Manual Screenshot Upload Fields - only for standard template */}
              {useManualScreenshots && templateType === 'standard' && (
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
              
              <div className="flex space-x-2">
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
              </div>
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
            
            {/* Landing Page Filter Tabs */}
            <div className="flex mb-6 border-b border-gray-700">
              <div 
                className={`px-4 py-3 cursor-pointer mr-2 ${
                  landingPageTab === 'all'
                    ? 'border-b-2 border-primary text-white font-semibold'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                onClick={() => setLandingPageTab('all')}
              >
                All ({landingPages.length})
              </div>
              <div 
                className={`px-4 py-3 cursor-pointer mr-2 ${
                  landingPageTab === 'standard'
                    ? 'border-b-2 border-primary text-white font-semibold'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                onClick={() => setLandingPageTab('standard')}
              >
                🌐 Standard ({getStandardLandingPages().length})
              </div>
              <div 
                className={`px-4 py-3 cursor-pointer mr-2 ${
                  landingPageTab === 'travel'
                    ? 'border-b-2 border-primary text-white font-semibold'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                onClick={() => setLandingPageTab('travel')}
              >
                ✈️ Travel ({getTravelLandingPages().length})
              </div>
              <div 
                className={`px-4 py-3 cursor-pointer mr-2 ${
                  landingPageTab === 'pest-control'
                    ? 'border-b-2 border-primary text-white font-semibold'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                onClick={() => setLandingPageTab('pest-control')}
              >
                🐛 Pest Control ({getPestControlLandingPages().length})
              </div>
              <div 
                className={`px-4 py-3 cursor-pointer mr-2 ${
                  landingPageTab === 'cloaked'
                    ? 'border-b-2 border-primary text-white font-semibold'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                onClick={() => setLandingPageTab('cloaked')}
              >
                🎭 Cloaked ({getCloakedLandingPages().length})
              </div>
            </div>
            
            {landingPages.length === 0 ? (
              <p className="text-gray-400">No landing pages yet. Create your first landing page above.</p>
            ) : getFilteredLandingPages().length === 0 ? (
              <p className="text-gray-400">No landing pages found for the selected filter.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-dark-accent">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-dark-accent">
                    <tr>
                      <th className="px-2 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider w-10">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-primary bg-dark-lighter border-dark-light rounded focus:ring-primary"
                          checked={getFilteredLandingPages().length > 0 && getFilteredLandingPages().every(page => selectedLandingPages.includes(page._id))}
                          onChange={toggleSelectAllLandingPages}
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">URL</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Template</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Google Ads Account ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Google Analytics ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-dark-lighter divide-y divide-gray-700">
                    {getFilteredLandingPages().map((page) => (
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
                            page.templateType === 'call-ads' 
                              ? 'bg-orange-900 text-orange-300' 
                              : page.templateType === 'cloaked'
                              ? 'bg-red-900 text-red-300'
                              : 'bg-blue-900 text-blue-300'
                          }`}>
                            {page.templateType === 'call-ads' 
                              ? `📞 ${page.callAdsTemplateType === 'pest-control' ? '🐛 Pest Control' : '✈️ Travel'}`
                              : page.templateType === 'cloaked'
                              ? '🎭 Cloaked'
                              : '🌐 Standard'
                            }
                          </span>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              placeholder="Enter Analytics ID"
                              value={page.googleAnalyticsId || ''}
                              onChange={(e) => {
                                // Update the landing page in state with the new value
                                const updatedPages = landingPages.map(p => 
                                  p._id === page._id ? { ...p, googleAnalyticsId: e.target.value } : p
                                );
                                setLandingPages(updatedPages);
                              }}
                              className="p-1 text-sm bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-white placeholder-gray-500 w-40"
                            />
                            <button
                              onClick={() => updateGoogleAnalyticsId(page._id, page.googleAnalyticsId || '')}
                              className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-green-300 bg-dark-light hover:bg-dark transition-colors duration-150"
                            >
                              Save
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          <div className="flex space-x-2">
                            {page.templateType === 'cloaked' && (
                              <>
                                <button 
                                  className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-green-300 bg-dark-light hover:bg-dark transition-colors duration-150"
                                  onClick={() => reDeployCloakedPage(page._id)}
                                  title="Re-deploy worker with latest code and same settings"
                                >
                                  🚀 Re-deploy
                                </button>
                                <button 
                                  className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-yellow-300 bg-dark-light hover:bg-dark transition-colors duration-150"
                                  onClick={() => fixCloakingDns(page._id)}
                                  title="Fix DNS settings to enable Cloudflare Workers"
                                >
                                  🔧 Fix DNS
                                </button>
                              </>
                            )}
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
      
      {activeTab === 'phoneNumbers' && (
        <>
          <div className="bg-dark-card p-6 mb-6 rounded-lg shadow-dark-md border border-dark-accent">
            <h2 className="text-xl font-semibold mb-4 text-white flex items-center">
              <svg className="w-5 h-5 mr-2 text-primary" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
              </svg>
              Manage Phone Numbers
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Add industry-specific phone numbers for call ads landing pages. Each industry uses different phone numbers that point to different offers.
            </p>
            
            <button 
              onClick={() => setIsPhoneNumberModalOpen(true)}
              className="px-4 py-2 rounded-md text-white font-medium bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-light focus:ring-offset-2 focus:ring-offset-dark-card transition-colors duration-200 mb-6"
            >
              Add Phone Numbers
            </button>
          </div>
          
          <div className="bg-dark-card p-6 rounded-lg shadow-dark-md border border-dark-accent">
            <h3 className="text-lg font-semibold mb-4 text-white">Phone Numbers by Industry</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Travel Phone Numbers */}
              <div>
                <h4 className="text-white font-medium mb-3 flex items-center">
                  ✈️ Travel ({getPhoneNumbersByIndustry('travel').length} numbers)
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {getPhoneNumbersByIndustry('travel').map((phone) => (
                    <div key={phone._id} className="p-3 bg-dark-lighter border border-dark-light rounded-md">
                      <div className="flex justify-between items-center">
                        <span className="text-white font-mono">{phone.phoneNumber}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          phone.isActive ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-300'
                        }`}>
                          {phone.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {phone.description && (
                        <p className="text-gray-400 text-sm mt-1">{phone.description}</p>
                      )}
                    </div>
                  ))}
                  {getPhoneNumbersByIndustry('travel').length === 0 && (
                    <p className="text-gray-400 text-center py-4">No travel phone numbers added yet</p>
                  )}
                </div>
              </div>
              
              {/* Pest Control Phone Numbers */}
              <div>
                <h4 className="text-white font-medium mb-3 flex items-center">
                  🐛 Pest Control ({getPhoneNumbersByIndustry('pest-control').length} numbers)
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {getPhoneNumbersByIndustry('pest-control').map((phone) => (
                    <div key={phone._id} className="p-3 bg-dark-lighter border border-dark-light rounded-md">
                      <div className="flex justify-between items-center">
                        <span className="text-white font-mono">{phone.phoneNumber}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          phone.isActive ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-300'
                        }`}>
                          {phone.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {phone.description && (
                        <p className="text-gray-400 text-sm mt-1">{phone.description}</p>
                      )}
                    </div>
                  ))}
                  {getPhoneNumbersByIndustry('pest-control').length === 0 && (
                    <p className="text-gray-400 text-center py-4">No pest control phone numbers added yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* Bulk Landing Page Creation Modal */}
      {isBulkLandingPageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-dark-card p-6 rounded-lg shadow-lg border border-dark-accent w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-white">Bulk Create Landing Pages</h3>
            <p className="text-gray-400 text-sm mb-4">
              Create the same landing page on multiple domains at once. Select the domains you want to use.
            </p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Form */}
              <div className="space-y-4">
                <h4 className="text-white font-medium">Landing Page Details</h4>
                
                <input
                  className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500"
                  type="text"
                  placeholder="Landing Page Name"
                  value={bulkLandingPageName}
                  onChange={(e) => setBulkLandingPageName(e.target.value)}
                />
                
                <input
                  className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500"
                  type="text"
                  placeholder="Subdomain (for regular domains only)"
                  value={bulkSubdomain}
                  onChange={(e) => setBulkSubdomain(e.target.value)}
                />
                
                <input
                  className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500"
                  type="text"
                  placeholder="Affiliate URL"
                  value={bulkAffiliateUrl}
                  onChange={(e) => setBulkAffiliateUrl(e.target.value)}
                />
                
                <input
                  className={`w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500 ${bulkUseManualScreenshots ? 'opacity-50 cursor-not-allowed' : ''}`}
                  type="text"
                  placeholder={bulkUseManualScreenshots ? "Not required for manual screenshots" : "Original URL"}
                  value={bulkOriginalUrl}
                  onChange={(e) => setBulkOriginalUrl(e.target.value)}
                  disabled={bulkUseManualScreenshots}
                />
                
                {/* Manual Screenshots Toggle */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="bulkManualScreenshots"
                    checked={bulkUseManualScreenshots}
                    onChange={(e) => setBulkUseManualScreenshots(e.target.checked)}
                    className="w-4 h-4 text-primary bg-dark-lighter border-dark-light rounded focus:ring-primary"
                  />
                  <label htmlFor="bulkManualScreenshots" className="text-gray-300 text-sm">
                    Manually upload screenshots
                  </label>
                </div>
                
                {/* Manual Screenshot Upload Fields */}
                {bulkUseManualScreenshots && (
                  <div className="space-y-4 p-4 border border-dark-accent rounded-md bg-dark-light">
                    <h5 className="text-white text-sm font-medium">Upload Screenshots</h5>
                    
                    {/* Desktop Screenshot */}
                    <div>
                      <label className="block text-gray-400 text-xs mb-1">Desktop Screenshot</label>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleBulkDesktopScreenshotChange}
                        className="text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary file:text-white hover:file:bg-primary-dark"
                      />
                      {bulkDesktopPreviewUrl && (
                        <div className="mt-2 relative">
                          <img 
                            src={bulkDesktopPreviewUrl} 
                            alt="Desktop Preview" 
                            className="max-h-32 rounded-md border border-dark-accent"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setBulkDesktopScreenshotFile(null);
                              setBulkDesktopPreviewUrl(null);
                            }}
                            className="absolute top-1 right-1 bg-red-600 rounded-full text-white text-xs p-1"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Mobile Screenshot */}
                    <div>
                      <label className="block text-gray-400 text-xs mb-1">Mobile Screenshot</label>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleBulkMobileScreenshotChange}
                        className="text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary file:text-white hover:file:bg-primary-dark"
                      />
                      {bulkMobilePreviewUrl && (
                        <div className="mt-2 relative">
                          <img 
                            src={bulkMobilePreviewUrl} 
                            alt="Mobile Preview" 
                            className="max-h-32 rounded-md border border-dark-accent"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setBulkMobileScreenshotFile(null);
                              setBulkMobilePreviewUrl(null);
                            }}
                            className="absolute top-1 right-1 bg-red-600 rounded-full text-white text-xs p-1"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Right Column - Domain Selection */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-white font-medium">Select Domains ({selectedDomainsForBulk.length} selected)</h4>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedDomainsForBulk.length === getEligibleDomains().length && getEligibleDomains().length > 0}
                      onChange={toggleSelectAllDomainsForBulk}
                      className="w-4 h-4 text-primary bg-dark-lighter border-dark-light rounded focus:ring-primary"
                    />
                    <span className="text-gray-300 text-sm">Select All</span>
                  </label>
                </div>
                
                <div className="max-h-64 overflow-y-auto border border-dark-accent rounded-md bg-dark-lighter">
                  {getEligibleDomains().length > 0 ? (
                    getEligibleDomains().map((domain) => (
                      <label key={domain._id} className="flex items-center p-3 hover:bg-dark-light cursor-pointer border-b border-dark-accent last:border-b-0">
                        <input
                          type="checkbox"
                          checked={selectedDomainsForBulk.includes(domain._id)}
                          onChange={() => toggleDomainSelectionForBulk(domain._id)}
                          className="w-4 h-4 text-primary bg-dark-lighter border-dark-light rounded focus:ring-primary mr-3"
                        />
                        <div className="flex-1">
                          <div className="text-white text-sm">{domain.name}</div>
                          <div className="text-gray-400 text-xs">
                            {domain.dnsManagement === 'external' ? 'External DNS' : 'Cloudflare DNS'}
                          </div>
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="p-4 text-gray-400 text-center">
                      No eligible domains available. Domains must be verified and have no landing pages.
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Results display */}
            {(bulkLandingPageResults.success.length > 0 || bulkLandingPageResults.failed.length > 0) && (
              <div className="mt-6">
                <h4 className="text-white font-medium mb-2">Results:</h4>
                {bulkLandingPageResults.success.length > 0 && (
                  <div className="mb-2">
                    <p className="text-green-400 text-sm">{bulkLandingPageResults.success.length} landing pages created successfully:</p>
                    <ul className="text-gray-300 text-xs ml-4 list-disc">
                      {bulkLandingPageResults.success.map((domain, index) => (
                        <li key={index}>{domain}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {bulkLandingPageResults.failed.length > 0 && (
                  <div>
                    <p className="text-red-400 text-sm">{bulkLandingPageResults.failed.length} landing pages failed:</p>
                    <ul className="text-gray-300 text-xs ml-4 list-disc">
                      {bulkLandingPageResults.failed.map((item, index) => (
                        <li key={index}>{item.domain}: {item.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setIsBulkLandingPageModalOpen(false);
                  setBulkLandingPageResults({ success: [], failed: [] });
                  if (bulkLandingPageResults.success.length > 0) {
                    setBulkLandingPageName('');
                    setBulkSubdomain('');
                    setBulkAffiliateUrl('');
                    setBulkOriginalUrl('');
                    setSelectedDomainsForBulk([]);
                    setBulkUseManualScreenshots(false);
                    setBulkDesktopScreenshotFile(null);
                    setBulkMobileScreenshotFile(null);
                    setBulkDesktopPreviewUrl(null);
                    setBulkMobilePreviewUrl(null);
                  }
                }}
                className="px-4 py-2 rounded-md text-white font-medium bg-gray-600 hover:bg-gray-700 transition-colors duration-200"
              >
                Close
              </button>
              <button
                onClick={createBulkLandingPages}
                disabled={bulkLandingPageLoading}
                className={`px-4 py-2 rounded-md text-white font-medium ${
                  bulkLandingPageLoading 
                    ? 'bg-primary-light/50 cursor-not-allowed' 
                    : 'bg-primary hover:bg-primary-dark transition-colors duration-200'
                }`}
              >
                {bulkLandingPageLoading ? 'Creating...' : 'Create Landing Pages'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* DNS Status Check Modal */}
      {isDnsCheckModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-dark-card p-6 rounded-lg shadow-lg border border-dark-accent w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-white">DNS Status Check</h3>
            <p className="text-gray-400 text-sm mb-4">
              Check which domains are properly pointing to Vercel and identify any that went offline.
            </p>
            
            {/* Check Type Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-white mb-2">Check Type</label>
              <div className="flex space-x-2">
                <button
                  onClick={() => checkDnsStatus('external')}
                  disabled={dnsCheckLoading}
                  className={`px-4 py-2 rounded-md text-white font-medium ${
                    dnsCheckLoading 
                      ? 'bg-purple-600/50 cursor-not-allowed' 
                      : 'bg-purple-600 hover:bg-purple-700 transition-colors duration-200'
                  }`}
                >
                  {dnsCheckLoading ? 'Checking...' : 'Check External Domains'}
                </button>
                <button
                  onClick={() => checkDnsStatus('inactive')}
                  disabled={dnsCheckLoading}
                  className={`px-4 py-2 rounded-md text-white font-medium ${
                    dnsCheckLoading 
                      ? 'bg-orange-600/50 cursor-not-allowed' 
                      : 'bg-orange-600 hover:bg-orange-700 transition-colors duration-200'
                  }`}
                >
                  {dnsCheckLoading ? 'Checking...' : 'Check Inactive Only'}
                </button>
                <button
                  onClick={() => checkDnsStatus('all')}
                  disabled={dnsCheckLoading}
                  className={`px-4 py-2 rounded-md text-white font-medium ${
                    dnsCheckLoading 
                      ? 'bg-blue-600/50 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700 transition-colors duration-200'
                  }`}
                >
                  {dnsCheckLoading ? 'Checking...' : 'Check All Domains'}
                </button>
              </div>
            </div>
            
            {/* Results Summary */}
            {dnsCheckResults.summary && (
              <div className="mb-6 p-4 bg-dark-lighter border border-dark-light rounded-md">
                <h4 className="text-white font-medium mb-2">Summary</h4>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">{dnsCheckResults.summary.total}</div>
                    <div className="text-gray-400">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">{dnsCheckResults.summary.active}</div>
                    <div className="text-gray-400">Active</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-400">{dnsCheckResults.summary.inactive}</div>
                    <div className="text-gray-400">Inactive</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-400">{dnsCheckResults.summary.errors}</div>
                    <div className="text-gray-400">Errors</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Results Table */}
            {dnsCheckResults.results && dnsCheckResults.results.externalInactive.length > 0 && (
              <div className="mb-4">
                <h4 className="text-white font-medium mb-2">External Domains with Issues ({dnsCheckResults.results.externalInactive.length})</h4>
                <div className="overflow-x-auto rounded-lg border border-dark-accent">
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-dark-accent">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Domain</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Current Target</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Expected</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Error</th>
                      </tr>
                    </thead>
                    <tbody className="bg-dark-lighter divide-y divide-gray-700">
                      {dnsCheckResults.results.externalInactive.map((result: any, index: number) => (
                        <tr key={index} className="hover:bg-dark-light transition-colors duration-150">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-white">{result.domain}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              result.status === 'active' 
                                ? 'bg-green-900 text-green-300'
                                : result.status === 'error'
                                  ? 'bg-red-900 text-red-300'
                                  : 'bg-yellow-900 text-yellow-300'
                            }`}>
                              {result.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                            {result.currentTarget || 'N/A'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-300">
                            {result.expectedTarget}
                          </td>
                          <td className="px-4 py-3 text-sm text-red-300">
                            {result.error || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* All Results Table (collapsed by default) */}
            {dnsCheckResults.results && dnsCheckResults.results.all.length > 0 && (
              <details className="mb-4">
                <summary className="cursor-pointer text-white font-medium mb-2 hover:text-gray-300">
                  All Results ({dnsCheckResults.results.all.length}) - Click to expand
                </summary>
                <div className="overflow-x-auto rounded-lg border border-dark-accent">
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-dark-accent">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Domain</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">DNS Management</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Current Target</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Expected</th>
                      </tr>
                    </thead>
                    <tbody className="bg-dark-lighter divide-y divide-gray-700">
                      {dnsCheckResults.results.all.map((result: any, index: number) => (
                        <tr key={index} className="hover:bg-dark-light transition-colors duration-150">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-white">{result.domain}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              result.dnsManagement === 'external' 
                                ? 'bg-blue-900 text-blue-300'
                                : 'bg-green-900 text-green-300'
                            }`}>
                              {result.dnsManagement}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              result.status === 'active' 
                                ? 'bg-green-900 text-green-300'
                                : result.status === 'error'
                                  ? 'bg-red-900 text-red-300'
                                  : 'bg-yellow-900 text-yellow-300'
                            }`}>
                              {result.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                            {result.currentTarget || 'N/A'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-300">
                            {result.expectedTarget}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
            
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setIsDnsCheckModalOpen(false);
                  setDnsCheckResults({});
                }}
                className="px-4 py-2 rounded-md text-white font-medium bg-gray-600 hover:bg-gray-700 transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Phone Number Management Modal */}
      {isPhoneNumberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-dark-card p-6 rounded-lg shadow-lg border border-dark-accent w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-white">Add Phone Numbers</h3>
            <p className="text-gray-400 text-sm mb-4">
              Add phone numbers for call ads landing pages. Each phone number should be on a new line.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Industry</label>
                <select 
                  value={phoneNumberIndustry}
                  onChange={(e) => setPhoneNumberIndustry(e.target.value as 'travel' | 'pest-control')}
                  className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white"
                >
                  <option value="travel">✈️ Travel</option>
                  <option value="pest-control">🐛 Pest Control</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-2">Phone Numbers (one per line)</label>
                <textarea
                  value={bulkPhoneNumbers}
                  onChange={(e) => setBulkPhoneNumbers(e.target.value)}
                  placeholder="Enter phone numbers, one per line:&#10;+1-555-123-4567&#10;+1-555-987-6543&#10;+1-555-456-7890"
                  className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500 h-32"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-2">Description (optional)</label>
                <input
                  type="text"
                  value={phoneNumberDescription}
                  onChange={(e) => setPhoneNumberDescription(e.target.value)}
                  placeholder="e.g., Campaign batch #1, High-converting numbers"
                  className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500"
                />
              </div>
            </div>
            
            {/* Results display */}
            {(phoneNumberResults.success.length > 0 || phoneNumberResults.failed.length > 0) && (
              <div className="mt-6">
                <h4 className="text-white font-medium mb-2">Results:</h4>
                {phoneNumberResults.success.length > 0 && (
                  <div className="mb-2">
                    <p className="text-green-400 text-sm">{phoneNumberResults.success.length} phone numbers added successfully:</p>
                    <ul className="text-gray-300 text-xs ml-4 list-disc max-h-20 overflow-y-auto">
                      {phoneNumberResults.success.map((phone, index) => (
                        <li key={index}>{phone}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {phoneNumberResults.failed.length > 0 && (
                  <div>
                    <p className="text-red-400 text-sm">{phoneNumberResults.failed.length} phone numbers failed:</p>
                    <ul className="text-gray-300 text-xs ml-4 list-disc max-h-20 overflow-y-auto">
                      {phoneNumberResults.failed.map((failure, index) => (
                        <li key={index}>{failure.phoneNumber}: {failure.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setIsPhoneNumberModalOpen(false);
                  setBulkPhoneNumbers('');
                  setPhoneNumberDescription('');
                  setPhoneNumberResults({ success: [], failed: [] });
                }}
                className="px-4 py-2 rounded-md text-white font-medium bg-gray-600 hover:bg-gray-700 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={addPhoneNumbers}
                disabled={phoneNumberLoading}
                className={`px-4 py-2 rounded-md text-white font-medium ${
                  phoneNumberLoading 
                    ? 'bg-primary-light/50 cursor-not-allowed' 
                    : 'bg-primary hover:bg-primary-dark transition-colors duration-200'
                }`}
              >
                {phoneNumberLoading ? 'Adding...' : 'Add Phone Numbers'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Bulk Call Ads Creation Modal */}
      {isBulkCallAdsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-dark-card p-6 rounded-lg shadow-lg border border-dark-accent w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-white">Bulk Create Call Ads Landing Pages</h3>
            <p className="text-gray-400 text-sm mb-4">
              Create call ads landing pages on multiple domains. Phone numbers and business names will be automatically assigned from your database.
            </p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Form */}
              <div className="space-y-4">
                <h4 className="text-white font-medium">Call Ads Details</h4>
                
                <input
                  className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500"
                  type="text"
                  placeholder="Campaign Name"
                  value={bulkCallAdsName}
                  onChange={(e) => setBulkCallAdsName(e.target.value)}
                />
                
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Industry</label>
                  <select 
                    value={bulkCallAdsIndustry}
                    onChange={(e) => setBulkCallAdsIndustry(e.target.value as 'travel' | 'pest-control')}
                    className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white"
                  >
                    <option value="travel">✈️ Travel ({getPhoneNumbersByIndustry('travel').length} numbers available)</option>
                    <option value="pest-control">🐛 Pest Control ({getPhoneNumbersByIndustry('pest-control').length} numbers available)</option>
                  </select>
                </div>
                
                <input
                  className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500"
                  type="text"
                  placeholder="Subdomain (for regular domains only)"
                  value={bulkCallAdsSubdomain}
                  onChange={(e) => setBulkCallAdsSubdomain(e.target.value)}
                />
                
                <div className="p-3 bg-blue-900/30 border border-blue-700 rounded-md">
                  <p className="text-blue-200 text-sm">
                    📞 Phone numbers and business names will be automatically assigned from your {bulkCallAdsIndustry} database.
                    Each landing page will get a unique phone number and generated business name.
                  </p>
                </div>
              </div>
              
              {/* Right Column - Domain Selection */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-white font-medium">Select Domains ({selectedDomainsForCallAds.length} selected)</h4>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedDomainsForCallAds.length === getEligibleDomains().length && getEligibleDomains().length > 0}
                      onChange={toggleSelectAllDomainsForCallAds}
                      className="w-4 h-4 text-primary bg-dark-lighter border-dark-light rounded focus:ring-primary"
                    />
                    <span className="text-gray-300 text-sm">Select All</span>
                  </label>
                </div>
                
                <div className="max-h-64 overflow-y-auto border border-dark-accent rounded-md bg-dark-lighter">
                  {getEligibleDomains().length > 0 ? (
                    getEligibleDomains().map((domain) => (
                      <label key={domain._id} className="flex items-center p-3 hover:bg-dark-light cursor-pointer border-b border-dark-accent last:border-b-0">
                        <input
                          type="checkbox"
                          checked={selectedDomainsForCallAds.includes(domain._id)}
                          onChange={() => toggleDomainSelectionForCallAds(domain._id)}
                          className="w-4 h-4 text-primary bg-dark-lighter border-dark-light rounded focus:ring-primary mr-3"
                        />
                        <div className="flex-1">
                          <div className="text-white text-sm">{domain.name}</div>
                          <div className="text-gray-400 text-xs">
                            {domain.dnsManagement === 'external' ? 'External DNS' : 'Cloudflare DNS'}
                          </div>
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="p-4 text-gray-400 text-center">
                      No eligible domains available. Domains must be verified and have no landing pages.
                    </div>
                  )}
                </div>
                
                {getPhoneNumbersByIndustry(bulkCallAdsIndustry).length < selectedDomainsForCallAds.length && (
                  <div className="mt-3 p-3 bg-yellow-900/30 border border-yellow-700 rounded-md">
                    <p className="text-yellow-200 text-sm">
                      ⚠️ Warning: You have selected {selectedDomainsForCallAds.length} domains but only have {getPhoneNumbersByIndustry(bulkCallAdsIndustry).length} phone numbers available for {bulkCallAdsIndustry}.
                      Only {getPhoneNumbersByIndustry(bulkCallAdsIndustry).length} landing pages will be created.
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Results display */}
            {(bulkCallAdsResults.success.length > 0 || bulkCallAdsResults.failed.length > 0) && (
              <div className="mt-6">
                <h4 className="text-white font-medium mb-2">Results:</h4>
                {bulkCallAdsResults.success.length > 0 && (
                  <div className="mb-2">
                    <p className="text-green-400 text-sm">{bulkCallAdsResults.success.length} call ads landing pages created successfully:</p>
                    <ul className="text-gray-300 text-xs ml-4 list-disc max-h-20 overflow-y-auto">
                      {bulkCallAdsResults.success.map((domain, index) => (
                        <li key={index}>{domain}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {bulkCallAdsResults.failed.length > 0 && (
                  <div>
                    <p className="text-red-400 text-sm">{bulkCallAdsResults.failed.length} domains failed:</p>
                    <ul className="text-gray-300 text-xs ml-4 list-disc max-h-20 overflow-y-auto">
                      {bulkCallAdsResults.failed.map((failure, index) => (
                        <li key={index}>{failure.domain}: {failure.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setIsBulkCallAdsModalOpen(false);
                  setBulkCallAdsName('');
                  setBulkCallAdsSubdomain('');
                  setSelectedDomainsForCallAds([]);
                  setBulkCallAdsResults({ success: [], failed: [] });
                }}
                className="px-4 py-2 rounded-md text-white font-medium bg-gray-600 hover:bg-gray-700 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={createBulkCallAds}
                disabled={bulkCallAdsLoading}
                className={`px-4 py-2 rounded-md text-white font-medium ${
                  bulkCallAdsLoading 
                    ? 'bg-primary-light/50 cursor-not-allowed' 
                    : 'bg-primary hover:bg-primary-dark transition-colors duration-200'
                }`}
              >
                {bulkCallAdsLoading ? 'Creating...' : 'Create Call Ads Landing Pages'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Cloaked Landing Page Creation Modal */}
      {isCloakedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-dark-card p-6 rounded-lg shadow-lg border border-dark-accent w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-white">🎭 Create Cloaked Landing Page</h3>
            <p className="text-gray-400 text-sm mb-4">
              Create a cloaked landing page with JCI API filtering. Shows different content based on visitor origin and quality.
            </p>
            
            <div className="space-y-4">
              <input
                className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500"
                type="text"
                placeholder="Campaign Name"
                value={cloakedName}
                onChange={(e) => setCloakedName(e.target.value)}
              />
              
              <div>
                <label className="block text-sm font-medium text-white mb-2">Select Domain</label>
                <select 
                  value={selectedDomainForCloaked}
                  onChange={(e) => setSelectedDomainForCloaked(e.target.value)}
                  className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white"
                >
                  <option value="">Select a domain</option>
                  {getCloakingEligibleDomains().map((domain) => (
                    <option key={domain._id} value={domain._id}>
                      {domain.name} (Cloudflare-managed)
                    </option>
                  ))}
                </select>
                {getCloakingEligibleDomains().length === 0 && (
                  <p className="text-yellow-400 text-sm mt-1">
                    No Cloudflare-managed domains available. Cloaking requires Cloudflare Workers (not available for external domains).
                  </p>
                )}
              </div>
              
              {selectedDomainForCloaked && !domains.find(d => d._id === selectedDomainForCloaked)?.dnsManagement?.includes('external') && (
                              <input
                className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500"
                type="text"
                placeholder="Subdomain (e.g., offers, campaign1)"
                value={cloakedSubdomain}
                onChange={(e) => setCloakedSubdomain(e.target.value)}
              />
            )}
            
            <input
              className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500"
              type="url"
              placeholder="Money Page URL (where real users go)"
              value={moneyUrl}
              onChange={(e) => setMoneyUrl(e.target.value)}
            />
            
            <input
              className="w-full p-3 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500"
              type="url"
              placeholder="Safe Page URL (where bots/reviewers go)"
              value={whitePageUrl}
              onChange={(e) => setWhitePageUrl(e.target.value)}
            />
              
              {/* Target Countries */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Target Countries (Whitelist)</label>
                <div className="flex space-x-2 mb-2">
                  <select
                    value={newTargetCountry}
                    onChange={(e) => setNewTargetCountry(e.target.value)}
                    className="flex-1 p-2 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white text-sm"
                  >
                    <option value="">Select a country</option>
                    {commonCountries.filter(country => !targetCountries.includes(country)).map((country) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addTargetCountry}
                    disabled={!newTargetCountry}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm rounded-md transition-colors duration-200"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {targetCountries.map((country, index) => (
                    <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-900/30 text-green-300 border border-green-600">
                      {country}
                      <button
                        type="button"
                        onClick={() => removeTargetCountry(country)}
                        className="ml-1 text-green-400 hover:text-green-200"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              

              

            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setIsCloakedModalOpen(false);
                  setCloakedName('');
                  setCloakedSubdomain('');
                  setMoneyUrl('');
                  setWhitePageUrl(''); // Reset white page URL
                  setTargetCountries(['Germany']);
                  setSelectedDomainForCloaked('');
                  setNewTargetCountry('');
                }}
                className="px-4 py-2 rounded-md text-white font-medium bg-gray-600 hover:bg-gray-700 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={createCloakedLandingPage}
                disabled={cloakedLoading}
                className={`px-4 py-2 rounded-md text-white font-medium ${
                  cloakedLoading 
                    ? 'bg-primary-light/50 cursor-not-allowed' 
                    : 'bg-red-600 hover:bg-red-700 transition-colors duration-200'
                }`}
              >
                {cloakedLoading ? 'Creating...' : '🎭 Create Cloaked Landing Page'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Traffic Logs Section */}
      {activeTab === 'trafficLogs' && (
        <>
          <div className="bg-dark-card p-6 mb-6 rounded-lg shadow-dark-md border border-dark-accent">
            <h2 className="text-xl font-semibold mb-4 text-white flex items-center">
              📊 Traffic Logs & Analytics
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Monitor all visitor traffic through your cloaked pages. See real-time decisions, geographic data, and bot detection results.
            </p>
            
            {/* Stats Cards */}
            {trafficLogStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-dark-lighter p-4 rounded-lg border border-dark-light">
                  <div className="text-2xl font-bold text-white">{trafficLogStats.totalRequests}</div>
                  <div className="text-gray-400 text-sm">Total Requests</div>
                </div>
                <div className="bg-dark-lighter p-4 rounded-lg border border-dark-light">
                  <div className="text-2xl font-bold text-green-400">{trafficLogStats.moneyPageRequests}</div>
                  <div className="text-gray-400 text-sm">Money Page Views</div>
                </div>
                <div className="bg-dark-lighter p-4 rounded-lg border border-dark-light">
                  <div className="text-2xl font-bold text-red-400">{trafficLogStats.safePageRequests}</div>
                  <div className="text-gray-400 text-sm">Safe Page Views</div>
                </div>
                <div className="bg-dark-lighter p-4 rounded-lg border border-dark-light">
                  <div className="text-2xl font-bold text-blue-400">
                    {trafficLogStats.totalRequests > 0 ? Math.round((trafficLogStats.moneyPageRequests / trafficLogStats.totalRequests) * 100) : 0}%
                  </div>
                  <div className="text-gray-400 text-sm">Conversion Rate</div>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <select
                value={trafficLogFilters.decision}
                onChange={(e) => setTrafficLogFilters({...trafficLogFilters, decision: e.target.value})}
                className="p-2 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white text-sm"
              >
                <option value="">All Decisions</option>
                <option value="money_page">Money Page</option>
                <option value="safe_page">Safe Page</option>
              </select>
              
              <input
                type="text"
                placeholder="Filter by domain"
                value={trafficLogFilters.domain}
                onChange={(e) => setTrafficLogFilters({...trafficLogFilters, domain: e.target.value})}
                className="p-2 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white text-sm placeholder-gray-500"
              />
              
              <input
                type="datetime-local"
                value={trafficLogFilters.since}
                onChange={(e) => setTrafficLogFilters({...trafficLogFilters, since: e.target.value})}
                className="p-2 bg-dark-lighter border border-dark-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white text-sm"
              />
            </div>

            <div className="flex space-x-2 mb-4">
              <button
                onClick={() => fetchTrafficLogs(1, trafficLogFilters)}
                disabled={trafficLogsLoading}
                className="px-4 py-2 bg-primary hover:bg-primary-dark disabled:bg-primary-light/50 text-white rounded-md text-sm font-medium transition-colors duration-200"
              >
                {trafficLogsLoading ? 'Loading...' : 'Apply Filters'}
              </button>
              <button
                onClick={() => {
                  setTrafficLogFilters({ decision: '', domain: '', since: '' });
                  fetchTrafficLogs(1, { decision: '', domain: '', since: '' });
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors duration-200"
              >
                Clear Filters
              </button>
              <button
                onClick={() => fetchTrafficLogs(trafficLogPage || 1, trafficLogFilters)}
                disabled={trafficLogsLoading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 text-white rounded-md text-sm font-medium transition-colors duration-200 flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                {trafficLogsLoading ? 'Refreshing...' : 'Refresh Now'}
              </button>
            </div>
            
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-gray-400 flex items-center">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                📊 Showing most recent 300 logs • Auto-refreshes every 30 seconds
              </div>
              <div className="text-xs text-gray-500">
                Last updated: {trafficLogLastUpdate ? trafficLogLastUpdate.toLocaleTimeString() : 'Never'}
              </div>
            </div>
          </div>

          {/* Traffic Logs Table */}
          <div className="bg-dark-card rounded-lg shadow-dark-md border border-dark-accent overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dark-lighter">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">IP Address</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Domain</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Path</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Decision</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Country</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Risk Score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Reason</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">User Agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-light">
                  {trafficLogsLoading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                        Loading traffic logs...
                      </td>
                    </tr>
                  ) : trafficLogs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                        No traffic logs found. Traffic will appear here once your cloaked pages start receiving visitors.
                      </td>
                    </tr>
                  ) : (
                    trafficLogs.map((log, index) => (
                      <tr key={index} className="hover:bg-dark-lighter/50">
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300 font-mono">
                          {formatIP(log.ip)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {log.domain}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {log.path}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            log.decision === 'money_page' 
                              ? 'bg-green-900/30 text-green-300 border border-green-600' 
                              : 'bg-red-900/30 text-red-300 border border-red-600'
                          }`}>
                            {log.decision === 'money_page' ? '💰 Money' : '🛡️ Safe'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {log.country || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {log.riskScore !== null ? (
                            <span className={`font-medium ${
                              log.riskScore > 60 ? 'text-red-400' : 
                              log.riskScore > 30 ? 'text-yellow-400' : 'text-green-400'
                            }`}>
                              {log.riskScore}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            log.detectionReason === 'clean_visitor' ? 'bg-green-900/20 text-green-400' :
                            log.detectionReason === 'no_gclid' ? 'bg-yellow-900/20 text-yellow-400' :
                            log.detectionReason === 'bot_user_agent' ? 'bg-red-900/20 text-red-400' :
                            log.detectionReason === 'geo_block' ? 'bg-blue-900/20 text-blue-400' :
                            log.detectionReason === 'high_risk' ? 'bg-red-900/20 text-red-400' :
                            log.detectionReason === 'proxy_detected' ? 'bg-purple-900/20 text-purple-400' :
                            'bg-gray-900/20 text-gray-400'
                          }`}>
                            {log.detectionReason?.replace('_', ' ') || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300 max-w-xs truncate" title={log.userAgent}>
                          {log.userAgent}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {trafficLogTotalPages > 1 && (
              <div className="bg-dark-lighter px-4 py-3 flex items-center justify-between border-t border-dark-light">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => fetchTrafficLogs(Math.max(1, trafficLogPage - 1), trafficLogFilters)}
                    disabled={trafficLogPage <= 1 || trafficLogsLoading}
                    className="relative inline-flex items-center px-4 py-2 border border-dark-light text-sm font-medium rounded-md text-gray-300 bg-dark-card hover:bg-dark-lighter disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => fetchTrafficLogs(Math.min(trafficLogTotalPages, trafficLogPage + 1), trafficLogFilters)}
                    disabled={trafficLogPage >= trafficLogTotalPages || trafficLogsLoading}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-dark-light text-sm font-medium rounded-md text-gray-300 bg-dark-card hover:bg-dark-lighter disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-400">
                      Page <span className="font-medium text-white">{trafficLogPage}</span> of{' '}
                      <span className="font-medium text-white">{trafficLogTotalPages}</span>
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => fetchTrafficLogs(Math.max(1, trafficLogPage - 1), trafficLogFilters)}
                        disabled={trafficLogPage <= 1 || trafficLogsLoading}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-dark-light bg-dark-card text-sm font-medium text-gray-300 hover:bg-dark-lighter disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => fetchTrafficLogs(Math.min(trafficLogTotalPages, trafficLogPage + 1), trafficLogFilters)}
                        disabled={trafficLogPage >= trafficLogTotalPages || trafficLogsLoading}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-dark-light bg-dark-card text-sm font-medium text-gray-300 hover:bg-dark-lighter disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Top Countries & Reasons */}
          {trafficLogStats && (trafficLogStats.topCountries.length > 0 || trafficLogStats.topReasons.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {/* Top Countries */}
              {trafficLogStats.topCountries.length > 0 && (
                <div className="bg-dark-card p-6 rounded-lg shadow-dark-md border border-dark-accent">
                  <h3 className="text-lg font-semibold mb-4 text-white">🌍 Top Countries</h3>
                  <div className="space-y-3">
                    {trafficLogStats.topCountries.map((item: any, index: number) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-gray-300">{item.country}</span>
                        <span className="text-white font-medium">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Detection Reasons */}
              {trafficLogStats.topReasons.length > 0 && (
                <div className="bg-dark-card p-6 rounded-lg shadow-dark-md border border-dark-accent">
                  <h3 className="text-lg font-semibold mb-4 text-white">🔍 Top Detection Reasons</h3>
                  <div className="space-y-3">
                    {trafficLogStats.topReasons.map((item: any, index: number) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-gray-300 capitalize">{item.reason.replace('_', ' ')}</span>
                        <span className="text-white font-medium">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

    </div>
  );
} 