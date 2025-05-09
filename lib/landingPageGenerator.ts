import { ILandingPage } from './models/LandingPage';
import { extractFavicon } from './faviconExtractor';
import { extractPageTitle } from './pageInfoExtractor';

export async function generateLandingPageHtml(landingPage: ILandingPage): Promise<string> {
  const { 
    affiliateUrl, 
    desktopScreenshotUrl, 
    mobileScreenshotUrl, 
    name, 
    originalUrl, 
    subdomain, 
    manualScreenshots 
  } = landingPage;
  
  // Use the provided name or a default
  let siteName = name || "This Site";
  // Ensure the first letter is capitalized
  if (siteName && siteName.length > 0) {
    siteName = siteName.charAt(0).toUpperCase() + siteName.slice(1);
  }
  
  // Try to extract the page title from the original URL
  let pageTitle = null;
  try {
    pageTitle = await extractPageTitle(originalUrl);
    // Remove any common separators and trailing text like " - Brand" or " | Site Name"
    if (pageTitle) {
      pageTitle = pageTitle.split(/\s*[|\-–—]\s*/)[0].trim();
    }
  } catch (error) {
    console.error("Error extracting page title:", error);
  }
  
  // Use the extracted title for the HTML title tag, or fall back to siteName
  const htmlTitle = pageTitle || `${siteName} - Official Website`;
  
  // For manual screenshots, skip favicon extraction to avoid errors
  let faviconPng = null;
  let faviconIco = null;
  
  if (!manualScreenshots) {
    // Only try to extract favicon for non-manual pages
    try {
      const faviconUrl = await extractFavicon(originalUrl);
      faviconPng = faviconUrl;
      faviconIco = faviconUrl;
    } catch (error) {
      console.error("Error extracting favicon:", error);
    }
    
    // Use default favicon if extraction failed
    const defaultFaviconPng = "https://storage.googleapis.com/filtrify-public-assets/filtripage/others/padlock.png";
    const defaultFaviconIco = "https://storage.googleapis.com/filtrify-public-assets/filtripage/others/padlock.ico";
    
    // Determine which favicons to use
    faviconPng = faviconPng || defaultFaviconPng;
    faviconIco = faviconIco || defaultFaviconIco;
  }
  
  // Prepare the favicon HTML tags based on whether it's a manual page
  const faviconTags = manualScreenshots ? '' : `
  <!-- Favicon from original site or default fallback -->
  <link rel="icon" type="image/png" href="${faviconPng}">
  <link rel="shortcut icon" href="${faviconIco}" type="image/x-icon">
  `;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow">
  <meta name="description" content="${pageTitle || siteName} - Official website with special offers and promotions">
  <meta name="keywords" content="${pageTitle || siteName}, official site, special offer, discount">
  <meta name="author" content="${siteName}">
  
  <meta property="og:title" content="${pageTitle || siteName} - Official Website" />
  <meta property="og:description" content="View special offers and promotions from ${pageTitle || siteName}. Confirm you're human to proceed." />
  <meta property="og:image" content="${desktopScreenshotUrl}" />
  <meta property="og:type" content="website" />
  
  <title>${htmlTitle}</title>
  ${faviconTags}
  
  <!-- Microsoft Clarity for analytics -->
  <script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "julpry3eht");
  </script>
  
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      font-family: Arial, sans-serif;
      height: 100%;
      overflow: hidden;
    }

    .background-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100vh;
      z-index: -2;
      overflow: hidden;
      background-color: #000;
    }

    .background-image {
      position: absolute;
      width: 100%;
      height: 100%;
      background-size: cover;
      background-position: center;
      filter: blur(3px);
      transform: scale(1.05);
      opacity: 0.4;
    }

    .background-image-mobile {
      background-image: url('${mobileScreenshotUrl}');
      display: none;
    }

    .background-image-desktop {
      background-image: url('${desktopScreenshotUrl}');
      display: block;
    }

    @media (max-width: 768px) {
      .background-image-desktop {
        display: none;
      }

      .background-image-mobile {
        display: block;
      }
    }

    .container {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      position: relative;
      z-index: 1;
    }

    .popup {
      background: rgba(255, 255, 255, 0.95);
      padding: 40px;
      border-radius: 12px;
      max-width: 90%;
      width: 400px;
      box-shadow: 0 0 20px rgba(0,0,0,0.2);
      text-align: center;
    }

    .popup img {
      max-width: 150px;
      margin-bottom: 20px;
    }

    .popup h1 {
      font-size: 24px;
      margin-bottom: 10px;
      color: #333;
    }

    .popup h2 {
      font-size: 18px;
      margin-top: 15px;
      margin-bottom: 5px;
      color: #333;
    }

    .popup p {
      margin: 10px 0;
      color: #555;
    }

    .verified-message {
      font-size: 18px;
      font-weight: bold;
      margin-top: 20px;
      transition: opacity 0.5s ease;
      min-height: 28px;
    }

    .verified-message.success {
      color: green;
    }

    .verified-message.error {
      color: red;
    }

    .progress-button {
      margin-top: 20px;
      width: 100%;
      height: 45px;
      background-color: #ffffff;
      border-radius: 25px;
      border: 2px solid #007BFF;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: bold;
      color: #007BFF;
      user-select: none;
      cursor: pointer;
    }

    .progress-fill {
      position: absolute;
      height: 100%;
      width: 0%;
      background-color: #007BFF;
      top: 0;
      left: 0;
      transition: width 0.05s linear;
      z-index: 0;
    }

    .progress-text {
      position: relative;
      z-index: 1;
      pointer-events: none;
    }

    .progress-button.fill-white .progress-text {
      color: white;
    }

    #manualLink {
      margin-top: 10px;
      font-size: 13px;
      display: none;
    }

    footer {
      position: absolute;
      bottom: 10px;
      width: 100%;
      text-align: center;
      font-size: 12px;
      color: #aaa;
    }

    footer a {
      color: #aaa;
      text-decoration: underline;
      margin: 0 5px;
    }

    @media (max-width: 480px) {
      .popup {
        padding: 30px 20px;
      }
    }
  </style>
</head>
<body>
  <div class="background-container">
    <div class="background-image background-image-desktop"></div>
    <div class="background-image background-image-mobile"></div>
  </div>

  <div class="container" id="pressArea">
    <div class="popup">
      <h1>Welcome to ${siteName}</h1>
      <img src="${desktopScreenshotUrl}" alt="${siteName} Logo" />
      <h2>Before We Continue</h2>
      <p>🛡️<b> Press and Hold</b> to Verify You're Human and Continue Safely!</p>

      <div class="progress-button" id="progressButton">
        <div class="progress-fill" id="progressFill"></div>
        <div class="progress-text" id="progressText"><span style="margin-right: 6px;">👉</span>Press to Verify</div>
      </div>

      <div class="verified-message" id="verifiedMessage"></div>

      <p id="manualLink">
        Having trouble? <a href="${affiliateUrl}" style="color: #007BFF; text-decoration: underline;">Click here to continue manually</a>
      </p>
    </div>
  </div>

  <footer>
    <a href="/privacy-policy.html" target="_blank">Privacy Policy</a> |
    <a href="/terms.html" target="_blank">Terms of Use</a>
  </footer>

  <script>
    // Use sessionStorage instead of localStorage to only remember verification for current tab session
    const storeKey = '${siteName.toLowerCase().replace(/\W+/g, "_")}_verified';
    const sessionKey = '${siteName.toLowerCase().replace(/\W+/g, "_")}_current_session';
    const currentSession = Date.now().toString();
    const affiliateUrl = '${affiliateUrl}';
    
    // Store a unique session ID and compare it to detect new visits even in the same session
    const savedSession = sessionStorage.getItem(sessionKey);
    const lastVerifiedTime = parseInt(sessionStorage.getItem(storeKey) || '0', 10);
    
    // Check if this is a new session or if the verification is very old (more than 15 minutes)
    const isRecentVerification = lastVerifiedTime > 0 && (Date.now() - lastVerifiedTime) < 15 * 60 * 1000;
    
    // If recently verified in this browser tab session, redirect
    if (isRecentVerification) {
      window.location.href = affiliateUrl;
    } else {
      // Otherwise, reset the verification status for this new session
      sessionStorage.removeItem(storeKey);
    }
    
    const progressFill = document.getElementById("progressFill");
    const progressText = document.getElementById("progressText");
    const progressButton = document.getElementById("progressButton");
    const verifiedMsg = document.getElementById("verifiedMessage");
    const pressArea = document.getElementById("pressArea");
    
    let interval;
    let progressValue = 0;
    const holdTime = 2000; // 2 seconds hold time
    const updateRate = 50;
    let loadingInterval;
    let failCount = 0;
    let redirectAttempted = false;
    
    const startHold = () => {
      resetProgress();
      verifiedMsg.innerHTML = "";
      verifiedMsg.classList.remove("error", "success");
      
      interval = setInterval(() => {
        progressValue += updateRate;
        const percent = Math.min((progressValue / holdTime) * 100, 100);
        progressFill.style.width = percent + "%";
        
        if (percent >= 50) {
          progressButton.classList.add("fill-white");
        } else {
          progressButton.classList.remove("fill-white");
        }
        
        if (progressValue >= holdTime) {
          clearInterval(interval);
          progressText.innerText = "⏳ Loading...";
          animateLoadingText();
          verifiedMsg.innerHTML = "✅ 100% Verified";
          verifiedMsg.classList.add("success");
          
          // Handle redirection
          setTimeout(() => {
            if (redirectAttempted) return; // Prevent multiple redirects
            redirectAttempted = true;
            
            // Direct redirect
            sessionStorage.setItem(storeKey, Date.now().toString());
            
            // Set a backup timeout to ensure redirection happens
            const redirectTimeout = setTimeout(() => {
              window.location.href = affiliateUrl;
            }, 1000);
            
            // Direct redirect
            window.location.href = affiliateUrl;
          }, 1000);
        }
      }, updateRate);
    };
    
    const resetProgress = () => {
      clearInterval(interval);
      clearInterval(loadingInterval);
      
      if (progressValue >= holdTime) {
        progressText.innerText = "⏳ Loading...";
      } else {
        failCount++;
        verifiedMsg.innerHTML = "Press and hold for 2 seconds to continue!";
        verifiedMsg.classList.remove("success");
        verifiedMsg.classList.add("error");
        progressValue = 0;
        progressFill.style.width = "0%";
        progressButton.classList.remove("fill-white");
        progressText.innerHTML = "<span style='margin-right: 6px;'>👉</span>Press to Verify";
        
        // Show manual link if user is struggling
        if (failCount >= 3) {
          const manualLink = document.getElementById("manualLink");
          if (manualLink) {
            manualLink.style.display = "block";
          }
        }
      }
    };
    
    const animateLoadingText = () => {
      let dots = "";
      loadingInterval = setInterval(() => {
        dots = dots.length < 3 ? dots + "." : "";
        progressText.innerText = "⏳ Loading" + dots;
      }, 500);
    };
    
    // Mouse events for desktop
    pressArea.addEventListener("mousedown", startHold);
    pressArea.addEventListener("mouseup", resetProgress);
    pressArea.addEventListener("mouseleave", resetProgress);
    
    // Touch events for mobile
    pressArea.addEventListener("touchstart", (e) => {
      e.preventDefault();
      startHold();
    });
    pressArea.addEventListener("touchend", resetProgress);
    
    // Handle possible redirection errors
    window.addEventListener('error', function(event) {
      if (redirectAttempted && !window.location.href.includes(affiliateUrl)) {
        tryFallbackRedirect();
      }
    });
    
    // Check if redirection has happened after load
    window.onload = function() {
      // If verification was successful but we're still on this page after 3 seconds
      if (redirectAttempted) {
        setTimeout(tryFallbackRedirect, 3000);
      }
    };
    
    // Helper for fallback redirection
    function tryFallbackRedirect() {
      console.log("Using fallback redirect method");
      try {
        sessionStorage.setItem(storeKey, Date.now().toString());
        window.location.replace(affiliateUrl);
      } catch (e) {
        // Last resort - open in new tab
        window.open(affiliateUrl, '_blank');
      }
    }
  </script>
</body>
</html>`;
} 