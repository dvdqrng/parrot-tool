import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getBeeperClient, getPlatformFromAccountId, MissingTokenError } from '@/lib/beeper-client';

export interface Contact {
  chatId: string;
  accountId: string;
  name: string;
  avatarUrl?: string;
  platform: string;
  isGroup: boolean;
  lastMessageAt?: string;
}

// GET /api/beeper/contacts - List all contacts (chats) for starting new conversations
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const accountIds = searchParams.get('accountIds')?.split(',').filter(Boolean) || [];
  const search = searchParams.get('search')?.toLowerCase() || '';
  // Higher default limit to get more contacts
  const limit = parseInt(searchParams.get('limit') || '600', 10);

  try {
    const beeperToken = request.headers.get('x-beeper-token') || undefined;
    const client = getBeeperClient(beeperToken);

    const contacts: Contact[] = [];
    const seenChatIds = new Set<string>();

    // Fetch all chats from Beeper - pass accountIDs filter if specified
    const listParams = accountIds.length > 0 ? { accountIDs: accountIds } : undefined;

    for await (const chat of client.chats.list(listParams)) {
      // Skip archived chats
      if (chat.isArchived) continue;

      // Skip if we've already seen this chat
      if (seenChatIds.has(chat.id)) {
        continue;
      }
      seenChatIds.add(chat.id);

      // Get display name and avatar from participants
      const isGroup = chat.type === 'group';
      let displayName = 'Unknown';
      let avatarUrl: string | undefined;

      const participants = chat.participants?.items || [];
      // For DMs, find the OTHER participant (not self)
      const otherParticipant = participants.find(p => !p.isSelf) || participants[0];

      if (isGroup) {
        // For groups, use the chat title or fallback
        displayName = chat.title || 'Group Chat';
      } else {
        // For DMs, get the other participant's info (not self)
        if (otherParticipant) {
          displayName = otherParticipant.fullName || otherParticipant.username || chat.title || 'Unknown';
          avatarUrl = otherParticipant.imgURL;
        } else if (chat.title) {
          displayName = chat.title;
        }
      }

      // Debug: Log final contact name for DMs
      if (!isGroup) {
        logger.debug(`[Contacts] FINAL: Chat ${chat.id} -> name: "${displayName}" (otherParticipant.fullName: "${otherParticipant?.fullName}", isSelf: ${otherParticipant?.isSelf})`);
      }

      // Apply search filter (skip contacts that don't match)
      if (search && !displayName.toLowerCase().includes(search)) {
        continue;
      }

      contacts.push({
        chatId: chat.id,
        accountId: chat.accountID || '',
        name: displayName,
        avatarUrl,
        platform: getPlatformFromAccountId(chat.accountID || ''),
        isGroup,
        lastMessageAt: chat.preview?.timestamp,
      });

      // Only limit after we have enough contacts
      if (contacts.length >= limit) break;
    }

    // Sort by last message time (most recent first)
    contacts.sort((a, b) => {
      if (!a.lastMessageAt && !b.lastMessageAt) return 0;
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    return NextResponse.json({ data: contacts });
  } catch (error) {
    if (error instanceof MissingTokenError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    logger.error('Error fetching contacts:', error instanceof Error ? error : String(error));
    return NextResponse.json(
      { error: 'Failed to fetch contacts. Make sure Beeper Desktop is running.' },
      { status: 500 }
    );
  }
}
