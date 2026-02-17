import {
  Draft,
  AppSettings,
  BeeperMessage,
  BeeperAccount,
  BeeperUserInfo,
  CrmContactProfile,
  CrmTag,
} from './types';
import { logger } from './logger';
import { STORAGE_KEYS } from './constants';
import { StorageManager, MapStorageManager, SetStorageManager, TimestampedStorageManager } from './storage-manager';

// Create storage manager instances
const draftsManager = new StorageManager<Draft[]>(STORAGE_KEYS.DRAFTS, [], 'drafts');
const settingsManager = new StorageManager<AppSettings>(STORAGE_KEYS.SETTINGS, { selectedAccountIds: [], showArchivedColumn: true }, 'settings');
const messagesManager = new TimestampedStorageManager<BeeperMessage[]>(STORAGE_KEYS.MESSAGES, [], 'messages');
const accountsManager = new TimestampedStorageManager<BeeperAccount[]>(STORAGE_KEYS.ACCOUNTS, [], 'accounts');
const avatarsManager = new MapStorageManager<string, string>(STORAGE_KEYS.AVATARS, 'avatars');
const userInfoManager = new StorageManager<BeeperUserInfo | null>(STORAGE_KEYS.USER_INFO, null, 'userInfo');
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

// Clear all app data from localStorage (keeps API keys)
export function clearAllData(): void {
  if (typeof window === 'undefined') return;

  // Preserve Beeper token from settings
  const currentSettings = loadSettings();
  const preservedSettings: AppSettings = {
    selectedAccountIds: [],
    beeperAccessToken: currentSettings.beeperAccessToken,
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
  ];

  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });

  // Restore Beeper token
  saveSettings(preservedSettings);
}

// Clear only cached/synced data (keeps user settings like Beeper token, hidden chats)
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
  ];

  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
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

function getCrmContactById(contactId: string): CrmContactProfile | null {
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
  avatarUrl?: string,
  isGroup?: boolean
): CrmContactProfile {
  const now = new Date().toISOString();
  const contact: CrmContactProfile = {
    id: generateId(),
    displayName,
    avatarUrl,
    isGroup,
    platformLinks: [{
      platform,
      chatId,
      accountId,
      displayName,
      avatarUrl,
      addedAt: now,
    }],
    tags: [],
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

  const updated: CrmContactProfile = {
    ...target,
    platformLinks: [...target.platformLinks, ...newLinks],
    tags: mergedTags,
    // Keep target's primary info, but fill in blanks from source
    email: target.email || source.email,
    phone: target.phone || source.phone,
    company: target.company || source.company,
    role: target.role || source.role,
    updatedAt: new Date().toISOString(),
  };

  saveCrmContact(updated);

  // Delete the source contact
  deleteCrmContact(sourceContactId);

  return updated;
}

// Maximum gap between messages to consider them part of the same conversation
// If more than 2 hours pass, treat it as a new conversation (not a delayed response)
const CONVERSATION_GAP_MS = 2 * 60 * 60 * 1000; // 2 hours

// Update contact interaction stats from messages
export function updateContactInteractionStats(
  contactId: string,
  messages: Array<{ timestamp: string; isFromMe: boolean }>
): CrmContactProfile | null {
  const contact = getCrmContactById(contactId);
  if (!contact || messages.length === 0) return contact;

  // Sort messages by timestamp
  const sortedMessages = [...messages].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Calculate stats
  let messagesSent = 0;
  let messagesReceived = 0;
  let lastTimestamp: string | undefined;

  // For response time calculation - only count responses within same conversation
  const responseTimes: number[] = [];
  let prevMessage: { timestamp: string; isFromMe: boolean } | null = null;

  for (const msg of sortedMessages) {
    const msgTime = new Date(msg.timestamp).getTime();

    if (msg.isFromMe) {
      messagesSent++;

      // Calculate response time if replying to their message within the conversation window
      if (prevMessage && !prevMessage.isFromMe) {
        const prevTime = new Date(prevMessage.timestamp).getTime();
        const responseTime = msgTime - prevTime;

        // Only count as a response if within the conversation gap
        // Otherwise it's a new conversation, not a delayed response
        if (responseTime <= CONVERSATION_GAP_MS) {
          responseTimes.push(responseTime);
        }
      }
    } else {
      messagesReceived++;
    }

    // Track last message time
    if (!lastTimestamp || msg.timestamp > lastTimestamp) {
      lastTimestamp = msg.timestamp;
    }

    prevMessage = msg;
  }

  // Calculate average response time (in minutes)
  let avgResponseTimeMinutes: number | undefined;
  if (responseTimes.length > 0) {
    const avgMs = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    avgResponseTimeMinutes = Math.round(avgMs / (1000 * 60));
  }

  // Update contact with new stats
  const updates: Partial<CrmContactProfile> = {
    totalMessageCount: messages.length,
    messagesSent,
    messagesReceived,
    avgResponseTimeMinutes,
  };

  if (lastTimestamp) {
    updates.lastInteractionAt = lastTimestamp;
  }

  return updateCrmContact(contactId, updates);
}

// CRM Tag operations
export function loadCrmTags(): Record<string, CrmTag> {
  return crmTagsManager.load();
}

export function saveCrmTags(tags: Record<string, CrmTag>): void {
  crmTagsManager.save(tags);
}

function getCrmTagById(tagId: string): CrmTag | null {
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

// CRM Chat mappings operations (internal)
function loadCrmChatMappings(): Record<string, string> {
  return crmChatMappingsManager.load();
}

// Search contacts by name
export function searchCrmContacts(query: string): CrmContactProfile[] {
  const contacts = loadCrmContacts();
  const lowerQuery = query.toLowerCase();

  return Object.values(contacts).filter(contact => {
    const matchesName = contact.displayName.toLowerCase().includes(lowerQuery);
    const matchesCompany = contact.company?.toLowerCase().includes(lowerQuery);
    const matchesEmail = contact.email?.toLowerCase().includes(lowerQuery);
    const matchesPlatformName = contact.platformLinks.some(
      link => link.displayName?.toLowerCase().includes(lowerQuery)
    );

    return matchesName || matchesCompany || matchesEmail || matchesPlatformName;
  });
}

// Beeper user info storage (authenticated user's name and avatar)

/**
 * Get the cached Beeper user info
 */
export function getBeeperUserInfo(): BeeperUserInfo | null {
  return userInfoManager.load();
}

/**
 * Save Beeper user info to cache
 */
export function saveBeeperUserInfo(userInfo: BeeperUserInfo): void {
  userInfoManager.save(userInfo);
}

// ============================================
// MESSAGE FETCHING UTILITIES
// ============================================

/**
 * Get messages by their IDs
 * Used by extraction queue to fetch specific messages for processing
 */
export function getMessagesByIds(messageIds: string[]): BeeperMessage[] {
  if (messageIds.length === 0) return [];

  const allMessages = loadCachedMessages();
  const idSet = new Set(messageIds);
  return allMessages.filter(msg => idSet.has(msg.id));
}

/**
 * Get messages for a specific chat
 * Optionally limit to most recent N messages
 */
export function getMessagesByChatId(chatId: string, limit?: number): BeeperMessage[] {
  const allMessages = loadCachedMessages();
  const chatMessages = allMessages.filter(msg => msg.chatId === chatId);

  // Sort by timestamp descending (most recent first)
  chatMessages.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (limit) {
    return chatMessages.slice(0, limit);
  }
  return chatMessages;
}
