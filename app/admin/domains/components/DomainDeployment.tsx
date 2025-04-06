'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

type Domain = {
  _id: string;
  name: string;
  deploymentStatus?: string;
  deploymentUrl?: string;
  lastDeployedAt?: string;
};

type Log = {
  timestamp: string;
  message: string;
  level: 'info' | 'warning' | 'error';
};

type DomainDeploymentProps = {
  domain: Domain;
};

export default function DomainDeployment({ domain }: DomainDeploymentProps) {
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [deploymentStatus, setDeploymentStatus] = useState<string>(domain.deploymentStatus || 'not_deployed');
  const [deploymentUrl, setDeploymentUrl] = useState<string | undefined>(domain.deploymentUrl);
  const [lastDeployed, setLastDeployed] = useState<string | undefined>(domain.lastDeployedAt);
  const [logs, setLogs] = useState<Log[]>([]);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);

  // Load initial deployment status
  useEffect(() => {
    fetchDeploymentStatus();
  }, [domain._id]);

  // Set up polling if deployment is in progress
  useEffect(() => {
    if (isDeploying || deploymentStatus === 'deploying') {
      const interval = window.setInterval(fetchDeploymentStatus, 5000);
      setRefreshInterval(interval);
      return () => {
        if (interval) window.clearInterval(interval);
      };
    } else if (refreshInterval) {
      window.clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [isDeploying, deploymentStatus]);

  const fetchDeploymentStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/domains/${domain._id}/deploy`);
      const data = await response.json();
      
      if (response.ok) {
        setDeploymentStatus(data.status || 'not_deployed');
        setDeploymentUrl(data.deploymentUrl);
        setLastDeployed(data.lastDeployedAt);
        setLogs(data.logs || []);
        
        // If deployment is no longer in progress, stop polling
        if (data.status !== 'deploying') {
          setIsDeploying(false);
        }
      } else {
        console.error('Error fetching deployment status:', data.error);
      }
    } catch (error) {
      console.error('Error fetching deployment status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startDeployment = async () => {
    try {
      setIsDeploying(true);
      const response = await fetch(`/api/domains/${domain._id}/deploy`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('Deployment started');
        setDeploymentStatus('deploying');
        fetchDeploymentStatus();
      } else {
        toast.error(`Failed to start deployment: ${data.error}`);
        setIsDeploying(false);
      }
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
      setIsDeploying(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'deployed':
        return <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">Deployed</span>;
      case 'deploying':
        return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">Deploying</span>;
      case 'failed':
        return <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">Failed</span>;
      case 'pending':
        return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">Pending</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium">Not Deployed</span>;
    }
  };

  const getLogLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs font-medium">Error</span>;
      case 'warning':
        return <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-xs font-medium">Warning</span>;
      default:
        return <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-medium">Info</span>;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">Domain Deployment</h2>
          <button
            onClick={startDeployment}
            disabled={isDeploying || isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isDeploying ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Deploying...
              </>
            ) : 'Deploy Domain'}
          </button>
        </div>

        <div className="bg-gray-50 p-4 rounded-md mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Status</h3>
          <div className="flex items-center space-x-4">
            <div>{getStatusBadge(deploymentStatus)}</div>
            {deploymentUrl && (
              <a
                href={deploymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View Deployment
              </a>
            )}
            {lastDeployed && (
              <div className="text-gray-500 text-sm">
                Last deployed: {new Date(lastDeployed).toLocaleString()}
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Deployment Logs</h3>
          
          {isLoading && !logs.length ? (
            <div className="text-center py-4">
              <div className="animate-spin h-6 w-6 border-2 border-blue-500 rounded-full border-t-transparent mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Loading logs...</p>
            </div>
          ) : logs.length > 0 ? (
            <div className="border border-gray-200 rounded-md overflow-auto max-h-96">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Level
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Message
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {getLogLevelBadge(log.level)}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {log.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-500">No deployment logs available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 