import { NextRequest, NextResponse } from 'next/server';

// Mark this route as dynamic to prevent static optimization issues
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terms of Service</title>
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
  <h1>Terms of Service</h1>
  
  <p><strong>Last Updated: ${new Date().toLocaleDateString()}</strong></p>
  
  <p>Please read these Terms of Service ("Terms", "Terms of Service") carefully before using our website.</p>
  
  <h2>1. Agreement to Terms</h2>
  
  <p>By accessing or using our service, you agree to be bound by these Terms. If you disagree with any part of the terms, you may not access the service.</p>
  
  <h2>2. Use License</h2>
  
  <p>Permission is granted to temporarily view the materials on our website for personal, non-commercial use only. This is the grant of a license, not a transfer of title, and under this license you may not:</p>
  
  <ul>
    <li>Modify or copy the materials</li>
    <li>Use the materials for any commercial purpose</li>
    <li>Attempt to decompile or reverse engineer any software contained on the website</li>
    <li>Remove any copyright or other proprietary notations from the materials</li>
    <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
  </ul>
  
  <h2>3. Disclaimer</h2>
  
  <p>The materials on our website are provided on an 'as is' basis. We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p>
  
  <h2>4. Limitations</h2>
  
  <p>In no event shall we or our suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on our website, even if we or our authorized representative has been notified orally or in writing of the possibility of such damage.</p>
  
  <h2>5. Accuracy of Materials</h2>
  
  <p>The materials appearing on our website could include technical, typographical, or photographic errors. We do not warrant that any of the materials on this website are accurate, complete or current. We may make changes to the materials contained on this website at any time without notice.</p>
  
  <h2>6. Links</h2>
  
  <p>We have not reviewed all of the sites linked to our website and are not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by us of the site. Use of any such linked website is at the user's own risk.</p>
  
  <h2>7. Modifications</h2>
  
  <p>We may revise these terms of service for our website at any time without notice. By using this website you are agreeing to be bound by the then current version of these terms of service.</p>
  
  <h2>8. Governing Law</h2>
  
  <p>These terms and conditions are governed by and construed in accordance with the laws and you irrevocably submit to the exclusive jurisdiction of the courts in that location.</p>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
} 