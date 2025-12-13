import { NextRequest, NextResponse } from 'next/server';
import { getBeeperClient } from '@/lib/beeper-client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params;
    // Decode the chatId in case it wasn't fully decoded
    const decodedChatId = decodeURIComponent(chatId);
    const beeperToken = request.headers.get('x-beeper-token') || undefined;
    const client = getBeeperClient(beeperToken);

    await client.chats.archive(decodedChatId, { archived: false });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    // The Beeper SDK may throw a JSON parse error for empty responses
    // but the unarchive action still succeeds. Check if it's this case.
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      // Unarchive likely succeeded but SDK couldn't parse empty response
      return NextResponse.json({ success: true });
    }

    console.error('Error unarchiving chat:', error);
    // Extract detailed error info
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
      // Check for API error details
      const apiError = error as { status?: number; error?: { message?: string } };
      if (apiError.status) {
        errorMessage = `API returned ${apiError.status}: ${apiError.error?.message || error.message}`;
      }
    }
    return NextResponse.json(
      { error: `Failed to unarchive chat: ${errorMessage}` },
      { status: 500 }
    );
  }
}
