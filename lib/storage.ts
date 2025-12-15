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
} from './types';

const DRAFTS_KEY = 'beeper-kanban-drafts';
const SETTINGS_KEY = 'beeper-kanban-settings';
const MESSAGES_KEY = 'beeper-kanban-messages';
const ACCOUNTS_KEY = 'beeper-kanban-accounts';
const AVATARS_KEY = 'beeper-kanban-avatars';
const CHAT_INFO_KEY = 'beeper-kanban-chat-info';
const CACHE_TIMESTAMP_KEY = 'beeper-kanban-cache-timestamp';

// Draft storage

export function loadDrafts(): Draft[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(DRAFTS_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as Draft[];
  } catch {
    console.error('Failed to load drafts from localStorage');
    return [];
  }
}

export function saveDrafts(drafts: Draft[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    console.error('Failed to save drafts to localStorage');
  }
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

export function getDraftById(id: string): Draft | undefined {
  const drafts = loadDrafts();
  return drafts.find(d => d.id === id);
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
      console.log(`[Storage] Updated ${updatedCount} drafts with correct recipient names`);
    }

    return updatedCount;
  } catch (error) {
    console.error('Failed to update draft recipient names:', error);
    return 0;
  }
}

// Settings storage

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') {
    return { selectedAccountIds: [] };
  }

  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return { selectedAccountIds: [] };
    return JSON.parse(stored) as AppSettings;
  } catch {
    console.error('Failed to load settings from localStorage');
    return { selectedAccountIds: [] };
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    console.error('Failed to save settings to localStorage');
  }
}

// Generate unique ID for drafts
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Message cache storage

export function loadCachedMessages(): BeeperMessage[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(MESSAGES_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as BeeperMessage[];
  } catch {
    console.error('Failed to load messages from localStorage');
    return [];
  }
}

export function saveCachedMessages(messages: BeeperMessage[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
    localStorage.setItem(`${CACHE_TIMESTAMP_KEY}-messages`, Date.now().toString());
  } catch {
    console.error('Failed to save messages to localStorage');
  }
}

export function getMessagesCacheTimestamp(): number | null {
  if (typeof window === 'undefined') return null;

  try {
    const timestamp = localStorage.getItem(`${CACHE_TIMESTAMP_KEY}-messages`);
    return timestamp ? parseInt(timestamp, 10) : null;
  } catch {
    return null;
  }
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
      console.log(`[Storage] Updated ${updatedCount} cached messages with correct names`);
    }

    return updatedCount;
  } catch (error) {
    console.error('Failed to update cached message names:', error);
    return 0;
  }
}

// Account cache storage

export function loadCachedAccounts(): BeeperAccount[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(ACCOUNTS_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as BeeperAccount[];
  } catch {
    console.error('Failed to load accounts from localStorage');
    return [];
  }
}

export function saveCachedAccounts(accounts: BeeperAccount[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    localStorage.setItem(`${CACHE_TIMESTAMP_KEY}-accounts`, Date.now().toString());
  } catch {
    console.error('Failed to save accounts to localStorage');
  }
}

export function getAccountsCacheTimestamp(): number | null {
  if (typeof window === 'undefined') return null;

  try {
    const timestamp = localStorage.getItem(`${CACHE_TIMESTAMP_KEY}-accounts`);
    return timestamp ? parseInt(timestamp, 10) : null;
  } catch {
    return null;
  }
}

// Avatar cache storage (chatId -> avatarUrl)

export function loadCachedAvatars(): Record<string, string> {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(AVATARS_KEY);
    if (!stored) return {};
    return JSON.parse(stored) as Record<string, string>;
  } catch {
    console.error('Failed to load avatars from localStorage');
    return {};
  }
}

export function saveCachedAvatars(avatars: Record<string, string>): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(AVATARS_KEY, JSON.stringify(avatars));
  } catch {
    console.error('Failed to save avatars to localStorage');
  }
}

export function mergeCachedAvatars(newAvatars: Record<string, string>): Record<string, string> {
  const existing = loadCachedAvatars();
  const merged = { ...existing, ...newAvatars };
  saveCachedAvatars(merged);
  return merged;
}

// Chat info cache storage (chatId -> { isGroup, title })
export interface CachedChatInfo {
  isGroup: boolean;
  title?: string;
}

export function loadCachedChatInfo(): Record<string, CachedChatInfo> {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(CHAT_INFO_KEY);
    if (!stored) return {};
    return JSON.parse(stored) as Record<string, CachedChatInfo>;
  } catch {
    console.error('Failed to load chat info from localStorage');
    return {};
  }
}

export function saveCachedChatInfo(chatInfo: Record<string, CachedChatInfo>): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(CHAT_INFO_KEY, JSON.stringify(chatInfo));
  } catch {
    console.error('Failed to save chat info to localStorage');
  }
}

export function mergeCachedChatInfo(newChatInfo: Record<string, CachedChatInfo>): Record<string, CachedChatInfo> {
  const existing = loadCachedChatInfo();
  const merged = { ...existing, ...newChatInfo };
  saveCachedChatInfo(merged);
  return merged;
}

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
      console.log(`[Storage] Updated ${updatedCount} cached chat info entries with correct names`);
    }

    return updatedCount;
  } catch (error) {
    console.error('Failed to update cached chat info titles:', error);
    return 0;
  }
}

// Hidden chats storage with metadata
const HIDDEN_CHATS_KEY = 'beeper-kanban-hidden-chats';
const HIDDEN_CHATS_META_KEY = 'beeper-kanban-hidden-chats-meta';

export interface HiddenChatInfo {
  chatId: string;
  name: string;
  avatarUrl?: string;
  platform?: string;
}

export function loadHiddenChats(): Set<string> {
  if (typeof window === 'undefined') return new Set();

  try {
    const stored = localStorage.getItem(HIDDEN_CHATS_KEY);
    if (!stored) return new Set();
    return new Set(JSON.parse(stored) as string[]);
  } catch {
    console.error('Failed to load hidden chats from localStorage');
    return new Set();
  }
}

export function loadHiddenChatsWithMeta(): HiddenChatInfo[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(HIDDEN_CHATS_META_KEY);
    if (!stored) {
      // Fallback to old format - just IDs
      const ids = loadHiddenChats();
      return Array.from(ids).map(chatId => ({ chatId, name: chatId }));
    }
    return JSON.parse(stored) as HiddenChatInfo[];
  } catch {
    console.error('Failed to load hidden chats meta from localStorage');
    return [];
  }
}

export function saveHiddenChats(hiddenChats: Set<string>): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(HIDDEN_CHATS_KEY, JSON.stringify(Array.from(hiddenChats)));
  } catch {
    console.error('Failed to save hidden chats to localStorage');
  }
}

export function saveHiddenChatsWithMeta(hiddenChats: HiddenChatInfo[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(HIDDEN_CHATS_META_KEY, JSON.stringify(hiddenChats));
    // Also save the ID set for backwards compatibility
    const ids = new Set(hiddenChats.map(h => h.chatId));
    saveHiddenChats(ids);
  } catch {
    console.error('Failed to save hidden chats meta to localStorage');
  }
}

export function addHiddenChat(chatId: string, name?: string, avatarUrl?: string, platform?: string): Set<string> {
  const hiddenChats = loadHiddenChats();
  hiddenChats.add(chatId);
  saveHiddenChats(hiddenChats);

  // Also save metadata
  const meta = loadHiddenChatsWithMeta();
  if (!meta.find(h => h.chatId === chatId)) {
    meta.push({ chatId, name: name || chatId, avatarUrl, platform });
    saveHiddenChatsWithMeta(meta);
  }

  return hiddenChats;
}

export function removeHiddenChat(chatId: string): Set<string> {
  const hiddenChats = loadHiddenChats();
  hiddenChats.delete(chatId);
  saveHiddenChats(hiddenChats);

  // Also remove from metadata
  const meta = loadHiddenChatsWithMeta();
  const filtered = meta.filter(h => h.chatId !== chatId);
  saveHiddenChatsWithMeta(filtered);

  return hiddenChats;
}

export function clearAllHiddenChats(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(HIDDEN_CHATS_KEY);
  localStorage.removeItem(HIDDEN_CHATS_META_KEY);
}

// Tone settings storage
const TONE_SETTINGS_KEY = 'beeper-kanban-tone-settings';
const WRITING_STYLE_KEY = 'beeper-kanban-writing-style';

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

export function loadToneSettings(): ToneSettings {
  if (typeof window === 'undefined') return DEFAULT_TONE_SETTINGS;

  try {
    const stored = localStorage.getItem(TONE_SETTINGS_KEY);
    if (!stored) return DEFAULT_TONE_SETTINGS;
    return JSON.parse(stored) as ToneSettings;
  } catch {
    console.error('Failed to load tone settings from localStorage');
    return DEFAULT_TONE_SETTINGS;
  }
}

export function saveToneSettings(settings: ToneSettings): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(TONE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    console.error('Failed to save tone settings to localStorage');
  }
}

export function loadWritingStylePatterns(): WritingStylePatterns {
  if (typeof window === 'undefined') return DEFAULT_WRITING_STYLE;

  try {
    const stored = localStorage.getItem(WRITING_STYLE_KEY);
    if (!stored) return DEFAULT_WRITING_STYLE;
    return JSON.parse(stored) as WritingStylePatterns;
  } catch {
    console.error('Failed to load writing style from localStorage');
    return DEFAULT_WRITING_STYLE;
  }
}

export function saveWritingStylePatterns(patterns: WritingStylePatterns): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(WRITING_STYLE_KEY, JSON.stringify(patterns));
  } catch {
    console.error('Failed to save writing style to localStorage');
  }
}

export function getUserMessages(): BeeperMessage[] {
  const messages = loadCachedMessages();
  return messages.filter(m => m.isFromMe && m.text && m.text.trim().length > 0);
}

// User messages cache for tone analysis (stores actual sent messages from chat history)
const USER_MESSAGES_CACHE_KEY = 'beeper-kanban-user-messages-cache';

export interface CachedUserMessage {
  id: string;
  chatId: string;
  text: string;
  timestamp: string;
}

export function loadCachedUserMessages(): CachedUserMessage[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(USER_MESSAGES_CACHE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as CachedUserMessage[];
  } catch {
    console.error('Failed to load user messages cache from localStorage');
    return [];
  }
}

export function saveCachedUserMessages(messages: CachedUserMessage[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(USER_MESSAGES_CACHE_KEY, JSON.stringify(messages));
  } catch {
    console.error('Failed to save user messages cache to localStorage');
  }
}

// AI Chat history storage (per chat thread)
const AI_CHAT_HISTORY_KEY = 'beeper-kanban-ai-chat-history';

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatHistory {
  [chatId: string]: AiChatMessage[];
}

export function loadAiChatHistory(): AiChatHistory {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(AI_CHAT_HISTORY_KEY);
    if (!stored) return {};
    return JSON.parse(stored) as AiChatHistory;
  } catch {
    console.error('Failed to load AI chat history from localStorage');
    return {};
  }
}

export function saveAiChatHistory(history: AiChatHistory): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(AI_CHAT_HISTORY_KEY, JSON.stringify(history));
  } catch {
    console.error('Failed to save AI chat history to localStorage');
  }
}

export function getAiChatForThread(chatId: string): AiChatMessage[] {
  const history = loadAiChatHistory();
  return history[chatId] || [];
}

export function saveAiChatForThread(chatId: string, messages: AiChatMessage[]): void {
  const history = loadAiChatHistory();
  history[chatId] = messages;
  saveAiChatHistory(history);
}

export function clearAiChatForThread(chatId: string): void {
  const history = loadAiChatHistory();
  delete history[chatId];
  saveAiChatHistory(history);
}

// Thread context storage (persistent conversation context per chat)
const THREAD_CONTEXT_KEY = 'beeper-kanban-thread-context';

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

export function loadThreadContextStore(): ThreadContextStore {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(THREAD_CONTEXT_KEY);
    if (!stored) return {};
    return JSON.parse(stored) as ThreadContextStore;
  } catch {
    console.error('Failed to load thread context from localStorage');
    return {};
  }
}

export function saveThreadContextStore(store: ThreadContextStore): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(THREAD_CONTEXT_KEY, JSON.stringify(store));
  } catch {
    console.error('Failed to save thread context to localStorage');
  }
}

export function getThreadContext(chatId: string): ThreadContext | null {
  const store = loadThreadContextStore();
  return store[chatId] || null;
}

export function saveThreadContext(chatId: string, senderName: string, messages: ThreadContextMessage[]): void {
  const store = loadThreadContextStore();
  store[chatId] = {
    chatId,
    senderName,
    messages,
    lastUpdated: new Date().toISOString(),
  };
  saveThreadContextStore(store);
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
  };

  const keysToRemove = [
    DRAFTS_KEY,
    SETTINGS_KEY,
    MESSAGES_KEY,
    ACCOUNTS_KEY,
    AVATARS_KEY,
    CHAT_INFO_KEY,
    CACHE_TIMESTAMP_KEY,
    `${CACHE_TIMESTAMP_KEY}-messages`,
    `${CACHE_TIMESTAMP_KEY}-accounts`,
    HIDDEN_CHATS_KEY,
    HIDDEN_CHATS_META_KEY,
    TONE_SETTINGS_KEY,
    USER_MESSAGES_CACHE_KEY,
    AI_CHAT_HISTORY_KEY,
    THREAD_CONTEXT_KEY,
    // Autopilot keys
    'beeper-kanban-autopilot-agents',
    'beeper-kanban-autopilot-chat-configs',
    'beeper-kanban-autopilot-activity',
    'beeper-kanban-autopilot-scheduled',
    'beeper-kanban-autopilot-handoffs',
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
    MESSAGES_KEY,
    ACCOUNTS_KEY,
    AVATARS_KEY,
    CHAT_INFO_KEY,
    CACHE_TIMESTAMP_KEY,
    `${CACHE_TIMESTAMP_KEY}-messages`,
    `${CACHE_TIMESTAMP_KEY}-accounts`,
    USER_MESSAGES_CACHE_KEY,
    THREAD_CONTEXT_KEY,
    AI_CHAT_HISTORY_KEY, // Also clear AI chat history as it contains participant names
  ];

  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
}

// ============================================
// AUTOPILOT STORAGE
// ============================================

const AUTOPILOT_AGENTS_KEY = 'beeper-kanban-autopilot-agents';
const AUTOPILOT_CHAT_CONFIGS_KEY = 'beeper-kanban-autopilot-chat-configs';
const AUTOPILOT_ACTIVITY_KEY = 'beeper-kanban-autopilot-activity';
const AUTOPILOT_SCHEDULED_KEY = 'beeper-kanban-autopilot-scheduled';
const AUTOPILOT_HANDOFFS_KEY = 'beeper-kanban-autopilot-handoffs';

const MAX_ACTIVITY_ENTRIES = 500;

// Agent CRUD operations

export function loadAutopilotAgents(): AutopilotAgent[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(AUTOPILOT_AGENTS_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as AutopilotAgent[];
  } catch {
    console.error('Failed to load autopilot agents from localStorage');
    return [];
  }
}

export function saveAutopilotAgents(agents: AutopilotAgent[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(AUTOPILOT_AGENTS_KEY, JSON.stringify(agents));
  } catch {
    console.error('Failed to save autopilot agents to localStorage');
  }
}

export function getAutopilotAgentById(id: string): AutopilotAgent | undefined {
  const agents = loadAutopilotAgents();
  return agents.find(a => a.id === id);
}

export function addAutopilotAgent(agent: AutopilotAgent): AutopilotAgent[] {
  const agents = loadAutopilotAgents();
  const updated = [...agents, agent];
  saveAutopilotAgents(updated);
  return updated;
}

export function updateAutopilotAgent(id: string, updates: Partial<AutopilotAgent>): AutopilotAgent[] {
  const agents = loadAutopilotAgents();
  const updated = agents.map(a =>
    a.id === id
      ? { ...a, ...updates, updatedAt: new Date().toISOString() }
      : a
  );
  saveAutopilotAgents(updated);
  return updated;
}

export function deleteAutopilotAgent(id: string): AutopilotAgent[] {
  const agents = loadAutopilotAgents();
  const updated = agents.filter(a => a.id !== id);
  saveAutopilotAgents(updated);
  return updated;
}

// Chat autopilot config operations

export function loadChatAutopilotConfigs(): Record<string, ChatAutopilotConfig> {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(AUTOPILOT_CHAT_CONFIGS_KEY);
    if (!stored) return {};
    return JSON.parse(stored) as Record<string, ChatAutopilotConfig>;
  } catch {
    console.error('Failed to load chat autopilot configs from localStorage');
    return {};
  }
}

export function saveChatAutopilotConfigs(configs: Record<string, ChatAutopilotConfig>): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(AUTOPILOT_CHAT_CONFIGS_KEY, JSON.stringify(configs));
  } catch {
    console.error('Failed to save chat autopilot configs to localStorage');
  }
}

export function getChatAutopilotConfig(chatId: string): ChatAutopilotConfig | null {
  const configs = loadChatAutopilotConfigs();
  return configs[chatId] || null;
}

export function saveChatAutopilotConfig(config: ChatAutopilotConfig): void {
  const configs = loadChatAutopilotConfigs();
  configs[config.chatId] = { ...config, updatedAt: new Date().toISOString() };
  saveChatAutopilotConfigs(configs);
}

export function deleteChatAutopilotConfig(chatId: string): void {
  const configs = loadChatAutopilotConfigs();
  delete configs[chatId];
  saveChatAutopilotConfigs(configs);
}

export function getActiveAutopilotChats(): ChatAutopilotConfig[] {
  const configs = loadChatAutopilotConfigs();
  return Object.values(configs).filter(c => c.enabled && c.status === 'active');
}

// Activity log operations

export function loadAutopilotActivity(): AutopilotActivityEntry[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(AUTOPILOT_ACTIVITY_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as AutopilotActivityEntry[];
  } catch {
    console.error('Failed to load autopilot activity from localStorage');
    return [];
  }
}

export function saveAutopilotActivity(entries: AutopilotActivityEntry[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(AUTOPILOT_ACTIVITY_KEY, JSON.stringify(entries));
  } catch {
    console.error('Failed to save autopilot activity to localStorage');
  }
}

export function addAutopilotActivityEntry(entry: AutopilotActivityEntry): void {
  const entries = loadAutopilotActivity();
  entries.push(entry);

  // Prune if over limit
  const pruned = entries.length > MAX_ACTIVITY_ENTRIES
    ? entries.slice(-MAX_ACTIVITY_ENTRIES)
    : entries;

  saveAutopilotActivity(pruned);
}

export function getActivityForChat(chatId: string): AutopilotActivityEntry[] {
  const entries = loadAutopilotActivity();
  return entries.filter(e => e.chatId === chatId);
}

export function clearAutopilotActivity(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTOPILOT_ACTIVITY_KEY);
}

// Scheduled actions operations

export function loadScheduledActions(): ScheduledAutopilotAction[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(AUTOPILOT_SCHEDULED_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as ScheduledAutopilotAction[];
  } catch {
    console.error('Failed to load scheduled actions from localStorage');
    return [];
  }
}

export function saveScheduledActions(actions: ScheduledAutopilotAction[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(AUTOPILOT_SCHEDULED_KEY, JSON.stringify(actions));
  } catch {
    console.error('Failed to save scheduled actions to localStorage');
  }
}

export function addScheduledAction(action: ScheduledAutopilotAction): void {
  const actions = loadScheduledActions();
  actions.push(action);
  saveScheduledActions(actions);
}

export function updateScheduledAction(id: string, updates: Partial<ScheduledAutopilotAction>): void {
  const actions = loadScheduledActions();
  const updated = actions.map(a =>
    a.id === id ? { ...a, ...updates } : a
  );
  saveScheduledActions(updated);
}

export function deleteScheduledAction(id: string): void {
  const actions = loadScheduledActions();
  const updated = actions.filter(a => a.id !== id);
  saveScheduledActions(updated);
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
  const actions = loadScheduledActions();
  return actions.filter(a => a.chatId === chatId && a.status === 'pending');
}

export function cancelActionsForChat(chatId: string): void {
  const actions = loadScheduledActions();
  const updated = actions.map(a =>
    a.chatId === chatId && a.status === 'pending'
      ? { ...a, status: 'cancelled' as const }
      : a
  );
  saveScheduledActions(updated);
}

export function cleanupCompletedActions(): void {
  const actions = loadScheduledActions();
  // Keep only pending and executing actions, plus failed ones from last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const updated = actions.filter(a =>
    a.status === 'pending' ||
    a.status === 'executing' ||
    (a.status === 'failed' && a.createdAt > oneDayAgo)
  );
  saveScheduledActions(updated);
}

// Handoff summaries operations

export function loadHandoffSummaries(): Record<string, ConversationHandoffSummary> {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(AUTOPILOT_HANDOFFS_KEY);
    if (!stored) return {};
    return JSON.parse(stored) as Record<string, ConversationHandoffSummary>;
  } catch {
    console.error('Failed to load handoff summaries from localStorage');
    return {};
  }
}

export function saveHandoffSummaries(summaries: Record<string, ConversationHandoffSummary>): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(AUTOPILOT_HANDOFFS_KEY, JSON.stringify(summaries));
  } catch {
    console.error('Failed to save handoff summaries to localStorage');
  }
}

export function getHandoffSummary(chatId: string): ConversationHandoffSummary | null {
  const summaries = loadHandoffSummaries();
  return summaries[chatId] || null;
}

export function saveHandoffSummary(summary: ConversationHandoffSummary): void {
  const summaries = loadHandoffSummaries();
  summaries[summary.chatId] = summary;
  saveHandoffSummaries(summaries);
}

export function deleteHandoffSummary(chatId: string): void {
  const summaries = loadHandoffSummaries();
  delete summaries[chatId];
  saveHandoffSummaries(summaries);
}
