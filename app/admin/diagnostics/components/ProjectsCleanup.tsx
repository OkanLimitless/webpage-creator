'use client';

import { useState } from 'react';

export default function ProjectsCleanup() {
  const [isLoading, setIsLoading] = useState(false);
  const [isRunningScript, setIsRunningScript] = useState(false);
  const [isCheckingOnly, setIsCheckingOnly] = useState(true); // Default to check-only mode
  const [result, setResult] = useState<{
    success?: boolean;
    cleanedProjects?: number;
    message?: string;
    error?: string;
  } | null>(null);
  const [scriptOutput, setScriptOutput] = useState<string[]>([]);
  const [projectsToClean, setProjectsToClean] = useState<{
    id: string;
    name: string;
    domains: { name: string; verified: boolean }[];
  }[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  const handleCheckProjects = async () => {
    try {
      setIsRunningScript(true);
      setScriptOutput(["Starting project analysis..."]);
      setProjectsToClean([]);
      setError(null);
      
      // Call the API with check-only mode
      const url = '/api/maintenance/run-cleanup-script?checkOnly=true';
      const eventSource = new EventSource(url);
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.output) {
            const output = data.output;
            if (typeof output === 'string' && (
                output.toLowerCase().includes('error:') || 
                output.toLowerCase().includes('failed') ||
                output.toLowerCase().includes('not found')
            )) {
              setScriptOutput(prev => [...prev, `⚠️ ${output}`]);
            } else {
              setScriptOutput(prev => [...prev, output]);
            }
          }
          if (data.projectsToClean) {
            setProjectsToClean(data.projectsToClean);
          }
          if (data.complete) {
            eventSource.close();
            setIsRunningScript(false);
            setScriptOutput(prev => [...prev, "Analysis completed!"]);
          }
        } catch (error) {
          console.error('Error parsing event data:', error);
          setScriptOutput(prev => [...prev, `Error: ${error}`]);
          setError('Failed to parse server response');
        }
      };
      
      eventSource.onerror = (err) => {
        console.error('EventSource error:', err);
        setScriptOutput(prev => [...prev, "Error in analysis process. Check server logs."]);
        setError('Connection error with the server');
        eventSource.close();
        setIsRunningScript(false);
      };
      
    } catch (error: any) {
      console.error('Error checking projects:', error);
      setScriptOutput(prev => [...prev, `Error: ${error.message || 'An unexpected error occurred'}`]);
      setError(error.message || 'Failed to analyze projects');
      setIsRunningScript(false);
    }
  };

  const handleRunCleanupScript = async () => {
    if (!confirm("Are you sure you want to run the comprehensive project analysis? This will scan and report on domain-specific projects.")) {
      return;
    }
    
    try {
      setIsRunningScript(true);
      setScriptOutput(["Starting project analysis..."]);
      setProjectsToClean([]);
      
      // Set up event source for server-sent events
      const url = `/api/maintenance/run-cleanup-script${isCheckingOnly ? '?checkOnly=true' : ''}`;
      const eventSource = new EventSource(url);
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.output) {
            setScriptOutput(prev => [...prev, data.output]);
          }
          if (data.projectsToClean) {
            setProjectsToClean(data.projectsToClean);
          }
          if (data.complete) {
            eventSource.close();
            setIsRunningScript(false);
            setScriptOutput(prev => [...prev, isCheckingOnly ? "Analysis completed!" : "Cleanup completed!"]);
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
          These utilities help you analyze and manage domain-specific Vercel projects:
        </p>
        <ul className="list-disc ml-5 mb-4 text-gray-700">
          <li><strong>Empty Projects Cleanup</strong>: Finds and deletes projects with no domains attached (safe)</li>
          <li><strong>Project Analysis</strong>: Scans and reports on all domain projects without making changes</li>
          <li><strong>IMPORTANT</strong>: These tools will <span className="font-bold text-red-600">never</span> move domains between projects</li>
        </ul>
        <div className="bg-blue-50 p-3 rounded border border-blue-200 mb-4">
          <h3 className="font-medium text-blue-800 mb-1">Important Note:</h3>
          <p className="text-sm text-blue-700">
            Each domain should stay on its dedicated project (domain-name-com). Domains should NOT be moved to the main "webpage-creator" project as this causes redirect issues.
          </p>
        </div>
        
        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            id="check-only"
            checked={isCheckingOnly}
            onChange={() => setIsCheckingOnly(!isCheckingOnly)}
            className="mr-2 h-4 w-4 text-blue-600 rounded"
            disabled={isRunningScript || isLoading}
          />
          <label htmlFor="check-only" className="text-sm text-gray-700">
            Check-only mode (analyze but don't make changes)
          </label>
        </div>
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
          onClick={handleCheckProjects}
          disabled={isLoading || isRunningScript}
          className={`px-4 py-2 rounded ${
            isLoading || isRunningScript
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-white'
          } transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
        >
          {isRunningScript ? (
            <>
              <span className="animate-spin inline-block h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></span>
              Analyzing...
            </>
          ) : (
            'Analyze Projects'
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
      
      {/* Projects that would be affected */}
      {projectsToClean.length > 0 && (
        <div className="mb-6 p-4 rounded bg-yellow-50 border border-yellow-200">
          <h3 className="font-medium text-yellow-800 mb-2">Domain Projects Overview:</h3>
          <div className="max-h-80 overflow-y-auto">
            {projectsToClean.map((project, idx) => (
              <div key={idx} className="mb-4 p-3 bg-white rounded shadow-sm border border-yellow-100">
                <div className="font-medium">Project: {project.name} <span className="text-gray-500 text-sm">({project.id})</span></div>
                <div className="text-sm text-gray-600 mt-1">Domains attached ({project.domains.length}):</div>
                {project.domains.length > 0 ? (
                  <ul className="list-disc ml-5 mt-1 text-sm">
                    {project.domains.map((domain, didx) => (
                      <li key={didx} className={domain.verified ? "text-green-600" : "text-orange-500"}>
                        {domain.name} {domain.verified ? "(verified)" : "(unverified)"}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm ml-5 mt-1 text-red-500 font-medium">
                    No domains attached (this project can be safely deleted)
                  </p>
                )}
              </div>
            ))}
          </div>
          
          {isCheckingOnly && projectsToClean.some(p => p.domains.length === 0) && (
            <div className="mt-4 text-sm text-yellow-700">
              <p className="font-medium">Empty projects (with no domains) can be safely deleted.</p>
              <p>Turn off "Check-only mode" and click "Clean Up Empty Projects" to delete these projects.</p>
            </div>
          )}
        </div>
      )}
      
      {/* Output from comprehensive cleanup script */}
      {scriptOutput.length > 0 && (
        <div className="mt-4">
          <h3 className="font-medium mb-2">Script Output:</h3>
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
      
      {error && (
        <div className="mb-4 p-4 rounded bg-red-100 text-red-800 border border-red-300">
          <h3 className="font-medium">Error</h3>
          <p>{error}</p>
          <p className="text-sm mt-2">Try refreshing the page or check the server logs for more information.</p>
        </div>
      )}
    </div>
  );
} 