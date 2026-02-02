import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getBeeperClient, getPlatformFromAccountId, MissingTokenError } from '@/lib/beeper-client';
import { BeeperChat, BeeperMessage, BeeperAttachment } from '@/lib/types';

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

// GET /api/beeper/chats - List chats or get messages for a specific chat
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const chatId = searchParams.get('chatId');
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const sinceHours = parseFloat(searchParams.get('sinceHours') || '0');
  const minMessages = parseInt(searchParams.get('minMessages') || '0', 10);
  // Cursor-based pagination: pass the sortKey of the last message to continue from there
  const cursor = searchParams.get('cursor') || undefined;
  // Legacy skip-based pagination (used by history loader)
  const skip = parseInt(searchParams.get('skip') || '0', 10);

  try {
    const beeperToken = request.headers.get('x-beeper-token') || undefined;
    const client = getBeeperClient(beeperToken);

    // If chatId is provided, get messages for that chat
    if (chatId) {
      const messages: BeeperMessage[] = [];
      let skipped = 0;
      let lastSortKey: string | null = null;

      // Calculate cutoff time if sinceHours is specified
      const cutoffTime = sinceHours > 0
        ? new Date(Date.now() - sinceHours * 60 * 60 * 1000)
        : null;

      // Use cursor-based pagination when a cursor is provided — this lets the
      // Beeper server jump directly to the right position instead of iterating
      const listQuery = cursor ? { cursor } : {};

      // Iterate until we have enough messages or hit the time cutoff
      for await (const msg of client.messages.list(chatId, listQuery)) {
        // Legacy skip support (for history loader compatibility)
        if (!cursor && skipped < skip) {
          skipped++;
          continue;
        }

        const msgTimestamp = new Date(msg.timestamp || Date.now());

        // If using time-based filtering and message is older than cutoff,
        // only stop if we've met the minimum message requirement
        if (cutoffTime && msgTimestamp < cutoffTime && messages.length >= minMessages) {
          break;
        }

        // Extract attachments
        const attachments = msg.attachments?.map(mapAttachment);

        // Track the sortKey for cursor-based pagination
        lastSortKey = msg.sortKey || null;

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
          attachments,
        });

        // If not using time-based filtering, use limit
        if (!cutoffTime && messages.length >= limit) break;
      }

      return NextResponse.json({ data: messages, nextCursor: lastSortKey });
    }

    // Otherwise, list all chats
    const chats: BeeperChat[] = [];

    for await (const chat of client.chats.list()) {
      const participants = chat.participants?.items || [];
      const isGroup = chat.type === 'group';

      // For DMs, find the OTHER participant (not self) to get their name and avatar
      const otherParticipant = participants.find(p => !p.isSelf) || participants[0];

      let displayName: string;
      if (isGroup) {
        displayName = chat.title || 'Group Chat';
      } else if (otherParticipant) {
        displayName = otherParticipant.fullName || otherParticipant.username || chat.title || 'Unknown';
      } else {
        displayName = chat.title || 'Unknown Chat';
      }

      chats.push({
        id: chat.id,
        accountId: chat.accountID || '',
        name: displayName,
        avatarUrl: otherParticipant?.imgURL,
        isGroup,
        lastMessageAt: chat.preview?.timestamp,
      });

      if (chats.length >= 50) break;
    }

    return NextResponse.json({ data: chats });
  } catch (error) {
    if (error instanceof MissingTokenError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    logger.error('Error fetching chats:', error instanceof Error ? error : String(error));
    return NextResponse.json(
      { error: 'Failed to fetch chats. Make sure Beeper Desktop is running.' },
      { status: 500 }
    );
  }
}
