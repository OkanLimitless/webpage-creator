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
  const [isError, setIsError] = useState(false);

  const handleClick = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setMessage('');
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
      
      setMessage(data.message);
      
      // Call the onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      // Open the domain in a new tab
      window.open(`https://${domainName}`, '_blank');
    } catch (error: any) {
      setMessage(error.message || 'Failed to generate root page');
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button
        className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded text-sm flex items-center"
        onClick={handleClick}
        disabled={isLoading}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
        {isLoading ? 'Generating...' : 'Generate Root Page'}
      </button>
      
      {message && (
        <div className={`mt-2 text-sm ${isError ? 'text-red-500' : 'text-green-500'}`}>
          {message}
        </div>
      )}
    </div>
  );
} 