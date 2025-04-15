import { NextRequest, NextResponse } from 'next/server';

// Mark this route as dynamic to prevent static optimization issues
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      border-bottom: 1px solid #ddd;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    h2 {
      margin-top: 30px;
      color: #444;
    }
    p {
      margin-bottom: 15px;
    }
    ul {
      margin-bottom: 20px;
    }
    li {
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  
  <p><strong>Last Updated: ${new Date().toLocaleDateString()}</strong></p>
  
  <p>This Privacy Policy describes how we collect, use, and share information when you use our service.</p>
  
  <h2>Information We Collect</h2>
  
  <p>We collect information you provide directly to us, such as when you create an account, subscribe to our newsletter, or contact us for support.</p>
  
  <p>We may also automatically collect certain information about your device, including your IP address, browser type, and operating system.</p>
  
  <h2>How We Use Your Information</h2>
  
  <p>We use the information we collect to:</p>
  
  <ul>
    <li>Provide, maintain, and improve our services</li>
    <li>Process transactions and send related information</li>
    <li>Send technical notices, updates, and support messages</li>
    <li>Respond to your comments, questions, and requests</li>
    <li>Monitor and analyze trends and usage to improve user experience</li>
  </ul>
  
  <h2>Cookies and Similar Technologies</h2>
  
  <p>We use cookies and similar technologies to collect information about your browsing activities and to personalize content.</p>
  
  <p>You can set your browser to refuse all or some browser cookies, or to alert you when cookies are being sent. If you disable or refuse cookies, please note that some parts of this site may then be inaccessible or not function properly.</p>
  
  <h2>Third-Party Services</h2>
  
  <p>We may allow third parties to provide analytics services and serve advertisements on our behalf. These entities may use cookies, web beacons, and other technologies to collect information about your use of our services.</p>
  
  <h2>Security</h2>
  
  <p>We take reasonable measures to help protect information about you from loss, theft, misuse, and unauthorized access.</p>
  
  <h2>Changes to This Privacy Policy</h2>
  
  <p>We may update this privacy policy from time to time. We will notify you of any changes by posting the new privacy policy on this page.</p>
  
  <h2>Contact Us</h2>
  
  <p>If you have any questions about this Privacy Policy, please contact us.</p>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
} 