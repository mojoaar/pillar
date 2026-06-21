import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import { writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/profile/avatar
 * Handles user avatar file uploads with strict size (max 2MB) and MIME validation.
 * Implements timestamp filename cache-busting (Gotcha #15).
 * Cleans up orphaned older avatar files to prevent storage leakages (Finding #4).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id!;

    // 1. Parse Multipart FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image file uploaded.' }, { status: 400 });
    }

    // 2. Validate File Size (Max 2MB)
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size exceeds maximum 2MB limit.' }, { status: 400 });
    }

    // 3. Validate File MIME Type (PNG, JPEG, WEBP)
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file format. Only PNG, JPEG, and WEBP are accepted.' }, { status: 400 });
    }

    // 4. Clean up the user's old avatar file if present (Finding #4)
    const currentUser = await db.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (currentUser && currentUser.avatarUrl && currentUser.avatarUrl.startsWith('/uploads/avatars/')) {
      try {
        // Construct the absolute path of the old avatar file (Gotcha #28)
        const oldFilename = path.basename(currentUser.avatarUrl);
        const oldFilepath = path.join(process.cwd(), 'public', 'uploads', 'avatars', oldFilename);
        
        // Delete file on local disk
        await unlink(oldFilepath);
        console.log(`[Avatar Cleanup] Deleted orphaned avatar file: ${oldFilename}`);
      } catch (err: any) {
        // Safe try-catch wrapper: prevent failure of deletion from blocking new upload
        console.warn(`[Avatar Cleanup] Failed to delete old avatar image: ${err.message}`);
      }
    }

    // 5. Resolve file extension and construct cache-busted filename (Gotcha #15)
    let ext = 'png';
    if (file.type === 'image/jpeg' || file.type === 'image/jpg') ext = 'jpg';
    if (file.type === 'image/webp') ext = 'webp';

    const filename = `${userId}_${Date.now()}.${ext}`;

    // Gotcha #28: Use process.cwd() instead of __dirname inside Turbopack
    const uploadDirectory = path.join(process.cwd(), 'public', 'uploads', 'avatars');
    const filepath = path.join(uploadDirectory, filename);

    // Read file buffer and save to local storage
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // 6. Update avatarUrl inside database User table
    const avatarUrl = `/uploads/avatars/${filename}`;
    await db.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    // 7. Write event to system audit logs
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    await writeAudit(
      userId,
      'Avatar Uploaded',
      ip,
      { message: 'User updated custom profile picture.', filename }
    );

    return NextResponse.json({
      data: { avatarUrl },
      ok: true,
    });

  } catch (error: any) {
    console.error('Failed to handle avatar upload:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
