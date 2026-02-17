/**
 * User State Agent
 * Infrastructure agent that provides access to user intelligence
 * - Active contexts and activities
 * - Distributed information tracking
 * - Communication mode
 * - Canonical explanations
 */

import {
  UserIntelligence,
  ActiveContext,
  TopicCluster,
  DistributedInfoItem,
  CanonicalExplanation,
  CommunicationMode,
} from '../../user-state/types';
import { userStateStore } from '../../knowledge/store';
import { getBestExplanation } from '../../user-state/canonical-explanations';

// ============================================
// LOGGING
// ============================================

const LOG_PREFIX = '[UserStateAgent]';

function log(method: string, message: string, data?: unknown) {
  console.log(`${LOG_PREFIX} ${method}: ${message}`, data !== undefined ? data : '');
}

function logError(method: string, message: string, error?: unknown) {
  console.error(`${LOG_PREFIX} ${method}: ${message}`, error);
}

// ============================================
// QUERY TYPES
// ============================================

export interface UserStateQuery {
  type:
    | 'current_state'
    | 'active_contexts'
    | 'distributed_info'
    | 'who_knows'
    | 'canonical_explanation'
    | 'topics'
    | 'communication_mode';
  topic?: string;
  contactId?: string;
}

export interface UserStateResult {
  success: boolean;
  data: unknown;
  confidence: number;
}

// ============================================
// USER STATE AGENT CLASS
// ============================================

export class UserStateAgent {
  /**
   * Get the current user state
   */
  async getCurrentState(): Promise<UserIntelligence | null> {
    log('getCurrentState', 'Fetching current user state');
    const result = await userStateStore.get();
    log('getCurrentState', 'Result', {
      found: !!result,
      activeContexts: result?.activeContexts?.length || 0,
      activeTopics: result?.activeTopics?.length || 0,
      distributedInfo: result?.distributedInfo?.length || 0,
    });
    return result || null;
  }

  /**
   * Get active contexts (what the user is currently doing)
   */
  async getActiveContexts(
    options?: {
      minConfidence?: number;
      status?: 'active' | 'winding_down' | 'completed';
    }
  ): Promise<ActiveContext[]> {
    const state = await this.getCurrentState();
    if (!state) return [];

    let contexts = state.activeContexts || [];

    if (options?.status) {
      contexts = contexts.filter(c => c.status === options.status);
    }

    if (options?.minConfidence) {
      contexts = contexts.filter(c => c.confidence >= options.minConfidence!);
    }

    return contexts.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get context relevant to a specific contact
   */
  async getContextsForContact(
    contactId: string
  ): Promise<ActiveContext[]> {
    const contexts = await this.getActiveContexts({ status: 'active' });
    return contexts.filter(c => c.relatedContacts.includes(contactId));
  }

  /**
   * Get distributed information (what user has been telling people)
   */
  async getDistributedInfo(
    options?: {
      topic?: string;
      limit?: number;
    }
  ): Promise<DistributedInfoItem[]> {
    log('getDistributedInfo', 'Searching distributed info', options);

    const state = await this.getCurrentState();
    if (!state) {
      log('getDistributedInfo', 'No state available');
      return [];
    }

    let info = state.distributedInfo || [];
    log('getDistributedInfo', 'Initial info count', { count: info.length });

    if (options?.topic) {
      const topicLower = options.topic.toLowerCase();
      info = info.filter(i =>
        i.content.toLowerCase().includes(topicLower)
      );
      log('getDistributedInfo', 'After topic filter', { count: info.length, topic: options.topic });
    }

    // Sort by recency
    info.sort((a, b) =>
      new Date(b.lastShared).getTime() - new Date(a.lastShared).getTime()
    );

    if (options?.limit) {
      info = info.slice(0, options.limit);
    }

    log('getDistributedInfo', 'Returning info', { count: info.length });
    return info;
  }

  /**
   * Find who knows about a topic
   */
  async whoKnowsAbout(topic: string): Promise<string[]> {
    const info = await this.getDistributedInfo({ topic });
    const knowers = new Set<string>();

    for (const item of info) {
      for (const contactId of item.sharedWith) {
        knowers.add(contactId);
      }
    }

    return [...knowers];
  }

  /**
   * Find who doesn't know about a topic (but probably should)
   */
  async whoDoesntKnowAbout(
    topic: string,
    relevantContacts: string[]
  ): Promise<string[]> {
    const knowers = new Set(await this.whoKnowsAbout(topic));
    return relevantContacts.filter(c => !knowers.has(c));
  }

  /**
   * Get canonical explanation for a topic
   */
  async getCanonicalExplanation(
    topic: string,
    relationshipType?: string,
    preferShort: boolean = false
  ): Promise<string | null> {
    const state = await this.getCurrentState();
    if (!state) return null;

    return getBestExplanation(
      state.canonicalExplanations || [],
      topic,
      relationshipType as any,
      preferShort
    );
  }

  /**
   * Get all canonical explanations
   */
  async getCanonicalExplanations(): Promise<CanonicalExplanation[]> {
    const state = await this.getCurrentState();
    return state?.canonicalExplanations || [];
  }

  /**
   * Get active topics (what user is talking about)
   */
  async getActiveTopics(limit: number = 10): Promise<TopicCluster[]> {
    const state = await this.getCurrentState();
    if (!state) return [];

    return (state.activeTopics || [])
      .sort((a, b) => b.recency - a.recency)
      .slice(0, limit);
  }

  /**
   * Get current communication mode
   */
  async getCommunicationMode(): Promise<CommunicationMode> {
    const state = await this.getCurrentState();
    return state?.communicationMode || 'mixed';
  }

  /**
   * Check if user is in "high social" mode
   */
  async isHighSocialMode(): Promise<boolean> {
    const mode = await this.getCommunicationMode();
    return mode === 'high_social';
  }

  /**
   * Get summary of user's current state for drafting context
   */
  async getCurrentStateSummary(): Promise<string> {
    log('getCurrentStateSummary', 'Building summary');
    const state = await this.getCurrentState();
    if (!state) {
      log('getCurrentStateSummary', 'No state available');
      return 'No user state available.';
    }

    const parts: string[] = [];

    // Communication mode
    parts.push(`Current mode: ${state.communicationMode.replace('_', ' ')}`);

    // Active contexts
    const activeContexts = (state.activeContexts || [])
      .filter(c => c.status === 'active')
      .slice(0, 3);

    if (activeContexts.length > 0) {
      parts.push('Active activities:');
      for (const ctx of activeContexts) {
        parts.push(`- ${ctx.label} (${ctx.relatedContacts.length} people involved)`);
      }
    }

    // Top topics
    const topTopics = (state.activeTopics || []).slice(0, 5);
    if (topTopics.length > 0) {
      parts.push(`Recent topics: ${topTopics.map(t => t.topic).join(', ')}`);
    }

    // Recently shared info
    const recentInfo = (state.distributedInfo || []).slice(0, 2);
    if (recentInfo.length > 0) {
      parts.push('Recently shared:');
      for (const info of recentInfo) {
        const preview = info.content.slice(0, 50) + (info.content.length > 50 ? '...' : '');
        parts.push(`- "${preview}" (with ${info.sharedWith.length} people)`);
      }
    }

    const summary = parts.join('\n');
    log('getCurrentStateSummary', 'Summary built', {
      mode: state.communicationMode,
      activeContextsCount: activeContexts.length,
      topicsCount: topTopics.length,
      recentInfoCount: recentInfo.length,
      summaryLength: summary.length,
    });

    return summary;
  }

  /**
   * Get information relevant to a specific context
   */
  async getContextInfo(contextId: string): Promise<{
    context: ActiveContext | null;
    relatedInfo: DistributedInfoItem[];
    relatedTopics: TopicCluster[];
  }> {
    const state = await this.getCurrentState();
    if (!state) {
      return { context: null, relatedInfo: [], relatedTopics: [] };
    }

    const context = (state.activeContexts || []).find(c => c.id === contextId) || null;

    if (!context) {
      return { context: null, relatedInfo: [], relatedTopics: [] };
    }

    // Find info shared with context contacts
    const relatedInfo = (state.distributedInfo || []).filter(info =>
      info.sharedWith.some(c => context.relatedContacts.includes(c))
    );

    // Find topics that overlap with context contacts
    const relatedTopics = (state.activeTopics || []).filter(topic =>
      topic.relatedMessages.some(m => context.relatedContacts.includes(m.chatId))
    );

    return { context, relatedInfo, relatedTopics };
  }

  /**
   * Process a user state query
   */
  async query(q: UserStateQuery): Promise<UserStateResult> {
    try {
      switch (q.type) {
        case 'current_state':
          const state = await this.getCurrentState();
          return {
            success: !!state,
            data: state,
            confidence: state ? 0.9 : 0,
          };

        case 'active_contexts':
          const contexts = await this.getActiveContexts({ status: 'active' });
          return {
            success: true,
            data: contexts,
            confidence: contexts.length > 0 ? 0.8 : 0.5,
          };

        case 'distributed_info':
          const info = await this.getDistributedInfo({ topic: q.topic });
          return {
            success: true,
            data: info,
            confidence: info.length > 0 ? 0.8 : 0.4,
          };

        case 'who_knows':
          if (!q.topic) {
            return { success: false, data: [], confidence: 0 };
          }
          const knowers = await this.whoKnowsAbout(q.topic);
          return {
            success: true,
            data: knowers,
            confidence: knowers.length > 0 ? 0.7 : 0.5,
          };

        case 'canonical_explanation':
          if (!q.topic) {
            return { success: false, data: null, confidence: 0 };
          }
          const explanation = await this.getCanonicalExplanation(q.topic);
          return {
            success: !!explanation,
            data: explanation,
            confidence: explanation ? 0.8 : 0.3,
          };

        case 'topics':
          const topics = await this.getActiveTopics();
          return {
            success: true,
            data: topics,
            confidence: topics.length > 0 ? 0.7 : 0.5,
          };

        case 'communication_mode':
          const mode = await this.getCommunicationMode();
          return {
            success: true,
            data: mode,
            confidence: 0.8,
          };

        default:
          return { success: false, data: null, confidence: 0 };
      }
    } catch (error) {
      console.error('[UserStateAgent] Query failed:', error);
      return { success: false, data: null, confidence: 0 };
    }
  }
}

// ============================================
// SINGLETON
// ============================================

let userStateAgent: UserStateAgent | null = null;

export function getUserStateAgent(): UserStateAgent {
  if (!userStateAgent) {
    userStateAgent = new UserStateAgent();
  }
  return userStateAgent;
}
