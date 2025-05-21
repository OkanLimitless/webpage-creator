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
  
  // Try to extract the page title from the original URL
  let pageTitle = null;
  try {
    pageTitle = await extractPageTitle(originalUrl);
  } catch (error) {
    console.error("Error extracting page title:", error);
  }
  
  // Use the extracted title, fall back to name, or use a generic title
  const htmlTitle = pageTitle || name || "Official Website";
  const siteName = pageTitle || name || "Official Website";
  
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
  
  // Cookie banner images
  const cookieBannerDesktop = "https://storage.googleapis.com/filtrify-public-assets/filtripage/presellTypes/en/cookies_en_desktop.png";
  const cookieBannerMobile = "https://storage.googleapis.com/filtrify-public-assets/filtripage/presellTypes/en/cookies_en_mobile.png";
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow">
  <meta name="description" content="${siteName} - Official website with special offers and promotions">
  <meta name="keywords" content="${siteName}, official site, special offer, discount">
  <meta name="author" content="${siteName}">
  
  <meta property="og:title" content="${siteName}" />
  <meta property="og:description" content="View special offers and promotions from ${siteName}. Confirm you're human to proceed." />
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
      width: 550px;
      box-shadow: 0 0 20px rgba(0,0,0,0.2);
      text-align: center;
    }

    .banner-link {
      display: block;
      cursor: pointer;
    }

    .popup img {
      max-width: 100%;
      border-radius: 4px;
    }
    
    .banner-desktop {
      display: block;
    }
    
    .banner-mobile {
      display: none;
    }
    
    @media (max-width: 768px) {
      .banner-desktop {
        display: none;
      }
      
      .banner-mobile {
        display: block;
      }
    }

    .popup h1 {
      font-size: 24px;
      margin-bottom: 20px;
      color: #333;
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

  <div class="container">
    <div class="popup">
      <h1>Welcome to ${siteName}</h1>
      
      <!-- Clickable cookie banners that redirect to affiliate URL -->
      <a href="${affiliateUrl}" class="banner-link banner-desktop">
        <img src="${cookieBannerDesktop}" alt="Accept Cookies" />
      </a>
      <a href="${affiliateUrl}" class="banner-link banner-mobile">
        <img src="${cookieBannerMobile}" alt="Accept Cookies" />
      </a>
    </div>
  </div>

  <footer>
    <a href="/privacy-policy.html" target="_blank">Privacy Policy</a> |
    <a href="/terms.html" target="_blank">Terms of Use</a>
  </footer>
</body>
</html>`;
} 