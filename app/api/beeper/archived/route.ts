import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
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

      // For DMs, find the OTHER participant (not self) to get their avatar and name
      const otherParticipant = participants.find(p => !p.isSelf) || participants[0];

      // Get avatar for single chats from the other participant
      let avatarUrl: string | undefined;
      if (!isGroup && otherParticipant?.imgURL) {
        avatarUrl = otherParticipant.imgURL;
        avatarsToReturn[chat.id] = avatarUrl;
      }

      // For DMs, always use the other participant's name as the chat name
      let chatDisplayName: string;
      if (isGroup) {
        chatDisplayName = chat.title || 'Group Chat';
      } else if (otherParticipant) {
        chatDisplayName = otherParticipant.fullName || otherParticipant.username || chat.title || 'Unknown';
      } else {
        chatDisplayName = chat.title || 'Unknown';
      }

      // Use chatDisplayName (the computed name) for title instead of chat.title
      // This ensures DMs show the other participant's name, not the raw Beeper title
      chatInfoToReturn[chat.id] = { isGroup, title: chatDisplayName };

      resultMessages.push({
        id: chat.id,
        chatId: chat.id,
        accountId: chat.accountID || '',
        senderId: '',
        senderName: chatDisplayName,
        senderAvatarUrl: avatarUrl,
        text: chat.description || '',
        timestamp: chat.lastActivity || new Date().toISOString(),
        isFromMe: false,
        isRead: true,
        chatName: chatDisplayName,
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
    logger.error('Error fetching archived chats:', error instanceof Error ? error : String(error));
    return NextResponse.json(
      { error: 'Failed to fetch archived chats. Make sure Beeper Desktop is running.' },
      { status: 500 }
    );
  }
}
