import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { LandingPage } from '@/lib/models/LandingPage';

export async function GET() {
  try {
    await connectToDatabase();
    
    // Find all cloaked landing pages with worker scripts
    const landingPages = await LandingPage.find({
      templateType: 'cloaked',
      workerScriptName: { $exists: true, $ne: null }
    })
    .populate('domainId', 'name')
    .select('name domainId subdomain workerScriptName workerRouteId moneyUrl targetCountries createdAt')
    .sort({ createdAt: -1 });
    
    return NextResponse.json({
      success: true,
      landingPages: landingPages.map(lp => ({
        _id: lp._id,
        name: lp.name,
        domain: (lp.domainId as any).name,
        subdomain: lp.subdomain,
        fullDomain: lp.subdomain ? `${lp.subdomain}.${(lp.domainId as any).name}` : (lp.domainId as any).name,
        workerScriptName: lp.workerScriptName,
        workerRouteId: lp.workerRouteId,
        moneyUrl: lp.moneyUrl,
        targetCountries: lp.targetCountries,
        createdAt: lp.createdAt
      }))
    });
    
  } catch (error) {
    console.error('Error fetching landing pages with workers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch landing pages with workers' }, 
      { status: 500 }
    );
  }
} 