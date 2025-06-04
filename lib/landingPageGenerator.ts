import { ILandingPage } from './models/LandingPage';
import { extractFavicon } from './faviconExtractor';
import { extractPageTitle } from './pageInfoExtractor';

export async function generateCallAdsHtml(landingPage: ILandingPage): Promise<string> {
  // Route to specific call-ads template based on callAdsTemplateType
  const templateType = landingPage.callAdsTemplateType || 'travel';
  
  if (templateType === 'pest-control') {
    return generatePestControlHtml(landingPage);
  } else {
    return generateTravelHtml(landingPage);
  }
}

async function generateTravelHtml(landingPage: ILandingPage): Promise<string> {
  const { 
    phoneNumber, 
    businessName, 
    name 
  } = landingPage;
  
  const htmlTitle = businessName || name || "Fly Easy";
  const siteName = businessName || name || "Fly Easy";
  
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
  <meta name="description" content="${siteName} - Best prices on flights. Call now to speak with a live travel specialist!">
  <meta name="keywords" content="${siteName}, flights, travel, booking, cheap flights, travel deals">
  <meta name="author" content="${siteName}">
  
  <meta property="og:title" content="${siteName} - Best Flight Deals" />
  <meta property="og:description" content="Call now to speak with a live travel specialist and get the best prices on flights!" />
  <meta property="og:type" content="website" />
  
  <title>${htmlTitle} - Best Flight Deals</title>
  
  <!-- Favicon -->
  <link rel="icon" type="image/png" href="https://img.icons8.com/ios-filled/32/ffffff/airplane-take-off.png">
  
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
      background: linear-gradient(135deg, #1e90ff 0%, #0073e6 100%);
      color: white;
      line-height: 1.6;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 40px;
      position: relative;
      z-index: 100;
    }

    .logo {
      display: flex;
      align-items: center;
      font-size: 24px;
      font-weight: bold;
    }

    .logo img {
      margin-right: 10px;
      width: 32px;
      height: 32px;
    }

    .nav {
      display: flex;
      gap: 30px;
    }

    .nav a {
      color: white;
      text-decoration: none;
      font-weight: 500;
      transition: opacity 0.3s ease;
    }

    .nav a:hover {
      opacity: 0.8;
    }

    .hero {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      padding: 40px 20px;
    }

    .hero-card {
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 60px 40px;
      text-align: center;
      max-width: 600px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .hero-title {
      font-size: 3.5rem;
      font-weight: 700;
      margin-bottom: 20px;
      color: white;
    }

    .hero-subtitle {
      font-size: 1.4rem;
      margin-bottom: 15px;
      color: rgba(255, 255, 255, 0.9);
      font-weight: 500;
    }

    .hero-description {
      font-size: 1.1rem;
      margin-bottom: 40px;
      color: rgba(255, 255, 255, 0.8);
    }

    .call-button {
      display: inline-block;
      background: linear-gradient(135deg, #4CAF50, #45a049);
      color: white;
      padding: 18px 40px;
      text-decoration: none;
      border-radius: 50px;
      font-size: 1.3rem;
      font-weight: 600;
      transition: all 0.3s ease;
      box-shadow: 0 8px 25px rgba(76, 175, 80, 0.3);
      border: none;
      cursor: pointer;
    }

    .call-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 35px rgba(76, 175, 80, 0.4);
    }

    .trust-badges {
      display: flex;
      justify-content: center;
      gap: 40px;
      margin: 60px 0;
      flex-wrap: wrap;
    }

    .trust-badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .trust-badge img {
      width: 60px;
      height: 60px;
      opacity: 0.9;
    }

    .trust-badge span {
      font-size: 0.9rem;
      color: rgba(255, 255, 255, 0.8);
      font-weight: 500;
    }

    .content-section {
      padding: 60px 40px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .section-title {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 30px;
      text-align: center;
    }

    .about-text {
      font-size: 1.1rem;
      line-height: 1.8;
      color: rgba(255, 255, 255, 0.9);
      text-align: center;
      max-width: 800px;
      margin: 0 auto;
    }

    .faq-section {
      background: rgba(255, 255, 255, 0.1);
      padding: 60px 40px;
      margin-top: 40px;
    }

    .faq-item {
      margin-bottom: 25px;
      max-width: 800px;
      margin-left: auto;
      margin-right: auto;
    }

    .faq-question {
      font-size: 1.1rem;
      font-weight: 600;
      color: white;
      margin-bottom: 8px;
    }

    .faq-answer {
      font-size: 1rem;
      color: rgba(255, 255, 255, 0.85);
      line-height: 1.6;
    }

    .footer {
      background: rgba(0, 0, 0, 0.3);
      padding: 40px;
      text-align: center;
      margin-top: 60px;
    }

    .footer-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }

    .footer-logo img {
      margin-right: 10px;
      width: 24px;
      height: 24px;
    }

    .footer-links {
      display: flex;
      justify-content: center;
      gap: 30px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .footer-links a {
      color: rgba(255, 255, 255, 0.8);
      text-decoration: none;
      transition: color 0.3s ease;
    }

    .footer-links a:hover {
      color: white;
    }

    .footer-text {
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.9rem;
    }

    @media (max-width: 768px) {
      .header {
        padding: 15px 20px;
        flex-direction: column;
        gap: 15px;
      }

      .nav {
        gap: 20px;
      }

      .hero-card {
        padding: 40px 25px;
        margin: 20px;
      }

      .hero-title {
        font-size: 2.5rem;
      }

      .hero-subtitle {
        font-size: 1.2rem;
      }

      .call-button {
        padding: 15px 30px;
        font-size: 1.1rem;
      }

      .trust-badges {
        gap: 20px;
      }

      .content-section {
        padding: 40px 20px;
      }

      .faq-section {
        padding: 40px 20px;
      }

      .footer-links {
        gap: 15px;
      }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="logo">
      <img src="https://img.icons8.com/ios-filled/50/ffffff/airplane-take-off.png" alt="${siteName} Logo">
      ${siteName}
    </div>
    <nav class="nav">
      <a href="#about">About Us</a>
      <a href="#faq">FAQs</a>
      <a href="#contact">Contact</a>
    </nav>
  </header>

  <section class="hero">
    <div class="hero-card">
      <h1 class="hero-title">${siteName}</h1>
      <p class="hero-subtitle">Best Prices in Market on flights</p>
      <p class="hero-description">Call now to speak with a live travel specialist!</p>
      <a href="tel:${phoneNumber}" class="call-button">Call ${formattedPhone}</a>
    </div>
  </section>

  <section class="trust-badges">
    <div class="trust-badge">
      <img src="https://img.icons8.com/ios-filled/100/ffffff/verified-account.png" alt="Secure Booking" title="Secure Booking" />
      <span>Secure Booking</span>
    </div>
    <div class="trust-badge">
      <img src="https://img.icons8.com/ios-filled/100/ffffff/clock.png" alt="24/7 Support" title="24/7 Support" />
      <span>24/7 Support</span>
    </div>
    <div class="trust-badge">
      <img src="https://img.icons8.com/ios-filled/100/ffffff/ticket.png" alt="Flight Deals" title="Flight Deals" />
      <span>Flight Deals</span>
    </div>
  </section>

  <section id="about" class="content-section">
    <h2 class="section-title">About Us</h2>
    <p class="about-text">
      ${siteName} was founded with a simple mission: make flight booking fast, and hassle-free. Since 
      our inception, we've helped thousands of travelers find the best flight deals available. Our team 
      of travel experts is passionate about helping people reach their destinations with ease, 
      comfort, and savings. Whether you're flying for business or leisure, ${siteName} is your trusted travel 
      companion.
    </p>
  </section>

  <section id="faq" class="faq-section">
    <h2 class="section-title">FAQs</h2>
    
    <div class="faq-item">
      <div class="faq-question">Q1: How do I book a flight with ${siteName}?</div>
      <div class="faq-answer">A: Simply call our helpline and our agents will guide you through the process.</div>
    </div>

    <div class="faq-item">
      <div class="faq-question">Q2: Can I change or cancel my flight after booking?</div>
      <div class="faq-answer">A: Yes, changes and cancellations are possible depending on the airline's policies.</div>
    </div>

    <div class="faq-item">
      <div class="faq-question">Q3: Do I get a confirmation email or ticket?</div>
      <div class="faq-answer">A: Yes, a confirmation and e-ticket will be sent to your email after booking.</div>
    </div>

    <div class="faq-item">
      <div class="faq-question">Q4: What payment methods do you accept?</div>
      <div class="faq-answer">A: We accept all major credit/debit cards and other secure online payment options.</div>
    </div>

    <div class="faq-item">
      <div class="faq-question">Q5: Is it safe to book over the phone?</div>
      <div class="faq-answer">A: Absolutely. We use secure systems and your privacy is protected.</div>
    </div>
  </section>

  <footer id="contact" class="footer">
    <div class="footer-logo">
      <img src="https://img.icons8.com/ios-filled/50/ffffff/airplane-take-off.png" alt="${siteName} Logo">
      ${siteName}
    </div>
    <div class="footer-links">
      <a href="#about">About Us</a>
      <a href="#faq">FAQs</a>
      <a href="#contact">Contact</a>
    </div>
    <p class="footer-text">© 2025 ${siteName}. All rights reserved.</p>
  </footer>
</body>
</html>`;
}

async function generatePestControlHtml(landingPage: ILandingPage): Promise<string> {
  const { 
    phoneNumber, 
    businessName, 
    name 
  } = landingPage;
  
  const htmlTitle = businessName || name || "Bug Busters";
  const siteName = businessName || name || "Bug Busters";
  
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
  <meta name="description" content="${siteName} - Professional pest control services. Call now for fast, reliable extermination!">
  <meta name="keywords" content="${siteName}, pest control, extermination, bug control, termite control, rodent control">
  <meta name="author" content="${siteName}">
  
  <meta property="og:title" content="${siteName} - Professional Pest Control" />
  <meta property="og:description" content="Call now for professional pest control services. Fast, reliable, and guaranteed results!" />
  <meta property="og:type" content="website" />
  
  <title>${htmlTitle} - Professional Pest Control</title>
  
  <!-- Favicon -->
  <link rel="icon" type="image/png" href="https://img.icons8.com/ios-filled/32/ffffff/bug--v1.png">
  
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
      background: linear-gradient(135deg, #2d5016 0%, #1a3009 100%);
      color: white;
      line-height: 1.6;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 40px;
      position: relative;
      z-index: 100;
    }

    .logo {
      display: flex;
      align-items: center;
      font-size: 24px;
      font-weight: bold;
    }

    .logo img {
      margin-right: 10px;
      width: 32px;
      height: 32px;
    }

    .nav {
      display: flex;
      gap: 30px;
    }

    .nav a {
      color: white;
      text-decoration: none;
      font-weight: 500;
      transition: opacity 0.3s ease;
    }

    .nav a:hover {
      opacity: 0.8;
    }

    .hero {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      padding: 40px 20px;
    }

    .hero-card {
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 60px 40px;
      text-align: center;
      max-width: 600px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .hero-title {
      font-size: 3.5rem;
      font-weight: 700;
      margin-bottom: 20px;
      color: white;
    }

    .hero-subtitle {
      font-size: 1.4rem;
      margin-bottom: 15px;
      color: rgba(255, 255, 255, 0.9);
      font-weight: 500;
    }

    .hero-description {
      font-size: 1.1rem;
      margin-bottom: 40px;
      color: rgba(255, 255, 255, 0.8);
    }

    .call-button {
      display: inline-block;
      background: linear-gradient(135deg, #ff6b35, #e55a2b);
      color: white;
      padding: 18px 40px;
      text-decoration: none;
      border-radius: 50px;
      font-size: 1.3rem;
      font-weight: 600;
      transition: all 0.3s ease;
      box-shadow: 0 8px 25px rgba(255, 107, 53, 0.3);
      border: none;
      cursor: pointer;
    }

    .call-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 35px rgba(255, 107, 53, 0.4);
    }

    .trust-badges {
      display: flex;
      justify-content: center;
      gap: 40px;
      margin: 60px 0;
      flex-wrap: wrap;
    }

    .trust-badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .trust-badge img {
      width: 60px;
      height: 60px;
      opacity: 0.9;
    }

    .trust-badge span {
      font-size: 0.9rem;
      color: rgba(255, 255, 255, 0.8);
      font-weight: 500;
    }

    .content-section {
      padding: 60px 40px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .section-title {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 30px;
      text-align: center;
    }

    .about-text {
      font-size: 1.1rem;
      line-height: 1.8;
      color: rgba(255, 255, 255, 0.9);
      text-align: center;
      max-width: 800px;
      margin: 0 auto;
    }

    .faq-section {
      background: rgba(255, 255, 255, 0.1);
      padding: 60px 40px;
      margin-top: 40px;
    }

    .faq-item {
      margin-bottom: 25px;
      max-width: 800px;
      margin-left: auto;
      margin-right: auto;
    }

    .faq-question {
      font-size: 1.1rem;
      font-weight: 600;
      color: white;
      margin-bottom: 8px;
    }

    .faq-answer {
      font-size: 1rem;
      color: rgba(255, 255, 255, 0.85);
      line-height: 1.6;
    }

    .footer {
      background: rgba(0, 0, 0, 0.3);
      padding: 40px;
      text-align: center;
      margin-top: 60px;
    }

    .footer-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }

    .footer-logo img {
      margin-right: 10px;
      width: 24px;
      height: 24px;
    }

    .footer-links {
      display: flex;
      justify-content: center;
      gap: 30px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .footer-links a {
      color: rgba(255, 255, 255, 0.8);
      text-decoration: none;
      transition: color 0.3s ease;
    }

    .footer-links a:hover {
      color: white;
    }

    .footer-text {
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.9rem;
    }

    @media (max-width: 768px) {
      .header {
        padding: 15px 20px;
        flex-direction: column;
        gap: 15px;
      }

      .nav {
        gap: 20px;
      }

      .hero-card {
        padding: 40px 25px;
        margin: 20px;
      }

      .hero-title {
        font-size: 2.5rem;
      }

      .hero-subtitle {
        font-size: 1.2rem;
      }

      .call-button {
        padding: 15px 30px;
        font-size: 1.1rem;
      }

      .trust-badges {
        gap: 20px;
      }

      .content-section {
        padding: 40px 20px;
      }

      .faq-section {
        padding: 40px 20px;
      }

      .footer-links {
        gap: 15px;
      }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="logo">
      <img src="https://img.icons8.com/ios-filled/100/ffffff/bug--v1.png" alt="${siteName} Logo">
      ${siteName}
    </div>
    <nav class="nav">
      <a href="#about">About Us</a>
      <a href="#faq">FAQs</a>
      <a href="#contact">Contact</a>
    </nav>
  </header>

  <section class="hero">
    <div class="hero-card">
      <h1 class="hero-title">${siteName}</h1>
      <p class="hero-subtitle">Professional Pest Control Services</p>
      <p class="hero-description">Call now for fast, reliable extermination!</p>
      <a href="tel:${phoneNumber}" class="call-button">Call ${formattedPhone}</a>
    </div>
  </section>

  <section class="trust-badges">
    <div class="trust-badge">
      <img src="https://img.icons8.com/ios-filled/100/ffffff/shield.png" alt="Licensed & Insured" title="Licensed & Insured" />
      <span>Licensed & Insured</span>
    </div>
    <div class="trust-badge">
      <img src="https://img.icons8.com/ios-filled/100/ffffff/clock.png" alt="24/7 Emergency Service" title="24/7 Emergency Service" />
      <span>24/7 Emergency</span>
    </div>
    <div class="trust-badge">
      <img src="https://img.icons8.com/ios-filled/100/ffffff/guarantee.png" alt="100% Guarantee" title="100% Guarantee" />
      <span>100% Guarantee</span>
    </div>
  </section>

  <section id="about" class="content-section">
    <h2 class="section-title">About Us</h2>
    <p class="about-text">
      ${siteName} has been protecting homes and businesses from unwanted pests for years. Our team 
      of certified professionals uses the latest techniques and eco-friendly solutions to eliminate 
      pests quickly and safely. From ants and roaches to termites and rodents, we handle it all. 
      We're committed to providing fast, reliable service with guaranteed results. Your satisfaction 
      and peace of mind are our top priorities.
    </p>
  </section>

  <section id="faq" class="faq-section">
    <h2 class="section-title">FAQs</h2>
    
    <div class="faq-item">
      <div class="faq-question">Q1: How quickly can you respond to a pest emergency?</div>
      <div class="faq-answer">A: We offer 24/7 emergency service and can typically respond within 2-4 hours.</div>
    </div>

    <div class="faq-item">
      <div class="faq-question">Q2: Are your treatments safe for pets and children?</div>
      <div class="faq-answer">A: Yes, we use eco-friendly, pet and child-safe treatments whenever possible.</div>
    </div>

    <div class="faq-item">
      <div class="faq-question">Q3: Do you offer a guarantee on your services?</div>
      <div class="faq-answer">A: Absolutely! We provide a 100% satisfaction guarantee on all our pest control services.</div>
    </div>

    <div class="faq-item">
      <div class="faq-question">Q4: What types of pests do you handle?</div>
      <div class="faq-answer">A: We handle all types of pests including ants, roaches, termites, rodents, spiders, and more.</div>
    </div>

    <div class="faq-item">
      <div class="faq-question">Q5: Do you provide free estimates?</div>
      <div class="faq-answer">A: Yes, we provide free, no-obligation estimates for all our services.</div>
    </div>
  </section>

  <footer id="contact" class="footer">
    <div class="footer-logo">
      <img src="https://img.icons8.com/ios-filled/100/ffffff/bug--v1.png" alt="${siteName} Logo">
      ${siteName}
    </div>
    <div class="footer-links">
      <a href="#about">About Us</a>
      <a href="#faq">FAQs</a>
      <a href="#contact">Contact</a>
    </div>
    <p class="footer-text">© 2025 ${siteName}. All rights reserved.</p>
  </footer>
</body>
</html>`;
}

export async function generateLandingPageHtml(landingPage: ILandingPage): Promise<string> {
  if (landingPage.templateType === 'call-ads') {
    return generateCallAdsHtml(landingPage);
  }
  
  // For standard template, restore the original cookie banner design
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
  
  // Generate Google Analytics tracking code if ID is provided
  const googleAnalyticsCode = landingPage.googleAnalyticsId ? `
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${landingPage.googleAnalyticsId}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', '${landingPage.googleAnalyticsId}');
  </script>` : '';
  
  // Professional privacy notice banner images (more legitimate looking)
  const privacyBannerDesktop = "https://storage.googleapis.com/filtrify-public-assets/filtripage/presellTypes/en/privacy_notice_desktop.png";
  const privacyBannerMobile = "https://storage.googleapis.com/filtrify-public-assets/filtripage/presellTypes/en/privacy_notice_mobile.png";
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow">
  <meta name="description" content="${siteName} - Official website with exclusive offers and promotions. View our privacy policy and terms of service.">
  <meta name="keywords" content="${siteName}, official site, privacy policy, terms of service, exclusive offers">
  <meta name="author" content="${siteName}">
  
  <meta property="og:title" content="${siteName} - Official Website" />
  <meta property="og:description" content="Visit the official ${siteName} website. Please review our privacy policy before proceeding." />
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
  </script>${googleAnalyticsCode}
  
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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

    .overlay-container {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      padding: 20px;
      position: relative;
      z-index: 1;
    }

    .privacy-notice {
      display: block;
      max-width: 500px;
      width: 100%;
      cursor: pointer;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 8px;
      padding: 25px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      border: 1px solid rgba(0, 0, 0, 0.1);
      text-align: center;
      text-decoration: none;
      color: #333;
      transition: all 0.3s ease;
      position: relative;
      box-sizing: border-box;
    }

    .privacy-notice:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 25px rgba(0, 0, 0, 0.2);
    }

    .notice-header {
      font-size: 1.4rem;
      font-weight: 600;
      color: #333;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .privacy-icon {
      font-size: 20px;
    }

    .notice-text {
      font-size: 0.95rem;
      line-height: 1.5;
      color: #666;
      margin-bottom: 20px;
    }

    .continue-button {
      background: #007bff;
      color: white;
      padding: 10px 24px;
      border-radius: 5px;
      font-weight: 500;
      font-size: 0.9rem;
      border: none;
      cursor: pointer;
      transition: background 0.3s ease;
      display: inline-block;
      text-decoration: none;
      margin-bottom: 15px;
    }

    .continue-button:hover {
      background: #0056b3;
    }

    .cookie-links {
      font-size: 0.8rem;
      color: #007bff;
      width: 100%;
      text-align: center;
      clear: both;
      display: block;
    }

    .cookie-links a {
      color: #007bff;
      text-decoration: none;
      margin: 0 5px;
    }

    .cookie-links a:hover {
      text-decoration: underline;
    }

    footer {
      position: absolute;
      bottom: 15px;
      width: 100%;
      text-align: center;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.8);
      z-index: 2;
    }
    
    footer a {
      color: rgba(255, 255, 255, 0.9);
      text-decoration: none;
      margin: 0 8px;
      padding: 2px 8px;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.3);
      transition: background 0.3s ease;
    }

    footer a:hover {
      background: rgba(0, 0, 0, 0.5);
      text-decoration: none;
    }

    @media (max-width: 768px) {
      .privacy-notice {
        padding: 25px 20px;
        margin: 15px;
      }

      .notice-header {
        font-size: 1.5rem;
      }

      .notice-text {
        font-size: 1rem;
      }

      .continue-button {
        padding: 10px 25px;
        font-size: 0.95rem;
      }
    }
  </style>
</head>
<body>
  <div class="background-container">
    <div class="background-image background-image-desktop"></div>
    <div class="background-image background-image-mobile"></div>
  </div>
  
  <div class="overlay-container">
    <a href="${affiliateUrl}" class="privacy-notice">
      <div class="notice-header">
        <div class="privacy-icon">🍪</div>
        Cookie Notice
      </div>
      
      <div class="notice-text">
        This website uses cookies to enhance your browsing experience and provide personalized content. 
        By clicking "Accept All Cookies", you consent to our use of cookies as described in our privacy policy.
      </div>
      
      <div class="continue-button">Accept All Cookies</div>
      
      <div class="cookie-links">
        <a href="#" onclick="event.preventDefault();">Cookie Settings</a> |
        <a href="#" onclick="event.preventDefault();">Learn More</a>
      </div>
    </a>
  </div>
    
  <footer>
    <a href="/privacy-policy.html" target="_blank">Privacy Policy</a>
    <a href="/terms.html" target="_blank">Terms of Use</a>
    <a href="/contact.html" target="_blank">Contact</a>
  </footer>
</body>
</html>`;
} 