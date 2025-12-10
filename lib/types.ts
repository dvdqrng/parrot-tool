// Types for Beeper API responses and app state

export interface BeeperAccount {
  id: string;
  service: string; // 'whatsapp', 'telegram', 'instagram', etc.
  displayName: string;
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

export interface AppSettings {
  selectedAccountIds: string[];
  beeperAccessToken?: string;
  anthropicApiKey?: string;
}

// Kanban types

export type ColumnId = 'unread' | 'drafts' | 'sent';

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
}

export type KanbanColumns = Record<ColumnId, KanbanCard[]>;

// API response types

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Personal tone of voice settings
export interface ToneSettings {
  // 0 = brief, 100 = detailed
  briefDetailed: number;
  // 0 = formal, 100 = casual
  formalCasual: number;
  // Sample messages used for analysis
  analyzedMessageCount?: number;
  lastAnalyzedAt?: string;
}
