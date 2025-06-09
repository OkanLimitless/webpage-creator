import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { LandingPage } from '@/lib/models/LandingPage';
import { Domain } from '@/lib/models/Domain';
import { PhoneNumber } from '@/lib/models/PhoneNumber';
import { generateBusinessName } from '@/lib/utils/businessNameGenerator';

// POST /api/landing-pages/bulk-create-call-ads
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { 
      name, 
      domainIds, 
      industry, // 'travel' or 'pest-control'
      subdomain 
    } = body;
    
    if (!name || !domainIds || !Array.isArray(domainIds) || domainIds.length === 0) {
      return NextResponse.json(
        { error: 'Name and domain IDs are required' },
        { status: 400 }
      );
    }
    
    if (!industry || !['travel', 'pest-control'].includes(industry)) {
      return NextResponse.json(
        { error: 'Valid industry is required (travel or pest-control)' },
        { status: 400 }
      );
    }
    
    // Get available phone numbers for the industry
    const availablePhoneNumbers = await PhoneNumber.find({ 
      industry, 
      isActive: true 
    });
    
    if (availablePhoneNumbers.length === 0) {
      return NextResponse.json(
        { error: `No phone numbers available for ${industry} industry. Please add some phone numbers first.` },
        { status: 400 }
      );
    }
    
    // Verify all domains exist and are eligible
    const domains = await Domain.find({ 
      _id: { $in: domainIds },
      $or: [
        { verificationStatus: 'active' },
        { verificationStatus: 'verified', dnsManagement: 'external' }
      ]
    });
    
    if (domains.length !== domainIds.length) {
      return NextResponse.json(
        { error: 'Some domains not found or not verified' },
        { status: 400 }
      );
    }
    
    const results: {
      success: string[];
      failed: { domain: string; reason: string; }[];
    } = {
      success: [],
      failed: []
    };
    
    let phoneIndex = 0;
    
    for (const domain of domains) {
      try {
        // Check if domain already has landing pages
        const existingCount = await LandingPage.countDocuments({ 
          domainId: domain._id 
        });
        
        if (existingCount > 0) {
          results.failed.push({
            domain: domain.name,
            reason: 'Domain already has landing pages'
          });
          continue;
        }
        
        // Get phone number (cycle through available numbers)
        const selectedPhone = availablePhoneNumbers[phoneIndex % availablePhoneNumbers.length];
        phoneIndex++;
        
        // Generate business name
        const businessName = generateBusinessName(industry);
        
        // Determine final URL structure
        const isExternal = domain.dnsManagement === 'external';
        const finalSubdomain = isExternal ? '' : subdomain;
        
        // Create landing page
        const landingPage = new LandingPage({
          name,
          domainId: domain._id,
          subdomain: finalSubdomain,
          affiliateUrl: '', // Not used for call ads
          originalUrl: 'https://placeholder.example.com',
          desktopScreenshotUrl: '',
          mobileScreenshotUrl: '',
          isActive: true,
          templateType: 'call-ads',
          callAdsTemplateType: industry,
          phoneNumber: selectedPhone.phoneNumber,
          businessName: businessName
        });
        
        await landingPage.save();
        
        // Update domain's landing page count
        await Domain.findByIdAndUpdate(domain._id, {
          $inc: { landingPageCount: 1 }
        });
        
        results.success.push(domain.name);
        
        // Add small delay to prevent overwhelming the system
        if (results.success.length % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`Error creating landing page for domain ${domain.name}:`, error);
        results.failed.push({
          domain: domain.name,
          reason: 'Failed to create landing page'
        });
      }
    }
    
    const message = `Successfully created ${results.success.length} call ads landing pages. ${results.failed.length} failed.`;
    
    return NextResponse.json({
      message,
      results,
      phoneNumbersUsed: Math.min(phoneIndex, availablePhoneNumbers.length),
      availablePhoneNumbers: availablePhoneNumbers.length
    });
    
  } catch (error) {
    console.error('Error in bulk call ads creation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 