import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { DomainDeployment } from '@/lib/models/DomainDeployment';
import { createVercelProject, addDomainToVercel } from '@/lib/vercel';
import fetch from 'node-fetch';

// Mark this route as dynamic to prevent static optimization
export const dynamic = 'force-dynamic';

// POST /api/deployments/vercel-template
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { domainId, wordpressApiUrl = 'https://nowshipping.store/wp-json' } = body;
    
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
    
    // Create the Vercel project with timeout protection
    let project: any = null;
    try {
      // Race between the project creation and a 60-second timeout
      project = await Promise.race([
        createVercelProject(domainName, 'nextjs'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Project creation timed out after 60s')), 60000))
      ]);
      
      if (!project || !project.id) {
        throw new Error('Failed to create Vercel project');
      }
      
      deployment.vercelProjectId = project.id;
      deployment.addLog(`Vercel project created successfully (ID: ${project.id})`, 'info');
      await deployment.save();
    } catch (projectError: any) {
      deployment.addLog(`Error creating Vercel project: ${projectError.message}`, 'error');
      await deployment.save();
      throw projectError;
    }
    
    // 2. Deploy the WordPress ISR blog template through Vercel API
    deployment.addLog(`Deploying NextJS WordPress ISR blog template...`, 'info');
    await deployment.save();
    
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    if (!VERCEL_TOKEN) {
      throw new Error('Vercel API token not set');
    }
    
    // First, let's import the WordPress ISR blog template from GitHub
    deployment.addLog(`Importing WordPress ISR blog template from GitHub...`, 'info');
    await deployment.save();
    
    // Flag to track if any method succeeded
    let deploymentSucceeded = false;
    let lastError = null;
    
    // First try the GitHub import
    try {
      // Construct the import API URL for Vercel
      let importUrl = `https://api.vercel.com/v1/integrations/github/repos/vercel/next.js/imports`;
      if (VERCEL_TEAM_ID) {
        importUrl += `?teamId=${VERCEL_TEAM_ID}`;
      }
      
      // Make the import request to fetch the ISR blog example
      const importResponse = await fetch(importUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: domainName,
          project: project.id,
          skipInitialBuild: false,
          subfolder: 'examples/cms-wordpress', // Path to WordPress example in Next.js repo
          ref: 'canary', // Use the canary branch which contains the latest examples
          environmentVariables: {
            WORDPRESS_API_URL: wordpressApiUrl
          }
        })
      });
      
      const importData = await importResponse.json();
      
      if (!importResponse.ok) {
        const errorMessage = importData.error?.message || 'Unknown error';
        const errorCode = importData.error?.code || 'unknown_error';
        
        deployment.addLog(`GitHub import failed (code: ${errorCode}): ${errorMessage}`, 'warning');
        deployment.addLog(`Will try direct deployment method next.`, 'info');
        lastError = new Error(`GitHub import error (${errorCode}): ${errorMessage}`);
      } else {
        deployment.addLog(`WordPress template imported successfully`, 'info');
        deploymentSucceeded = true;
        // Set the deployment ID if available in the response
        if (importData.id) {
          deployment.deploymentId = importData.id;
        }
      }
    } catch (importError: any) {
      deployment.addLog(`Error during GitHub import: ${importError.message}`, 'warning');
      deployment.addLog(`Will try direct deployment method next.`, 'info');
      lastError = importError;
    }
    
    // If GitHub import failed, try direct deployment
    if (!deploymentSucceeded) {
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
    <div className="container">
      <Head>
        <title>${domainName} - WordPress Blog</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <h1>
          Welcome to ${domainName}
        </h1>
        
        {loading ? (
          <p>Loading posts...</p>
        ) : posts.length > 0 ? (
          <div className="posts">
            {posts.map(post => (
              <div key={post.id} className="post">
                <h2 dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
                <div dangerouslySetInnerHTML={{ __html: post.excerpt.rendered }} />
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
          <p>No posts found. Your WordPress content will appear here once configured.</p>
        )}
      </main>

      <style jsx>{\`
        .container {
          min-height: 100vh;
          padding: 0 0.5rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
        main {
          padding: 5rem 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          width: 100%;
          max-width: 800px;
        }
        h1 {
          margin: 0 0 2rem;
          line-height: 1.15;
          font-size: 3rem;
          text-align: center;
        }
        .posts {
          width: 100%;
        }
        .post {
          margin-bottom: 2rem;
          padding: 1.5rem;
          border: 1px solid #eaeaea;
          border-radius: 10px;
        }
        .post h2 {
          margin-top: 0;
        }
        .date {
          color: #666;
          font-size: 0.9rem;
        }
        .read-more {
          display: inline-block;
          margin-top: 1rem;
          color: #0070f3;
          text-decoration: none;
        }
        .read-more:hover {
          text-decoration: underline;
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
    }
    
    // If all deployment methods failed, throw the last error
    if (!deploymentSucceeded) {
      throw lastError || new Error('All deployment methods failed');
    }
    
    // Add the domain to the project
    const domainResult = await addDomainToVercel(domainName, project.id);
    if (!domainResult.success) {
      deployment.addLog(`Warning: Failed to add domain to project: ${JSON.stringify(domainResult.error)}`, 'warning');
    } else {
      deployment.addLog(`Domain ${domainName} added to project`, 'info');
    }
    
    // Update deployment record
    deployment.status = 'deployed';
    deployment.completedAt = new Date();
    deployment.addLog(`Deployment triggered successfully. Vercel will now build and deploy your site.`, 'info');
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