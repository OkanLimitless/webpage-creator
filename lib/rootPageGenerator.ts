import { IRootPage } from './models/RootPage';

/**
 * Generate HTML for a root domain page
 * This creates a clean, professional, responsive landing page for the root domain
 * 
 * @param rootPage The root page configuration object
 * @returns HTML string for the root domain page
 */
export function generateRootPageHtml(rootPage: IRootPage): string {
  // Extract primary color or use default blue
  const primaryColor = rootPage.primaryColor || '#3b82f6';
  
  // Create feature HTML blocks
  const featuresHtml = rootPage.features.map(feature => `
    <div class="feature">
      ${feature.iconName ? `<div class="feature-icon">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${getIconPath(feature.iconName)}"></path>
        </svg>
      </div>` : ''}
      <h3>${feature.title}</h3>
      <p>${feature.description}</p>
    </div>
  `).join('');
  
  // Create testimonials HTML blocks if they exist
  const testimonialsHtml = rootPage.testimonials && rootPage.testimonials.length > 0 ? `
    <section class="testimonials">
      <div class="container">
        <h2>What Our Customers Say</h2>
        <div class="testimonials-grid">
          ${rootPage.testimonials.map(testimonial => `
            <div class="testimonial">
              <div class="testimonial-content">
                <p>"${testimonial.comment}"</p>
              </div>
              <div class="testimonial-author">
                ${testimonial.avatarUrl ? `<img src="${testimonial.avatarUrl}" alt="${testimonial.name}" class="testimonial-avatar">` : ''}
                <div>
                  <h4>${testimonial.name}</h4>
                  ${testimonial.role ? `<p class="testimonial-role">${testimonial.role}</p>` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  ` : '';
  
  // Create contact section HTML if email or phone exists
  const contactHtml = (rootPage.contactEmail || rootPage.contactPhone || rootPage.contactAddress) ? `
    <section class="contact">
      <div class="container">
        <h2>${rootPage.contactTitle || 'Contact Us'}</h2>
        <div class="contact-wrapper">
          <div class="contact-info">
            ${rootPage.contactEmail ? `<p><strong>Email:</strong> <a href="mailto:${rootPage.contactEmail}">${rootPage.contactEmail}</a></p>` : ''}
            ${rootPage.contactPhone ? `<p><strong>Phone:</strong> <a href="tel:${rootPage.contactPhone.replace(/[^0-9+]/g, '')}">${rootPage.contactPhone}</a></p>` : ''}
            ${rootPage.contactAddress ? `<p><strong>Address:</strong> ${rootPage.contactAddress}</p>` : ''}
          </div>
          <div class="contact-form">
            <form onsubmit="event.preventDefault(); alert('Message sent! We will get back to you soon.');">
              <div class="form-group">
                <label for="name">Name</label>
                <input type="text" id="name" name="name" required>
              </div>
              <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" name="email" required>
              </div>
              <div class="form-group">
                <label for="message">Message</label>
                <textarea id="message" name="message" rows="4" required></textarea>
              </div>
              <button type="submit" class="btn btn-primary">Send Message</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  ` : '';
  
  // Footer HTML with privacy policy and terms if they exist
  const footerHtml = `
    <footer>
      <div class="container">
        <div class="footer-content">
          <div class="footer-logo">
            ${rootPage.logoUrl ? `<img src="${rootPage.logoUrl}" alt="${rootPage.companyName || rootPage.title}" class="logo">` : ''}
            <p>${rootPage.companyName || rootPage.title} © ${new Date().getFullYear()}</p>
          </div>
          <div class="footer-links">
            ${rootPage.privacyPolicyUrl ? `<a href="${rootPage.privacyPolicyUrl}">Privacy Policy</a>` : ''}
            ${rootPage.termsUrl ? `<a href="${rootPage.termsUrl}">Terms of Service</a>` : ''}
          </div>
        </div>
      </div>
    </footer>
  `;
  
  // Hero button HTML if button text and URL exist
  const heroButtonHtml = (rootPage.heroButtonText && rootPage.heroButtonUrl) ? `
    <a href="${rootPage.heroButtonUrl}" class="btn btn-primary">${rootPage.heroButtonText}</a>
  ` : '';
  
  // Assemble the complete HTML
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${rootPage.title}</title>
  <meta name="description" content="${rootPage.description}">
  <meta property="og:title" content="${rootPage.title}">
  <meta property="og:description" content="${rootPage.description}">
  ${rootPage.heroImageUrl ? `<meta property="og:image" content="${rootPage.heroImageUrl}">` : ''}
  <link rel="icon" type="image/png" href="${rootPage.logoUrl || 'https://storage.googleapis.com/filtrify-public-assets/filtripage/others/padlock.png'}">
  <style>
    :root {
      --primary-color: ${primaryColor};
      --primary-dark: ${darkenColor(primaryColor, 20)};
      --primary-light: ${lightenColor(primaryColor, 20)};
      --text-color: #333;
      --text-light: #666;
      --background-light: #f9fafb;
      --border-color: #e5e7eb;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: var(--text-color);
    }
    
    a {
      color: var(--primary-color);
      text-decoration: none;
    }
    
    .container {
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
    }
    
    .btn {
      display: inline-block;
      padding: 12px 24px;
      border-radius: 6px;
      font-weight: 600;
      text-align: center;
      transition: all 0.3s ease;
      cursor: pointer;
    }
    
    .btn-primary {
      background-color: var(--primary-color);
      color: white;
      border: none;
    }
    
    .btn-primary:hover {
      background-color: var(--primary-dark);
    }
    
    /* Header Styles */
    header {
      background-color: white;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      padding: 20px 0;
      position: fixed;
      width: 100%;
      top: 0;
      z-index: 100;
    }
    
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .logo {
      height: 40px;
    }
    
    .site-title {
      font-size: 24px;
      font-weight: 700;
      color: var(--primary-color);
    }
    
    /* Hero Section */
    .hero {
      padding: 120px 0 60px;
      background-color: var(--background-light);
      text-align: center;
    }
    
    .hero h1 {
      font-size: 48px;
      margin-bottom: 20px;
      line-height: 1.2;
    }
    
    .hero p {
      font-size: 20px;
      color: var(--text-light);
      max-width: 700px;
      margin: 0 auto 30px;
    }
    
    .hero-image {
      max-width: 100%;
      margin-top: 40px;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    }
    
    /* Features Section */
    .features {
      padding: 80px 0;
    }
    
    .features h2 {
      text-align: center;
      margin-bottom: 50px;
      font-size: 36px;
    }
    
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 40px;
    }
    
    .feature {
      text-align: center;
      padding: 30px;
      border-radius: 8px;
      transition: all 0.3s ease;
    }
    
    .feature:hover {
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
      transform: translateY(-5px);
    }
    
    .feature-icon {
      background-color: var(--primary-light);
      color: var(--primary-color);
      width: 60px;
      height: 60px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    
    .feature h3 {
      margin-bottom: 15px;
      font-size: 20px;
    }
    
    .feature p {
      color: var(--text-light);
    }
    
    /* Testimonials Section */
    .testimonials {
      padding: 80px 0;
      background-color: var(--background-light);
    }
    
    .testimonials h2 {
      text-align: center;
      margin-bottom: 50px;
      font-size: 36px;
    }
    
    .testimonials-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 30px;
    }
    
    .testimonial {
      background-color: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
    }
    
    .testimonial-content p {
      font-style: italic;
      margin-bottom: 20px;
    }
    
    .testimonial-author {
      display: flex;
      align-items: center;
    }
    
    .testimonial-avatar {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      margin-right: 15px;
      object-fit: cover;
    }
    
    .testimonial-author h4 {
      font-size: 18px;
      margin: 0;
    }
    
    .testimonial-role {
      color: var(--text-light);
      font-size: 14px;
    }
    
    /* Contact Section */
    .contact {
      padding: 80px 0;
    }
    
    .contact h2 {
      text-align: center;
      margin-bottom: 50px;
      font-size: 36px;
    }
    
    .contact-wrapper {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }
    
    .contact-info p {
      margin-bottom: 20px;
    }
    
    .form-group {
      margin-bottom: 20px;
    }
    
    .form-group label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
    }
    
    .form-group input,
    .form-group textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      font-size: 16px;
    }
    
    .form-group textarea {
      resize: vertical;
    }
    
    /* Footer */
    footer {
      background-color: #333;
      color: white;
      padding: 40px 0;
    }
    
    .footer-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
    }
    
    .footer-logo {
      display: flex;
      align-items: center;
    }
    
    .footer-logo img {
      height: 30px;
      margin-right: 15px;
    }
    
    .footer-links a {
      color: white;
      margin-left: 20px;
      opacity: 0.8;
      transition: opacity 0.3s;
    }
    
    .footer-links a:hover {
      opacity: 1;
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .hero h1 {
        font-size: 36px;
      }
      
      .hero p {
        font-size: 18px;
      }
      
      .features-grid,
      .testimonials-grid,
      .contact-wrapper {
        grid-template-columns: 1fr;
      }
      
      .footer-content {
        flex-direction: column;
        text-align: center;
      }
      
      .footer-links {
        margin-top: 20px;
      }
      
      .footer-links a {
        margin: 0 10px;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="container header-container">
      ${rootPage.logoUrl 
        ? `<a href="/"><img src="${rootPage.logoUrl}" alt="${rootPage.companyName || rootPage.title}" class="logo"></a>` 
        : `<a href="/" class="site-title">${rootPage.companyName || rootPage.title}</a>`
      }
    </div>
  </header>
  
  <section class="hero">
    <div class="container">
      <h1>${rootPage.heroTitle}</h1>
      <p>${rootPage.heroSubtitle}</p>
      ${heroButtonHtml}
      ${rootPage.heroImageUrl ? `<img src="${rootPage.heroImageUrl}" alt="${rootPage.heroTitle}" class="hero-image">` : ''}
    </div>
  </section>
  
  <section class="features">
    <div class="container">
      <h2>Our Services</h2>
      <div class="features-grid">
        ${featuresHtml}
      </div>
    </div>
  </section>
  
  ${testimonialsHtml}
  
  ${contactHtml}
  
  ${footerHtml}
</body>
</html>
`;
}

/**
 * Helper function to get SVG path for common icons
 * @param iconName The name of the icon
 * @returns SVG path string
 */
function getIconPath(iconName: string): string {
  const icons: Record<string, string> = {
    'checkmark': 'M5 13l4 4L19 7',
    'shield': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'star': 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
    'phone': 'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z',
    'email': 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z',
    'location': 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z',
    'heart': 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z',
    'clock': 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    'lightbulb': 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    'chat': 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
    'gear': 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
    // Default to a simple circle if icon not found
    'default': 'M12 8v8m0-8v.01',
  };
  
  return icons[iconName] || icons['default'];
}

/**
 * Helper function to darken a hex color
 * @param color The hex color to darken
 * @param percent The percentage to darken (0-100)
 * @returns Darkened hex color
 */
function darkenColor(color: string, percent: number): string {
  // Remove the # if present
  color = color.replace('#', '');
  
  // Parse the hex values
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  
  // Calculate the darkened values
  const darkenedR = Math.max(0, Math.floor(r * (1 - percent / 100)));
  const darkenedG = Math.max(0, Math.floor(g * (1 - percent / 100)));
  const darkenedB = Math.max(0, Math.floor(b * (1 - percent / 100)));
  
  // Convert back to hex
  return `#${darkenedR.toString(16).padStart(2, '0')}${darkenedG.toString(16).padStart(2, '0')}${darkenedB.toString(16).padStart(2, '0')}`;
}

/**
 * Helper function to lighten a hex color
 * @param color The hex color to lighten
 * @param percent The percentage to lighten (0-100)
 * @returns Lightened hex color
 */
function lightenColor(color: string, percent: number): string {
  // Remove the # if present
  color = color.replace('#', '');
  
  // Parse the hex values
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  
  // Calculate the lightened values
  const lightenedR = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
  const lightenedG = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
  const lightenedB = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));
  
  // Convert back to hex
  return `#${lightenedR.toString(16).padStart(2, '0')}${lightenedG.toString(16).padStart(2, '0')}${lightenedB.toString(16).padStart(2, '0')}`;
} 