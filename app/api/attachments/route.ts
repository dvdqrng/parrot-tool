import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';

// Content type mapping
const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.rtf': 'application/rtf',
};

function getAttachmentsDir(): string {
  const electronUserData = path.join(
    process.env.HOME || '',
    'Library/Application Support/Parrot'
  );
  return path.join(electronUserData, 'attachments');
}

async function ensureAttachmentsDir(): Promise<string> {
  const dir = getAttachmentsDir();
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

function validateStoredName(storedName: string): boolean {
  const sanitized = path.basename(storedName);
  return sanitized === storedName && !storedName.includes('..');
}

// GET /api/attachments?name=stored-filename.pdf
export async function GET(request: NextRequest) {
  const storedName = request.nextUrl.searchParams.get('name');

  if (!storedName) {
    return NextResponse.json({ error: 'Missing name parameter' }, { status: 400 });
  }

  if (!validateStoredName(storedName)) {
    return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
  }

  try {
    const attachmentsDir = getAttachmentsDir();
    const filePath = path.resolve(path.join(attachmentsDir, storedName));

    if (!filePath.startsWith(attachmentsDir)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Content-Length': data.length.toString(),
      },
    });
  } catch (error) {
    logger.error('Error serving attachment:', error instanceof Error ? error : String(error));
    return NextResponse.json({ error: 'Failed to load attachment' }, { status: 500 });
  }
}

// POST /api/attachments — upload a file (browser fallback when Electron IPC is unavailable)
// Expects multipart/form-data with a "file" field and a "storedName" field
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as globalThis.File | null;
    const storedName = formData.get('storedName') as string | null;

    if (!file || !storedName) {
      return NextResponse.json({ error: 'Missing file or storedName' }, { status: 400 });
    }

    if (!validateStoredName(storedName)) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
    }

    const dir = await ensureAttachmentsDir();
    const destPath = path.join(dir, storedName);

    if (!path.resolve(destPath).startsWith(dir)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(destPath, buffer);

    return NextResponse.json({
      success: true,
      storedName,
      size: buffer.length,
    });
  } catch (error) {
    logger.error('Error uploading attachment:', error instanceof Error ? error : String(error));
    return NextResponse.json({ error: 'Failed to upload attachment' }, { status: 500 });
  }
}

// DELETE /api/attachments?name=stored-filename.pdf
export async function DELETE(request: NextRequest) {
  const storedName = request.nextUrl.searchParams.get('name');

  if (!storedName) {
    return NextResponse.json({ error: 'Missing name parameter' }, { status: 400 });
  }

  if (!validateStoredName(storedName)) {
    return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
  }

  try {
    const attachmentsDir = getAttachmentsDir();
    const filePath = path.resolve(path.join(attachmentsDir, storedName));

    if (!filePath.startsWith(attachmentsDir)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (existsSync(filePath)) {
      await unlink(filePath);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting attachment:', error instanceof Error ? error : String(error));
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 });
  }
}
