import { NextRequest, NextResponse } from 'next/server';
import { getBeeperClient, getPlatformFromAccountId } from '@/lib/beeper-client';
import { BeeperMessage } from '@/lib/types';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const accountIds = searchParams.get('accountIds')?.split(',').filter(Boolean) || [];

  try {
    const beeperToken = request.headers.get('x-beeper-token') || undefined;
    const client = getBeeperClient(beeperToken);

    // If no accounts selected, return empty
    if (accountIds.length === 0) {
      return NextResponse.json({ data: [], avatars: {}, chatInfo: {} });
    }

    const resultMessages: BeeperMessage[] = [];
    const avatarsToReturn: Record<string, string> = {};
    const chatInfoToReturn: Record<string, { isGroup: boolean; title?: string }> = {};

    // Use chats.search with inbox: 'archive' to get archived chats
    let chatCount = 0;

    for await (const chat of client.chats.search({
      accountIDs: accountIds,
      inbox: 'archive',
    })) {
      const platform = getPlatformFromAccountId(chat.accountID || '');
      const isGroup = chat.type === 'group';
      const participants = chat.participants?.items || [];

      // Get avatar for single chats
      let avatarUrl: string | undefined;
      if (!isGroup && participants[0]?.imgURL) {
        avatarUrl = participants[0].imgURL;
        avatarsToReturn[chat.id] = avatarUrl;
      }

      chatInfoToReturn[chat.id] = { isGroup, title: chat.title || undefined };

      resultMessages.push({
        id: chat.id,
        chatId: chat.id,
        accountId: chat.accountID || '',
        senderId: '',
        senderName: chat.title || 'Unknown',
        senderAvatarUrl: avatarUrl,
        text: chat.description || '',
        timestamp: chat.lastActivity || new Date().toISOString(),
        isFromMe: false,
        isRead: true,
        chatName: chat.title || undefined,
        platform,
        unreadCount: chat.unreadCount || 0,
        isGroup,
      });

      chatCount++;

      // Limit results
      if (chatCount >= 20) break;
    }

    return NextResponse.json({
      data: resultMessages,
      avatars: avatarsToReturn,
      chatInfo: chatInfoToReturn,
    });
  } catch (error) {
    console.error('Error fetching archived chats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch archived chats. Make sure Beeper Desktop is running.' },
      { status: 500 }
    );
  }
}
