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

export type AiProvider = 'anthropic' | 'ollama' | 'openai';

// Grouping options for the kanban board
export type KanbanGroupBy = 'status' | 'platform';

export interface AppSettings {
  selectedAccountIds: string[];
  beeperAccessToken?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  // AI provider settings
  aiProvider?: AiProvider;
  ollamaModel?: string;
  ollamaBaseUrl?: string;
  // UI settings
  showArchivedColumn?: boolean;
  kanbanGroupBy?: KanbanGroupBy;
}

// Kanban types

export type ColumnId = 'unread' | 'autopilot' | 'drafts' | 'sent' | 'archived';

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

// Detailed writing style patterns extracted from user messages
export interface WritingStylePatterns {
  // Sample messages that exemplify the user's writing style
  sampleMessages: string[];
  // Common phrases/expressions the user uses
  commonPhrases: string[];
  // Emojis the user frequently uses
  frequentEmojis: string[];
  // Greeting patterns (how they start messages)
  greetingPatterns: string[];
  // Sign-off patterns (how they end messages)
  signOffPatterns: string[];
  // Punctuation style: multiple exclamation marks, ellipsis usage, etc.
  punctuationStyle: {
    usesMultipleExclamation: boolean;
    usesEllipsis: boolean;
    usesAllCaps: boolean;
    endsWithPunctuation: boolean;
  };
  // Capitalization style
  capitalizationStyle: 'proper' | 'lowercase' | 'mixed';
  // Average words per message
  avgWordsPerMessage: number;
  // Common abbreviations used
  abbreviations: string[];
  // Language quirks (e.g., "haha" vs "lol", "u" vs "you")
  languageQuirks: string[];
}

// ============================================
// AUTOPILOT TYPES
// ============================================

// Agent goal completion behavior
export type GoalCompletionBehavior = 'auto-disable' | 'maintenance' | 'handoff';

// Human-like behavior settings for agents
export interface AgentBehaviorSettings {
  // Reply delay (seconds)
  replyDelayMin: number;           // e.g., 30
  replyDelayMax: number;           // e.g., 300
  replyDelayContextAware: boolean; // faster in active convos

  // Activity hours (24h format)
  activityHoursEnabled: boolean;
  activityHoursStart: number;      // e.g., 9
  activityHoursEnd: number;        // e.g., 22
  activityHoursTimezone: string;

  // Typing simulation
  typingIndicatorEnabled: boolean;
  typingSpeedWpm: number;

  // Read receipts
  readReceiptEnabled: boolean;
  readReceiptDelayMin: number;
  readReceiptDelayMax: number;

  // Multi-message (based on writing style)
  multiMessageEnabled: boolean;
  multiMessageDelayMin: number;    // seconds between messages
  multiMessageDelayMax: number;

  // Response rate - simulate being busy (0-100, 100 = always respond)
  responseRate: number;

  // Emoji-only responses - sometimes just react with emoji
  emojiOnlyResponseEnabled: boolean;
  emojiOnlyResponseChance: number; // 0-100, chance to respond with just emoji

  // Conversation fatigue - reduce engagement over long convos
  conversationFatigueEnabled: boolean;
  fatigueTriggerMessages: number;  // After X messages, start reducing engagement
  fatigueResponseReduction: number; // Reduce response rate by this % per additional message

  // Natural conversation closing
  conversationClosingEnabled: boolean;
  closingTriggerIdleMinutes: number; // Suggest closing after X minutes idle
}

// Default behavior settings
export const DEFAULT_AGENT_BEHAVIOR: AgentBehaviorSettings = {
  replyDelayMin: 60,
  replyDelayMax: 300,
  replyDelayContextAware: true,
  activityHoursEnabled: true,
  activityHoursStart: 9,
  activityHoursEnd: 22,
  activityHoursTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  typingIndicatorEnabled: true,
  typingSpeedWpm: 40,
  readReceiptEnabled: true,
  readReceiptDelayMin: 5,
  readReceiptDelayMax: 30,
  multiMessageEnabled: true,
  multiMessageDelayMin: 3,
  multiMessageDelayMax: 10,
  // Response rate - 85% means occasionally "busy"
  responseRate: 85,
  // Emoji-only responses - 10% chance for casual acknowledgments
  emojiOnlyResponseEnabled: true,
  emojiOnlyResponseChance: 10,
  // Conversation fatigue
  conversationFatigueEnabled: true,
  fatigueTriggerMessages: 15,
  fatigueResponseReduction: 5,
  // Natural closing
  conversationClosingEnabled: true,
  closingTriggerIdleMinutes: 30,
};

// Agent definition (user-configurable)
export interface AutopilotAgent {
  id: string;
  name: string;
  description: string;
  goal: string;                    // e.g., "Schedule a meeting"
  systemPrompt: string;            // Custom personality/instructions
  behavior: AgentBehaviorSettings;
  goalCompletionBehavior: GoalCompletionBehavior;
  createdAt: string;
  updatedAt: string;
}

// Per-chat autopilot config
export type AutopilotMode = 'manual-approval' | 'self-driving';
export type AutopilotStatus = 'inactive' | 'active' | 'paused' | 'goal-completed' | 'error';

export interface ChatAutopilotConfig {
  chatId: string;
  enabled: boolean;
  agentId: string;
  mode: AutopilotMode;
  status: AutopilotStatus;

  // Self-driving time constraint
  selfDrivingDurationMinutes?: number;  // e.g., 10, 30, 60
  selfDrivingStartedAt?: string;
  selfDrivingExpiresAt?: string;

  // Goal override (optional)
  goalCompletionBehaviorOverride?: GoalCompletionBehavior;

  // Tracking
  messagesHandled: number;
  lastActivityAt?: string;
  errorCount: number;
  lastError?: string;

  createdAt: string;
  updatedAt: string;
}

// Scheduled action queue
export interface ScheduledAutopilotAction {
  id: string;
  chatId: string;
  agentId: string;
  type: 'send-message' | 'send-read-receipt' | 'typing-indicator';
  scheduledFor: string;           // ISO timestamp
  createdAt: string;
  messageText?: string;
  messageId?: string;
  status: 'pending' | 'executing' | 'completed' | 'cancelled' | 'failed';
  attempts: number;
  lastError?: string;
}

// Activity log
export type AutopilotActivityType =
  | 'draft-generated'
  | 'message-sent'
  | 'message-received'
  | 'goal-detected'
  | 'mode-changed'
  | 'agent-changed'
  | 'error'
  | 'paused'
  | 'resumed'
  | 'handoff-triggered'
  | 'time-expired'
  | 'skipped-busy'           // Skipped due to response rate
  | 'emoji-only-sent'        // Sent emoji-only response
  | 'conversation-closing'   // Suggested closing
  | 'fatigue-reduced';       // Response rate reduced due to fatigue

export interface AutopilotActivityEntry {
  id: string;
  chatId: string;
  agentId: string;
  type: AutopilotActivityType;
  timestamp: string;
  messageText?: string;
  draftText?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

// Handoff summary
export interface ConversationHandoffSummary {
  chatId: string;
  agentId: string;
  generatedAt: string;
  summary: string;
  keyPoints: string[];
  suggestedNextSteps: string[];
  goalStatus: 'achieved' | 'in-progress' | 'unclear';
}

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
 * Contact profile - metadata and notes about a contact
 * Links to one or more platform chats
 */
export interface CrmContactProfile {
  id: string;              // Unique ID for this contact

  // Display info (can override platform defaults)
  displayName: string;     // User-defined name
  nickname?: string;       // Optional nickname
  avatarUrl?: string;      // User-defined avatar (or from platform)

  // Contact details
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  location?: string;

  // Platform links - connects this contact to platform chats
  platformLinks: CrmPlatformLink[];

  // Organization
  tags: string[];          // Tag IDs

  // Notes
  notes: string;           // Free-form notes

  // Relationship tracking
  relationship?: 'personal' | 'professional' | 'family' | 'acquaintance' | 'other';
  importance?: 'high' | 'medium' | 'low';

  // Interaction metrics (computed)
  lastInteractionAt?: string;
  firstInteractionAt?: string;
  totalMessageCount?: number;
  messagesSent?: number;        // Messages sent by me to this contact
  messagesReceived?: number;    // Messages received from this contact

  // Phase 4: Enhanced interaction tracking
  lastConversationInitiator?: 'me' | 'them'; // Who started the most recent conversation
  avgResponseTimeMinutes?: number;           // Average time to respond in minutes
  messageFrequencyPerDay?: number;           // Average messages per day
  lastInboundAt?: string;                    // Last message received from them
  lastOutboundAt?: string;                   // Last message sent by me

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * Simplified contact info for quick lookups
 * Maps chatId -> contactId for fast resolution
 */
export interface CrmChatMapping {
  chatId: string;
  contactId: string;
}

/**
 * CRM store state
 */
export interface CrmStore {
  contacts: Record<string, CrmContactProfile>;  // contactId -> profile
  tags: Record<string, CrmTag>;                  // tagId -> tag
  chatMappings: Record<string, string>;          // chatId -> contactId
}
