import { NextRequest, NextResponse } from 'next/server';
import { getBeeperClient, getPlatformFromAccountId } from '@/lib/beeper-client';
import { BeeperChat, BeeperMessage } from '@/lib/types';

// GET /api/beeper/chats - List chats or get messages for a specific chat
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const chatId = searchParams.get('chatId');
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  try {
    const beeperToken = request.headers.get('x-beeper-token') || undefined;
    const client = getBeeperClient(beeperToken);

    // If chatId is provided, get messages for that chat
    if (chatId) {
      const messages: BeeperMessage[] = [];

      // Iterate until we have enough messages (limit is handled client-side via break)
      for await (const msg of client.messages.list(chatId)) {
        messages.push({
          id: msg.id,
          chatId: msg.chatID,
          accountId: msg.accountID || '',
          senderId: msg.senderID || '',
          senderName: msg.senderName || 'Unknown',
          senderAvatarUrl: undefined,
          text: msg.text || '',
          timestamp: msg.timestamp || new Date().toISOString(),
          isFromMe: msg.isSender || false,
          isRead: !msg.isUnread,
          platform: getPlatformFromAccountId(msg.accountID || ''),
        });

        if (messages.length >= limit) break;
      }

      return NextResponse.json({ data: messages });
    }

    // Otherwise, list all chats
    const chats: BeeperChat[] = [];

    for await (const chat of client.chats.list()) {
      // Get the display name from first participant
      const firstParticipant = chat.participants?.items?.[0];
      const displayName = firstParticipant?.fullName ||
                         firstParticipant?.username ||
                         'Unknown Chat';

      chats.push({
        id: chat.id,
        accountId: chat.accountID || '',
        name: displayName,
        avatarUrl: firstParticipant?.imgURL,
        isGroup: chat.type === 'group',
        lastMessageAt: chat.preview?.timestamp,
      });

      if (chats.length >= 50) break;
    }

    return NextResponse.json({ data: chats });
  } catch (error) {
    console.error('Error fetching chats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chats. Make sure Beeper Desktop is running.' },
      { status: 500 }
    );
  }
}
