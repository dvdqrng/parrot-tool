/**
 * Trigger Store
 * Persistent storage and management of triggers
 */

import {
  Trigger,
  TriggerEvent,
  TriggerStatus,
  TriggerType,
  CreateTriggerRequest,
} from './types';

// ============================================
// IN-MEMORY STORE (would use IndexedDB in production)
// ============================================

const triggers = new Map<string, Trigger>();
const triggerEvents = new Map<string, TriggerEvent[]>();

// ============================================
// TRIGGER STORE
// ============================================

export const triggerStore = {
  /**
   * Create a new trigger
   */
  async create(request: CreateTriggerRequest): Promise<Trigger> {
    const now = new Date().toISOString();

    const trigger: Trigger = {
      id: `trigger-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...request,
      status: 'enabled',
      fireCount: 0,
      createdAt: now,
      updatedAt: now,
      nextFire: this.calculateNextFire(request),
    };

    triggers.set(trigger.id, trigger);
    return trigger;
  },

  /**
   * Get a trigger by ID
   */
  async get(id: string): Promise<Trigger | null> {
    return triggers.get(id) || null;
  },

  /**
   * Get all triggers
   */
  async getAll(): Promise<Trigger[]> {
    return [...triggers.values()];
  },

  /**
   * Get triggers by status
   */
  async getByStatus(status: TriggerStatus): Promise<Trigger[]> {
    return [...triggers.values()].filter(t => t.status === status);
  },

  /**
   * Get triggers by type
   */
  async getByType(type: TriggerType): Promise<Trigger[]> {
    return [...triggers.values()].filter(t => t.type === type);
  },

  /**
   * Get triggers owned by an agent
   */
  async getByOwner(agentId: string): Promise<Trigger[]> {
    return [...triggers.values()].filter(t => t.ownerAgentId === agentId);
  },

  /**
   * Get triggers due to fire
   */
  async getDue(): Promise<Trigger[]> {
    const now = new Date().toISOString();

    return [...triggers.values()].filter(t =>
      t.status === 'enabled' &&
      t.nextFire &&
      t.nextFire <= now
    );
  },

  /**
   * Update a trigger
   */
  async update(id: string, updates: Partial<Trigger>): Promise<Trigger | null> {
    const existing = triggers.get(id);
    if (!existing) return null;

    const updated: Trigger = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    triggers.set(id, updated);
    return updated;
  },

  /**
   * Enable a trigger
   */
  async enable(id: string): Promise<boolean> {
    const trigger = triggers.get(id);
    if (!trigger) return false;

    trigger.status = 'enabled';
    trigger.updatedAt = new Date().toISOString();
    trigger.nextFire = this.calculateNextFire(trigger);

    return true;
  },

  /**
   * Disable a trigger
   */
  async disable(id: string): Promise<boolean> {
    const trigger = triggers.get(id);
    if (!trigger) return false;

    trigger.status = 'disabled';
    trigger.updatedAt = new Date().toISOString();

    return true;
  },

  /**
   * Record a trigger fire
   */
  async recordFire(
    id: string,
    event: Omit<TriggerEvent, 'id' | 'firedAt'>
  ): Promise<TriggerEvent | null> {
    const trigger = triggers.get(id);
    if (!trigger) return null;

    const now = new Date().toISOString();

    // Update trigger state
    trigger.lastFired = now;
    trigger.fireCount++;
    trigger.nextFire = this.calculateNextFire(trigger);
    trigger.updatedAt = now;

    // Check if maxFires reached
    if (trigger.maxFires && trigger.fireCount >= trigger.maxFires) {
      trigger.status = 'expired';
    }

    // Create event record
    const triggerEvent: TriggerEvent = {
      ...event,
      id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      triggerId: id,
      firedAt: now,
    };

    // Store event
    const events = triggerEvents.get(id) || [];
    events.push(triggerEvent);
    triggerEvents.set(id, events.slice(-100)); // Keep last 100

    return triggerEvent;
  },

  /**
   * Get events for a trigger
   */
  async getEvents(
    triggerId: string,
    limit: number = 10
  ): Promise<TriggerEvent[]> {
    const events = triggerEvents.get(triggerId) || [];
    return events.slice(-limit);
  },

  /**
   * Delete a trigger
   */
  async delete(id: string): Promise<boolean> {
    const existed = triggers.has(id);
    triggers.delete(id);
    triggerEvents.delete(id);
    return existed;
  },

  /**
   * Delete triggers by owner
   */
  async deleteByOwner(agentId: string): Promise<number> {
    const toDelete = [...triggers.values()]
      .filter(t => t.ownerAgentId === agentId)
      .map(t => t.id);

    for (const id of toDelete) {
      triggers.delete(id);
      triggerEvents.delete(id);
    }

    return toDelete.length;
  },

  /**
   * Calculate next fire time for a trigger
   */
  calculateNextFire(trigger: Partial<Trigger>): string | undefined {
    const now = new Date();

    if (!trigger.schedule) {
      // For conditional/event triggers, no scheduled next fire
      return undefined;
    }

    // One-time scheduled trigger
    if (trigger.schedule.datetime) {
      const scheduled = new Date(trigger.schedule.datetime);
      if (scheduled > now) {
        return trigger.schedule.datetime;
      }
      return undefined; // Already passed
    }

    // Recurring trigger
    if (trigger.schedule.rrule) {
      const { freq, interval = 1, byHour = 9, byMinute = 0, byDay } = trigger.schedule.rrule;

      const next = new Date(now);
      next.setHours(byHour, byMinute, 0, 0);

      // If today's time has passed, start from tomorrow
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }

      // Handle frequency
      switch (freq) {
        case 'daily':
          // Already set to next day if needed
          break;

        case 'weekly':
          if (byDay && byDay.length > 0) {
            // Find next matching day
            const dayMap: Record<string, number> = {
              SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
            };
            const targetDays = byDay.map(d => dayMap[d]).sort((a, b) => a - b);

            while (!targetDays.includes(next.getDay())) {
              next.setDate(next.getDate() + 1);
            }
          }
          break;

        case 'monthly':
          next.setMonth(next.getMonth() + interval);
          break;
      }

      // Check expiry
      if (trigger.schedule.rrule.until) {
        const until = new Date(trigger.schedule.rrule.until);
        if (next > until) return undefined;
      }

      // Check cooldown
      if (trigger.cooldownMinutes && trigger.lastFired) {
        const cooldownEnd = new Date(trigger.lastFired);
        cooldownEnd.setMinutes(cooldownEnd.getMinutes() + trigger.cooldownMinutes);
        if (next < cooldownEnd) {
          return cooldownEnd.toISOString();
        }
      }

      return next.toISOString();
    }

    return undefined;
  },

  /**
   * Clean up expired triggers
   */
  async cleanup(): Promise<number> {
    const now = new Date().toISOString();
    let cleaned = 0;

    for (const [id, trigger] of triggers) {
      // Remove expired triggers
      if (trigger.expiresAt && trigger.expiresAt < now) {
        triggers.delete(id);
        triggerEvents.delete(id);
        cleaned++;
        continue;
      }

      // Remove fired one-time triggers
      if (
        trigger.type === 'scheduled' &&
        trigger.schedule?.datetime &&
        trigger.status === 'fired'
      ) {
        triggers.delete(id);
        triggerEvents.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  },

  /**
   * Get trigger statistics
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<TriggerStatus, number>;
    byType: Record<string, number>;
    totalFires: number;
  }> {
    const all = [...triggers.values()];

    const byStatus: Record<TriggerStatus, number> = {
      enabled: 0,
      disabled: 0,
      fired: 0,
      expired: 0,
    };

    const byType: Record<string, number> = {};
    let totalFires = 0;

    for (const trigger of all) {
      byStatus[trigger.status]++;
      byType[trigger.type] = (byType[trigger.type] || 0) + 1;
      totalFires += trigger.fireCount;
    }

    return {
      total: all.length,
      byStatus,
      byType,
      totalFires,
    };
  },
};
