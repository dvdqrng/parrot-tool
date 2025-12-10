import { NextRequest, NextResponse } from 'next/server';
import { getBeeperClient } from '@/lib/beeper-client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params;
    const beeperToken = request.headers.get('x-beeper-token') || undefined;
    const client = getBeeperClient(beeperToken);

    await client.chats.archive(chatId, { archived: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error archiving chat:', error);
    return NextResponse.json(
      { error: 'Failed to archive chat. Make sure Beeper Desktop is running.' },
      { status: 500 }
    );
  }
}
