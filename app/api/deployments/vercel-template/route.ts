import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { DomainDeployment } from '@/lib/models/DomainDeployment';
import { createVercelProject, addDomainToVercel, getProjectDomains } from '@/lib/vercel';
import fetch from 'node-fetch';

// Mark this route as dynamic to prevent static optimization
export const dynamic = 'force-dynamic';

// POST /api/deployments/vercel-template
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { domainId, wordpressApiUrl = 'https://novoslabs.com/wp-json' } = body;
    
    if (!domainId) {
      return NextResponse.json(
        { error: 'Domain ID is required' },
        { status: 400 }
      );
    }
    
    // Find the domain
    const domain = await Domain.findById(domainId);
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }
    
    // Create a deployment record
    const deployment = new DomainDeployment({
      domainId: domain._id,
      domainName: domain.name,
      deploymentId: `template_${Date.now()}`,
      status: 'pending',
      logs: [{
        message: `Starting WordPress template deployment for ${domain.name}`,
        level: 'info',
        timestamp: new Date()
      }]
    });
    
    await deployment.save();
    
    // Update domain status
    domain.deploymentStatus = 'deploying';
    await domain.save();
    
    // Start the deployment in the background
    deployWordpressTemplate(domain.name, domain._id.toString(), deployment._id.toString(), wordpressApiUrl)
      .catch(error => {
        console.error(`Background deployment error for ${domain.name}:`, error);
      });
    
    return NextResponse.json({
      success: true,
      message: 'WordPress template deployment started',
      deploymentId: deployment._id,
      domainName: domain.name
    });
    
  } catch (error: any) {
    console.error('Error initiating template deployment:', error);
    return NextResponse.json(
      { error: `Failed to start deployment: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * Process the WordPress template deployment
 */
async function deployWordpressTemplate(
  domainName: string,
  domainId: string,
  deploymentId: string,
  wordpressApiUrl: string
): Promise<void> {
  console.log(`Starting WordPress template deployment for ${domainName}`);
  
  try {
    // 1. Create a new Vercel project for this domain
    const deployment = await DomainDeployment.findById(deploymentId);
    if (!deployment) {
      throw new Error('Deployment record not found');
    }
    
    deployment.addLog(`Creating Vercel project for ${domainName}...`, 'info');
    await deployment.save();
    
    // First check if a project already exists for this domain
    let project: any = null;
    let existingProject = false;
    let domainAdded = false;
    
    try {
      // Create the Vercel project with timeout protection
      project = await Promise.race([
        createVercelProject(domainName, 'nextjs'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Project creation timed out after 60s')), 60000))
      ]);
      
      if (project.alreadyExists) {
        existingProject = true;
        deployment.addLog(`Found existing Vercel project (ID: ${project.id})`, 'info');
      } else {
        deployment.addLog(`Vercel project created successfully (ID: ${project.id})`, 'info');
      }
      
      if (!project || !project.id) {
        throw new Error('Failed to create Vercel project');
      }
      
      deployment.vercelProjectId = project.id;
      await deployment.save();
    } catch (projectError: any) {
      deployment.addLog(`Error creating Vercel project: ${projectError.message}`, 'error');
      await deployment.save();
      throw projectError;
    }
    
    // If we found an existing project that already has the domain, we should continue with deployment
    if (existingProject) {
      try {
        const domains = await getProjectDomains(project.id);
        const hasDomain = domains.some((d: any) => d.name.toLowerCase() === domainName.toLowerCase());
        
        if (hasDomain) {
          deployment.addLog(`Domain ${domainName} is already configured for this project. Continuing with deployment.`, 'info');
          // Mark domain as already added to avoid attempts to add it again
          domainAdded = true;
        }
      } catch (domainCheckError) {
        // If domain check fails, continue with normal deployment
        deployment.addLog(`Error checking domains: ${domainCheckError}`, 'warning');
      }
    }
    
    // 2. Deploy the WordPress ISR blog template through Vercel API
    deployment.addLog(`Deploying NextJS WordPress ISR blog template...`, 'info');
    await deployment.save();
    
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    if (!VERCEL_TOKEN) {
      throw new Error('Vercel API token not set');
    }
    
    // Skip GitHub import and directly use the template deployment
    deployment.addLog(`Skipping GitHub import and proceeding with direct template deployment...`, 'info');
    await deployment.save();
    
    // Flag to track if deployment succeeded
    let deploymentSucceeded = false;
    let lastError = null;
    
    // Direct deployment method
    try {
      deployment.addLog(`Attempting direct template deployment...`, 'info');
      await deployment.save();
      
      // Construct direct deployment URL
      let deploymentUrl = `https://api.vercel.com/v13/deployments`;
      if (VERCEL_TEAM_ID) {
        deploymentUrl += `?teamId=${VERCEL_TEAM_ID}&projectId=${project.id}`;
      } else {
        deploymentUrl += `?projectId=${project.id}`;
      }
      
      // Create minimal WordPress blog deployment - using a different approach
      const deploymentResponse = await fetch(deploymentUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: domainName,
          target: 'production',
          framework: 'nextjs',
          // Use a simple deployment with basic files
          files: [
            {
              file: 'package.json',
              data: JSON.stringify({
                name: `wordpress-blog-${domainName.replace(/\./g, '-')}`,
                version: '1.0.0',
                private: true,
                scripts: {
                  dev: 'next dev',
                  build: 'next build',
                  start: 'next start'
                },
                dependencies: {
                  next: "latest",
                  react: "latest",
                  "react-dom": "latest",
                  "date-fns": "latest",
                  "classnames": "latest"
                },
                engines: {
                  "node": "18.x" 
                }
              }),
              encoding: 'utf-8'
            },
            {
              file: '.env.local',
              data: `WORDPRESS_API_URL=${wordpressApiUrl}`,
              encoding: 'utf-8'
            },
            {
              file: 'next.config.js',
              data: `
/** @type {import('next').NextConfig} */
module.exports = {
  images: {
    domains: [
      'secure.gravatar.com',
      'nowshipping.store',
      'i0.wp.com',
      'i1.wp.com',
      'i2.wp.com',
    ],
  },
  // Do not use standalone output to avoid build errors
  // output: 'standalone',
}`,
              encoding: 'utf-8'
            },
            {
              file: 'lib/api.js',
              data: `
const API_URL = process.env.WORDPRESS_API_URL

/**
 * Fetch posts from WordPress REST API
 */
export async function getRecentPosts() {
  try {
    // Use the /posts endpoint for the REST API
    const res = await fetch(\`\${API_URL}/wp/v2/posts?_embed=true&per_page=10\`)
    
    // Check if response is OK
    if (!res.ok) {
      throw new Error(\`Failed to fetch posts: \${res.status}\`)
    }
    
    const posts = await res.json()
    return posts || []
  } catch (error) {
    console.error('Error fetching posts:', error)
    return []
  }
}
`,
              encoding: 'utf-8'
            },
            {
              file: 'pages/index.js',
              data: `
import Head from 'next/head'
import { useEffect, useState } from 'react'

export default function Home() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    async function loadPosts() {
      try {
        const res = await fetch('/api/posts')
        const data = await res.json()
        setPosts(data)
      } catch (error) {
        console.error('Error loading posts:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadPosts()
  }, [])

  return (
    <div className="page-container">
      <Head>
        <title>${domainName} - WordPress Blog</title>
        <link rel="icon" href="/favicon.ico" />
        <meta name="description" content="Latest news and updates from ${domainName}" />
      </Head>

      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <h2>${domainName}</h2>
          </div>
          <nav className="nav">
            <ul>
              <li><a href="#" className="active">Home</a></li>
              <li><a href="#">About</a></li>
              <li><a href="#">Blog</a></li>
              <li><a href="#contact">Contact</a></li>
            </ul>
          </nav>
        </div>
      </header>

      <main>
        <div className="container">
          <h1 className="page-title">
            Welcome to our Blog
          </h1>
          
          {loading ? (
            <div className="loading">
              <p>Loading posts...</p>
            </div>
          ) : posts.length > 0 ? (
            <div className="posts">
              {posts.map(post => (
                <div key={post.id} className="post">
                  <h2 dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
                  <div className="post-excerpt" dangerouslySetInnerHTML={{ __html: post.excerpt.rendered }} />
                  <p className="date">{new Date(post.date).toLocaleDateString()}</p>
                  <a 
                    href={post.link} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="read-more"
                  >
                    Read More
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-posts">
              <p>No posts found. Your WordPress content will appear here once configured.</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="footer" id="contact">
        <div className="footer-content">
          <div className="footer-section">
            <h3>About Us</h3>
            <p>This blog provides the latest updates and information about our products and services.</p>
          </div>
          
          <div className="footer-section">
            <h3>Quick Links</h3>
            <ul>
              <li><a href="#">Home</a></li>
              <li><a href="#">About</a></li>
              <li><a href="#">Blog</a></li>
              <li><a href="#">Sitemap</a></li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h3 id="contact">Contact Us</h3>
            <p>Email: contact@${domainName}</p>
            <p>Phone: +1 (555) 123-4567</p>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="container">
            <p>&copy; {new Date().getFullYear()} ${domainName}. All rights reserved.</p>
            <div className="footer-links">
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
              <a href="#">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>

      <style jsx global>{\`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        html, body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f8f9fa;
        }
        
        a {
          color: #0070f3;
          text-decoration: none;
        }
        
        a:hover {
          text-decoration: underline;
        }
        
        ul {
          list-style: none;
        }
        
        .page-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        
        /* Header styles */
        .header {
          background-color: #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        
        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .logo h2 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #333;
          margin: 0;
        }
        
        .nav ul {
          display: flex;
          gap: 1.5rem;
        }
        
        .nav a {
          color: #555;
          font-weight: 500;
          transition: color 0.3s ease;
        }
        
        .nav a:hover, .nav a.active {
          color: #0070f3;
          text-decoration: none;
        }
        
        /* Main content styles */
        main {
          flex: 1;
          padding: 2rem 0;
        }
        
        .container {
          max-width: 800px;
          margin: 0 auto;
          padding: 0 1rem;
        }
        
        .page-title {
          margin-bottom: 2rem;
          font-size: 2.5rem;
          font-weight: 700;
          color: #333;
          text-align: center;
        }
        
        .loading, .no-posts {
          text-align: center;
          padding: 2rem 0;
          color: #666;
        }
        
        .posts {
          display: grid;
          gap: 2rem;
        }
        
        .post {
          background-color: #ffffff;
          border-radius: 8px;
          padding: 1.5rem;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .post:hover {
          transform: translateY(-5px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        
        .post h2 {
          margin-top: 0;
          font-size: 1.5rem;
          margin-bottom: 1rem;
          color: #333;
        }
        
        .post-excerpt {
          color: #555;
          margin-bottom: 1rem;
        }
        
        .date {
          color: #888;
          font-size: 0.9rem;
          margin-bottom: 1rem;
        }
        
        .read-more {
          display: inline-block;
          padding: 0.5rem 1rem;
          background-color: #0070f3;
          color: white;
          border-radius: 4px;
          font-weight: 500;
          transition: background-color 0.3s ease;
        }
        
        .read-more:hover {
          background-color: #0051b3;
          text-decoration: none;
        }
        
        /* Footer styles */
        .footer {
          background-color: #222;
          color: #f8f9fa;
          margin-top: auto;
        }
        
        .footer-content {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 2rem;
          max-width: 1200px;
          margin: 0 auto;
          padding: 3rem 1rem;
        }
        
        .footer-section h3 {
          color: #fff;
          margin-bottom: 1rem;
          font-size: 1.2rem;
        }
        
        .footer-section p {
          color: #aaa;
          margin-bottom: 0.5rem;
        }
        
        .footer-section ul {
          margin-top: 0.5rem;
        }
        
        .footer-section ul li {
          margin-bottom: 0.5rem;
        }
        
        .footer-section a {
          color: #aaa;
          transition: color 0.3s ease;
        }
        
        .footer-section a:hover {
          color: #fff;
          text-decoration: none;
        }
        
        .footer-bottom {
          background-color: #111;
          padding: 1.5rem 0;
          text-align: center;
        }
        
        .footer-bottom .container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        }
        
        .footer-bottom p {
          color: #aaa;
          font-size: 0.9rem;
          margin: 0;
        }
        
        .footer-links {
          display: flex;
          gap: 1.5rem;
        }
        
        .footer-links a {
          color: #aaa;
          font-size: 0.9rem;
          transition: color 0.3s ease;
        }
        
        .footer-links a:hover {
          color: #fff;
          text-decoration: none;
        }
        
        /* Responsive adjustments */
        @media (max-width: 768px) {
          .header-content {
            flex-direction: column;
            gap: 1rem;
            padding: 1rem;
          }
          
          .nav ul {
            gap: 1rem;
          }
          
          .footer-bottom .container {
            flex-direction: column;
          }
          
          .page-title {
            font-size: 2rem;
          }
        }
      \`}</style>
    </div>
  )
}
`,
              encoding: 'utf-8'
            },
            {
              file: 'pages/api/posts.js',
              data: `
import { getRecentPosts } from '../../lib/api'

export default async function handler(req, res) {
  try {
    const posts = await getRecentPosts()
    
    if (posts.length === 0) {
      console.log('No posts found or error connecting to WordPress API')
    }
    
    res.status(200).json(posts)
  } catch (error) {
    console.error('Error in API route:', error)
    res.status(500).json({ error: 'Failed to fetch posts', message: error.message })
  }
}
`,
              encoding: 'utf-8'
            }
          ],
          projectSettings: {
            framework: "nextjs",
            buildCommand: null,
            outputDirectory: ".next"
          },
          env: {
            WORDPRESS_API_URL: wordpressApiUrl
          }
        })
      });
      
      const deploymentData = await deploymentResponse.json();
      
      if (!deploymentResponse.ok) {
        const errorMessage = deploymentData.error?.message || 'Unknown error';
        const errorCode = deploymentData.error?.code || 'unknown_error';
        
        deployment.addLog(`Failed to create deployment (code: ${errorCode}): ${errorMessage}`, 'error');
        deployment.addLog(`API Response: ${JSON.stringify(deploymentData)}`, 'error');
        await deployment.save();
        lastError = new Error(`Vercel API error (${errorCode}): ${errorMessage}`);
      } else {
        if (!deploymentData.id) {
          deployment.addLog(`Deployment response missing ID: ${JSON.stringify(deploymentData)}`, 'error');
          await deployment.save();
          lastError = new Error('Deployment response missing ID');
        } else {
          deployment.deploymentId = deploymentData.id;
          deployment.addLog(`Template deployment initiated successfully (ID: ${deploymentData.id})`, 'info');
          await deployment.save();
          deploymentSucceeded = true;
        }
      }
    } catch (directDeployError: any) {
      deployment.addLog(`Error during direct deployment: ${directDeployError.message}`, 'error');
      await deployment.save();
      lastError = directDeployError;
    }
    
    // If all deployment methods failed, throw the last error
    if (!deploymentSucceeded) {
      throw lastError || new Error('Deployment failed');
    }
    
    // Add the domain to the project
    try {
      deployment.addLog(`Adding domain ${domainName} to Vercel project...`, 'info');
      
      // Initialize domainAdded variable
      let domainAdded = false;
      let lastError: any = null;
      const maxAttempts = 3; // Define maxAttempts here in the outer scope
      
      // First check if domain is already attached to the project
      deployment.addLog(`Checking if domain is already attached to project ${project.id}...`, 'info');
      try {
        const domains = await getProjectDomains(project.id);
        const hasDomain = domains.some((d: any) => d.name.toLowerCase() === domainName.toLowerCase());
        
        if (hasDomain) {
          deployment.addLog(`Domain ${domainName} is already attached to project ${project.id}`, 'info');
          domainAdded = true;
        }
      } catch (domainCheckError: any) {
        deployment.addLog(`Error checking domains: ${domainCheckError.message}`, 'warning');
        // Continue with normal domain addition process if check fails
      }
      
      // Only try to add the domain if it's not already attached
      if (!domainAdded) {
        deployment.addLog(`Domain not attached yet, attempting to add domain...`, 'info');
        // Add rate limiting to prevent too many requests
        let attemptCount = 0;
        
        while (attemptCount < maxAttempts && !domainAdded) {
          attemptCount++;
          
          deployment.addLog(`Domain addition attempt #${attemptCount}/${maxAttempts}`, 'info');
          
          try {
            const domainResult = await addDomainToVercel(domainName, project.id);
            
            if (domainResult.success) {
              deployment.addLog(`Domain ${domainName} added successfully on attempt #${attemptCount}`, 'info');
              domainAdded = true;
              break; // Exit the loop immediately on success
            } else {
              // Check if domain is already in use by this project (which is actually a success case)
              if (domainResult.alreadyConfigured && domainResult.vercelDomain) {
                deployment.addLog(`Domain ${domainName} is already configured for this project`, 'info');
                domainAdded = true;
                break; // Exit the loop immediately
              }
              
              lastError = domainResult.error || domainResult.message || 'Unknown error';
              deployment.addLog(`Failed to add domain on attempt #${attemptCount}: ${JSON.stringify(lastError)}`, 'warning');
              
              // If the error indicates the domain is already attached to this project, count as success
              if (typeof lastError === 'object' && lastError.code === 'domain_already_in_use' && 
                  lastError.projectId === project.id) {
                deployment.addLog(`Domain is already in use by this project, treating as success`, 'info');
                domainAdded = true;
                break;
              }
              
              // If we have more attempts to make, wait before trying again
              if (attemptCount < maxAttempts) {
                const delaySeconds = 3 * attemptCount; // Increasing delay between attempts
                deployment.addLog(`Waiting ${delaySeconds} seconds before retry...`, 'info');
                await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
              }
            }
          } catch (attemptError: any) {
            lastError = attemptError.message || 'Unknown error';
            deployment.addLog(`Error during domain addition attempt #${attemptCount}: ${lastError}`, 'error');
            
            // Check if error indicates the domain is already added
            if (lastError.includes('already in use') || lastError.includes('already configured')) {
              deployment.addLog('Error indicates domain is already added to a project, treating as success', 'info');
              domainAdded = true;
              break; // Exit the loop immediately
            }
            
            // If we have more attempts to make, wait before trying again
            if (attemptCount < maxAttempts) {
              const delaySeconds = 3 * attemptCount;
              deployment.addLog(`Waiting ${delaySeconds} seconds before retry...`, 'info');
              await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
            }
          }
        }
      }
      
      // Regardless of whether domain addition succeeded, proceed with deploying the site
      // Note: domainAdded will be true if:
      // 1. Domain was already attached
      // 2. Domain was successfully attached during this process
      // 3. Domain attachment error indicates it's already in use by this project
      deployment.status = 'deployed';
      deployment.completedAt = new Date();
      
      // Use appropriate log message based on domain status
      if (domainAdded) {
        deployment.addLog(`Deployment triggered successfully with domain ${domainName}. Vercel will now build and deploy your site.`, 'info');
      } else {
        deployment.addLog(`Deployment triggered, but there were issues with domain attachment. The WordPress site should still work, but you may need to manually configure the domain in Vercel.`, 'warning');
      }
      
      await deployment.save();
      
      // Update the domain record
      const domain = await Domain.findById(domainId);
      if (domain) {
        domain.deploymentStatus = 'deployed';
        domain.lastDeployedAt = new Date();
        domain.deploymentUrl = `https://${domainName}`;
        domain.vercelProjectId = project.id;
        await domain.save();
      }
    } catch (domainError: any) {
      deployment.addLog(`Error in domain addition process: ${domainError.message}`, 'error');
      
      // Even if domain addition fails completely, mark the deployment as complete
      // since the project and deployment were created successfully
      deployment.status = 'deployed';
      deployment.completedAt = new Date();
      deployment.addLog(`Deployment completed with domain issues. You may need to manually add the domain in Vercel.`, 'warning');
      await deployment.save();
      
      // Update the domain record
      const domain = await Domain.findById(domainId);
      if (domain) {
        domain.deploymentStatus = 'deployed';
        domain.lastDeployedAt = new Date();
        domain.deploymentUrl = `https://${domainName}`;
        domain.vercelProjectId = project.id;
        await domain.save();
      }
    }
    
  } catch (error: any) {
    console.error(`Error in WordPress template deployment for ${domainName}:`, error);
    
    // Try to update the deployment record if something went wrong
    try {
      const deployment = await DomainDeployment.findById(deploymentId);
      if (deployment) {
        deployment.addLog(`Deployment failed: ${error.message}`, 'error');
        deployment.status = 'failed';
        deployment.completedAt = new Date();
        await deployment.save();
      }
      
      // Update domain status
      const domain = await Domain.findById(domainId);
      if (domain) {
        domain.deploymentStatus = 'failed';
        await domain.save();
      }
    } catch (updateError) {
      console.error('Error updating records after failure:', updateError);
    }
  }
} 