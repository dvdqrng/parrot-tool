import { NextRequest, NextResponse } from 'next/server';
import { getBeeperClient, getPlatformFromAccountId } from '@/lib/beeper-client';
import { BeeperMessage } from '@/lib/types';

// Cache for chat info (chatId -> { avatarUrl, isGroup, title })
interface ChatInfo {
  avatarUrl?: string;
  isGroup: boolean;
  title?: string;
}
const chatInfoCache = new Map<string, ChatInfo>();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const accountIds = searchParams.get('accountIds')?.split(',').filter(Boolean) || [];
  const cursor = searchParams.get('cursor') || undefined;
  const hiddenChatIds = new Set(searchParams.get('hiddenChatIds')?.split(',').filter(Boolean) || []);

  try {
    const beeperToken = request.headers.get('x-beeper-token') || undefined;
    const client = getBeeperClient(beeperToken);

    // If no accounts selected, return empty
    if (accountIds.length === 0) {
      return NextResponse.json({ data: [], hasMore: false, nextCursor: null, avatars: {} });
    }

    const resultMessages: BeeperMessage[] = [];
    const avatarsToReturn: Record<string, string> = {};
    const chatInfoToReturn: Record<string, { isGroup: boolean; title?: string }> = {};

    // Use chats.list to get chats with preview messages, then filter for unread
    const chatListParams: {
      accountIDs: string[];
      cursor?: string;
    } = {
      accountIDs: accountIds,
    };

    if (cursor) {
      chatListParams.cursor = cursor;
    }

    let nextCursor: string | null = null;
    let chatCount = 0;

    for await (const chat of client.chats.list(chatListParams)) {
      // Skip hidden chats
      if (hiddenChatIds.has(chat.id)) continue;

      // Skip archived chats
      if (chat.isArchived) continue;

      // Get preview message info
      const preview = chat.preview;
      const isFromMe = preview?.isSender || false;
      const hasUnread = chat.unreadCount > 0;

      // Skip chats that have no unread messages AND aren't from me
      // We want to show: unread messages OR recently sent messages
      if (!hasUnread && !isFromMe) continue;

      const platform = getPlatformFromAccountId(chat.accountID || '');
      const isGroup = chat.type === 'group';
      const participants = chat.participants?.items || [];

      // Get avatar for single chats
      let avatarUrl: string | undefined;
      if (!isGroup && participants[0]?.imgURL) {
        avatarUrl = participants[0].imgURL;
        avatarsToReturn[chat.id] = avatarUrl;
      }

      // Cache and return chat info
      chatInfoCache.set(chat.id, {
        avatarUrl,
        isGroup,
        title: chat.title || undefined,
      });
      chatInfoToReturn[chat.id] = { isGroup, title: chat.title || undefined };

      resultMessages.push({
        id: preview?.id || chat.id,
        chatId: chat.id,
        accountId: chat.accountID || '',
        senderId: preview?.senderID || '',
        senderName: preview?.senderName || chat.title || 'Unknown',
        senderAvatarUrl: avatarUrl,
        text: preview?.text || '',
        timestamp: preview?.timestamp || chat.lastActivity || new Date().toISOString(),
        isFromMe,
        isRead: !hasUnread,
        chatName: chat.title || undefined,
        platform,
        unreadCount: chat.unreadCount,
      });

      chatCount++;
      nextCursor = chat.id;

      // Limit results per page (set high to load all messages)
      if (chatCount >= 500) break;
    }

    const hasMore = chatCount === 500;

    return NextResponse.json({
      data: resultMessages,
      hasMore,
      nextCursor: hasMore ? nextCursor : null,
      avatars: avatarsToReturn,
      chatInfo: chatInfoToReturn,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages. Make sure Beeper Desktop is running.' },
      { status: 500 }
    );
  }
}
