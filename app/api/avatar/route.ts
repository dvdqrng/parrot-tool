import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// GET /api/avatar?url=file:///path/to/avatar
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    // Only allow file:// URLs from the Beeper media directory
    if (!url.startsWith('file://')) {
      return NextResponse.json({ error: 'Invalid URL scheme' }, { status: 400 });
    }

    // Convert file:// URL to local path
    const filePath = decodeURIComponent(url.replace('file://', ''));

    // Security: Only allow paths within the BeeperTexts directory
    const allowedBase = path.join(
      process.env.HOME || '',
      'Library/Application Support/BeeperTexts'
    );

    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(allowedBase)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!existsSync(resolvedPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const data = await readFile(resolvedPath);

    // Determine content type based on file extension or magic bytes
    let contentType = 'image/jpeg'; // default
    const ext = path.extname(resolvedPath).toLowerCase();
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.webp') contentType = 'image/webp';

    // Check magic bytes for files without extension
    if (!ext) {
      if (data[0] === 0x89 && data[1] === 0x50) contentType = 'image/png';
      else if (data[0] === 0x47 && data[1] === 0x49) contentType = 'image/gif';
      else if (data[0] === 0x52 && data[1] === 0x49) contentType = 'image/webp';
    }

    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    });
  } catch (error) {
    logger.error('Error serving avatar:', error instanceof Error ? error : String(error));
    return NextResponse.json({ error: 'Failed to load avatar' }, { status: 500 });
  }
}
