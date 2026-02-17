/**
 * Style Agent
 * Infrastructure agent that handles style resolution and matching
 * - Resolves appropriate style for context
 * - Provides drafting instructions
 * - Learns from user edits
 */

import { BeeperMessage } from '@/lib/types';
import { StyleFingerprint, RelationshipType } from '../../knowledge/types';
import { StyleInstruction, StyleModel, getStyleModel } from '../../style/model';
import { getStyleResolver, ResolvedStyle, ResolutionContext } from '../../style/resolver';
import { calculateStyleDistance, findSimilarStyles } from '../../style/clusters';
import { contactStore } from '../../knowledge/store';

// ============================================
// LOGGING
// ============================================

const LOG_PREFIX = '[StyleAgent]';

function log(method: string, message: string, data?: unknown) {
  console.log(`${LOG_PREFIX} ${method}: ${message}`, data !== undefined ? data : '');
}

function logError(method: string, message: string, error?: unknown) {
  console.error(`${LOG_PREFIX} ${method}: ${message}`, error);
}

// ============================================
// STYLE REQUEST TYPES
// ============================================

export interface StyleRequest {
  contactId?: string;
  chatId?: string;
  platform: string;
  relationshipType?: RelationshipType;
  includeExamplars?: boolean;
}

export interface StyleResponse {
  style: StyleFingerprint;
  instructions: StyleInstruction;
  source: ResolvedStyle['source'];
  confidence: number;
  exemplars?: string[];
}

// ============================================
// STYLE AGENT CLASS
// ============================================

export class StyleAgent {
  private model: StyleModel;

  constructor() {
    this.model = getStyleModel();
    log('constructor', 'StyleAgent initialized');
  }

  /**
   * Get style instructions for a drafting context
   */
  async getStyleInstructions(request: StyleRequest): Promise<StyleResponse> {
    log('getStyleInstructions', 'Processing request', {
      contactId: request.contactId,
      chatId: request.chatId,
      platform: request.platform,
      relationshipType: request.relationshipType,
    });

    const resolver = getStyleResolver();

    // Resolve contact ID from chat ID if needed
    let contactId = request.contactId;
    if (!contactId && request.chatId) {
      const contact = await contactStore.getByChatId(request.chatId);
      contactId = contact?.id;
      log('getStyleInstructions', 'Resolved contactId from chatId', { contactId });
    }

    const context: ResolutionContext = {
      contactId,
      platform: request.platform,
      relationshipType: request.relationshipType,
    };

    const resolved = resolver.resolve(context);
    log('getStyleInstructions', 'Style resolved', {
      source: resolved.source,
      confidence: resolved.confidence,
      formality: resolved.style.formality,
      emojiUsage: resolved.style.emojiUsage,
    });

    // Get exemplars if requested
    let exemplars: string[] = [];
    if (request.includeExamplars && resolved.style.exemplarIds.length > 0) {
      // Would fetch actual message content from store
      exemplars = resolved.style.exemplarIds.slice(0, 3);
    }

    return {
      style: resolved.style,
      instructions: resolved.instructions,
      source: resolved.source,
      confidence: resolved.confidence,
      exemplars,
    };
  }

  /**
   * Analyze messages to build/update style fingerprint
   */
  async analyzeStyle(
    contactId: string,
    platform: string,
    messages: BeeperMessage[]
  ): Promise<StyleFingerprint | null> {
    const fingerprint = this.model.buildFingerprint(messages, platform);

    if (fingerprint) {
      await this.model.updateStyle(contactId, platform, messages);
    }

    return fingerprint;
  }

  /**
   * Learn from user edits to drafts
   */
  async learnFromEdit(
    contactId: string,
    platform: string,
    originalDraft: string,
    editedDraft: string
  ): Promise<{
    learned: boolean;
    adjustments: string[];
  }> {
    const adjustments: string[] = [];

    // Analyze what changed
    const origLower = originalDraft.toLowerCase();
    const editLower = editedDraft.toLowerCase();

    // Length change
    if (editedDraft.length < originalDraft.length * 0.7) {
      adjustments.push('User prefers shorter messages');
    } else if (editedDraft.length > originalDraft.length * 1.3) {
      adjustments.push('User prefers more detailed messages');
    }

    // Capitalization change
    const origHasProperCaps = /^[A-Z]/.test(originalDraft);
    const editHasProperCaps = /^[A-Z]/.test(editedDraft);
    if (origHasProperCaps && !editHasProperCaps) {
      adjustments.push('User prefers lowercase');
    } else if (!origHasProperCaps && editHasProperCaps) {
      adjustments.push('User prefers proper capitalization');
    }

    // Emoji changes
    const origEmoji = (originalDraft.match(/\p{Emoji}/gu) || []).length;
    const editEmoji = (editedDraft.match(/\p{Emoji}/gu) || []).length;
    if (origEmoji > 0 && editEmoji === 0) {
      adjustments.push('User removed emojis');
    } else if (origEmoji === 0 && editEmoji > 0) {
      adjustments.push('User added emojis');
    }

    // Punctuation changes
    const origPunct = /[.!?]$/.test(originalDraft.trim());
    const editPunct = /[.!?]$/.test(editedDraft.trim());
    if (origPunct && !editPunct) {
      adjustments.push('User removed punctuation');
    } else if (!origPunct && editPunct) {
      adjustments.push('User added punctuation');
    }

    // Store these adjustments as learnings
    // (Would integrate with agent memory in full implementation)

    return {
      learned: adjustments.length > 0,
      adjustments,
    };
  }

  /**
   * Get contacts with similar style
   */
  async getSimilarStyleContacts(
    contactId: string,
    platform: string,
    limit: number = 5
  ): Promise<Array<{
    contactId: string;
    contactName: string;
    similarity: number;
  }>> {
    const contact = await contactStore.get(contactId);
    if (!contact?.styleProfiles?.[platform]) {
      return [];
    }

    const targetStyle = contact.styleProfiles[platform];

    // Get all contacts with style profiles
    const allContacts = await contactStore.getAll();
    const stylesWithContact = allContacts
      .filter(c => c.id !== contactId && c.styleProfiles?.[platform])
      .map(c => ({
        contactId: c.id,
        platform,
        style: c.styleProfiles![platform],
        contactName: c.displayName || c.id || 'Unknown',
      }));

    const similar = findSimilarStyles(
      targetStyle,
      stylesWithContact.map(s => ({
        contactId: s.contactId,
        platform: s.platform,
        style: s.style,
      })),
      limit
    );

    return similar.map(s => {
      const contact = stylesWithContact.find(c => c.contactId === s.contactId);
      return {
        contactId: s.contactId,
        contactName: contact?.contactName || 'Unknown',
        similarity: s.similarity,
      };
    });
  }

  /**
   * Generate style-aware draft instructions
   */
  async getDraftInstructions(
    contactId: string | undefined,
    chatId: string | undefined,
    platform: string,
    relationshipType?: RelationshipType
  ): Promise<string> {
    log('getDraftInstructions', 'Getting draft instructions', {
      contactId,
      chatId,
      platform,
      relationshipType,
    });

    const response = await this.getStyleInstructions({
      contactId,
      chatId,
      platform,
      relationshipType,
      includeExamplars: true,
    });

    let instructions = response.instructions.instructions;

    // Add confidence context
    if (response.confidence < 0.4) {
      instructions = `(Note: Limited style data available, using defaults) ${instructions}`;
    }

    // Add source context
    if (response.source === 'cold_start') {
      instructions = `Using ${platform}/${relationshipType || 'general'} defaults. ${instructions}`;
    } else if (response.source === 'platform') {
      instructions = `Based on your ${platform} style. ${instructions}`;
    } else if (response.source === 'contact') {
      instructions = `Matching your style with this contact. ${instructions}`;
    }

    log('getDraftInstructions', 'Instructions generated', {
      source: response.source,
      confidence: response.confidence,
      instructionsLength: instructions.length,
    });

    return instructions;
  }

  /**
   * Get style comparison between two contexts
   */
  async compareStyles(
    context1: { contactId?: string; chatId?: string; platform: string },
    context2: { contactId?: string; chatId?: string; platform: string }
  ): Promise<{
    distance: number;
    differences: string[];
  }> {
    const style1 = await this.getStyleInstructions({
      ...context1,
      includeExamplars: false,
    });

    const style2 = await this.getStyleInstructions({
      ...context2,
      includeExamplars: false,
    });

    const distance = calculateStyleDistance(style1.style, style2.style);
    const differences: string[] = [];

    // Identify key differences
    if (style1.style.formality !== style2.style.formality) {
      differences.push(`Formality: ${style1.style.formality} vs ${style2.style.formality}`);
    }
    if (style1.style.emojiUsage !== style2.style.emojiUsage) {
      differences.push(`Emoji usage: ${style1.style.emojiUsage} vs ${style2.style.emojiUsage}`);
    }
    if (style1.style.capitalization !== style2.style.capitalization) {
      differences.push(`Capitalization: ${style1.style.capitalization} vs ${style2.style.capitalization}`);
    }
    if (style1.style.punctuation !== style2.style.punctuation) {
      differences.push(`Punctuation: ${style1.style.punctuation} vs ${style2.style.punctuation}`);
    }
    if (style1.style.messageBreaking !== style2.style.messageBreaking) {
      differences.push(`Message length: ${style1.style.messageBreaking} vs ${style2.style.messageBreaking}`);
    }

    return { distance, differences };
  }
}

// ============================================
// SINGLETON
// ============================================

let styleAgent: StyleAgent | null = null;

export function getStyleAgent(): StyleAgent {
  if (!styleAgent) {
    styleAgent = new StyleAgent();
  }
  return styleAgent;
}
