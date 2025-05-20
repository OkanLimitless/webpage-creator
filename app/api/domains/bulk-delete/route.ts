import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Domain } from '@/lib/models/Domain';
import { LandingPage } from '@/lib/models/LandingPage';
import { deleteDomainFromVercel } from '@/lib/vercel';

// Mark this route as dynamic to prevent static optimization issues
export const dynamic = 'force-dynamic';

// Set a longer timeout for bulk operations
export const maxDuration = 60;

// Helper function to delete a Cloudflare zone
async function deleteCloudflareZone(zoneId: string): Promise<{ success: boolean, error?: string }> {
  try {
    // Get Cloudflare credentials
    const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
    
    if (!CLOUDFLARE_API_TOKEN) {
      console.warn('Missing Cloudflare API token, skipping Cloudflare zone deletion');
      return { success: false, error: 'Missing Cloudflare API token' };
    }
    
    // Delete the zone via Cloudflare API
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });
    
    const result = await response.json();
    
    if (!result.success) {
      console.error('Failed to delete Cloudflare zone:', result.errors);
      return { success: false, error: result.errors?.[0]?.message || 'Failed to delete zone' };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting Cloudflare zone:', error);
    return { success: false, error: (error as Error).message };
  }
}

// POST /api/domains/bulk-delete - Delete multiple domains
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { ids } = body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Domain IDs are required and must be an array' },
        { status: 400 }
      );
    }
    
    // Limit bulk operations to avoid overloading
    const MAX_ITEMS = 50;
    if (ids.length > MAX_ITEMS) {
      return NextResponse.json(
        { error: `Too many items. Maximum of ${MAX_ITEMS} items can be processed at once.` },
        { status: 400 }
      );
    }
    
    // Results tracking
    const results = {
      success: [] as string[],
      failed: [] as { id: string, reason: string }[]
    };
    
    // Process each domain sequentially
    for (const id of ids) {
      try {
        // Find the domain
        const domain = await Domain.findById(id);
        if (!domain) {
          results.failed.push({
            id,
            reason: 'Domain not found'
          });
          continue;
        }
        
        // Check if there are any landing pages using this domain
        const landingPagesCount = await LandingPage.countDocuments({ domainId: id });
        
        if (landingPagesCount > 0) {
          results.failed.push({
            id,
            reason: `Domain has ${landingPagesCount} landing page(s). Delete them first.`
          });
          continue;
        }
        
        // Track deletion operations and their results
        const deletionResults = {
          cloudflareDeleted: false,
          vercelDomainDeleted: false,
          domainDeleted: false,
        };
        
        // Delete domain from Vercel
        try {
          console.log(`Removing domain ${domain.name} from Vercel`);
          const vercelResult = await deleteDomainFromVercel(domain.name);
          
          if (vercelResult.success) {
            console.log(`Successfully removed domain ${domain.name} from Vercel`);
            deletionResults.vercelDomainDeleted = true;
          } else {
            console.warn(`Warning: Failed to remove domain from Vercel: ${JSON.stringify(vercelResult.error || vercelResult.message)}`);
          }
        } catch (vercelError) {
          console.error('Error removing domain from Vercel:', vercelError);
          // Continue with deletion even if Vercel deletion fails
        }
        
        // Delete domain from Cloudflare
        try {
          if (domain.cloudflareZoneId) {
            console.log(`Removing domain ${domain.name} from Cloudflare with zone ID ${domain.cloudflareZoneId}`);
            const cloudflareResult = await deleteCloudflareZone(domain.cloudflareZoneId);
            
            if (cloudflareResult.success) {
              console.log(`Successfully removed domain ${domain.name} from Cloudflare`);
              deletionResults.cloudflareDeleted = true;
            } else {
              console.warn(`Warning: Failed to remove domain from Cloudflare: ${cloudflareResult.error}`);
            }
          } else {
            console.warn(`Domain ${domain.name} has no Cloudflare zone ID, skipping Cloudflare deletion`);
          }
        } catch (cloudflareError) {
          console.error('Error removing domain from Cloudflare:', cloudflareError);
          // Continue with deletion even if Cloudflare deletion fails
        }
        
        // Delete the domain from database
        try {
          await Domain.findByIdAndDelete(id);
          deletionResults.domainDeleted = true;
          console.log(`Domain ${id} deleted successfully`);
          
          // Add to success list
          results.success.push(id);
        } catch (dbError) {
          console.error('Error deleting domain from database:', dbError);
          results.failed.push({
            id,
            reason: `Database error: ${(dbError as Error).message || 'Unknown error'}`
          });
        }
      } catch (error) {
        console.error(`Error processing domain ${id}:`, error);
        results.failed.push({
          id,
          reason: (error as Error).message || 'Unknown error'
        });
      }
    }
    
    // Return results
    return NextResponse.json({
      results,
      message: `Processed ${ids.length} domains. ${results.success.length} succeeded, ${results.failed.length} failed.`
    });
    
  } catch (error) {
    console.error('Error bulk deleting domains:', error);
    return NextResponse.json(
      { error: 'Failed to process bulk delete', message: (error as Error).message },
      { status: 500 }
    );
  }
} 