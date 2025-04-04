"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Basic styling for the app
const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    padding: '10px 0',
    borderBottom: '1px solid #eaeaea',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
  },
  card: {
    padding: '20px',
    marginBottom: '20px',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    backgroundColor: 'white',
  },
  button: {
    padding: '10px 15px',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    marginBottom: '10px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '14px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as 'collapse',
  },
  tableHead: {
    backgroundColor: '#f9f9f9',
  },
  tableCell: {
    padding: '10px',
    border: '1px solid #eaeaea',
    textAlign: 'left' as const,
  },
  tabs: {
    display: 'flex',
    marginBottom: '20px',
    borderBottom: '1px solid #eaeaea',
  },
  tab: {
    padding: '10px 15px',
    cursor: 'pointer',
    marginRight: '5px',
  },
  activeTab: {
    borderBottom: '2px solid #0070f3',
    fontWeight: 'bold' as const,
  },
};

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
  
  // Get domain name for a landing page
  const getDomainName = (landingPage: LandingPage) => {
    if (typeof landingPage.domainId === 'object' && landingPage.domainId !== null) {
      return landingPage.domainId.name;
    }
    
    const domain = domains.find(d => d._id === landingPage.domainId);
    return domain ? domain.name : 'Unknown';
  };
  
  // Get full URL for a landing page
  const getLandingPageUrl = (landingPage: LandingPage) => {
    const domainName = getDomainName(landingPage);
    return `http://${landingPage.subdomain}.${domainName}`;
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
  
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Webpage Creator</h1>
      </header>
      
      <div style={styles.tabs}>
        <div 
          style={{
            ...styles.tab,
            ...(activeTab === 'domains' ? styles.activeTab : {}),
          }}
          onClick={() => setActiveTab('domains')}
        >
          Domains
        </div>
        <div 
          style={{
            ...styles.tab,
            ...(activeTab === 'landingPages' ? styles.activeTab : {}),
          }}
          onClick={() => setActiveTab('landingPages')}
        >
          Landing Pages
        </div>
      </div>
      
      {activeTab === 'domains' && (
        <>
          <div style={styles.card}>
            <h2>Add Domain</h2>
            <form onSubmit={addDomain}>
              <input
                style={styles.input}
                type="text"
                placeholder="Domain name (e.g., example.com)"
                value={domainName}
                onChange={(e) => setDomainName(e.target.value)}
              />
              <button 
                style={styles.button} 
                type="submit"
                disabled={loading}
              >
                {loading ? 'Adding...' : 'Add Domain'}
              </button>
            </form>
          </div>
          
          <div style={styles.card}>
            <h2>Your Domains</h2>
            {domains.length === 0 ? (
              <p>No domains yet. Add your first domain above.</p>
            ) : (
              <table style={styles.table}>
                <thead style={styles.tableHead}>
                  <tr>
                    <th style={styles.tableCell}>Domain</th>
                    <th style={styles.tableCell}>Nameservers</th>
                    <th style={styles.tableCell}>Status</th>
                    <th style={styles.tableCell}>Verification</th>
                    <th style={styles.tableCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {domains.map((domain) => (
                    <tr key={domain._id}>
                      <td style={styles.tableCell}>{domain.name}</td>
                      <td style={styles.tableCell}>
                        <ul>
                          {Array.isArray(domain.cloudflareNameservers) ? (
                            domain.cloudflareNameservers.map((ns, i) => (
                              <li key={i}>{ns}</li>
                            ))
                          ) : (
                            <li>Nameservers not available</li>
                          )}
                        </ul>
                      </td>
                      <td style={styles.tableCell}>
                        {domain.isActive ? 'Active' : 'Inactive'}
                      </td>
                      <td style={styles.tableCell}>
                        <div>
                          {domain.verificationStatus === 'pending' && (
                            <span style={{ color: 'orange' }}>Pending</span>
                          )}
                          {domain.verificationStatus === 'active' && (
                            <span style={{ color: 'green' }}>Verified</span>
                          )}
                          {domain.verificationStatus === 'inactive' && (
                            <span style={{ color: 'red' }}>Not Verified</span>
                          )}
                          {domain.verificationStatus === 'error' && (
                            <span style={{ color: 'red' }}>Error</span>
                          )}
                          <button 
                            style={{
                              ...styles.button,
                              backgroundColor: '#0070f3',
                              marginLeft: '10px',
                            }}
                            onClick={() => checkVerification(domain._id)}
                          >
                            Check
                          </button>
                        </div>
                      </td>
                      <td style={styles.tableCell}>
                        <button 
                          style={{
                            ...styles.button,
                            backgroundColor: '#dc3545',
                            marginRight: '5px',
                          }}
                          onClick={() => deleteDomain(domain._id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
      
      {activeTab === 'landingPages' && (
        <>
          <div style={styles.card}>
            <h2>Create Landing Page</h2>
            <form onSubmit={addLandingPage}>
              <input
                style={styles.input}
                type="text"
                placeholder="Name"
                value={landingPageName}
                onChange={(e) => setLandingPageName(e.target.value)}
              />
              
              <select
                style={styles.input}
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
                style={styles.input}
                type="text"
                placeholder="Subdomain"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
              />
              
              <input
                style={styles.input}
                type="text"
                placeholder="Affiliate URL"
                value={affiliateUrl}
                onChange={(e) => setAffiliateUrl(e.target.value)}
              />
              
              <input
                style={styles.input}
                type="text"
                placeholder="Original URL"
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
              />
              
              <button 
                style={styles.button} 
                type="submit"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Landing Page'}
              </button>
            </form>
          </div>
          
          <div style={styles.card}>
            <h2>Your Landing Pages</h2>
            {landingPages.length === 0 ? (
              <p>No landing pages yet. Create your first landing page above.</p>
            ) : (
              <table style={styles.table}>
                <thead style={styles.tableHead}>
                  <tr>
                    <th style={styles.tableCell}>Name</th>
                    <th style={styles.tableCell}>URL</th>
                    <th style={styles.tableCell}>Affiliate URL</th>
                    <th style={styles.tableCell}>Status</th>
                    <th style={styles.tableCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {landingPages.map((page) => (
                    <tr key={page._id}>
                      <td style={styles.tableCell}>{page.name}</td>
                      <td style={styles.tableCell}>
                        <a href={getLandingPageUrl(page)} target="_blank" rel="noopener noreferrer">
                          {getLandingPageUrl(page)}
                        </a>
                      </td>
                      <td style={styles.tableCell}>
                        <a href={page.affiliateUrl} target="_blank" rel="noopener noreferrer">
                          Affiliate Link
                        </a>
                      </td>
                      <td style={styles.tableCell}>
                        {page.isActive ? 'Active' : 'Inactive'}
                      </td>
                      <td style={styles.tableCell}>
                        <button 
                          style={{
                            ...styles.button,
                            backgroundColor: '#dc3545',
                            marginRight: '5px',
                          }}
                          onClick={() => deleteLandingPage(page._id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
} 