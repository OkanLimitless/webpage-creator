'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';

interface WordpressTemplateButtonProps {
  domainId: string;
  domainName: string;
  disabled?: boolean;
}

export default function WordpressTemplateButton({
  domainId,
  domainName,
  disabled = false
}: WordpressTemplateButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const deployWordpressTemplate = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/deployments/vercel-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domainId,
          wordpressApiUrl: 'https://novoslabs.com/wp-json'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start WordPress template deployment');
      }

      toast.success(`WordPress ISR blog deployment started for ${domainName}`);
    } catch (error: any) {
      console.error('Error deploying WordPress template:', error);
      toast.error(error.message || 'Failed to deploy WordPress template');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={deployWordpressTemplate}
      disabled={disabled || isLoading}
      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? 'Deploying...' : 'Deploy WordPress Blog'}
    </button>
  );
} 