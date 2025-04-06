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
    
    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
      console.error('Error: Vercel token or project ID not set in environment variables');
      return;
    }
    
    console.log(`Main project ID: ${VERCEL_PROJECT_ID}`);
    
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
    
    // Get the main project details
    const mainProject = projects.find(p => p.id === VERCEL_PROJECT_ID);
    if (!mainProject) {
      console.error(`Main project with ID ${VERCEL_PROJECT_ID} not found!`);
      return;
    }
    console.log(`Main project: ${mainProject.name} (${mainProject.id})`);
    
    // Get domains for main project
    let domainsUrl = `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/domains`;
    if (VERCEL_TEAM_ID) {
      domainsUrl += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    const domainsResponse = await fetch(domainsUrl, {
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const domainsData = await domainsResponse.json();
    
    if (!domainsResponse.ok) {
      console.error('Error fetching domains for main project:', domainsData);
      return;
    }
    
    const mainDomains = domainsData.domains || [];
    console.log(`Main project has ${mainDomains.length} domains attached`);
    mainDomains.forEach(d => console.log(`- ${d.name}`));
    
    // Find all domain-* projects that might be duplicates
    const domainProjects = projects.filter(p => 
      p.id !== VERCEL_PROJECT_ID && 
      p.name.startsWith('domain-')
    );
    
    console.log(`\nFound ${domainProjects.length} domain-specific projects to analyze`);
    
    // Array to collect projects that will be affected by cleanup
    const projectsToClean = [];
    
    // Process the projects
    for (const project of domainProjects) {
      console.log(`\nAnalyzing project: ${project.name} (${project.id})`);
      
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
      
      // If we're in check-only mode, just list the domains but don't make changes
      if (checkOnly) {
        if (projectDomains.length === 0) {
          console.log('No domains found. This project would be deleted during actual cleanup.');
        } else {
          projectDomains.forEach(d => {
            console.log(`- ${d.name} (${d.verified ? 'verified' : 'unverified'})`);
          });
          console.log('These domains would be transferred to the main project during actual cleanup.');
        }
        continue;
      }
      
      // If we're here, we're in full cleanup mode
      if (projectDomains.length === 0) {
        console.log('No domains found. This project can be safely deleted.');
        await deleteProject(project.id);
        continue;
      }
      
      // Process each domain in this project
      for (const domain of projectDomains) {
        console.log(`- Domain: ${domain.name}`);
        
        // Check if this domain is already in the main project
        const domainInMainProject = mainDomains.some(d => d.name === domain.name);
        
        if (domainInMainProject) {
          console.log(`  Domain ${domain.name} is already in main project. Removing from this project...`);
          await removeDomainFromProject(project.id, domain.name);
        } else {
          console.log(`  Adding domain ${domain.name} to main project...`);
          await addDomainToProject(VERCEL_PROJECT_ID, domain.name);
          console.log(`  Removing domain ${domain.name} from this project...`);
          await removeDomainFromProject(project.id, domain.name);
        }
      }
      
      // After moving all domains, delete the project
      console.log(`Deleting now-empty project ${project.name} (${project.id})...`);
      await deleteProject(project.id);
    }
    
    // Output the projects to clean in a special format that can be parsed by the UI
    console.log('PROJECTS_TO_CLEAN_JSON:' + JSON.stringify(projectsToClean));
    
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