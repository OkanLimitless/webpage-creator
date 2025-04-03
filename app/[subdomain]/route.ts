import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { LandingPage } from '@/lib/models/LandingPage';
import { Domain } from '@/lib/models/Domain';
import { generateLandingPageHtml } from '@/lib/landingPageGenerator';

interface Params {
  params: {
    subdomain: string;
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    
    // Get the host from the request
    const host = request.headers.get('host') || '';
    
    // Extract domain and subdomain
    const hostParts = host.split('.');
    let subdomain, domain;
    
    if (hostParts.length >= 2) {
      subdomain = hostParts[0];
      domain = hostParts.slice(1).join('.');
    } else {
      // If we can't parse the host, use the params
      subdomain = params.subdomain;
      // We would need to determine the domain from context in a real app
      domain = 'example.com';
    }
    
    // Find the domain in our database
    const domainDoc = await Domain.findOne({ name: domain });
    
    if (!domainDoc) {
      return new NextResponse('Domain not found', { status: 404 });
    }
    
    // Find the landing page
    const landingPage = await LandingPage.findOne({
      domainId: domainDoc._id,
      subdomain: subdomain,
    });
    
    if (!landingPage) {
      return new NextResponse('Landing page not found', { status: 404 });
    }
    
    // Generate the HTML
    const html = generateLandingPageHtml(landingPage);
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Error serving landing page:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 