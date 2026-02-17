/**
 * Shared transformation functions for Beeper data
 * Single source of truth for data extraction logic
 */

import { BeeperMessage, BeeperAttachment, BeeperAccount, BeeperUserInfo } from '@/lib/types';
import { getPlatformFromAccountId, getPlatformInfo } from '@/lib/beeper-client';
import { ChatInfo, ParticipantInfo } from './types';

/**
 * Map Beeper SDK attachment to our type
 */
export function mapAttachment(att: {
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

/**
 * Extract participant info from a chat
 * Used for DMs to get the other participant's name/avatar
 */
export function extractParticipantInfo(
  chat: {
    type?: string;
    title?: string | null;
    participants?: {
      items?: Array<{
        isSelf?: boolean;
        fullName?: string;
        username?: string;
        imgURL?: string;
      }>;
    };
  }
): ParticipantInfo {
  const isGroup = chat.type === 'group';
  const participants = chat.participants?.items || [];

  // For DMs, find the OTHER participant (not self)
  const otherParticipant = participants.find(p => !p.isSelf) || participants[0];

  let displayName: string;
  let avatarUrl: string | undefined;

  if (isGroup) {
    displayName = chat.title || 'Group Chat';
  } else if (otherParticipant) {
    displayName = otherParticipant.fullName || otherParticipant.username || chat.title || 'Unknown';
    avatarUrl = otherParticipant.imgURL;
  } else {
    displayName = chat.title || 'Unknown';
  }

  return { displayName, avatarUrl, isGroup };
}

/**
 * Extract user info from accounts
 */
export function extractUserInfoFromAccounts(
  accounts: Array<{
    user?: {
      fullName?: string;
      username?: string;
      imgURL?: string;
    };
  }>
): BeeperUserInfo {
  let name: string | undefined;
  let avatarUrl: string | undefined;

  for (const account of accounts) {
    if (account.user) {
      if (!name && (account.user.fullName || account.user.username)) {
        name = account.user.fullName || account.user.username;
      }
      if (!avatarUrl && account.user.imgURL) {
        avatarUrl = account.user.imgURL;
      }
      if (name && avatarUrl) break;
    }
  }

  return { name, avatarUrl };
}

/**
 * Extract user info from chat participants (fallback)
 */
export function extractUserInfoFromChats(
  chats: Array<{
    participants?: {
      items?: Array<{
        isSelf?: boolean;
        fullName?: string;
        username?: string;
        imgURL?: string;
      }>;
    };
  }>
): BeeperUserInfo {
  let name: string | undefined;
  let avatarUrl: string | undefined;

  for (const chat of chats) {
    const participants = chat.participants?.items || [];
    const selfParticipant = participants.find(p => p.isSelf);

    if (selfParticipant) {
      if (!name && (selfParticipant.fullName || selfParticipant.username)) {
        name = selfParticipant.fullName || selfParticipant.username;
      }
      if (!avatarUrl && selfParticipant.imgURL) {
        avatarUrl = selfParticipant.imgURL;
      }
      if (name && avatarUrl) break;
    }
  }

  return { name, avatarUrl };
}

/**
 * Transform raw account to BeeperAccount
 */
export function transformAccount(account: {
  accountID: string;
  network?: string;
  user?: {
    imgURL?: string;
  };
}): BeeperAccount {
  const platform = getPlatformFromAccountId(account.accountID);
  const platformData = getPlatformInfo(platform);

  return {
    id: account.accountID,
    service: platform,
    displayName: account.network || platformData.name,
    avatarUrl: account.user?.imgURL,
  };
}

/**
 * Transform a chat to a BeeperMessage
 * Works for both regular and archived chats
 */
export function transformChatToMessage(
  chat: {
    id: string;
    accountID?: string;
    type?: string;
    title?: string | null;
    isArchived?: boolean;
    description?: string | null;
    lastActivity?: string;
    unreadCount?: number;
    preview?: {
      id?: string;
      text?: string;
      timestamp?: string;
      senderID?: string;
      isSender?: boolean;
      attachments?: Array<{
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
      }>;
    };
    participants?: {
      items?: Array<{
        isSelf?: boolean;
        fullName?: string;
        username?: string;
        imgURL?: string;
      }>;
    };
  },
  options: {
    isArchived?: boolean;
  } = {}
): { message: BeeperMessage; chatInfo: ChatInfo; avatarUrl?: string } {
  const platform = getPlatformFromAccountId(chat.accountID || '');
  const participantInfo = extractParticipantInfo(chat);

  const preview = chat.preview;
  const isFromMe = preview?.isSender || false;
  const hasUnread = (chat.unreadCount || 0) > 0;

  // Extract attachments from preview
  const attachments = preview?.attachments?.map(mapAttachment);

  const message: BeeperMessage = {
    id: preview?.id || chat.id,
    chatId: chat.id,
    accountId: chat.accountID || '',
    senderId: preview?.senderID || '',
    senderName: participantInfo.displayName,
    senderAvatarUrl: participantInfo.avatarUrl,
    text: preview?.text || chat.description || '',
    timestamp: preview?.timestamp || chat.lastActivity || new Date().toISOString(),
    isFromMe: options.isArchived ? false : isFromMe,
    isRead: options.isArchived ? true : !hasUnread,
    chatName: participantInfo.displayName,
    platform,
    unreadCount: chat.unreadCount || 0,
    attachments,
    isGroup: participantInfo.isGroup,
  };

  const chatInfo: ChatInfo = {
    isGroup: participantInfo.isGroup,
    title: participantInfo.displayName,
  };

  return {
    message,
    chatInfo,
    avatarUrl: participantInfo.avatarUrl,
  };
}

/**
 * Merge user info from multiple sources
 */
export function mergeUserInfo(primary: BeeperUserInfo, fallback: BeeperUserInfo): BeeperUserInfo {
  return {
    name: primary.name || fallback.name,
    avatarUrl: primary.avatarUrl || fallback.avatarUrl,
  };
}
