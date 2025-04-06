#!/usr/bin/env node
require('dotenv').config();
const fetch = require('node-fetch');

async function cleanupDuplicateProjects() {
  try {
    // Parse command line arguments
    const checkOnly = process.argv.includes('--check-only');
    
    console.log('Cleanup Duplicate Projects Tool');
    console.log('===========================');
    console.log(`Mode: ${checkOnly ? 'Analysis only (no changes will be made)' : 'Full cleanup'}`);
    
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
    
    if (!VERCEL_TOKEN) {
      console.error('Error: Vercel token not set in environment variables');
      return;
    }
    
    if (VERCEL_PROJECT_ID) {
      console.log(`Main project ID: ${VERCEL_PROJECT_ID} (Note: Domains should NOT be moved to this project)`);
    }
    
    // Get all projects
    let projectsUrl = 'https://api.vercel.com/v9/projects';
    if (VERCEL_TEAM_ID) {
      projectsUrl += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    const projectsResponse = await fetch(projectsUrl, {
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const projectsData = await projectsResponse.json();
    
    if (!projectsResponse.ok) {
      console.error('Error fetching projects:', projectsData);
      return;
    }
    
    const projects = projectsData.projects || [];
    console.log(`Found ${projects.length} projects`);
    
    // Find all domain-* projects
    const domainProjects = projects.filter(p => 
      p.name.startsWith('domain-')
    );
    
    console.log(`\nFound ${domainProjects.length} domain-specific projects to analyze`);
    
    // Array to collect projects that will be affected by cleanup
    const projectsToClean = [];
    
    // Find empty domain projects (no domains attached)
    const emptyProjects = [];
    
    // Process the projects
    for (const project of domainProjects) {
      console.log(`\nAnalyzing project: ${project.name} (${project.id})`);
      
      // Skip main project
      if (project.id === VERCEL_PROJECT_ID) {
        console.log(`Skipping main project ${VERCEL_PROJECT_ID}`);
        continue;
      }
      
      // Get domains for this project
      let projDomainsUrl = `https://api.vercel.com/v9/projects/${project.id}/domains`;
      if (VERCEL_TEAM_ID) {
        projDomainsUrl += `?teamId=${VERCEL_TEAM_ID}`;
      }
      
      const projDomainsResponse = await fetch(projDomainsUrl, {
        headers: {
          'Authorization': `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      const projDomainsData = await projDomainsResponse.json();
      
      if (!projDomainsResponse.ok) {
        console.error(`Error fetching domains for project ${project.id}:`, projDomainsData);
        continue;
      }
      
      const projectDomains = projDomainsData.domains || [];
      console.log(`Project has ${projectDomains.length} domains:`);
      
      // Add this project to the list of projects that would be affected
      projectsToClean.push({
        id: project.id,
        name: project.name,
        domains: projectDomains.map(d => ({
          name: d.name,
          verified: d.verified
        }))
      });
      
      // If project has no domains, mark it for cleanup
      if (projectDomains.length === 0) {
        emptyProjects.push(project);
        console.log('No domains found. This project can be safely deleted.');
      } else {
        projectDomains.forEach(d => {
          console.log(`- ${d.name} (${d.verified ? 'verified' : 'unverified'})`);
        });
        
        // Extract the domain name from the project name (domain-example-com => example.com)
        const domainFromName = project.name.replace('domain-', '').replace(/-/g, '.');
        
        // Check if this project has its expected domain
        const hasExpectedDomain = projectDomains.some(d => d.name === domainFromName);
        if (!hasExpectedDomain) {
          console.log(`WARNING: This project doesn't have its expected domain (${domainFromName})`);
        } else {
          console.log(`✓ Project correctly has its domain (${domainFromName})`);
        }
      }
      
      // If we're in check-only mode, just continue to the next project
      if (checkOnly) {
        continue;
      }
      
      // If we're here, we're in full cleanup mode
      
      // Only delete empty projects (with no domains)
      if (projectDomains.length === 0) {
        console.log(`Deleting empty project ${project.name} (${project.id})...`);
        await deleteProject(project.id);
      } else {
        console.log(`Leaving project ${project.name} intact as it has active domains`);
      }
    }
    
    // Output the projects to clean in a special format that can be parsed by the UI
    console.log('PROJECTS_TO_CLEAN_JSON:' + JSON.stringify(projectsToClean));
    
    // Summary of empty projects
    if (emptyProjects.length > 0) {
      console.log(`\nFound ${emptyProjects.length} empty domain projects that can be safely deleted:`);
      emptyProjects.forEach(p => console.log(`- ${p.name} (${p.id})`));
    } else {
      console.log(`\nNo empty domain projects found to clean up`);
    }
    
    console.log('\nProject ' + (checkOnly ? 'analysis' : 'cleanup') + ' completed!');
  } catch (error) {
    console.error('Error during project cleanup:', error);
  }
}

async function addDomainToProject(projectId, domainName) {
  try {
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    let apiUrl = `https://api.vercel.com/v9/projects/${projectId}/domains`;
    if (VERCEL_TEAM_ID) {
      apiUrl += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: domainName })
    });
    
    const data = await response.json();
    
    if (!response.ok && data.error?.code !== 'domain_already_exists') {
      console.error(`Failed to add domain ${domainName} to project ${projectId}:`, data);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`Error adding domain ${domainName} to project ${projectId}:`, error);
    return false;
  }
}

async function removeDomainFromProject(projectId, domainName) {
  try {
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    let apiUrl = `https://api.vercel.com/v9/projects/${projectId}/domains/${domainName}`;
    if (VERCEL_TEAM_ID) {
      apiUrl += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok && response.status !== 204) {
      const data = await response.json();
      console.error(`Failed to remove domain ${domainName} from project ${projectId}:`, data);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`Error removing domain ${domainName} from project ${projectId}:`, error);
    return false;
  }
}

async function deleteProject(projectId) {
  try {
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    let apiUrl = `https://api.vercel.com/v9/projects/${projectId}`;
    if (VERCEL_TEAM_ID) {
      apiUrl += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok && response.status !== 204) {
      const data = await response.json();
      console.error(`Failed to delete project ${projectId}:`, data);
      return false;
    }
    
    console.log(`Project ${projectId} deleted successfully`);
    return true;
  } catch (error) {
    console.error(`Error deleting project ${projectId}:`, error);
    return false;
  }
}

// Run the script
cleanupDuplicateProjects().catch(console.error); 