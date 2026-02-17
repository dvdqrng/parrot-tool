/**
 * Knowledge Agent
 * Infrastructure agent that handles all knowledge retrieval operations
 * - Contact facts and history
 * - Relationship information
 * - Cross-contact search
 */

import { ContactIntelligence, ContactFact, RelationshipType } from '../../knowledge/types';
import { contactStore } from '../../knowledge/store';
import { deduplicateFacts, mergeAndPruneFacts } from '../../knowledge/deduplication';

// ============================================
// LOGGING
// ============================================

const LOG_PREFIX = '[KnowledgeAgent]';

function log(method: string, message: string, data?: unknown) {
  console.log(`${LOG_PREFIX} ${method}: ${message}`, data !== undefined ? data : '');
}

function logError(method: string, message: string, error?: unknown) {
  console.error(`${LOG_PREFIX} ${method}: ${message}`, error);
}

// ============================================
// QUERY TYPES
// ============================================

export interface KnowledgeQuery {
  type: 'contact' | 'facts' | 'relationship' | 'search' | 'actions';
  contactId?: string;
  chatId?: string;
  searchQuery?: string;
  factCategories?: string[];
  limit?: number;
}

export interface KnowledgeResult {
  success: boolean;
  data: unknown;
  confidence: number;
  sources: string[];
}

// ============================================
// KNOWLEDGE AGENT CLASS
// ============================================

export class KnowledgeAgent {
  /**
   * Get complete contact intelligence
   */
  async getContactProfile(
    contactId?: string,
    chatId?: string
  ): Promise<ContactIntelligence | null> {
    log('getContactProfile', 'Looking up contact', { contactId, chatId });

    if (contactId) {
      const result = await contactStore.get(contactId);
      log('getContactProfile', 'Result by contactId', {
        found: !!result,
        displayName: result?.displayName,
        factsCount: result?.facts?.length || 0,
      });
      return result || null;
    }
    if (chatId) {
      const result = await contactStore.getByChatId(chatId);
      log('getContactProfile', 'Result by chatId', {
        found: !!result,
        displayName: result?.displayName,
        factsCount: result?.facts?.length || 0,
      });
      return result || null;
    }
    log('getContactProfile', 'No contactId or chatId provided');
    return null;
  }

  /**
   * Get specific facts about a contact
   */
  async getContactFacts(
    contactId: string,
    options?: {
      categories?: string[];
      minConfidence?: number;
      activeOnly?: boolean;
      limit?: number;
    }
  ): Promise<ContactFact[]> {
    log('getContactFacts', 'Fetching facts', { contactId, options });

    const contact = await contactStore.get(contactId);
    if (!contact) {
      log('getContactFacts', 'Contact not found', { contactId });
      return [];
    }

    let facts = contact.facts || [];
    log('getContactFacts', 'Initial facts count', { count: facts.length });

    // Filter by active status
    if (options?.activeOnly !== false) {
      facts = facts.filter(f => f.isActive);
    }

    // Filter by categories
    if (options?.categories && options.categories.length > 0) {
      facts = facts.filter(f => options.categories!.includes(f.category));
    }

    // Filter by confidence
    if (options?.minConfidence) {
      facts = facts.filter(f => f.confidence >= options.minConfidence!);
    }

    // Sort by recency and confidence
    facts.sort((a, b) => {
      const scoreA = a.confidence + (new Date(a.lastConfirmed).getTime() / Date.now());
      const scoreB = b.confidence + (new Date(b.lastConfirmed).getTime() / Date.now());
      return scoreB - scoreA;
    });

    // Apply limit
    if (options?.limit) {
      facts = facts.slice(0, options.limit);
    }

    log('getContactFacts', 'Returning facts', { count: facts.length });
    return facts;
  }

  /**
   * Get relationship classification
   */
  async getRelationship(
    contactId: string
  ): Promise<{ type: RelationshipType; confidence: number } | null> {
    const contact = await contactStore.get(contactId);
    if (!contact?.relationship) return null;

    return {
      type: contact.relationship.type,
      confidence: contact.relationship.confidence,
    };
  }

  /**
   * Search across all contacts for specific information
   */
  async searchAcrossContacts(
    query: string,
    options?: {
      categories?: string[];
      limit?: number;
    }
  ): Promise<Array<{
    contact: ContactIntelligence;
    matchingFacts: ContactFact[];
    relevance: number;
  }>> {
    const allContacts = await contactStore.getAll();
    const results: Array<{
      contact: ContactIntelligence;
      matchingFacts: ContactFact[];
      relevance: number;
    }> = [];

    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    for (const contact of allContacts) {
      const matchingFacts: ContactFact[] = [];
      let totalRelevance = 0;

      for (const fact of contact.facts || []) {
        if (!fact.isActive) continue;

        // Filter by category if specified
        if (options?.categories && !options.categories.includes(fact.category)) {
          continue;
        }

        const contentLower = fact.content.toLowerCase();

        // Check for query matches
        let matched = false;
        let relevance = 0;

        // Exact phrase match
        if (contentLower.includes(queryLower)) {
          matched = true;
          relevance = 1;
        } else {
          // Word-level match
          let wordMatches = 0;
          for (const word of queryWords) {
            if (contentLower.includes(word)) {
              wordMatches++;
            }
          }
          if (wordMatches > 0) {
            matched = true;
            relevance = wordMatches / queryWords.length;
          }
        }

        if (matched) {
          matchingFacts.push(fact);
          totalRelevance += relevance * fact.confidence;
        }
      }

      if (matchingFacts.length > 0) {
        results.push({
          contact,
          matchingFacts,
          relevance: totalRelevance / matchingFacts.length,
        });
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);

    // Apply limit
    if (options?.limit) {
      return results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Find contacts who know about a topic
   */
  async whoKnowsAbout(
    topic: string
  ): Promise<Array<{ contact: ContactIntelligence; relevance: number }>> {
    const results = await this.searchAcrossContacts(topic, { limit: 20 });

    return results.map(r => ({
      contact: r.contact,
      relevance: r.relevance,
    }));
  }

  /**
   * Get pending action items for a contact
   */
  async getPendingActions(
    contactId?: string
  ): Promise<Array<{
    contactId: string;
    contactName: string;
    actionItems: Array<{
      id: string;
      content: string;
      commitment: string;
      dueDate?: string;
    }>;
  }>> {
    const contacts = contactId
      ? [await contactStore.get(contactId)].filter(Boolean) as ContactIntelligence[]
      : await contactStore.getAll();

    const results: Array<{
      contactId: string;
      contactName: string;
      actionItems: Array<{
        id: string;
        content: string;
        commitment: string;
        dueDate?: string;
      }>;
    }> = [];

    for (const contact of contacts) {
      const pendingItems = (contact.actionItems || []).filter(
        a => a.status === 'pending'
      );

      if (pendingItems.length > 0) {
        results.push({
          contactId: contact.id,
          contactName: contact.displayName || contact.id || 'Unknown',
          actionItems: pendingItems.map(a => ({
            id: a.id,
            content: a.content,
            commitment: a.commitment,
            dueDate: a.dueDate,
          })),
        });
      }
    }

    return results;
  }

  /**
   * Update facts for a contact (with deduplication)
   */
  async updateFacts(
    contactId: string,
    newFacts: ContactFact[]
  ): Promise<{ added: number; merged: number; contradictions: number }> {
    const contact = await contactStore.get(contactId);
    if (!contact) {
      return { added: 0, merged: 0, contradictions: 0 };
    }

    const result = mergeAndPruneFacts(contact.facts || [], newFacts);

    await contactStore.upsert({
      ...contact,
      facts: result.facts,
      updatedAt: new Date().toISOString(),
    });

    return {
      added: result.stats.newFacts,
      merged: result.stats.kept - result.stats.newFacts,
      contradictions: result.stats.contradictions,
    };
  }

  /**
   * Get summary of a contact for drafting context
   */
  async getContactSummary(
    contactId: string
  ): Promise<string | null> {
    const contact = await contactStore.get(contactId);
    if (!contact) return null;

    const parts: string[] = [];

    // Name
    const name = contact.displayName || contact.id;
    if (name) parts.push(`Name: ${name}`);

    // Relationship
    if (contact.relationship && contact.relationship.type !== 'unknown') {
      parts.push(`Relationship: ${contact.relationship.type.replace('_', ' ')}`);
    }

    // Key facts (top 5 by confidence)
    const topFacts = (contact.facts || [])
      .filter(f => f.isActive)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    if (topFacts.length > 0) {
      parts.push('Key facts:');
      for (const fact of topFacts) {
        parts.push(`- ${fact.content}`);
      }
    }

    // Pending actions
    const pendingActions = (contact.actionItems || []).filter(
      a => a.status === 'pending'
    );
    if (pendingActions.length > 0) {
      parts.push('Pending actions:');
      for (const action of pendingActions.slice(0, 3)) {
        parts.push(`- ${action.content}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Process a knowledge query
   */
  async query(q: KnowledgeQuery): Promise<KnowledgeResult> {
    try {
      switch (q.type) {
        case 'contact':
          const contact = await this.getContactProfile(q.contactId, q.chatId);
          return {
            success: !!contact,
            data: contact,
            confidence: contact ? 1 : 0,
            sources: contact ? [contact.id] : [],
          };

        case 'facts':
          if (!q.contactId) {
            return { success: false, data: null, confidence: 0, sources: [] };
          }
          const facts = await this.getContactFacts(q.contactId, {
            categories: q.factCategories,
            limit: q.limit,
          });
          return {
            success: true,
            data: facts,
            confidence: facts.length > 0 ? 0.8 : 0.3,
            sources: facts.map(f => f.source.messageId),
          };

        case 'relationship':
          if (!q.contactId) {
            return { success: false, data: null, confidence: 0, sources: [] };
          }
          const rel = await this.getRelationship(q.contactId);
          return {
            success: !!rel,
            data: rel,
            confidence: rel?.confidence || 0,
            sources: [q.contactId],
          };

        case 'search':
          if (!q.searchQuery) {
            return { success: false, data: null, confidence: 0, sources: [] };
          }
          const searchResults = await this.searchAcrossContacts(
            q.searchQuery,
            { categories: q.factCategories, limit: q.limit }
          );
          return {
            success: searchResults.length > 0,
            data: searchResults,
            confidence: searchResults.length > 0 ? searchResults[0].relevance : 0,
            sources: searchResults.flatMap(r => r.matchingFacts.map(f => f.source.messageId)),
          };

        case 'actions':
          const actions = await this.getPendingActions(q.contactId);
          return {
            success: true,
            data: actions,
            confidence: 0.9,
            sources: actions.map(a => a.contactId),
          };

        default:
          return { success: false, data: null, confidence: 0, sources: [] };
      }
    } catch (error) {
      logError('query', 'Query failed', error);
      return { success: false, data: null, confidence: 0, sources: [] };
    }
  }
}

// ============================================
// SINGLETON
// ============================================

let knowledgeAgent: KnowledgeAgent | null = null;

export function getKnowledgeAgent(): KnowledgeAgent {
  if (!knowledgeAgent) {
    log('getKnowledgeAgent', 'Creating new KnowledgeAgent instance');
    knowledgeAgent = new KnowledgeAgent();
  }
  return knowledgeAgent;
}
