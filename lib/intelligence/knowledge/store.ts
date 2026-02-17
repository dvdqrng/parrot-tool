/**
 * IndexedDB Knowledge Store
 * Persistent storage for intelligence data using Dexie
 */

import Dexie, { Table } from 'dexie';
import {
  ContactIntelligence,
  ExtractionQueueItem,
  StyleFingerprint,
} from './types';
import { UserIntelligence, createDefaultUserIntelligence } from '../user-state/types';
import { Agent, AgentLifecycle } from '../agents/types';

// ============================================
// DATABASE SCHEMA
// ============================================

export class IntelligenceDB extends Dexie {
  contacts!: Table<ContactIntelligence, string>;
  userState!: Table<UserIntelligence, string>;
  agents!: Table<Agent, string>;
  styleMatrix!: Table<{ id: string; data: Record<string, StyleFingerprint> }, string>;
  extractionQueue!: Table<ExtractionQueueItem, string>;

  constructor() {
    super('BeeperIntelligence');

    this.version(1).stores({
      contacts: 'id, updatedAt',
      userState: 'id',
      agents: 'id, type, lifecycle, contextId, lastActiveAt',
      styleMatrix: 'id',
      extractionQueue: 'id, chatId, priority, scheduledFor',
    });
  }
}

// Singleton instance
let db: IntelligenceDB | null = null;

export function getIntelligenceDb(): IntelligenceDB {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is only available in browser');
  }
  if (!db) {
    db = new IntelligenceDB();
  }
  return db;
}

// ============================================
// CONTACT STORE
// ============================================

export const contactStore = {
  async get(contactId: string): Promise<ContactIntelligence | undefined> {
    try {
      const db = getIntelligenceDb();
      return db.contacts.get(contactId);
    } catch {
      return undefined;
    }
  },

  async getByChatId(chatId: string): Promise<ContactIntelligence | undefined> {
    try {
      const db = getIntelligenceDb();
      const all = await db.contacts.toArray();
      return all.find(c =>
        c.platformLinks?.some(link => link.chatId === chatId)
      );
    } catch {
      return undefined;
    }
  },

  async upsert(contact: ContactIntelligence): Promise<void> {
    try {
      const db = getIntelligenceDb();
      await db.contacts.put({
        ...contact,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Failed to upsert contact:', e);
    }
  },

  async getAll(): Promise<ContactIntelligence[]> {
    try {
      const db = getIntelligenceDb();
      return db.contacts.toArray();
    } catch {
      return [];
    }
  },

  async delete(contactId: string): Promise<void> {
    try {
      const db = getIntelligenceDb();
      await db.contacts.delete(contactId);
    } catch (e) {
      console.error('Failed to delete contact:', e);
    }
  },

  async count(): Promise<number> {
    try {
      const db = getIntelligenceDb();
      return db.contacts.count();
    } catch {
      return 0;
    }
  },
};

// ============================================
// USER STATE STORE
// ============================================

export const userStateStore = {
  async get(): Promise<UserIntelligence | undefined> {
    try {
      const db = getIntelligenceDb();
      let state = await db.userState.get('current');
      if (!state) {
        state = createDefaultUserIntelligence();
        await this.set(state);
      }
      return state;
    } catch {
      return createDefaultUserIntelligence();
    }
  },

  async set(state: UserIntelligence): Promise<void> {
    try {
      const db = getIntelligenceDb();
      await db.userState.put({
        ...state,
        id: 'current',
        lastUpdated: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Failed to set user state:', e);
    }
  },

  async update(updates: Partial<UserIntelligence>): Promise<void> {
    try {
      const current = await this.get();
      if (current) {
        await this.set({
          ...current,
          ...updates,
          lastUpdated: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('Failed to update user state:', e);
    }
  },

  async clear(): Promise<void> {
    try {
      const db = getIntelligenceDb();
      await db.userState.clear();
    } catch (e) {
      console.error('Failed to clear user state:', e);
    }
  },
};

// ============================================
// AGENT STORE
// ============================================

export const agentStore = {
  async get(agentId: string): Promise<Agent | undefined> {
    try {
      const db = getIntelligenceDb();
      return db.agents.get(agentId);
    } catch {
      return undefined;
    }
  },

  async getByContext(
    contextId: string,
    platform?: string
  ): Promise<Agent | undefined> {
    try {
      const db = getIntelligenceDb();
      const agents = await db.agents
        .where('contextId')
        .equals(contextId)
        .toArray();

      if (platform) {
        return agents.find(a => a.platform === platform);
      }
      return agents[0];
    } catch {
      return undefined;
    }
  },

  async getByType(type: string): Promise<Agent[]> {
    try {
      const db = getIntelligenceDb();
      return db.agents.where('type').equals(type).toArray();
    } catch {
      return [];
    }
  },

  async getByLifecycle(lifecycle: AgentLifecycle): Promise<Agent[]> {
    try {
      const db = getIntelligenceDb();
      return db.agents.where('lifecycle').equals(lifecycle).toArray();
    } catch {
      return [];
    }
  },

  async upsert(agent: Agent): Promise<void> {
    try {
      const db = getIntelligenceDb();
      await db.agents.put({
        ...agent,
        lastActiveAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Failed to upsert agent:', e);
    }
  },

  async updateLifecycle(
    agentId: string,
    lifecycle: AgentLifecycle
  ): Promise<void> {
    try {
      const db = getIntelligenceDb();
      await db.agents.update(agentId, { lifecycle });
    } catch (e) {
      console.error('Failed to update agent lifecycle:', e);
    }
  },

  async countActive(): Promise<number> {
    try {
      const db = getIntelligenceDb();
      const active = await db.agents.where('lifecycle').equals('active').count();
      const warm = await db.agents.where('lifecycle').equals('warm').count();
      return active + warm;
    } catch {
      return 0;
    }
  },

  async count(): Promise<number> {
    try {
      const db = getIntelligenceDb();
      return db.agents.count();
    } catch {
      return 0;
    }
  },

  async getAll(): Promise<Agent[]> {
    try {
      const db = getIntelligenceDb();
      return db.agents.toArray();
    } catch {
      return [];
    }
  },

  async delete(agentId: string): Promise<void> {
    try {
      const db = getIntelligenceDb();
      await db.agents.delete(agentId);
    } catch (e) {
      console.error('Failed to delete agent:', e);
    }
  },
};

// ============================================
// EXTRACTION QUEUE STORE
// ============================================

export const extractionQueueStore = {
  async add(
    item: Omit<ExtractionQueueItem, 'id' | 'attempts' | 'createdAt'>
  ): Promise<void> {
    try {
      const db = getIntelligenceDb();
      await db.extractionQueue.put({
        ...item,
        id: `${item.chatId}-${Date.now()}`,
        attempts: 0,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Failed to add to extraction queue:', e);
    }
  },

  async getNext(limit: number = 10): Promise<ExtractionQueueItem[]> {
    try {
      const db = getIntelligenceDb();
      const now = new Date().toISOString();
      return db.extractionQueue
        .where('scheduledFor')
        .belowOrEqual(now)
        .limit(limit)
        .toArray();
    } catch {
      return [];
    }
  },

  async markComplete(id: string): Promise<void> {
    try {
      const db = getIntelligenceDb();
      await db.extractionQueue.delete(id);
    } catch (e) {
      console.error('Failed to mark extraction complete:', e);
    }
  },

  async markFailed(id: string, error: string): Promise<void> {
    try {
      const db = getIntelligenceDb();
      const item = await db.extractionQueue.get(id);
      if (item) {
        if (item.attempts >= 3) {
          await this.markComplete(id);
        } else {
          await db.extractionQueue.update(id, {
            attempts: item.attempts + 1,
            lastError: error,
            scheduledFor: new Date(
              Date.now() + 60000 * Math.pow(2, item.attempts)
            ).toISOString(),
          });
        }
      }
    } catch (e) {
      console.error('Failed to mark extraction failed:', e);
    }
  },

  async count(): Promise<number> {
    try {
      const db = getIntelligenceDb();
      return db.extractionQueue.count();
    } catch {
      return 0;
    }
  },

  async getAll(): Promise<ExtractionQueueItem[]> {
    try {
      const db = getIntelligenceDb();
      return db.extractionQueue.toArray();
    } catch {
      return [];
    }
  },

  async remove(id: string): Promise<void> {
    try {
      const db = getIntelligenceDb();
      await db.extractionQueue.delete(id);
    } catch (e) {
      console.error('Failed to remove from extraction queue:', e);
    }
  },

  async clear(): Promise<void> {
    try {
      const db = getIntelligenceDb();
      await db.extractionQueue.clear();
    } catch (e) {
      console.error('Failed to clear extraction queue:', e);
    }
  },
};

// ============================================
// STYLE MATRIX STORE
// ============================================

export const styleMatrixStore = {
  async get(): Promise<Record<string, StyleFingerprint>> {
    try {
      const db = getIntelligenceDb();
      const row = await db.styleMatrix.get('current');
      return row?.data || {};
    } catch {
      return {};
    }
  },

  async set(matrix: Record<string, StyleFingerprint>): Promise<void> {
    try {
      const db = getIntelligenceDb();
      await db.styleMatrix.put({ id: 'current', data: matrix });
    } catch (e) {
      console.error('Failed to set style matrix:', e);
    }
  },

  async updateStyle(key: string, style: StyleFingerprint): Promise<void> {
    try {
      const current = await this.get();
      current[key] = style;
      await this.set(current);
    } catch (e) {
      console.error('Failed to update style:', e);
    }
  },
};
