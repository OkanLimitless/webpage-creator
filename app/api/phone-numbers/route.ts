import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { PhoneNumber } from '@/lib/models/PhoneNumber';

// GET /api/phone-numbers - Get all phone numbers or filter by industry
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const industry = searchParams.get('industry');
    const activeOnly = searchParams.get('activeOnly') === 'true';
    
    let filter: any = {};
    if (industry) {
      filter.industry = industry;
    }
    if (activeOnly) {
      filter.isActive = true;
    }
    
    const phoneNumbers = await PhoneNumber.find(filter).sort({ createdAt: -1 });
    
    return NextResponse.json(phoneNumbers);
  } catch (error) {
    console.error('Error fetching phone numbers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch phone numbers' },
      { status: 500 }
    );
  }
}

// POST /api/phone-numbers - Add new phone number(s)
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const body = await request.json();
    const { phoneNumbers, industry, description } = body;
    
    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return NextResponse.json(
        { error: 'Phone numbers array is required' },
        { status: 400 }
      );
    }
    
    if (!industry || !['travel', 'pest-control'].includes(industry)) {
      return NextResponse.json(
        { error: 'Valid industry is required (travel or pest-control)' },
        { status: 400 }
      );
    }
    
    const results: {
      success: string[];
      failed: { phoneNumber: string; reason: string; }[];
    } = {
      success: [],
      failed: []
    };
    
    for (const phoneNumber of phoneNumbers) {
      try {
        const cleanPhone = phoneNumber.trim();
        if (!cleanPhone) continue;
        
        // Check if phone number already exists
        const existing = await PhoneNumber.findOne({ phoneNumber: cleanPhone });
        if (existing) {
          results.failed.push({
            phoneNumber: cleanPhone,
            reason: 'Phone number already exists'
          });
          continue;
        }
        
        const newPhoneNumber = new PhoneNumber({
          phoneNumber: cleanPhone,
          industry,
          description
        });
        
        await newPhoneNumber.save();
        results.success.push(cleanPhone);
      } catch (error) {
        console.error(`Error adding phone number ${phoneNumber}:`, error);
        results.failed.push({
          phoneNumber: phoneNumber,
          reason: 'Database error'
        });
      }
    }
    
    return NextResponse.json({
      message: `Added ${results.success.length} phone numbers successfully`,
      results
    });
  } catch (error) {
    console.error('Error adding phone numbers:', error);
    return NextResponse.json(
      { error: 'Failed to add phone numbers' },
      { status: 500 }
    );
  }
} 