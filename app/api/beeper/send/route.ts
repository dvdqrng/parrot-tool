import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getBeeperClient, MissingTokenError } from '@/lib/beeper-client';

interface SendMessageBody {
  chatId: string;
  text: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SendMessageBody = await request.json();
    const { chatId, text } = body;

    if (!chatId || !text) {
      return NextResponse.json(
        { error: 'chatId and text are required' },
        { status: 400 }
      );
    }

    const beeperToken = request.headers.get('x-beeper-token') || undefined;
    const client = getBeeperClient(beeperToken);

    // Send the message using messages.send API
    const response = await client.messages.send(chatId, {
      text,
    });

    return NextResponse.json({
      data: {
        success: true,
        messageId: response.pendingMessageID,
        chatId: response.chatID,
      }
    });
  } catch (error) {
    if (error instanceof MissingTokenError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    logger.error('Error sending message:', error instanceof Error ? error : String(error));
    return NextResponse.json(
      { error: 'Failed to send message. Make sure Beeper Desktop is running.' },
      { status: 500 }
    );
  }
}
