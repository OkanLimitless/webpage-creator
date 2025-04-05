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

  const handleClick = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
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
      
      alert(`Success! ${data.message}`);
      
      // Call the onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      // Open the domain in a new tab
      window.open(`https://${domainName}`, '_blank');
    } catch (error: any) {
      alert(`Error: ${error.message || 'Failed to generate root page'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-blue-300 bg-dark-light hover:bg-dark transition-colors duration-150"
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? 'Generating...' : 'Generate Root Page'}
    </button>
  );
} 