import { NextRequest, NextResponse } from 'next/server';
import { getBeeperClient, getPlatformFromAccountId } from '@/lib/beeper-client';
import { BeeperMessage, BeeperAttachment } from '@/lib/types';

// Convert Beeper API attachment to our type
function mapAttachment(att: {
  type: 'unknown' | 'img' | 'video' | 'audio';
  duration?: number;
  fileName?: string;
  fileSize?: number;
  isGif?: boolean;
  isSticker?: boolean;
  isVoiceNote?: boolean;
  mimeType?: string;
  posterImg?: string;
  srcURL?: string;
  size?: { height?: number; width?: number };
}): BeeperAttachment {
  return {
    type: att.type,
    duration: att.duration,
    fileName: att.fileName,
    fileSize: att.fileSize,
    isGif: att.isGif,
    isSticker: att.isSticker,
    isVoiceNote: att.isVoiceNote,
    mimeType: att.mimeType,
    posterImg: att.posterImg,
    srcURL: att.srcURL,
    size: att.size,
  };
}

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

      // For DMs, find the OTHER participant (not self) to get their avatar and name
      const otherParticipant = participants.find(p => !p.isSelf) || participants[0];

      // Debug: Log participant info to understand the data structure
      if (!isGroup && participants.length > 0) {
        console.log(`[Messages] Chat ${chat.id} (title: "${chat.title}") otherParticipant:`, {
          selected: otherParticipant ? {
            id: otherParticipant.id,
            fullName: otherParticipant.fullName,
            username: otherParticipant.username,
            isSelf: otherParticipant.isSelf,
          } : null,
          allParticipants: participants.map(p => ({
            id: p.id,
            fullName: p.fullName,
            isSelf: p.isSelf,
          })),
        });
      }

      // Get avatar for single chats from the other participant
      let avatarUrl: string | undefined;
      if (!isGroup && otherParticipant?.imgURL) {
        avatarUrl = otherParticipant.imgURL;
        avatarsToReturn[chat.id] = avatarUrl;
      }

      // For DMs, always use the other participant's name as the chat name
      // (not the preview sender, which could be "me" if I sent the last message)
      let chatDisplayName: string;
      if (isGroup) {
        chatDisplayName = chat.title || 'Group Chat';
      } else if (otherParticipant) {
        chatDisplayName = otherParticipant.fullName || otherParticipant.username || chat.title || 'Unknown';
      } else {
        chatDisplayName = chat.title || 'Unknown';
      }

      // Debug: Log the final display name
      if (!isGroup) {
        console.log(`[Messages] FINAL: Chat ${chat.id} -> displayName: "${chatDisplayName}" (otherParticipant.fullName: "${otherParticipant?.fullName}", otherParticipant.isSelf: ${otherParticipant?.isSelf})`);
      }

      // Cache and return chat info
      // Use chatDisplayName (the computed name) for title instead of chat.title
      // This ensures DMs show the other participant's name, not the raw Beeper title
      chatInfoCache.set(chat.id, {
        avatarUrl,
        isGroup,
        title: chatDisplayName,
      });
      chatInfoToReturn[chat.id] = { isGroup, title: chatDisplayName };

      // Extract attachments from preview
      const attachments = preview?.attachments?.map(mapAttachment);

      resultMessages.push({
        id: preview?.id || chat.id,
        chatId: chat.id,
        accountId: chat.accountID || '',
        senderId: preview?.senderID || '',
        // For the card title, use the chat display name (other participant for DMs)
        // The senderName field is used as the card title in the UI
        senderName: chatDisplayName,
        senderAvatarUrl: avatarUrl,
        text: preview?.text || '',
        timestamp: preview?.timestamp || chat.lastActivity || new Date().toISOString(),
        isFromMe,
        isRead: !hasUnread,
        chatName: chatDisplayName,
        platform,
        unreadCount: chat.unreadCount,
        attachments,
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
