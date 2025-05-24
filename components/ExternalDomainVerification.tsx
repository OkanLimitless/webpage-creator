'use client';

import { useState } from 'react';

interface ExternalDomainVerificationProps {
  domain: {
    _id: string;
    name: string;
    dnsManagement: string;
    verificationStatus: string;
    targetCname?: string;
  };
  onVerificationUpdate: () => void;
}

export default function ExternalDomainVerification({ domain, onVerificationUpdate }: ExternalDomainVerificationProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const handleVerify = async () => {
    setIsVerifying(true);
    setVerificationResult(null);

    try {
      const response = await fetch(`/api/domains/${domain._id}/verify-external`, {
        method: 'POST',
      });

      const data = await response.json();
      setVerificationResult(data);

      if (data.verified) {
        // Refresh the parent component to show updated status
        setTimeout(() => {
          onVerificationUpdate();
        }, 1000);
      }
    } catch (error) {
      setVerificationResult({
        success: false,
        message: 'Network error. Please try again.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Only show for external domains
  if (domain.dnsManagement !== 'external') {
    return null;
  }

  return (
    <div className="bg-white border rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">DNS Verification</h3>
          <p className="text-sm text-gray-600">
            Status: <span className={`font-medium ${
              domain.verificationStatus === 'active' ? 'text-green-600' : 'text-yellow-600'
            }`}>
              {domain.verificationStatus === 'active' ? 'Verified ✅' : 'Pending ⏳'}
            </span>
          </p>
        </div>
        <button
          onClick={handleVerify}
          disabled={isVerifying}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {isVerifying ? 'Verifying...' : 'Verify DNS'}
        </button>
      </div>

      <div className="space-y-3">
        <div className="bg-gray-50 p-3 rounded-md">
          <h4 className="font-medium text-gray-900 mb-2">Required DNS Configuration:</h4>
          <div className="font-mono text-sm bg-white p-2 rounded border">
            CNAME {domain.name} → {domain.targetCname || 'cname.vercel-dns.com'}
          </div>
        </div>

        {verificationResult && (
          <div className={`p-3 rounded-md border ${
            verificationResult.verified 
              ? 'bg-green-50 border-green-200 text-green-800'
              : verificationResult.success === false
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-yellow-50 border-yellow-200 text-yellow-800'
          }`}>
            <p className="font-medium mb-2">
              {verificationResult.verified ? '✅ Verified!' : 
               verificationResult.success === false ? '❌ Error' : '⚠️ Not Ready'}
            </p>
            <p className="text-sm">{verificationResult.message}</p>
            
            {verificationResult.dnsInfo && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium">DNS Details</summary>
                <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-auto">
                  {JSON.stringify(verificationResult.dnsInfo, null, 2)}
                </pre>
              </details>
            )}
            
            {verificationResult.expectedTargets && (
              <div className="mt-2">
                <p className="text-sm font-medium">Expected DNS targets:</p>
                <ul className="text-xs mt-1 space-y-1">
                  {verificationResult.expectedTargets.map((target: string, index: number) => (
                    <li key={index} className="font-mono">• {target}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 