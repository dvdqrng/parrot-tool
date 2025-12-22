import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Content type mapping
const CONTENT_TYPES: Record<string, string> = {
  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  // Videos
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  // Audio
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.opus': 'audio/opus',
  // Documents
  '.pdf': 'application/pdf',
};

// GET /api/media?url=file:///path/to/media
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    // Handle file:// URLs
    if (url.startsWith('file://')) {
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

      // Determine content type
      const ext = path.extname(resolvedPath).toLowerCase();
      let contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

      // Check magic bytes for files without extension
      if (!ext && data.length >= 4) {
        if (data[0] === 0x89 && data[1] === 0x50) contentType = 'image/png';
        else if (data[0] === 0x47 && data[1] === 0x49) contentType = 'image/gif';
        else if (data[0] === 0x52 && data[1] === 0x49) contentType = 'image/webp';
        else if (data[0] === 0xff && data[1] === 0xd8) contentType = 'image/jpeg';
        // ftyp for mp4/mov
        else if (data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) {
          contentType = 'video/mp4';
        }
      }

      return new NextResponse(data, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'Content-Length': data.length.toString(),
        },
      });
    }

    // Handle remote URLs (proxy them)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const response = await fetch(url);
      if (!response.ok) {
        return NextResponse.json({ error: 'Failed to fetch remote media' }, { status: response.status });
      }

      const data = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'application/octet-stream';

      return new NextResponse(data, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    return NextResponse.json({ error: 'Invalid URL scheme' }, { status: 400 });
  } catch (error) {
    logger.error('Error serving media:', error instanceof Error ? error : String(error));
    return NextResponse.json({ error: 'Failed to load media' }, { status: 500 });
  }
}
