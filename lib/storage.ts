import {
  Draft,
  AppSettings,
  BeeperMessage,
  BeeperAccount,
  ToneSettings,
  WritingStylePatterns,
  AutopilotAgent,
  ChatAutopilotConfig,
  AutopilotActivityEntry,
  ScheduledAutopilotAction,
  ConversationHandoffSummary,
  CrmContactProfile,
  CrmTag,
} from './types';
import { emitActivityAdded, emitActionScheduled, emitConfigChanged } from './autopilot-events';
import { logger } from './logger';
import { STORAGE_KEYS } from './constants';
import { StorageManager, MapStorageManager, SetStorageManager, TimestampedStorageManager } from './storage-manager';

// Create storage manager instances
const draftsManager = new StorageManager<Draft[]>(STORAGE_KEYS.DRAFTS, [], 'drafts');
const settingsManager = new StorageManager<AppSettings>(STORAGE_KEYS.SETTINGS, { selectedAccountIds: [] }, 'settings');
const messagesManager = new TimestampedStorageManager<BeeperMessage[]>(STORAGE_KEYS.MESSAGES, [], 'messages');
const accountsManager = new TimestampedStorageManager<BeeperAccount[]>(STORAGE_KEYS.ACCOUNTS, [], 'accounts');
const avatarsManager = new MapStorageManager<string, string>(STORAGE_KEYS.AVATARS, 'avatars');
const chatInfoManager = new MapStorageManager<string, { isGroup: boolean; title?: string }>(STORAGE_KEYS.CHAT_INFO, 'chatInfo');

// Draft storage

export function loadDrafts(): Draft[] {
  return draftsManager.load();
}

export function saveDrafts(drafts: Draft[]): void {
  draftsManager.save(drafts);
}

export function addDraft(draft: Draft): Draft[] {
  const drafts = loadDrafts();
  const updated = [...drafts, draft];
  saveDrafts(updated);
  return updated;
}

export function updateDraft(id: string, updates: Partial<Draft>): Draft[] {
  const drafts = loadDrafts();
  const updated = drafts.map(d =>
    d.id === id
      ? { ...d, ...updates, updatedAt: new Date().toISOString() }
      : d
  );
  saveDrafts(updated);
  return updated;
}

export function deleteDraft(id: string): Draft[] {
  const drafts = loadDrafts();
  const updated = drafts.filter(d => d.id !== id);
  saveDrafts(updated);
  return updated;
}

// Update draft recipient names from a name map
// nameMap: chatId -> correct display name
export function updateDraftRecipientNames(nameMap: Record<string, { name: string; avatarUrl?: string }>): number {
  if (typeof window === 'undefined') return 0;

  try {
    const drafts = loadDrafts();
    let updatedCount = 0;

    const updatedDrafts = drafts.map(draft => {
      const correction = nameMap[draft.chatId];
      if (correction && draft.recipientName !== correction.name) {
        updatedCount++;
        return {
          ...draft,
          recipientName: correction.name,
          avatarUrl: correction.avatarUrl || draft.avatarUrl,
          updatedAt: new Date().toISOString(),
        };
      }
      return draft;
    });

    if (updatedCount > 0) {
      saveDrafts(updatedDrafts);
      logger.storage(`Updated ${updatedCount} drafts with correct recipient names`);
    }

    return updatedCount;
  } catch (error) {
    logger.error('Failed to update draft recipient names', error instanceof Error ? error : String(error));
    return 0;
  }
}

// Settings storage

export function loadSettings(): AppSettings {
  return settingsManager.load();
}

export function saveSettings(settings: AppSettings): void {
  settingsManager.save(settings);
}

// Generate unique ID for drafts
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Message cache storage

export function loadCachedMessages(): BeeperMessage[] {
  return messagesManager.load();
}

export function saveCachedMessages(messages: BeeperMessage[]): void {
  messagesManager.save(messages);
}

export function getCachedMessageById(messageId: string): BeeperMessage | undefined {
  const messages = loadCachedMessages();
  return messages.find(m => m.id === messageId);
}

// Update cached messages with correct participant names from a name map
// nameMap: chatId -> correct display name
export function updateCachedMessageNames(nameMap: Record<string, { name: string; avatarUrl?: string }>): number {
  if (typeof window === 'undefined') return 0;

  try {
    const messages = loadCachedMessages();
    let updatedCount = 0;

    const updatedMessages = messages.map(msg => {
      const correction = nameMap[msg.chatId];
      if (correction && (msg.senderName !== correction.name || msg.chatName !== correction.name)) {
        updatedCount++;
        return {
          ...msg,
          senderName: correction.name,
          chatName: correction.name,
          senderAvatarUrl: correction.avatarUrl || msg.senderAvatarUrl,
        };
      }
      return msg;
    });

    if (updatedCount > 0) {
      saveCachedMessages(updatedMessages);
      logger.storage(` Updated ${updatedCount} cached messages with correct names`);
    }

    return updatedCount;
  } catch (error) {
    logger.error('Failed to update cached message names:', error instanceof Error ? error : String(error));
    return 0;
  }
}

// Account cache storage

export function loadCachedAccounts(): BeeperAccount[] {
  return accountsManager.load();
}

export function saveCachedAccounts(accounts: BeeperAccount[]): void {
  accountsManager.save(accounts);
}

// Avatar cache storage (chatId -> avatarUrl)

export function loadCachedAvatars(): Record<string, string> {
  return avatarsManager.load();
}

export function saveCachedAvatars(avatars: Record<string, string>): void {
  avatarsManager.save(avatars);
}

export function mergeCachedAvatars(newAvatars: Record<string, string>): Record<string, string> {
  return avatarsManager.merge(newAvatars);
}

// Chat info cache storage (chatId -> { isGroup, title })
export interface CachedChatInfo {
  isGroup: boolean;
  title?: string;
}

export function loadCachedChatInfo(): Record<string, CachedChatInfo> {
  return chatInfoManager.load();
}

export function saveCachedChatInfo(chatInfo: Record<string, CachedChatInfo>): void {
  chatInfoManager.save(chatInfo);
}

export function mergeCachedChatInfo(newChatInfo: Record<string, CachedChatInfo>): Record<string, CachedChatInfo> {
  return chatInfoManager.merge(newChatInfo);
}

// Create manager instances for hidden chats
const hiddenChatsManager = new SetStorageManager<string>(STORAGE_KEYS.HIDDEN_CHATS, 'hiddenChats');

// Hidden chats metadata storage
export interface HiddenChatInfo {
  chatId: string;
  name: string;
  avatarUrl?: string;
  platform?: string;
}

const hiddenChatsMetaManager = new StorageManager<HiddenChatInfo[]>(
  STORAGE_KEYS.HIDDEN_CHATS_META,
  [],
  'hiddenChatsMeta'
);

// Define default values for tone and writing style
const DEFAULT_TONE_SETTINGS: ToneSettings = {
  briefDetailed: 50,
  formalCasual: 50,
};

const DEFAULT_WRITING_STYLE: WritingStylePatterns = {
  sampleMessages: [],
  commonPhrases: [],
  frequentEmojis: [],
  greetingPatterns: [],
  signOffPatterns: [],
  punctuationStyle: {
    usesMultipleExclamation: false,
    usesEllipsis: false,
    usesAllCaps: false,
    endsWithPunctuation: true,
  },
  capitalizationStyle: 'proper',
  avgWordsPerMessage: 10,
  abbreviations: [],
  languageQuirks: [],
};

// Create manager instances for tone and writing style
const toneSettingsManager = new StorageManager<ToneSettings>(
  STORAGE_KEYS.TONE_SETTINGS,
  DEFAULT_TONE_SETTINGS,
  'toneSettings'
);

const writingStyleManager = new StorageManager<WritingStylePatterns>(
  STORAGE_KEYS.WRITING_STYLE,
  DEFAULT_WRITING_STYLE,
  'writingStyle'
);

// User messages cache interface and manager
export interface CachedUserMessage {
  id: string;
  chatId: string;
  text: string;
  timestamp: string;
}

const userMessagesCacheManager = new StorageManager<CachedUserMessage[]>(
  STORAGE_KEYS.USER_MESSAGES,
  [],
  'userMessagesCache'
);

// AI Chat history interface and manager
export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatHistory {
  [chatId: string]: AiChatMessage[];
}

const aiChatHistoryManager = new MapStorageManager<string, AiChatMessage[]>(
  STORAGE_KEYS.AI_CHAT_HISTORY,
  'aiChatHistory'
);

// Thread context interfaces and manager
export interface ThreadContextMessage {
  id: string;
  text: string;
  isFromMe: boolean;
  senderName: string;
  timestamp: string;
}

export interface ThreadContext {
  chatId: string;
  senderName: string;
  messages: ThreadContextMessage[];
  lastUpdated: string;
}

export interface ThreadContextStore {
  [chatId: string]: ThreadContext;
}

const threadContextManager = new MapStorageManager<string, ThreadContext>(
  STORAGE_KEYS.THREAD_CONTEXT,
  'threadContext'
);

// Update cached chat info with correct names (e.g., when API fixes participant name resolution)
export function updateCachedChatInfoTitles(nameMap: Record<string, string>): number {
  if (typeof window === 'undefined') return 0;

  try {
    const chatInfo = loadCachedChatInfo();
    let updatedCount = 0;

    const updatedChatInfo: Record<string, CachedChatInfo> = {};
    for (const [chatId, info] of Object.entries(chatInfo)) {
      const correctName = nameMap[chatId];
      if (correctName && info.title !== correctName) {
        updatedCount++;
        updatedChatInfo[chatId] = { ...info, title: correctName };
      } else {
        updatedChatInfo[chatId] = info;
      }
    }

    if (updatedCount > 0) {
      saveCachedChatInfo(updatedChatInfo);
      logger.storage(` Updated ${updatedCount} cached chat info entries with correct names`);
    }

    return updatedCount;
  } catch (error) {
    logger.error('Failed to update cached chat info titles:', error instanceof Error ? error : String(error));
    return 0;
  }
}

// Hidden chats storage functions using SetStorageManager
export function loadHiddenChats(): Set<string> {
  return hiddenChatsManager.load();
}

export function loadHiddenChatsWithMeta(): HiddenChatInfo[] {
  const meta = hiddenChatsMetaManager.load();
  if (meta.length === 0) {
    // Fallback to old format - just IDs
    const ids = loadHiddenChats();
    return Array.from(ids).map(chatId => ({ chatId, name: chatId }));
  }
  return meta;
}

export function saveHiddenChats(hiddenChats: Set<string>): void {
  hiddenChatsManager.save(hiddenChats);
}

export function saveHiddenChatsWithMeta(hiddenChats: HiddenChatInfo[]): void {
  hiddenChatsMetaManager.save(hiddenChats);
  // Also save the ID set for backwards compatibility
  const ids = new Set(hiddenChats.map(h => h.chatId));
  saveHiddenChats(ids);
}

export function addHiddenChat(chatId: string, name?: string, avatarUrl?: string, platform?: string): Set<string> {
  const updated = hiddenChatsManager.add(chatId);

  // Also save metadata
  const meta = loadHiddenChatsWithMeta();
  if (!meta.find(h => h.chatId === chatId)) {
    hiddenChatsMetaManager.update(current => [
      ...current,
      { chatId, name: name || chatId, avatarUrl, platform }
    ]);
  }

  return updated;
}

export function removeHiddenChat(chatId: string): Set<string> {
  const updated = hiddenChatsManager.delete(chatId);

  // Also remove from metadata
  hiddenChatsMetaManager.update(current =>
    current.filter(h => h.chatId !== chatId)
  );

  return updated;
}

export function clearAllHiddenChats(): void {
  hiddenChatsManager.clear();
  hiddenChatsMetaManager.clear();
}

// Tone settings storage using StorageManager
export function loadToneSettings(): ToneSettings {
  return toneSettingsManager.load();
}

export function saveToneSettings(settings: ToneSettings): void {
  toneSettingsManager.save(settings);
}

// Writing style storage using StorageManager
export function loadWritingStylePatterns(): WritingStylePatterns {
  return writingStyleManager.load();
}

export function saveWritingStylePatterns(patterns: WritingStylePatterns): void {
  writingStyleManager.save(patterns);
}

// User messages cache storage using StorageManager
export function loadCachedUserMessages(): CachedUserMessage[] {
  return userMessagesCacheManager.load();
}

export function saveCachedUserMessages(messages: CachedUserMessage[]): void {
  userMessagesCacheManager.save(messages);
}

// AI Chat history storage using MapStorageManager
export function loadAiChatHistory(): AiChatHistory {
  return aiChatHistoryManager.load();
}

export function saveAiChatHistory(history: AiChatHistory): void {
  aiChatHistoryManager.save(history);
}

export function getAiChatForThread(chatId: string): AiChatMessage[] {
  const history = loadAiChatHistory();
  return history[chatId] || [];
}

export function saveAiChatForThread(chatId: string, messages: AiChatMessage[]): void {
  aiChatHistoryManager.merge({ [chatId]: messages });
}

// Thread context storage using MapStorageManager
export function loadThreadContextStore(): ThreadContextStore {
  return threadContextManager.load();
}

export function saveThreadContextStore(store: ThreadContextStore): void {
  threadContextManager.save(store);
}

export function getThreadContext(chatId: string): ThreadContext | null {
  const store = loadThreadContextStore();
  return store[chatId] || null;
}

export function saveThreadContext(chatId: string, senderName: string, messages: ThreadContextMessage[]): void {
  threadContextManager.merge({
    [chatId]: {
      chatId,
      senderName,
      messages,
      lastUpdated: new Date().toISOString(),
    }
  });
}

export function updateThreadContextWithNewMessages(
  chatId: string,
  senderName: string,
  newMessages: ThreadContextMessage[]
): ThreadContext {
  const existing = getThreadContext(chatId);
  const existingIds = new Set(existing?.messages.map(m => m.id) || []);

  // Add only new messages (by ID)
  const messagesToAdd = newMessages.filter(m => !existingIds.has(m.id));
  const allMessages = [...(existing?.messages || []), ...messagesToAdd];

  // Sort by timestamp - keep all messages (no limit) so user sees all loaded history
  const sortedMessages = allMessages
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  saveThreadContext(chatId, senderName, sortedMessages);

  return {
    chatId,
    senderName,
    messages: sortedMessages,
    lastUpdated: new Date().toISOString(),
  };
}

export function formatThreadContextForPrompt(context: ThreadContext | null): string {
  if (!context || context.messages.length === 0) return '';

  return context.messages
    .map(m => `${m.isFromMe ? 'Me' : m.senderName}: ${m.text}`)
    .join('\n');
}

export function formatAiChatSummaryForPrompt(aiMessages: AiChatMessage[]): string {
  if (aiMessages.length === 0) return '';

  // Get last few exchanges to understand ongoing AI conversation
  const recentMessages = aiMessages.slice(-10);
  return recentMessages
    .map(m => `${m.role === 'user' ? 'User asked' : 'AI responded'}: ${m.content}`)
    .join('\n');
}

// Clear all app data from localStorage (keeps API keys)
export function clearAllData(): void {
  if (typeof window === 'undefined') return;

  // Preserve API keys from settings
  const currentSettings = loadSettings();
  const preservedSettings: AppSettings = {
    selectedAccountIds: [],
    beeperAccessToken: currentSettings.beeperAccessToken,
    anthropicApiKey: currentSettings.anthropicApiKey,
    openaiApiKey: currentSettings.openaiApiKey,
  };

  const keysToRemove = [
    STORAGE_KEYS.DRAFTS,
    STORAGE_KEYS.SETTINGS,
    STORAGE_KEYS.MESSAGES,
    STORAGE_KEYS.ACCOUNTS,
    STORAGE_KEYS.AVATARS,
    STORAGE_KEYS.CHAT_INFO,
    STORAGE_KEYS.CACHE_TIMESTAMP,
    `${STORAGE_KEYS.CACHE_TIMESTAMP}-messages`,
    `${STORAGE_KEYS.CACHE_TIMESTAMP}-accounts`,
    STORAGE_KEYS.HIDDEN_CHATS,
    STORAGE_KEYS.HIDDEN_CHATS_META,
    STORAGE_KEYS.TONE_SETTINGS,
    STORAGE_KEYS.USER_MESSAGES,
    STORAGE_KEYS.AI_CHAT_HISTORY,
    STORAGE_KEYS.THREAD_CONTEXT,
    // Autopilot keys
    STORAGE_KEYS.AUTOPILOT_AGENTS,
    STORAGE_KEYS.AUTOPILOT_CHAT_CONFIGS,
    STORAGE_KEYS.AUTOPILOT_ACTIVITY,
    STORAGE_KEYS.AUTOPILOT_SCHEDULED,
    STORAGE_KEYS.AUTOPILOT_HANDOFFS,
  ];

  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });

  // Restore API keys
  saveSettings(preservedSettings);
}

// Clear only cached/synced data (keeps user settings like API keys, tone, hidden chats)
export function clearCachedData(): void {
  if (typeof window === 'undefined') return;

  const keysToRemove = [
    STORAGE_KEYS.MESSAGES,
    STORAGE_KEYS.ACCOUNTS,
    STORAGE_KEYS.AVATARS,
    STORAGE_KEYS.CHAT_INFO,
    STORAGE_KEYS.CACHE_TIMESTAMP,
    `${STORAGE_KEYS.CACHE_TIMESTAMP}-messages`,
    `${STORAGE_KEYS.CACHE_TIMESTAMP}-accounts`,
    STORAGE_KEYS.USER_MESSAGES,
    STORAGE_KEYS.THREAD_CONTEXT,
    STORAGE_KEYS.AI_CHAT_HISTORY, // Also clear AI chat history as it contains participant names
  ];

  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
}

// ============================================
// AUTOPILOT STORAGE
// ============================================

// Create manager instances for autopilot storage
const autopilotAgentsManager = new StorageManager<AutopilotAgent[]>(
  STORAGE_KEYS.AUTOPILOT_AGENTS,
  [],
  'autopilotAgents'
);

const chatAutopilotConfigsManager = new MapStorageManager<string, ChatAutopilotConfig>(
  STORAGE_KEYS.AUTOPILOT_CHAT_CONFIGS,
  'chatAutopilotConfigs'
);

const autopilotActivityManager = new StorageManager<AutopilotActivityEntry[]>(
  STORAGE_KEYS.AUTOPILOT_ACTIVITY,
  [],
  'autopilotActivity'
);

const scheduledActionsManager = new StorageManager<ScheduledAutopilotAction[]>(
  STORAGE_KEYS.AUTOPILOT_SCHEDULED,
  [],
  'scheduledActions'
);

const autopilotHandoffsManager = new MapStorageManager<string, ConversationHandoffSummary>(
  STORAGE_KEYS.AUTOPILOT_HANDOFFS,
  'autopilotHandoffs'
);

const MAX_ACTIVITY_ENTRIES = 500;

// Agent CRUD operations using StorageManager
export function loadAutopilotAgents(): AutopilotAgent[] {
  return autopilotAgentsManager.load();
}

export function saveAutopilotAgents(agents: AutopilotAgent[]): void {
  autopilotAgentsManager.save(agents);
}

export function getAutopilotAgentById(id: string): AutopilotAgent | undefined {
  return loadAutopilotAgents().find(a => a.id === id);
}

export function addAutopilotAgent(agent: AutopilotAgent): AutopilotAgent[] {
  return autopilotAgentsManager.update(current => [...current, agent]);
}

export function updateAutopilotAgent(id: string, updates: Partial<AutopilotAgent>): AutopilotAgent[] {
  return autopilotAgentsManager.update(agents =>
    agents.map(a =>
      a.id === id
        ? { ...a, ...updates, updatedAt: new Date().toISOString() }
        : a
    )
  );
}

export function deleteAutopilotAgent(id: string): AutopilotAgent[] {
  return autopilotAgentsManager.update(agents => agents.filter(a => a.id !== id));
}

// Chat autopilot config operations using MapStorageManager
export function loadChatAutopilotConfigs(): Record<string, ChatAutopilotConfig> {
  return chatAutopilotConfigsManager.load();
}

export function saveChatAutopilotConfigs(configs: Record<string, ChatAutopilotConfig>): void {
  chatAutopilotConfigsManager.save(configs);
}

export function getChatAutopilotConfig(chatId: string): ChatAutopilotConfig | null {
  const configs = loadChatAutopilotConfigs();
  return configs[chatId] || null;
}

export function saveChatAutopilotConfig(config: ChatAutopilotConfig): void {
  chatAutopilotConfigsManager.merge({
    [config.chatId]: { ...config, updatedAt: new Date().toISOString() }
  });

  // Emit event for real-time updates
  emitConfigChanged(config.chatId);
}

export function deleteChatAutopilotConfig(chatId: string): void {
  chatAutopilotConfigsManager.delete(chatId);
}

export function getActiveAutopilotChats(): ChatAutopilotConfig[] {
  const configs = loadChatAutopilotConfigs();
  return Object.values(configs).filter(c => c.enabled && c.status === 'active');
}

// Activity log operations using StorageManager
export function loadAutopilotActivity(): AutopilotActivityEntry[] {
  return autopilotActivityManager.load();
}

export function saveAutopilotActivity(entries: AutopilotActivityEntry[]): void {
  autopilotActivityManager.save(entries);
}

export function addAutopilotActivityEntry(entry: AutopilotActivityEntry): void {
  autopilotActivityManager.update(entries => {
    const updated = [...entries, entry];
    // Prune if over limit
    return updated.length > MAX_ACTIVITY_ENTRIES
      ? updated.slice(-MAX_ACTIVITY_ENTRIES)
      : updated;
  });

  // Emit event for real-time updates
  emitActivityAdded(entry.chatId, entry.type);
}

export function getActivityForChat(chatId: string): AutopilotActivityEntry[] {
  return loadAutopilotActivity().filter(e => e.chatId === chatId);
}

export function clearAutopilotActivity(): void {
  autopilotActivityManager.clear();
}

// Scheduled actions operations using StorageManager
export function loadScheduledActions(): ScheduledAutopilotAction[] {
  return scheduledActionsManager.load();
}

export function saveScheduledActions(actions: ScheduledAutopilotAction[]): void {
  scheduledActionsManager.save(actions);
}

export function addScheduledAction(action: ScheduledAutopilotAction): void {
  scheduledActionsManager.update(actions => [...actions, action]);

  // Emit event for real-time updates
  emitActionScheduled(action.chatId, action.id, action.scheduledFor);
}

export function updateScheduledAction(id: string, updates: Partial<ScheduledAutopilotAction>): void {
  scheduledActionsManager.update(actions =>
    actions.map(a => a.id === id ? { ...a, ...updates } : a)
  );
}

export function deleteScheduledAction(id: string): void {
  scheduledActionsManager.update(actions => actions.filter(a => a.id !== id));
}

export function getNextPendingAction(): ScheduledAutopilotAction | null {
  const actions = loadScheduledActions();
  const now = new Date().toISOString();

  // Find actions that are pending and due
  const pending = actions
    .filter(a => a.status === 'pending' && a.scheduledFor <= now)
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));

  return pending[0] || null;
}

export function getPendingActionsForChat(chatId: string): ScheduledAutopilotAction[] {
  return loadScheduledActions().filter(a => a.chatId === chatId && a.status === 'pending');
}

export function cancelActionsForChat(chatId: string): void {
  scheduledActionsManager.update(actions =>
    actions.map(a =>
      a.chatId === chatId && a.status === 'pending'
        ? { ...a, status: 'cancelled' as const }
        : a
    )
  );
}

export function cleanupCompletedActions(): void {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  scheduledActionsManager.update(actions =>
    actions.filter(a =>
      a.status === 'pending' ||
      a.status === 'executing' ||
      (a.status === 'failed' && a.createdAt > oneDayAgo)
    )
  );
}

// Handoff summaries operations using MapStorageManager
export function loadHandoffSummaries(): Record<string, ConversationHandoffSummary> {
  return autopilotHandoffsManager.load();
}

export function saveHandoffSummaries(summaries: Record<string, ConversationHandoffSummary>): void {
  autopilotHandoffsManager.save(summaries);
}

export function getHandoffSummary(chatId: string): ConversationHandoffSummary | null {
  const summaries = loadHandoffSummaries();
  return summaries[chatId] || null;
}

export function saveHandoffSummary(summary: ConversationHandoffSummary): void {
  autopilotHandoffsManager.merge({ [summary.chatId]: summary });
}

export function deleteHandoffSummary(chatId: string): void {
  autopilotHandoffsManager.delete(chatId);
}

// ============================================
// CRM STORAGE
// ============================================

// Default tag colors
const DEFAULT_TAG_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];

// Create manager instances for CRM storage
const crmContactsManager = new MapStorageManager<string, CrmContactProfile>(
  STORAGE_KEYS.CRM_CONTACTS,
  'crmContacts'
);

const crmTagsManager = new MapStorageManager<string, CrmTag>(
  STORAGE_KEYS.CRM_TAGS,
  'crmTags'
);

const crmChatMappingsManager = new MapStorageManager<string, string>(
  STORAGE_KEYS.CRM_CHAT_MAPPINGS,
  'crmChatMappings'
);

// CRM Contact operations
export function loadCrmContacts(): Record<string, CrmContactProfile> {
  return crmContactsManager.load();
}

export function saveCrmContacts(contacts: Record<string, CrmContactProfile>): void {
  crmContactsManager.save(contacts);
}

export function getCrmContactById(contactId: string): CrmContactProfile | null {
  const contacts = loadCrmContacts();
  return contacts[contactId] || null;
}

export function getCrmContactByChatId(chatId: string): CrmContactProfile | null {
  const mappings = loadCrmChatMappings();
  const contactId = mappings[chatId];
  if (!contactId) return null;
  return getCrmContactById(contactId);
}

export function saveCrmContact(contact: CrmContactProfile): void {
  crmContactsManager.merge({
    [contact.id]: { ...contact, updatedAt: new Date().toISOString() }
  });

  // Update chat mappings for all platform links
  const mappings: Record<string, string> = {};
  for (const link of contact.platformLinks) {
    mappings[link.chatId] = contact.id;
  }
  if (Object.keys(mappings).length > 0) {
    crmChatMappingsManager.merge(mappings);
  }
}

export function createCrmContact(
  displayName: string,
  chatId: string,
  platform: string,
  accountId: string,
  avatarUrl?: string
): CrmContactProfile {
  const now = new Date().toISOString();
  const contact: CrmContactProfile = {
    id: generateId(),
    displayName,
    avatarUrl,
    platformLinks: [{
      platform,
      chatId,
      accountId,
      displayName,
      avatarUrl,
      addedAt: now,
    }],
    tags: [],
    notes: '',
    createdAt: now,
    updatedAt: now,
  };

  saveCrmContact(contact);
  return contact;
}

export function updateCrmContact(contactId: string, updates: Partial<CrmContactProfile>): CrmContactProfile | null {
  const contact = getCrmContactById(contactId);
  if (!contact) return null;

  const updated = {
    ...contact,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveCrmContact(updated);
  return updated;
}

export function deleteCrmContact(contactId: string): void {
  const contact = getCrmContactById(contactId);
  if (contact) {
    // Remove chat mappings
    for (const link of contact.platformLinks) {
      crmChatMappingsManager.delete(link.chatId);
    }
  }
  crmContactsManager.delete(contactId);
}

export function addPlatformLinkToContact(
  contactId: string,
  chatId: string,
  platform: string,
  accountId: string,
  displayName?: string,
  avatarUrl?: string
): CrmContactProfile | null {
  const contact = getCrmContactById(contactId);
  if (!contact) return null;

  // Check if link already exists
  if (contact.platformLinks.some(link => link.chatId === chatId)) {
    return contact;
  }

  const updated: CrmContactProfile = {
    ...contact,
    platformLinks: [
      ...contact.platformLinks,
      {
        platform,
        chatId,
        accountId,
        displayName,
        avatarUrl,
        addedAt: new Date().toISOString(),
      }
    ],
    updatedAt: new Date().toISOString(),
  };

  saveCrmContact(updated);
  return updated;
}

export function removePlatformLinkFromContact(contactId: string, chatId: string): CrmContactProfile | null {
  const contact = getCrmContactById(contactId);
  if (!contact) return null;

  const updated: CrmContactProfile = {
    ...contact,
    platformLinks: contact.platformLinks.filter(link => link.chatId !== chatId),
    updatedAt: new Date().toISOString(),
  };

  // Remove chat mapping
  crmChatMappingsManager.delete(chatId);

  saveCrmContact(updated);
  return updated;
}

// Merge two contacts into one
export function mergeCrmContacts(targetContactId: string, sourceContactId: string): CrmContactProfile | null {
  const target = getCrmContactById(targetContactId);
  const source = getCrmContactById(sourceContactId);
  if (!target || !source) return null;

  // Merge platform links (avoid duplicates)
  const existingChatIds = new Set(target.platformLinks.map(l => l.chatId));
  const newLinks = source.platformLinks.filter(l => !existingChatIds.has(l.chatId));

  // Merge tags (unique)
  const mergedTags = [...new Set([...target.tags, ...source.tags])];

  // Merge notes
  const mergedNotes = target.notes && source.notes
    ? `${target.notes}\n\n---\nMerged from ${source.displayName}:\n${source.notes}`
    : target.notes || source.notes;

  const updated: CrmContactProfile = {
    ...target,
    platformLinks: [...target.platformLinks, ...newLinks],
    tags: mergedTags,
    notes: mergedNotes,
    // Keep target's primary info, but fill in blanks from source
    email: target.email || source.email,
    phone: target.phone || source.phone,
    company: target.company || source.company,
    role: target.role || source.role,
    location: target.location || source.location,
    updatedAt: new Date().toISOString(),
  };

  saveCrmContact(updated);

  // Delete the source contact
  deleteCrmContact(sourceContactId);

  return updated;
}

// CRM Tag operations
export function loadCrmTags(): Record<string, CrmTag> {
  return crmTagsManager.load();
}

export function saveCrmTags(tags: Record<string, CrmTag>): void {
  crmTagsManager.save(tags);
}

export function getCrmTagById(tagId: string): CrmTag | null {
  const tags = loadCrmTags();
  return tags[tagId] || null;
}

export function createCrmTag(name: string, color?: string): CrmTag {
  const tags = loadCrmTags();
  const tagCount = Object.keys(tags).length;

  const tag: CrmTag = {
    id: generateId(),
    name,
    color: color || DEFAULT_TAG_COLORS[tagCount % DEFAULT_TAG_COLORS.length],
    createdAt: new Date().toISOString(),
  };

  crmTagsManager.merge({ [tag.id]: tag });
  return tag;
}

export function updateCrmTag(tagId: string, updates: Partial<CrmTag>): CrmTag | null {
  const tag = getCrmTagById(tagId);
  if (!tag) return null;

  const updated = { ...tag, ...updates };
  crmTagsManager.merge({ [tagId]: updated });
  return updated;
}

export function deleteCrmTag(tagId: string): void {
  // Remove tag from all contacts
  const contacts = loadCrmContacts();
  for (const contact of Object.values(contacts)) {
    if (contact.tags.includes(tagId)) {
      updateCrmContact(contact.id, {
        tags: contact.tags.filter(t => t !== tagId)
      });
    }
  }
  crmTagsManager.delete(tagId);
}

// CRM Chat mappings operations
export function loadCrmChatMappings(): Record<string, string> {
  return crmChatMappingsManager.load();
}

export function saveCrmChatMappings(mappings: Record<string, string>): void {
  crmChatMappingsManager.save(mappings);
}

// Get all contacts with a specific tag
export function getContactsByTag(tagId: string): CrmContactProfile[] {
  const contacts = loadCrmContacts();
  return Object.values(contacts).filter(c => c.tags.includes(tagId));
}

// Search contacts by name
export function searchCrmContacts(query: string): CrmContactProfile[] {
  const contacts = loadCrmContacts();
  const lowerQuery = query.toLowerCase();

  return Object.values(contacts).filter(contact => {
    const matchesName = contact.displayName.toLowerCase().includes(lowerQuery);
    const matchesNickname = contact.nickname?.toLowerCase().includes(lowerQuery);
    const matchesCompany = contact.company?.toLowerCase().includes(lowerQuery);
    const matchesNotes = contact.notes.toLowerCase().includes(lowerQuery);
    const matchesPlatformName = contact.platformLinks.some(
      link => link.displayName?.toLowerCase().includes(lowerQuery)
    );

    return matchesName || matchesNickname || matchesCompany || matchesNotes || matchesPlatformName;
  });
}
