/**
 * AI Activity Log System
 *
 * Tracks all AI system activity for transparency and debugging:
 * - Agent thoughts and decisions
 * - API calls and responses
 * - Knowledge extraction events
 * - Draft generation
 * - Proactive suggestions
 *
 * Stored in IndexedDB for persistence, with real-time subscription support.
 */

import Dexie, { type EntityTable } from 'dexie';

// ============================================
// TYPES
// ============================================

export type ActivityType =
  | 'thought'           // Agent's internal reasoning
  | 'observation'       // Something the agent noticed
  | 'decision'          // A decision the agent made
  | 'action'            // An action the agent took
  | 'api_call'          // External API call
  | 'api_response'      // Response from API
  | 'knowledge_extract' // Extracted knowledge from conversation
  | 'draft_generated'   // Generated a draft
  | 'insight_generated' // Generated an insight
  | 'error'             // Something went wrong
  | 'system';           // System-level events

export type AgentType =
  | 'companion'         // The main companion agent
  | 'analyzer'          // Conversation analyzer
  | 'drafter'           // Draft composer
  | 'knowledge'         // Knowledge extractor
  | 'style'             // Style analyzer
  | 'proactive'         // Proactive trigger system
  | 'orchestrator'      // Agent orchestrator
  | 'conversation_agent' // Per-contact conversation agent
  | 'user_state'        // User state agent
  | 'trigger'           // Trigger scheduler
  | 'worker'            // Background worker
  | 'system';           // System-level

export interface ActivityLogEntry {
  id?: number;
  timestamp: string;
  type: ActivityType;
  agent: AgentType;
  chatId?: string;
  contactName?: string;
  content: string;
  details?: Record<string, unknown>;
  duration?: number; // milliseconds
}

// ============================================
// DATABASE
// ============================================

class ActivityLogDB extends Dexie {
  activityLog!: EntityTable<ActivityLogEntry, 'id'>;

  constructor() {
    super('BeeperActivityLog');
    this.version(1).stores({
      activityLog: '++id, timestamp, type, agent, chatId',
    });
  }
}

const db = new ActivityLogDB();

// ============================================
// SUBSCRIPTION SYSTEM
// ============================================

type ActivitySubscriber = (entry: ActivityLogEntry) => void;
const subscribers = new Set<ActivitySubscriber>();

export function subscribeToActivity(callback: ActivitySubscriber): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

function notifySubscribers(entry: ActivityLogEntry) {
  subscribers.forEach((callback) => {
    try {
      callback(entry);
    } catch (error) {
      console.error('[ActivityLog] Subscriber error:', error);
    }
  });
}

// ============================================
// LOGGING FUNCTIONS
// ============================================

export async function logActivity(
  entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>
): Promise<void> {
  const fullEntry: ActivityLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  try {
    await db.activityLog.add(fullEntry);
    notifySubscribers(fullEntry);

    // Also log to console for debugging
    const icon = getActivityIcon(entry.type);
    console.log(
      `[AI ${icon}] [${entry.agent}] ${entry.content}`,
      { chatId: entry.chatId, ...entry.details }
    );
  } catch (error) {
    console.error('[ActivityLog] Failed to log activity:', error);
  }
}

function getActivityIcon(type: ActivityType): string {
  switch (type) {
    case 'thought':
      return '💭';
    case 'observation':
      return '👁️';
    case 'decision':
      return '🎯';
    case 'action':
      return '⚡';
    case 'api_call':
      return '📤';
    case 'api_response':
      return '📥';
    case 'knowledge_extract':
      return '🧠';
    case 'draft_generated':
      return '✍️';
    case 'insight_generated':
      return '💡';
    case 'error':
      return '❌';
    case 'system':
      return '⚙️';
    default:
      return '📝';
  }
}

// ============================================
// CONVENIENCE LOGGERS
// ============================================

export const aiLog = {
  thought: (agent: AgentType, content: string, chatId?: string, details?: Record<string, unknown>) =>
    logActivity({ type: 'thought', agent, content, chatId, details }),

  observation: (agent: AgentType, content: string, chatId?: string, details?: Record<string, unknown>) =>
    logActivity({ type: 'observation', agent, content, chatId, details }),

  decision: (agent: AgentType, content: string, chatId?: string, details?: Record<string, unknown>) =>
    logActivity({ type: 'decision', agent, content, chatId, details }),

  action: (agent: AgentType, content: string, chatId?: string, details?: Record<string, unknown>) =>
    logActivity({ type: 'action', agent, content, chatId, details }),

  apiCall: (agent: AgentType, endpoint: string, chatId?: string, details?: Record<string, unknown>) =>
    logActivity({ type: 'api_call', agent, content: `Calling ${endpoint}`, chatId, details }),

  apiResponse: (agent: AgentType, endpoint: string, duration: number, chatId?: string, details?: Record<string, unknown>) =>
    logActivity({ type: 'api_response', agent, content: `Response from ${endpoint}`, chatId, duration, details }),

  knowledge: (content: string, chatId: string, contactName?: string, details?: Record<string, unknown>) =>
    logActivity({ type: 'knowledge_extract', agent: 'knowledge', content, chatId, contactName, details }),

  draft: (content: string, chatId: string, contactName?: string) =>
    logActivity({ type: 'draft_generated', agent: 'drafter', content, chatId, contactName }),

  insight: (content: string, chatId?: string, contactName?: string) =>
    logActivity({ type: 'insight_generated', agent: 'analyzer', content, chatId, contactName }),

  error: (agent: AgentType, content: string, chatId?: string, details?: Record<string, unknown>) =>
    logActivity({ type: 'error', agent, content, chatId, details }),

  system: (content: string, details?: Record<string, unknown>) =>
    logActivity({ type: 'system', agent: 'system', content, details }),
};

// ============================================
// QUERY FUNCTIONS
// ============================================

export async function getRecentActivity(
  limit: number = 100
): Promise<ActivityLogEntry[]> {
  return db.activityLog.orderBy('timestamp').reverse().limit(limit).toArray();
}

export async function getActivityForChat(
  chatId: string,
  limit: number = 50
): Promise<ActivityLogEntry[]> {
  return db.activityLog
    .where('chatId')
    .equals(chatId)
    .reverse()
    .limit(limit)
    .toArray();
}

export async function getActivityByAgent(
  agent: AgentType,
  limit: number = 50
): Promise<ActivityLogEntry[]> {
  return db.activityLog
    .where('agent')
    .equals(agent)
    .reverse()
    .limit(limit)
    .toArray();
}

export async function getActivityByType(
  type: ActivityType,
  limit: number = 50
): Promise<ActivityLogEntry[]> {
  return db.activityLog
    .where('type')
    .equals(type)
    .reverse()
    .limit(limit)
    .toArray();
}

export async function clearActivityLog(): Promise<void> {
  await db.activityLog.clear();
  aiLog.system('Activity log cleared');
}

export async function getActivityStats(): Promise<{
  total: number;
  byType: Record<string, number>;
  byAgent: Record<string, number>;
  last24h: number;
}> {
  const all = await db.activityLog.toArray();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const byType: Record<string, number> = {};
  const byAgent: Record<string, number> = {};
  let last24h = 0;

  for (const entry of all) {
    byType[entry.type] = (byType[entry.type] || 0) + 1;
    byAgent[entry.agent] = (byAgent[entry.agent] || 0) + 1;
    if (entry.timestamp > yesterday) {
      last24h++;
    }
  }

  return {
    total: all.length,
    byType,
    byAgent,
    last24h,
  };
}
