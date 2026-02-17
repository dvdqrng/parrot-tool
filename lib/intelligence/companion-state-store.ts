/**
 * Companion State Store
 *
 * Persists AI companion state across page navigations and sessions.
 * Uses IndexedDB for durability.
 */

import Dexie, { type EntityTable } from 'dexie';

// ============================================
// TYPES
// ============================================

export interface CompanionChatState {
  chatId: string;
  enabled: boolean;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    type?: 'chat' | 'draft' | 'insight' | 'action';
    metadata?: Record<string, unknown>;
  }>;
  hasRunInitialAnalysis: boolean;
  hasActivity: boolean;
  updatedAt: string;
}

// ============================================
// DATABASE
// ============================================

class CompanionStateDB extends Dexie {
  companionStates!: EntityTable<CompanionChatState, 'chatId'>;

  constructor() {
    super('BeeperCompanionState');
    this.version(1).stores({
      companionStates: 'chatId, enabled, updatedAt',
    });
  }
}

const db = new CompanionStateDB();

// ============================================
// STORE FUNCTIONS
// ============================================

export async function saveCompanionState(state: CompanionChatState): Promise<void> {
  try {
    await db.companionStates.put({
      ...state,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CompanionStateStore] Failed to save state:', error);
  }
}

export async function getCompanionState(chatId: string): Promise<CompanionChatState | null> {
  try {
    const state = await db.companionStates.get(chatId);
    return state || null;
  } catch (error) {
    console.error('[CompanionStateStore] Failed to get state:', error);
    return null;
  }
}

export async function getAllEnabledCompanions(): Promise<CompanionChatState[]> {
  try {
    return await db.companionStates.where('enabled').equals(1).toArray();
  } catch (error) {
    console.error('[CompanionStateStore] Failed to get enabled companions:', error);
    return [];
  }
}

export async function deleteCompanionState(chatId: string): Promise<void> {
  try {
    await db.companionStates.delete(chatId);
  } catch (error) {
    console.error('[CompanionStateStore] Failed to delete state:', error);
  }
}

export async function clearAllCompanionStates(): Promise<void> {
  try {
    await db.companionStates.clear();
  } catch (error) {
    console.error('[CompanionStateStore] Failed to clear states:', error);
  }
}

// ============================================
// IN-MEMORY CACHE FOR QUICK ACCESS
// ============================================

// Keep an in-memory cache that syncs with IndexedDB
const stateCache = new Map<string, CompanionChatState>();
let cacheInitialized = false;

export async function initializeCache(): Promise<void> {
  if (cacheInitialized) return;

  try {
    const allStates = await db.companionStates.toArray();
    for (const state of allStates) {
      stateCache.set(state.chatId, state);
    }
    cacheInitialized = true;
    console.log('[CompanionStateStore] Cache initialized with', allStates.length, 'states');
  } catch (error) {
    console.error('[CompanionStateStore] Failed to initialize cache:', error);
  }
}

export function getCachedState(chatId: string): CompanionChatState | null {
  return stateCache.get(chatId) || null;
}

export function setCachedState(state: CompanionChatState): void {
  stateCache.set(state.chatId, state);
  // Also persist to IndexedDB (fire and forget)
  saveCompanionState(state);
}

export function deleteCachedState(chatId: string): void {
  stateCache.delete(chatId);
  // Also delete from IndexedDB (fire and forget)
  deleteCompanionState(chatId);
}

export function getAllCachedStates(): Map<string, CompanionChatState> {
  return stateCache;
}

// ============================================
// SUBSCRIPTION SYSTEM
// ============================================

type EnabledStateSubscriber = (chatId: string, enabled: boolean) => void;
const enabledSubscribers = new Set<EnabledStateSubscriber>();

export function subscribeToEnabledChanges(callback: EnabledStateSubscriber): () => void {
  enabledSubscribers.add(callback);
  return () => enabledSubscribers.delete(callback);
}

function notifyEnabledChange(chatId: string, enabled: boolean) {
  enabledSubscribers.forEach((callback) => {
    try {
      callback(chatId, enabled);
    } catch (error) {
      console.error('[CompanionStateStore] Subscriber error:', error);
    }
  });
}

// ============================================
// CONVENIENCE FUNCTIONS FOR ENABLED STATE
// ============================================

export function isAiEnabled(chatId: string): boolean {
  const state = stateCache.get(chatId);
  return state?.enabled ?? false;
}

export function setAiEnabled(chatId: string, enabled: boolean, contactName?: string, platform?: string): void {
  // Import dynamically to avoid circular dependencies
  const { emitAiEnabled, emitAiDisabled } = require('./event-bus');

  const existingState = stateCache.get(chatId);
  const newState: CompanionChatState = existingState
    ? { ...existingState, enabled, updatedAt: new Date().toISOString() }
    : {
        chatId,
        enabled,
        messages: [],
        hasRunInitialAnalysis: false,
        hasActivity: false,
        updatedAt: new Date().toISOString(),
      };

  stateCache.set(chatId, newState);
  saveCompanionState(newState);
  notifyEnabledChange(chatId, enabled);

  // Emit event so background worker can trigger history loading + extraction
  if (enabled) {
    emitAiEnabled(chatId, contactName, platform);
  } else {
    emitAiDisabled(chatId);
  }

  console.log('[CompanionStateStore] AI', enabled ? 'enabled' : 'disabled', 'for chat', chatId);
}

export function getAllEnabledChatIds(): string[] {
  const enabledIds: string[] = [];
  stateCache.forEach((state, chatId) => {
    if (state.enabled) {
      enabledIds.push(chatId);
    }
  });
  return enabledIds;
}
