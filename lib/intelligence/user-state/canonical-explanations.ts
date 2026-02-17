/**
 * Canonical Explanations
 * Tracks things the user explains repeatedly to different people
 * (e.g., "what my startup does", "directions to my apartment")
 * and maintains canonical versions for each relationship type.
 */

import { BeeperMessage } from '@/lib/types';
import {
  CanonicalExplanation,
  MessageRef,
} from './types';
import { RelationshipType } from '../knowledge/types';

// ============================================
// EXPLANATION DETECTION
// ============================================

/** Topics that are commonly explained repeatedly */
const COMMON_EXPLANATION_TOPICS = [
  // Work/business
  { pattern: /(?:what|about)\s+(?:my|our|the)\s+(?:startup|company|business|work|job)/i, topic: 'work' },
  { pattern: /(?:I|we)\s+(?:work on|build|make|create|do)/i, topic: 'work' },

  // Location/directions
  { pattern: /(?:my|the)\s+(?:apartment|place|house|home|address)/i, topic: 'location' },
  { pattern: /(?:how to get|directions|where.*live)/i, topic: 'location' },

  // Projects
  { pattern: /(?:my|our|the)\s+(?:project|app|product|side hustle)/i, topic: 'project' },

  // Personal info
  { pattern: /(?:my|I'm)\s+(?:background|story|history)/i, topic: 'background' },
  { pattern: /(?:how I|why I)\s+(?:got into|started|ended up)/i, topic: 'background' },

  // Events/plans
  { pattern: /(?:the|my|our)\s+(?:party|wedding|event|trip|vacation)/i, topic: 'event' },
  { pattern: /(?:planning|organizing)\s+(?:a|the)/i, topic: 'event' },

  // Technical/how things work
  { pattern: /(?:how|the way)\s+(?:it|this|that)\s+works/i, topic: 'technical' },
  { pattern: /(?:basically|essentially|in short)/i, topic: 'explanation' },
];

/**
 * Detect if a message contains an explanation
 */
export function detectExplanation(
  text: string
): { topic: string; confidence: number } | null {
  const normalized = text.toLowerCase();

  // Check length - explanations are usually substantial
  if (text.length < 50) return null;

  // Look for explanation patterns
  for (const { pattern, topic } of COMMON_EXPLANATION_TOPICS) {
    if (pattern.test(text)) {
      // Calculate confidence based on explanation indicators
      let confidence = 0.5;

      // Longer explanations are more likely canonical
      if (text.length > 150) confidence += 0.1;
      if (text.length > 300) confidence += 0.1;

      // Contains enumeration (1., 2., etc. or bullets)
      if (/(?:\d+\.|•|-)\s+\w/m.test(text)) confidence += 0.1;

      // Contains transition words
      if (/(?:first|second|then|also|basically|essentially)/i.test(text)) confidence += 0.1;

      // Contains clarifying language
      if (/(?:in other words|basically|essentially|to put it simply)/i.test(text)) confidence += 0.1;

      return { topic, confidence: Math.min(0.9, confidence) };
    }
  }

  // Generic explanation detection
  if (/(?:so basically|let me explain|here's (?:the|how)|the thing is)/i.test(text)) {
    return { topic: 'general', confidence: 0.4 };
  }

  return null;
}

// ============================================
// EXPLANATION EXTRACTION
// ============================================

export interface ExtractedExplanation {
  topic: string;
  content: string;
  source: MessageRef;
  confidence: number;
  length: 'short' | 'medium' | 'long';
}

/**
 * Extract explanations from messages
 */
export function extractExplanations(
  messages: BeeperMessage[]
): ExtractedExplanation[] {
  const explanations: ExtractedExplanation[] = [];

  for (const msg of messages) {
    if (!msg.isFromMe || !msg.text) continue;

    const detection = detectExplanation(msg.text);
    if (!detection) continue;

    const length: ExtractedExplanation['length'] =
      msg.text.length < 100 ? 'short' :
      msg.text.length < 300 ? 'medium' : 'long';

    explanations.push({
      topic: detection.topic,
      content: msg.text,
      source: {
        messageId: msg.id,
        chatId: msg.chatId,
        platform: msg.platform || 'unknown',
        timestamp: msg.timestamp,
      },
      confidence: detection.confidence,
      length,
    });
  }

  return explanations;
}

// ============================================
// CANONICAL MERGING
// ============================================

/**
 * Calculate content similarity between two explanations
 */
function calculateExplanationSimilarity(
  content1: string,
  content2: string
): number {
  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const words1 = new Set(normalize(content1).split(' ').filter(w => w.length > 3));
  const words2 = new Set(normalize(content2).split(' ').filter(w => w.length > 3));

  if (words1.size === 0 && words2.size === 0) return 1;
  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Group similar explanations together
 */
export function groupSimilarExplanations(
  explanations: ExtractedExplanation[],
  similarityThreshold: number = 0.3
): ExtractedExplanation[][] {
  const groups: ExtractedExplanation[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < explanations.length; i++) {
    if (used.has(i)) continue;

    const group = [explanations[i]];
    used.add(i);

    for (let j = i + 1; j < explanations.length; j++) {
      if (used.has(j)) continue;

      // Same topic and similar content
      if (explanations[i].topic === explanations[j].topic) {
        const similarity = calculateExplanationSimilarity(
          explanations[i].content,
          explanations[j].content
        );

        if (similarity >= similarityThreshold) {
          group.push(explanations[j]);
          used.add(j);
        }
      }
    }

    if (group.length >= 2) {
      // Only keep groups with multiple explanations
      groups.push(group);
    }
  }

  return groups;
}

/**
 * Build a canonical explanation from a group
 */
export function buildCanonicalExplanation(
  group: ExtractedExplanation[]
): CanonicalExplanation {
  // Sort by length (prefer longer, more detailed explanations)
  const sorted = [...group].sort((a, b) => b.content.length - a.content.length);

  const longest = sorted[0];
  const shortest = sorted[sorted.length - 1];

  // Get unique recipients by chat
  const recipients = new Set(group.map(e => e.source.chatId));

  return {
    id: `explanation-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    topic: longest.topic,
    shortVersion: shortest.content.slice(0, 200) + (shortest.content.length > 200 ? '...' : ''),
    longVersion: longest.content,
    variations: {}, // Would need relationship data to populate
    frequency: group.length,
    lastUsed: sorted.reduce(
      (latest, e) => e.source.timestamp > latest ? e.source.timestamp : latest,
      sorted[0].source.timestamp
    ),
  };
}

// ============================================
// VARIATION TRACKING
// ============================================

/**
 * Categorize explanation variations by relationship type
 */
export function categorizeVariations(
  explanations: ExtractedExplanation[],
  getRelationshipType: (chatId: string) => RelationshipType | undefined
): Partial<Record<RelationshipType, string>> {
  const variations: Partial<Record<RelationshipType, string>> = {};

  for (const exp of explanations) {
    const relType = getRelationshipType(exp.source.chatId);
    if (!relType || relType === 'unknown') continue;

    // Keep the longest explanation for each relationship type
    if (!variations[relType] || exp.content.length > (variations[relType]?.length || 0)) {
      variations[relType] = exp.content;
    }
  }

  return variations;
}

// ============================================
// CANONICAL STORE OPERATIONS
// ============================================

/**
 * Update or merge a new explanation into existing canonical explanations
 */
export function mergeExplanation(
  existing: CanonicalExplanation[],
  newExp: ExtractedExplanation,
  relationshipType?: RelationshipType
): CanonicalExplanation[] {
  // Find existing canonical for this topic
  const existingIdx = existing.findIndex(e => e.topic === newExp.topic);

  if (existingIdx === -1) {
    // Create new canonical
    const canonical: CanonicalExplanation = {
      id: `explanation-${Date.now()}`,
      topic: newExp.topic,
      shortVersion: newExp.content.slice(0, 200),
      longVersion: newExp.content,
      variations: relationshipType && relationshipType !== 'unknown'
        ? { [relationshipType]: newExp.content }
        : {},
      frequency: 1,
      lastUsed: newExp.source.timestamp,
    };

    return [...existing, canonical];
  }

  // Update existing
  const updated = [...existing];
  const canonical = { ...updated[existingIdx] };

  canonical.frequency++;
  canonical.lastUsed = newExp.source.timestamp;

  // Update long version if this is longer
  if (newExp.content.length > canonical.longVersion.length) {
    canonical.longVersion = newExp.content;
  }

  // Add relationship variation
  if (relationshipType && relationshipType !== 'unknown') {
    canonical.variations = {
      ...canonical.variations,
      [relationshipType]: newExp.content,
    };
  }

  updated[existingIdx] = canonical;
  return updated;
}

// ============================================
// MAIN PROCESSOR
// ============================================

/**
 * Process messages and update canonical explanations
 */
export async function processExplanations(
  messages: BeeperMessage[],
  existingCanonicals: CanonicalExplanation[],
  getRelationshipType: (chatId: string) => RelationshipType | undefined
): Promise<{
  canonicals: CanonicalExplanation[];
  newExplanations: number;
}> {
  // Extract explanations from messages
  const extracted = extractExplanations(messages);

  if (extracted.length === 0) {
    return { canonicals: existingCanonicals, newExplanations: 0 };
  }

  // Merge each explanation into canonicals
  let canonicals = [...existingCanonicals];
  let newCount = 0;

  for (const exp of extracted) {
    const relType = getRelationshipType(exp.source.chatId);
    const beforeLen = canonicals.length;
    canonicals = mergeExplanation(canonicals, exp, relType);

    if (canonicals.length > beforeLen) {
      newCount++;
    }
  }

  return { canonicals, newExplanations: newCount };
}

/**
 * Get the best explanation for a given topic and relationship
 */
export function getBestExplanation(
  canonicals: CanonicalExplanation[],
  topic: string,
  relationshipType?: RelationshipType,
  preferShort: boolean = false
): string | null {
  const canonical = canonicals.find(c =>
    c.topic.toLowerCase().includes(topic.toLowerCase())
  );

  if (!canonical) return null;

  // Check for relationship-specific variation
  if (relationshipType && canonical.variations[relationshipType]) {
    return canonical.variations[relationshipType];
  }

  // Return appropriate version
  return preferShort ? canonical.shortVersion : canonical.longVersion;
}
