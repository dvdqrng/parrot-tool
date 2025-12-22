import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getBeeperClient, getPlatformFromAccountId } from '@/lib/beeper-client';

interface UserMessage {
  id: string;
  chatId: string;
  text: string;
  timestamp: string;
}

// GET /api/beeper/user-messages - Get a sample of messages sent by the user for tone analysis
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  // Increased defaults: 500 messages from up to 50 chats for better voice analysis
  const maxMessages = parseInt(searchParams.get('maxMessages') || '500', 10);
  const maxChats = parseInt(searchParams.get('maxChats') || '50', 10);

  try {
    const beeperToken = request.headers.get('x-beeper-token') || undefined;
    const client = getBeeperClient(beeperToken);

    const userMessages: UserMessage[] = [];
    let chatCount = 0;

    // Iterate through chats (most recent first)
    for await (const chat of client.chats.list()) {
      if (chatCount >= maxChats || userMessages.length >= maxMessages) break;
      chatCount++;

      let messagesChecked = 0;
      const maxMessagesPerChat = 50; // Check up to 50 messages per chat for better sampling

      // Get messages from this chat
      try {
        for await (const msg of client.messages.list(chat.id)) {
          if (messagesChecked >= maxMessagesPerChat || userMessages.length >= maxMessages) break;
          messagesChecked++;

          // Only include messages sent by the user with actual text content
          if (msg.isSender && msg.text && msg.text.trim().length > 0) {
            userMessages.push({
              id: msg.id,
              chatId: msg.chatID,
              text: msg.text,
              timestamp: msg.timestamp || new Date().toISOString(),
            });
          }
        }
      } catch (chatError) {
        // Skip chats that fail to load
        logger.error(`Error fetching messages for chat ${chat.id}:`, chatError instanceof Error ? chatError : String(chatError));
        continue;
      }
    }

    return NextResponse.json({
      data: userMessages,
      stats: {
        chatsScanned: chatCount,
        messagesFound: userMessages.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching user messages:', error instanceof Error ? error : String(error));
    return NextResponse.json(
      { error: 'Failed to fetch user messages. Make sure Beeper Desktop is running.' },
      { status: 500 }
    );
  }
}
