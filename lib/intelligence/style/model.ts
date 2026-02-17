/**
 * Style Model
 * Platform x Relationship style matrix for matching user's communication style
 */

import { BeeperMessage } from '@/lib/types';
import { StyleFingerprint, RelationshipType } from '../knowledge/types';
import { extractTier1, aggregateStyleSignals } from '../extraction/tier1-local';
import { styleMatrixStore } from '../knowledge/store';

// ============================================
// STYLE INSTRUCTIONS
// ============================================

export interface StyleInstruction {
  instructions: string; // Natural language for drafting
  exemplars: string[]; // Example messages
  confidence: number;
}

// ============================================
// COLD START MATRIX
// ============================================

const COLD_START_STYLES: Record<string, Partial<Record<RelationshipType, Partial<StyleFingerprint>>>> = {
  whatsapp: {
    close_friend: {
      capitalization: 'all_lower',
      punctuation: 'minimal',
      emojiUsage: 'heavy',
      formality: 'very_casual',
      messageBreaking: 'multiple_short',
    },
    friend: {
      capitalization: 'all_lower',
      punctuation: 'minimal',
      emojiUsage: 'moderate',
      formality: 'casual',
      messageBreaking: 'multiple_short',
    },
    professional: {
      capitalization: 'proper',
      punctuation: 'full',
      emojiUsage: 'light',
      formality: 'casual',
      messageBreaking: 'single_long',
    },
    family: {
      capitalization: 'mixed',
      punctuation: 'minimal',
      emojiUsage: 'moderate',
      formality: 'casual',
      messageBreaking: 'multiple_short',
    },
  },
  linkedin: {
    professional: {
      capitalization: 'proper',
      punctuation: 'full',
      emojiUsage: 'none',
      formality: 'formal',
      messageBreaking: 'single_long',
    },
    acquaintance: {
      capitalization: 'proper',
      punctuation: 'full',
      emojiUsage: 'light',
      formality: 'formal',
      messageBreaking: 'single_long',
    },
  },
  instagram: {
    close_friend: {
      capitalization: 'all_lower',
      punctuation: 'none',
      emojiUsage: 'heavy',
      formality: 'very_casual',
      messageBreaking: 'multiple_short',
    },
    friend: {
      capitalization: 'all_lower',
      punctuation: 'minimal',
      emojiUsage: 'moderate',
      formality: 'casual',
      messageBreaking: 'multiple_short',
    },
  },
  telegram: {
    friend: {
      capitalization: 'all_lower',
      punctuation: 'minimal',
      emojiUsage: 'moderate',
      formality: 'casual',
      messageBreaking: 'multiple_short',
    },
    professional: {
      capitalization: 'proper',
      punctuation: 'full',
      emojiUsage: 'light',
      formality: 'casual',
      messageBreaking: 'mixed',
    },
  },
  default: {
    unknown: {
      capitalization: 'proper',
      punctuation: 'minimal',
      emojiUsage: 'light',
      formality: 'casual',
      messageBreaking: 'mixed',
    },
  },
};

// ============================================
// STYLE MODEL CLASS
// ============================================

export class StyleModel {
  private cache: Map<string, StyleFingerprint> = new Map();

  /**
   * Build a style fingerprint from messages
   */
  buildFingerprint(
    messages: BeeperMessage[],
    platform: string
  ): StyleFingerprint | null {
    if (messages.length === 0) return null;

    const myMessages = messages.filter(m => m.isFromMe);
    if (myMessages.length < 3) return null; // Need at least 3 messages

    const tier1Results = myMessages.map(extractTier1);
    const aggregated = aggregateStyleSignals(tier1Results);

    if (!aggregated) return null;

    // Determine formality from word choice and punctuation
    let formality: StyleFingerprint['formality'] = 'casual';
    if (aggregated.punctuationStyle === 'full' && aggregated.capitalization === 'proper') {
      formality = 'formal';
    } else if (aggregated.punctuationStyle === 'none' && aggregated.capitalization === 'all_lower') {
      formality = 'very_casual';
    }

    // Determine emoji usage
    let emojiUsage: StyleFingerprint['emojiUsage'] = 'none';
    const avgEmoji = aggregated.emojiCount || 0;
    if (avgEmoji > 2) emojiUsage = 'heavy';
    else if (avgEmoji > 0.5) emojiUsage = 'moderate';
    else if (avgEmoji > 0) emojiUsage = 'light';

    // Determine message breaking style
    let messageBreaking: StyleFingerprint['messageBreaking'] = 'mixed';
    const avgLength = aggregated.charCount || 0;
    if (avgLength < 50) messageBreaking = 'multiple_short';
    else if (avgLength > 150) messageBreaking = 'single_long';

    const fingerprint: StyleFingerprint = {
      avgMessageLength: aggregated.charCount || 0,
      messageBreaking,
      capitalization: aggregated.capitalization || 'mixed',
      punctuation: aggregated.punctuationStyle || 'minimal',
      emojiUsage,
      formality,
      platform,
      sampleSize: myMessages.length,
      confidence: Math.min(0.9, myMessages.length / 20),
      exemplarIds: myMessages.slice(-5).map(m => m.id),
      lastUpdated: new Date().toISOString(),
    };

    return fingerprint;
  }

  /**
   * Get style for a specific context with fallback hierarchy
   */
  resolveStyle(
    contactId: string,
    platform: string,
    relationshipType: RelationshipType = 'unknown'
  ): StyleFingerprint {
    // 1. Check cache for per-contact per-platform
    const contactKey = `${contactId}-${platform}`;
    const cached = this.cache.get(contactKey);
    if (cached && cached.confidence > 0.5) {
      return cached;
    }

    // 2. Check platform-wide style
    const platformCached = this.cache.get(`platform-${platform}`);
    if (platformCached && platformCached.confidence > 0.3) {
      return platformCached;
    }

    // 3. Use cold start matrix
    return this.getColdStartStyle(platform, relationshipType);
  }

  /**
   * Get cold start style from matrix
   */
  getColdStartStyle(
    platform: string,
    relationshipType: RelationshipType
  ): StyleFingerprint {
    const platformStyles = COLD_START_STYLES[platform] || COLD_START_STYLES.default;
    const style = platformStyles[relationshipType] || platformStyles.unknown || COLD_START_STYLES.default.unknown!;

    return {
      avgMessageLength: 50,
      messageBreaking: style.messageBreaking || 'mixed',
      capitalization: style.capitalization || 'proper',
      punctuation: style.punctuation || 'minimal',
      emojiUsage: style.emojiUsage || 'light',
      formality: style.formality || 'casual',
      platform,
      sampleSize: 0,
      confidence: 0.3, // Low confidence for cold start
      exemplarIds: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Generate natural language style instructions for drafting
   */
  getStyleInstructions(
    style: StyleFingerprint
  ): StyleInstruction {
    const instructions: string[] = [];

    // Message length
    if (style.messageBreaking === 'multiple_short') {
      instructions.push('Keep messages short and punchy. Break long thoughts into multiple messages.');
    } else if (style.messageBreaking === 'single_long') {
      instructions.push('Write in complete, well-structured paragraphs. Keep everything in one message.');
    }

    // Capitalization
    if (style.capitalization === 'all_lower') {
      instructions.push('Use all lowercase, no capital letters.');
    } else if (style.capitalization === 'proper') {
      instructions.push('Use proper capitalization.');
    }

    // Punctuation
    if (style.punctuation === 'none') {
      instructions.push('Skip punctuation entirely.');
    } else if (style.punctuation === 'minimal') {
      instructions.push("Use minimal punctuation - periods optional, skip commas when possible.");
    } else {
      instructions.push('Use full punctuation.');
    }

    // Emoji
    if (style.emojiUsage === 'heavy') {
      instructions.push('Use emojis freely throughout the message.');
    } else if (style.emojiUsage === 'moderate') {
      instructions.push('Include an emoji or two where it fits naturally.');
    } else if (style.emojiUsage === 'light') {
      instructions.push('Use emojis sparingly, if at all.');
    } else {
      instructions.push('No emojis.');
    }

    // Formality
    if (style.formality === 'formal') {
      instructions.push('Keep a professional, formal tone.');
    } else if (style.formality === 'very_casual') {
      instructions.push('Be very casual and relaxed. Use slang if appropriate.');
    } else {
      instructions.push('Keep it friendly and casual.');
    }

    return {
      instructions: instructions.join(' '),
      exemplars: [], // Would be populated from actual messages
      confidence: style.confidence,
    };
  }

  /**
   * Update style model with new messages
   */
  async updateStyle(
    contactId: string,
    platform: string,
    messages: BeeperMessage[]
  ): Promise<void> {
    const fingerprint = this.buildFingerprint(messages, platform);
    if (!fingerprint) return;

    const key = `${contactId}-${platform}`;
    this.cache.set(key, fingerprint);

    // Persist to store
    await styleMatrixStore.updateStyle(key, fingerprint);
  }

  /**
   * Load styles from persistent store
   */
  async loadFromStore(): Promise<void> {
    const stored = await styleMatrixStore.get();
    for (const [key, style] of Object.entries(stored)) {
      this.cache.set(key, style);
    }
  }
}

// Singleton instance
let styleModel: StyleModel | null = null;

export function getStyleModel(): StyleModel {
  if (!styleModel) {
    styleModel = new StyleModel();
  }
  return styleModel;
}
