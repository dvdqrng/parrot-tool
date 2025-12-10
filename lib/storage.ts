import { Draft, AppSettings, BeeperMessage, BeeperAccount, ToneSettings } from './types';

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

const DEFAULT_TONE_SETTINGS: ToneSettings = {
  briefDetailed: 50,
  formalCasual: 50,
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
