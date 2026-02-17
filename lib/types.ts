// Types for Beeper API responses and app state

export interface BeeperAccount {
  id: string;
  service: string; // 'whatsapp', 'telegram', 'instagram', etc.
  displayName: string;
  avatarUrl?: string;
}

// The authenticated user's info from Beeper (from self participant in chats)
export interface BeeperUserInfo {
  name?: string;
  avatarUrl?: string;
}

export interface BeeperChat {
  id: string;
  accountId: string;
  name: string;
  avatarUrl?: string;
  isGroup: boolean;
  lastMessageAt?: string;
}

// Attachment type from Beeper API
export interface BeeperAttachment {
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
}

export interface BeeperMessage {
  id: string;
  chatId: string;
  accountId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string;
  text: string;
  timestamp: string;
  isFromMe: boolean;
  isRead: boolean;
  chatName?: string;
  platform?: string;
  // For grouped chat view - count of unread messages in this chat
  unreadCount?: number;
  // Is this a group chat?
  isGroup?: boolean;
  // Attachments (media, files, etc.)
  attachments?: BeeperAttachment[];
}

// App-specific types

export interface Draft {
  id: string;
  originalMessageId: string;
  chatId: string;
  accountId: string;
  recipientName: string;
  originalText: string;
  draftText: string;
  platform: string;
  avatarUrl?: string;
  isGroup?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Grouping options for the kanban board
export type KanbanGroupBy = 'status' | 'platform';

export interface AppSettings {
  selectedAccountIds: string[];
  beeperAccessToken?: string;
  // UI settings
  showArchivedColumn?: boolean;
  kanbanGroupBy?: KanbanGroupBy;
}

// Kanban types

// Status-based column IDs (used when groupBy='status')
export type StatusColumnId = 'unread' | 'drafts' | 'sent' | 'archived';

// ColumnId is a string to support both status columns and dynamic platform columns
export type ColumnId = string;

// Media type indicators for preview display
export type MediaType = 'photo' | 'video' | 'audio' | 'voice' | 'gif' | 'sticker' | 'file' | 'link';

export interface KanbanCard {
  id: string;
  type: 'message' | 'draft';
  // For messages
  message?: BeeperMessage;
  // For drafts
  draft?: Draft;
  // Display fields
  title: string;
  preview: string;
  timestamp: string;
  platform: string;
  avatarUrl?: string;
  // For grouped chat view
  unreadCount?: number;
  // Is this a group chat?
  isGroup?: boolean;
  // Media indicators
  mediaTypes?: MediaType[];
}

// KanbanColumns uses string keys to support both status and platform grouping
export type KanbanColumns = Record<string, KanbanCard[]>;

// ============================================
// CRM TYPES
// ============================================

/**
 * Platform-specific chat link for a contact identity
 * Links a contact to their chat on a specific platform
 */
export interface CrmPlatformLink {
  platform: string;        // 'whatsapp', 'telegram', 'instagram', etc.
  chatId: string;          // The chatId on this platform
  accountId: string;       // Which account this is on
  displayName?: string;    // Name shown on this platform
  avatarUrl?: string;      // Avatar from this platform
  addedAt: string;         // When this link was added
}

/**
 * Custom tag for organizing contacts
 */
export interface CrmTag {
  id: string;
  name: string;
  color: string;           // Hex color for display
  createdAt: string;
}

/**
 * Contact profile - metadata about a contact
 * Links to one or more platform chats
 */
export interface CrmContactProfile {
  id: string;              // Unique ID for this contact

  // Display info (can override platform defaults)
  displayName: string;     // User-defined name
  avatarUrl?: string;      // User-defined avatar (or from platform)
  isGroup?: boolean;       // Is this a group chat or person

  // Contact details
  email?: string;
  phone?: string;
  company?: string;
  role?: string;

  // Platform links - connects this contact to platform chats
  platformLinks: CrmPlatformLink[];

  // Organization
  tags: string[];          // Tag IDs

  // Interaction metrics (computed, read-only)
  lastInteractionAt?: string;
  totalMessageCount?: number;
  messagesSent?: number;        // Messages sent by me to this contact
  messagesReceived?: number;    // Messages received from this contact
  avgResponseTimeMinutes?: number;           // Average time to respond in minutes

  // Attachments (PDFs, images, documents)
  attachments?: ContactAttachment[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * File attachment on a contact profile
 */
export interface ContactAttachment {
  id: string;
  fileName: string;       // Original file name
  storedName: string;     // Name in the attachments directory (unique)
  mimeType: string;
  fileSize: number;       // Bytes
  addedAt: string;        // ISO timestamp
  note?: string;          // Optional user note about the attachment
}
