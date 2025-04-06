import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { addDomainToVercel } from '@/lib/vercel';

interface Params {
  params: {
    id: string;
  };
}

// Helper function to set PRIMARY_DOMAIN in Vercel
async function setPrimaryDomain(domain: string) {
  try {
    const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
    const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
    const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
    
    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
      throw new Error('VERCEL_TOKEN and VERCEL_PROJECT_ID must be set');
    }
    
    // Check if env var already exists
    let url = `https://api.vercel.com/v8/projects/${VERCEL_PROJECT_ID}/env`;
    if (VERCEL_TEAM_ID) {
      url += `?teamId=${VERCEL_TEAM_ID}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Failed to get environment variables: ${JSON.stringify(data)}`);
    }
    
    // Find if PRIMARY_DOMAIN already exists
    const primaryDomainEnv = data.envs.find((env: any) => env.key === 'PRIMARY_DOMAIN');
    
    // If it exists, update it. Otherwise, create it.
    if (primaryDomainEnv) {
      const updateUrl = `https://api.vercel.com/v8/projects/${VERCEL_PROJECT_ID}/env/${primaryDomainEnv.id}`;
      const updateQueryParams = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
      
      const updateResponse = await fetch(`${updateUrl}${updateQueryParams}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          value: domain,
          target: ['production', 'preview', 'development']
        })
      });
      
      const updateData = await updateResponse.json();
      
      if (!updateResponse.ok) {
        throw new Error(`Failed to update PRIMARY_DOMAIN: ${JSON.stringify(updateData)}`);
      }
      
      return {
        action: 'updated',
        previousValue: primaryDomainEnv.value,
        newValue: domain
      };
    } else {
      let createUrl = `https://api.vercel.com/v8/projects/${VERCEL_PROJECT_ID}/env`;
      if (VERCEL_TEAM_ID) {
        createUrl += `?teamId=${VERCEL_TEAM_ID}`;
      }
      
      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: 'PRIMARY_DOMAIN',
          value: domain,
          target: ['production', 'preview', 'development'],
          type: 'plain'
        })
      });
      
      const createData = await createResponse.json();
      
      if (!createResponse.ok) {
        throw new Error(`Failed to create PRIMARY_DOMAIN: ${JSON.stringify(createData)}`);
      }
      
      return {
        action: 'created',
        value: domain
      };
    }
  } catch (error) {
    throw error;
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    // Find the domain
    const domain = await Domain.findById(params.id);
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }
    
    // Results object
    const results: any = {
      domain: domain.name,
      actions: [],
      remainingIssues: [],
      nextSteps: [],
      success: false
    };
    
    // Fix 1: Update Cloudflare Zone ID if not set
    if (!domain.cloudflareZoneId) {
      try {
        const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
        if (!CF_API_TOKEN) {
          results.actions.push({
            description: 'Attempted to set Cloudflare Zone ID',
            success: false,
            error: 'Cloudflare API token not configured'
          });
          results.remainingIssues.push('Cloudflare API token not configured');
          results.nextSteps.push('Set CLOUDFLARE_API_TOKEN environment variable');
        } else {
          // Search for zone by domain name
          const zonesResponse = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${domain.name}`, {
            headers: {
              'Authorization': `Bearer ${CF_API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          });
          
          const zonesData = await zonesResponse.json();
          
          if (zonesData.success && zonesData.result.length > 0) {
            const zoneId = zonesData.result[0].id;
            domain.cloudflareZoneId = zoneId;
            await domain.save();
            
            results.actions.push({
              description: `Updated Cloudflare Zone ID to: ${zoneId}`,
              success: true
            });
          } else {
            results.actions.push({
              description: 'Attempted to find Cloudflare Zone ID',
              success: false,
              error: 'Zone not found in Cloudflare'
            });
            results.remainingIssues.push('Domain not found in Cloudflare');
            results.nextSteps.push('Add domain to Cloudflare first');
          }
        }
      } catch (error: any) {
        results.actions.push({
          description: 'Attempted to update Cloudflare Zone ID',
          success: false,
          error: error.message
        });
      }
    }
    
    // Fix 2: Make sure domain is active
    if (!domain.isActive) {
      domain.isActive = true;
      await domain.save();
      
      results.actions.push({
        description: 'Activated domain',
        success: true
      });
    }
    
    // Fix 3: Add domain to Vercel if not already added
    try {
      const vercelResult = await addDomainToVercel(domain.name);
      
      results.actions.push({
        description: 'Added domain to Vercel',
        success: true,
        details: vercelResult.domainName ? 'Domain added successfully' : 'Domain already exists in Vercel'
      });
      
      // Add DNS configuration instructions if not already configured
      if (!vercelResult.vercelDomain?.verified) {
        results.nextSteps.push(`Add these DNS records to verify the domain in Vercel:`);
        
        // Add specific instructions based on the records from Vercel
        if (vercelResult.configurationDnsRecords && vercelResult.configurationDnsRecords.length > 0) {
          vercelResult.configurationDnsRecords.forEach((record: any) => {
            results.nextSteps.push(`- ${record.type} record: Name=${record.name || '@'}, Value=${record.value}`);
          });
        } else {
          results.nextSteps.push(`- A record for @ pointing to 76.76.21.21`);
          results.nextSteps.push(`- Or CNAME record for @ pointing to cname.vercel-dns.com`);
        }
      }
    } catch (error: any) {
      results.actions.push({
        description: 'Attempted to add domain to Vercel',
        success: false,
        error: error.message
      });
      results.remainingIssues.push('Failed to add domain to Vercel');
    }
    
    // Fix 4: Create DNS records in Cloudflare if zone ID exists
    if (domain.cloudflareZoneId) {
      try {
        const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
        
        if (CF_API_TOKEN) {
          // First check existing records
          const dnsResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.cloudflareZoneId}/dns_records`, {
            headers: {
              'Authorization': `Bearer ${CF_API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          });
          
          const dnsData = await dnsResponse.json();
          
          if (dnsData.success) {
            // Check if we already have an A record for the root domain (@)
            const rootRecords = dnsData.result.filter((r: any) => 
              (r.name === domain.name || r.name === '@') && 
              (r.type === 'A' || r.type === 'CNAME')
            );
            
            if (rootRecords.length === 0) {
              // Create A record for root domain
              const aRecordResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.cloudflareZoneId}/dns_records`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${CF_API_TOKEN}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  type: 'A',
                  name: '@',
                  content: '76.76.21.21',
                  ttl: 1,
                  proxied: false
                })
              });
              
              const aRecordData = await aRecordResponse.json();
              
              if (aRecordData.success) {
                results.actions.push({
                  description: 'Created A record for root domain pointing to Vercel',
                  success: true
                });
              } else {
                results.actions.push({
                  description: 'Attempted to create A record',
                  success: false,
                  error: aRecordData.errors ? aRecordData.errors[0].message : 'Unknown error'
                });
              }
            } else {
              const vercelRecord = rootRecords.find((r: any) => 
                r.content === '76.76.21.21' || r.content === 'cname.vercel-dns.com'
              );
              
              if (!vercelRecord) {
                results.nextSteps.push('Update existing DNS record to point to Vercel:');
                results.nextSteps.push('- A record: 76.76.21.21');
                results.nextSteps.push('- Or CNAME record: cname.vercel-dns.com');
              } else {
                results.actions.push({
                  description: 'Root domain already has Vercel DNS record',
                  success: true
                });
              }
            }
            
            // Check if SSL is set to Flexible or Full
            const zoneResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.cloudflareZoneId}`, {
              headers: {
                'Authorization': `Bearer ${CF_API_TOKEN}`,
                'Content-Type': 'application/json'
              }
            });
            
            const zoneData = await zoneResponse.json();
            
            if (zoneData.success && zoneData.result.ssl?.mode === 'full_strict') {
              results.nextSteps.push('Consider changing Cloudflare SSL mode from "Full (strict)" to "Full" or "Flexible" for better compatibility with Vercel');
            } else if (zoneData.success && !zoneData.result.ssl?.mode) {
              results.nextSteps.push('Consider enabling Cloudflare SSL and setting it to "Flexible" for better compatibility with Vercel');
            }
          } else {
            results.actions.push({
              description: 'Attempted to check DNS records',
              success: false,
              error: 'Could not get DNS records from Cloudflare'
            });
          }
        }
      } catch (error: any) {
        results.actions.push({
          description: 'Attempted to configure DNS',
          success: false,
          error: error.message
        });
      }
    }
    
    // Fix 5: Set PRIMARY_DOMAIN environment variable in Vercel
    try {
      const primaryDomainResult = await setPrimaryDomain(domain.name);
      
      results.actions.push({
        description: 'Set PRIMARY_DOMAIN environment variable in Vercel',
        success: true,
        details: primaryDomainResult.action === 'updated' 
          ? `Updated from ${primaryDomainResult.previousValue} to ${primaryDomainResult.newValue}` 
          : `Created with value ${primaryDomainResult.value}`
      });
      
      results.nextSteps.push('Deploy your application to apply the PRIMARY_DOMAIN environment variable change');
      
    } catch (error: any) {
      results.actions.push({
        description: 'Attempted to set PRIMARY_DOMAIN environment variable',
        success: false,
        error: error.message
      });
      results.remainingIssues.push('Failed to set PRIMARY_DOMAIN environment variable');
      results.nextSteps.push('Make sure VERCEL_TOKEN and VERCEL_PROJECT_ID are set correctly');
    }
    
    // Determine overall success
    results.success = results.actions.some((a: any) => a.success) && results.remainingIssues.length === 0;
    
    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Error fixing domain:', error);
    return NextResponse.json(
      { error: `Error fixing domain: ${error.message}` },
      { status: 500 }
    );
  }
} 