// Debug Worker Script for Cloudflare
// This bypasses template literal issues by being a direct JS file

const SAFE_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Worker Debug - Logging Test</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            max-width: 500px;
        }
        h1 { font-size: 3rem; margin-bottom: 1rem; }
        p { font-size: 1.2rem; margin-bottom: 2rem; opacity: 0.9; }
        .status {
            background: rgba(0, 255, 0, 0.2);
            color: #90EE90;
            padding: 1rem;
            border-radius: 10px;
            margin-bottom: 2rem;
            border: 1px solid rgba(0, 255, 0, 0.3);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="status">✅ Debug Worker Active - Logging Fixed</div>
        <h1>Coming Soon</h1>
        <p>Worker is now logging to external API successfully!</p>
    </div>
</body>
</html>`;

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  console.log('🔍 Debug Worker handling request for:', request.url);
  
  try {
    // Log the request using external API
    await logDecision({
      ip: request.headers.get('CF-Connecting-IP') || 'unknown',
      userAgent: request.headers.get('User-Agent') || 'unknown',
      decision: 'SAFE_PAGE',
      reason: 'TESTING_MODE',
      jciResponse: null,
      error: null
    });
  } catch (error) {
    console.warn('⚠️ Logging failed:', error.message);
  }
  
  return new Response(SAFE_PAGE_HTML, {
    headers: { 
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Worker-Status': 'debug-active'
    }
  });
}

async function logDecision(logData) {
  try {
    // Use external API endpoint to avoid worker interception
    const logUrl = 'https://webpage-creator-okans-projects-6fb1aba6.vercel.app/api/jci-logs';
    
    console.log('📡 Logging to external API:', logUrl);
    console.log('📡 Log data:', JSON.stringify(logData));
    
    const response = await fetch(logUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'CloudflareWorkerDebug/1.0'
      },
      body: JSON.stringify({
        ...logData,
        timestamp: new Date().toISOString(),
        workerVersion: 'debug-external-1.0'
      })
    });
    
    console.log('📡 Response status:', response.status, response.statusText);
    
    if (response.ok) {
      const responseText = await response.text();
      console.log('📝 Successfully logged! Response:', responseText);
    } else {
      const errorText = await response.text();
      console.warn('⚠️ Failed to log - Status:', response.status, 'Error:', errorText);
    }
  } catch (error) {
    console.warn('⚠️ Logging error:', error.message);
  }
} 