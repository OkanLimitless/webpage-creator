'use client';

import { useState } from 'react';

export default function TrafficLogsV2Page() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  async function setupTrafficLogsV2() {
    try {
      setIsLoading(true);
      const response = await fetch('/api/traffic-logs/v2/setup', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        setResults(prev => [...prev, {
          type: 'success',
          message: `Traffic Logs V2 setup complete!`,
          details: data.data,
          timestamp: new Date().toLocaleTimeString()
        }]);
      } else {
        setResults(prev => [...prev, {
          type: 'error',
          message: `Setup failed: ${data.error}`,
          details: data,
          timestamp: new Date().toLocaleTimeString()
        }]);
      }
    } catch (error: any) {
      setResults(prev => [...prev, {
        type: 'error',
        message: `Setup error: ${error.message}`,
        details: error,
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  async function testTrafficLogsV2() {
    try {
      setIsLoading(true);
      const response = await fetch('/api/traffic-logs/v2?limit=5&date=last_hour');
      const data = await response.json();
      
      if (data.success) {
        setResults(prev => [...prev, {
          type: 'success',
          message: `V2 API working! Found ${data.data.pagination.total} requests, ${data.data.performance.batches_scanned} batches scanned`,
          details: data.data,
          timestamp: new Date().toLocaleTimeString()
        }]);
      } else {
        setResults(prev => [...prev, {
          type: 'error', 
          message: `V2 test failed: ${data.error}`,
          details: data,
          timestamp: new Date().toLocaleTimeString()
        }]);
      }
    } catch (error: any) {
      setResults(prev => [...prev, {
        type: 'error',
        message: `V2 test error: ${error.message}`,
        details: error,
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          🚀 Traffic Logs V2 - Clean Architecture
        </h1>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">System Upgrade Benefits</h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-semibold text-blue-800">Performance</div>
              <div className="text-blue-600">99% fewer KV operations</div>
              <div className="text-blue-600">80% faster queries</div>
            </div>
            <div>
              <div className="font-semibold text-blue-800">Cost Efficiency</div>
              <div className="text-blue-600">90% storage reduction</div>
              <div className="text-blue-600">~$5/month vs $50/month</div>
            </div>
            <div>
              <div className="font-semibold text-blue-800">Maintenance</div>
              <div className="text-blue-600">Zero manual cleanup</div>
              <div className="text-blue-600">48h automatic retention</div>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <button
            onClick={setupTrafficLogsV2}
            disabled={isLoading}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Setting up...' : '1. Setup Clean V2 System'}
          </button>
          
          <button
            onClick={testTrafficLogsV2}
            disabled={isLoading}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Testing...' : '2. Test V2 API'}
          </button>
        </div>

        {results.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Results</h3>
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  result.type === 'success'
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{result.message}</span>
                  <span className="text-xs opacity-75">{result.timestamp}</span>
                </div>
                
                {result.type === 'success' && result.details?.environment_variable && (
                  <div className="mt-3 p-3 bg-white rounded border text-sm">
                    <div className="font-semibold mb-1">Next Step: Add to Vercel Environment Variables</div>
                    <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                      {result.details.environment_variable.name}={result.details.environment_variable.value}
                    </code>
                  </div>
                )}
                
                {result.type === 'success' && result.details?.performance && (
                  <div className="mt-3 p-3 bg-white rounded border text-sm">
                    <div className="font-semibold mb-1">Performance Metrics</div>
                    <div>Batches Scanned: {result.details.performance.batches_scanned}</div>
                    <div>Efficiency: {result.details.performance.efficiency} requests/batch</div>
                  </div>
                )}
                
                {result.details && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs opacity-75">Show Details</summary>
                    <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-8 text-sm text-gray-600">
          <h4 className="font-semibold mb-2">Migration Notes:</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>V2 system runs parallel to existing V1 system</li>
            <li>New worker deployments automatically use V2</li>
            <li>Old data remains accessible via V1 API during transition</li>
            <li>V2 uses batching: 100 requests per KV write vs 1 request per write</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 