import { ILandingPage } from './models/LandingPage';
import { extractFavicon } from './faviconExtractor';
import { extractPageTitle } from './pageInfoExtractor';

export async function generateCallAdsHtml(landingPage: ILandingPage): Promise<string> {
  const { 
    phoneNumber, 
    businessName, 
    name 
  } = landingPage;
  
  const htmlTitle = businessName || name || "Contact Us";
  const siteName = businessName || name || "Business";
  
  // Format phone number for display (assuming US format)
  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned[0] === '1') {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone; // Return original if format doesn't match
  };

  const formattedPhone = formatPhoneNumber(phoneNumber || '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow">
  <meta name="description" content="${siteName} - Contact us for more information">
  <meta name="keywords" content="${siteName}, contact, phone, business">
  <meta name="author" content="${siteName}">
  
  <meta property="og:title" content="${siteName}" />
  <meta property="og:description" content="Contact ${siteName} for more information" />
  <meta property="og:type" content="website" />
  
  <title>${htmlTitle}</title>
  
  <!-- Default favicon -->
  <link rel="icon" type="image/png" href="https://storage.googleapis.com/filtrify-public-assets/filtripage/others/padlock.png">
  <link rel="shortcut icon" href="https://storage.googleapis.com/filtrify-public-assets/filtripage/others/padlock.ico" type="image/x-icon">
  
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
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      height: 100%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #333;
    }
    
    .container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }

    .card {
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      padding: 60px 40px;
      text-align: center;
      max-width: 500px;
      width: 100%;
      position: relative;
      overflow: hidden;
    }

    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 5px;
      background: linear-gradient(90deg, #667eea, #764ba2);
    }

    .business-name {
      font-size: 2.5rem;
      font-weight: 700;
      color: #2d3748;
      margin-bottom: 20px;
      line-height: 1.2;
    }

    .subtitle {
      font-size: 1.2rem;
      color: #718096;
      margin-bottom: 40px;
      font-weight: 400;
    }

    .phone-section {
      background: #f7fafc;
      border-radius: 15px;
      padding: 30px;
      margin: 30px 0;
      border: 2px solid #e2e8f0;
    }

    .phone-label {
      font-size: 1rem;
      color: #4a5568;
      margin-bottom: 15px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .phone-number {
      font-size: 2.2rem;
      font-weight: 700;
      color: #2b6cb0;
      margin-bottom: 20px;
      font-family: 'Courier New', monospace;
    }

    .call-button {
      display: inline-block;
      background: linear-gradient(135deg, #48bb78, #38a169);
      color: white;
      padding: 15px 30px;
      text-decoration: none;
      border-radius: 50px;
      font-size: 1.1rem;
      font-weight: 600;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(72, 187, 120, 0.3);
    }

    .call-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(72, 187, 120, 0.4);
    }

    .verification-note {
      margin-top: 40px;
      padding: 20px;
      background: #fff5f5;
      border-left: 4px solid #fc8181;
      border-radius: 5px;
      text-align: left;
    }

    .verification-note h3 {
      color: #c53030;
      font-size: 1rem;
      margin-bottom: 10px;
      font-weight: 600;
    }

    .verification-note p {
      color: #742a2a;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    @media (max-width: 768px) {
      .card {
        padding: 40px 25px;
        margin: 10px;
      }

      .business-name {
        font-size: 2rem;
      }

      .phone-number {
        font-size: 1.8rem;
      }

      .subtitle {
        font-size: 1.1rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1 class="business-name">${businessName}</h1>
      <p class="subtitle">Contact us for more information</p>
      
      <div class="phone-section">
        <div class="phone-label">Call Now</div>
        <div class="phone-number">${formattedPhone}</div>
        <a href="tel:${phoneNumber}" class="call-button">📞 Call Now</a>
      </div>

      <div class="verification-note">
        <h3>Verification Purpose Only</h3>
        <p>This page is created for domain verification purposes. It displays basic contact information to comply with advertising platform requirements.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function generateLandingPageHtml(landingPage: ILandingPage): Promise<string> {
  // Check if this is a call ads template
  if (landingPage.templateType === 'call-ads') {
    return generateCallAdsHtml(landingPage);
  }

  // Original standard template code
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

    .banner-container {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      padding: 20px;
    }

    .banner-link {
      display: block;
      max-width: 550px;
      width: 100%;
      cursor: pointer;
    }

    .banner-link img {
      width: 100%;
      border-radius: 8px;
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
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

    footer {
      position: absolute;
      bottom: 10px;
      width: 100%;
      text-align: center;
      font-size: 12px;
      color: #fff;
    }

    footer a {
      color: #fff;
      text-decoration: underline;
      margin: 0 5px;
    }
  </style>
</head>
<body>
  <div class="background-container">
    <div class="background-image background-image-desktop"></div>
    <div class="background-image background-image-mobile"></div>
  </div>

  <div class="banner-container">
    <!-- Clickable cookie banners that redirect to affiliate URL -->
    <a href="${affiliateUrl}" class="banner-link banner-desktop">
      <img src="${cookieBannerDesktop}" alt="Accept Cookies" />
    </a>
    <a href="${affiliateUrl}" class="banner-link banner-mobile">
      <img src="${cookieBannerMobile}" alt="Accept Cookies" />
    </a>
  </div>

  <footer>
    <a href="/privacy-policy.html" target="_blank">Privacy Policy</a> |
    <a href="/terms.html" target="_blank">Terms of Use</a>
  </footer>
</body>
</html>`;
} 