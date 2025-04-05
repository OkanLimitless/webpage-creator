'use client';

import { useState } from 'react';

interface GenerateRootPageButtonProps {
  domainId: string;
  domainName: string;
  onSuccess?: () => void;
}

export default function GenerateRootPageButton({
  domainId,
  domainName,
  onSuccess,
}: GenerateRootPageButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [detailedInfo, setDetailedInfo] = useState<string[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [isError, setIsError] = useState(false);

  const handleClick = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setMessage('');
    setDetailedInfo([]);
    setShowDetails(false);
    setIsError(false);
    
    try {
      const response = await fetch(`/api/domains/${domainId}/create-root-page`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          companyName: domainName.charAt(0).toUpperCase() + domainName.slice(1).split('.')[0],
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate root page');
      }
      
      setMessage(data.message || 'Root page created successfully');
      
      // Collect detailed information about the process
      const details = [
        ...data.dnsStatus?.messages || [],
        data.vercelStatus === 'error' ? 'Could not register domain with Vercel.' : 'Domain registered with Vercel.',
        ...(data.nextSteps || []),
      ];
      
      setDetailedInfo(details);
      
      // Call the onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      // Open the domain in a new tab if all went perfectly
      if (data.vercelStatus === 'configured' && data.dnsStatus?.success) {
        window.open(`https://${domainName}`, '_blank');
      }
    } catch (error: any) {
      setMessage(error.message || 'Failed to generate root page');
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="inline-flex flex-col">
      <button
        className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-blue-300 bg-dark-light hover:bg-dark transition-colors duration-150"
        onClick={handleClick}
        disabled={isLoading}
      >
        {isLoading ? 'Generating...' : 'Generate Root Page'}
      </button>
      
      {message && (
        <div className="mt-2 text-xs">
          <div className={`${isError ? 'text-red-400' : 'text-green-400'}`}>
            {message}
          </div>
          
          {detailedInfo.length > 0 && (
            <div className="mt-1">
              <button
                className="text-xs text-gray-400 hover:text-gray-300 underline"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? 'Hide details' : 'Show details'}
              </button>
              
              {showDetails && (
                <ul className="mt-1 text-gray-400 pl-4 max-w-xs">
                  {detailedInfo.map((info, index) => (
                    <li key={index} className="list-disc list-inside">
                      {info}
                    </li>
                  ))}
                  <li className="list-disc list-inside text-yellow-400 mt-2">
                    DNS changes can take up to 24-48 hours to propagate.
                  </li>
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 