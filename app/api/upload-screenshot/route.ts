import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { generateUniqueFilename } from '@/lib/vercelBlobStorage';

// Mark this route as dynamic to prevent static optimization issues
export const dynamic = 'force-dynamic';

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// POST /api/upload-screenshot - Upload a screenshot
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null; // 'desktop' or 'mobile'
    const id = formData.get('id') as string | null; // Optional ID for filename

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!type || (type !== 'desktop' && type !== 'mobile')) {
      return NextResponse.json(
        { error: 'Invalid screenshot type. Must be "desktop" or "mobile"' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Supported formats: PNG, JPEG, WebP' },
        { status: 400 }
      );
    }

    // Generate a unique filename
    const fileExtension = file.type.split('/')[1];
    const prefix = id ? `${id}_${type}` : `manual_${type}`;
    const filename = generateUniqueFilename(prefix, fileExtension);

    // Get file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Vercel Blob Storage
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: file.type
    });

    // Return success with the blob URL
    return NextResponse.json({
      success: true,
      url: blob.url
    });
  } catch (error) {
    console.error('Error uploading screenshot:', error);
    return NextResponse.json(
      { error: 'Failed to upload screenshot' },
      { status: 500 }
    );
  }
} 