'use client';

import { useState } from 'react';

export default function ProjectsCleanup() {
  const [isLoading, setIsLoading] = useState(false);
  const [isRunningScript, setIsRunningScript] = useState(false);
  const [result, setResult] = useState<{
    success?: boolean;
    cleanedProjects?: number;
    message?: string;
    error?: string;
  } | null>(null);
  const [scriptOutput, setScriptOutput] = useState<string[]>([]);

  const handleCleanup = async () => {
    if (!confirm("Are you sure you want to clean up empty Vercel projects? This will delete projects with no domains attached.")) {
      return;
    }
    
    try {
      setIsLoading(true);
      setResult(null);
      
      const response = await fetch('/api/maintenance/cleanup-projects');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to clean up projects');
      }
      
      setResult({
        success: data.success,
        cleanedProjects: data.cleanedProjects,
        message: data.message
      });
    } catch (error: any) {
      console.error('Error cleaning up projects:', error);
      setResult({
        success: false,
        error: error.message || 'An unexpected error occurred'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunCleanupScript = async () => {
    if (!confirm("Are you sure you want to run the comprehensive cleanup script? This will transfer domains from duplicate projects to the main project and then delete the duplicates.")) {
      return;
    }
    
    try {
      setIsRunningScript(true);
      setScriptOutput(["Starting cleanup script..."]);
      
      // Set up event source for server-sent events
      const eventSource = new EventSource('/api/maintenance/run-cleanup-script');
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.output) {
            setScriptOutput(prev => [...prev, data.output]);
          }
          if (data.complete) {
            eventSource.close();
            setIsRunningScript(false);
            setScriptOutput(prev => [...prev, "Cleanup completed!"]);
          }
        } catch (error) {
          console.error('Error parsing event data:', error);
          setScriptOutput(prev => [...prev, `Error: ${error}`]);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        setScriptOutput(prev => [...prev, "Error in cleanup process. Check server logs."]);
        eventSource.close();
        setIsRunningScript(false);
      };
      
    } catch (error: any) {
      console.error('Error running cleanup script:', error);
      setScriptOutput(prev => [...prev, `Error: ${error.message || 'An unexpected error occurred'}`]);
      setIsRunningScript(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Vercel Projects Cleanup</h2>
      
      <div className="mb-6">
        <p className="mb-2">
          These utilities will help you clean up duplicate or empty Vercel projects:
        </p>
        <ul className="list-disc ml-5 mb-4 text-gray-700">
          <li><strong>Empty Projects Cleanup</strong>: Finds and deletes projects with no domains attached</li>
          <li><strong>Duplicate Projects Cleanup</strong>: Consolidates all domains to your main project and deletes duplicates</li>
        </ul>
        <p className="text-sm text-gray-600 mb-4">
          Use these tools if you notice domains being deployed to multiple projects or if root domains are not working correctly.
        </p>
      </div>
      
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={handleCleanup}
          disabled={isLoading || isRunningScript}
          className={`px-4 py-2 rounded ${
            isLoading || isRunningScript
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          } transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
        >
          {isLoading ? (
            <>
              <span className="animate-spin inline-block h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></span>
              Cleaning Up...
            </>
          ) : (
            'Clean Up Empty Projects'
          )}
        </button>
        
        <button
          onClick={handleRunCleanupScript}
          disabled={isLoading || isRunningScript}
          className={`px-4 py-2 rounded ${
            isLoading || isRunningScript
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-700 text-white'
          } transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500`}
        >
          {isRunningScript ? (
            <>
              <span className="animate-spin inline-block h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></span>
              Running Script...
            </>
          ) : (
            'Run Comprehensive Cleanup'
          )}
        </button>
      </div>
      
      {/* Results from empty projects cleanup */}
      {result && (
        <div className={`mb-4 p-4 rounded ${
          result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {result.success ? (
            <>
              <h3 className="font-medium">Cleanup Successful</h3>
              <p>{result.message}</p>
              {result.cleanedProjects !== undefined && (
                <p className="mt-1">Projects cleaned: {result.cleanedProjects}</p>
              )}
            </>
          ) : (
            <>
              <h3 className="font-medium">Cleanup Failed</h3>
              <p>{result.error || result.message}</p>
            </>
          )}
        </div>
      )}
      
      {/* Output from comprehensive cleanup script */}
      {scriptOutput.length > 0 && (
        <div className="mt-4">
          <h3 className="font-medium mb-2">Cleanup Script Output:</h3>
          <div className="bg-black text-green-400 p-4 rounded font-mono text-sm overflow-auto max-h-80">
            {scriptOutput.map((line, index) => (
              <div key={index}>{line}</div>
            ))}
            {isRunningScript && (
              <div className="animate-pulse">▌</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 