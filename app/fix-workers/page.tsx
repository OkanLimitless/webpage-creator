'use client';

import { useState } from 'react';

export default function FixWorkersPage() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [results, setResults] = useState<any>(null);

  const updateAllWorkers = async () => {
    setIsUpdating(true);
    setResults(null);

    try {
      const response = await fetch('/api/update-worker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update-all-workers-kv'
        }),
      });

      const data = await response.json();
      setResults(data);

      if (data.success) {
        alert(`✅ SUCCESS! Updated ${data.results.filter((r: any) => r.success).length} workers to use the new KV namespace. Traffic logs should now appear in real-time!`);
      } else {
        alert(`❌ Update failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating workers:', error);
      alert('❌ Error updating workers');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🔧 Fix Worker KV Bindings</h1>
        
        <div className="bg-gray-800 p-6 rounded-lg mb-8">
          <h2 className="text-xl font-semibold mb-4">Problem</h2>
          <p className="text-gray-300 mb-4">
            Your existing workers are logging to the old KV namespace (with 73k+ records), 
            but your traffic logs API is reading from the new fresh namespace.
          </p>
          <p className="text-gray-300 mb-4">
            <strong>Solution:</strong> Update all existing workers to use the new fresh KV namespace 
            so new traffic logs appear immediately.
          </p>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg mb-8">
          <h2 className="text-xl font-semibold mb-4">Fix Action</h2>
          <button
            onClick={updateAllWorkers}
            disabled={isUpdating}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              isUpdating
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isUpdating ? '🔄 Updating Workers...' : '🚀 Update All Workers to New KV Namespace'}
          </button>
        </div>

        {results && (
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Results</h2>
            
            {results.success && (
              <div className="mb-4 p-4 bg-green-900 rounded-lg">
                <p className="text-green-300">
                  ✅ {results.message}
                </p>
                <p className="text-sm text-green-400 mt-2">
                  New KV Namespace: {results.newNamespaceId}
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              {results.results?.map((result: any, index: number) => (
                <div 
                  key={index}
                  className={`p-3 rounded-lg ${
                    result.success ? 'bg-green-900' : 'bg-red-900'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      {result.domain}{result.subdomain ? `.${result.subdomain}` : ''}
                    </span>
                    <span className={result.success ? 'text-green-300' : 'text-red-300'}>
                      {result.success ? '✅ Updated' : '❌ Failed'}
                    </span>
                  </div>
                  {result.error && (
                    <p className="text-sm text-red-400 mt-1">{result.error}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 