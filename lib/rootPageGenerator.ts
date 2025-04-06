/**
 * Generate HTML for a root domain page
 * This creates a clean, professional, responsive landing page for the root domain
 * 
 * @param rootPage The root page configuration object
 * @returns HTML string for the root domain page
 */
export function generateRootPageHtml(rootPage: any): string {
  // Basic HTML structure
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${rootPage.title}</title>
  <meta name="description" content="${rootPage.description}">
  
  <!-- Meta tags -->
  ${rootPage.metaTags?.map((tag: string) => {
    // Parse meta tags in format "name:content"
    const parts = tag.split(':');
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const content = parts.slice(1).join(':').trim();
      return `<meta name="${name}" content="${content}">`;
    }
    return '';
  }).join('\n  ') || ''}
  
  <!-- Default styles -->
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
    }
    
    h1, h2, h3, h4, h5, h6 {
      color: #111;
    }
    
    a {
      color: #0070f3;
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    img {
      max-width: 100%;
      height: auto;
    }
    
    /* Responsive adjustments */
    @media (max-width: 768px) {
      h1 {
        font-size: 2rem;
      }
      
      h2 {
        font-size: 1.5rem;
      }
    }
    
    /* Custom CSS */
    ${rootPage.customCss || ''}
  </style>
  
  <!-- Custom head content -->
  ${rootPage.customHead || ''}
</head>
<body>
  <div class="container">
    ${rootPage.content || `
      <h1>${rootPage.title}</h1>
      <p>${rootPage.description}</p>
    `}
  </div>
</body>
</html>
  `.trim();
  
  return html;
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