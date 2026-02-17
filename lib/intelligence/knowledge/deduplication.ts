/**
 * Fact Deduplication & Contradiction Resolution
 * Handles merging new facts with existing ones, detecting contradictions,
 * and maintaining fact integrity over time.
 */

import { ContactFact, FactCategory } from './types';

// ============================================
// DEDUPLICATION RESULT
// ============================================

export interface DeduplicationResult {
  /** Facts that should be kept (merged + new unique facts) */
  mergedFacts: ContactFact[];
  /** Facts that were superseded by newer information */
  supersededFacts: ContactFact[];
  /** Detected contradictions that may need user review */
  contradictions: Contradiction[];
  /** Stats about the merge operation */
  stats: {
    kept: number;
    superseded: number;
    contradictions: number;
    newFacts: number;
  };
}

export interface Contradiction {
  existingFact: ContactFact;
  incomingFact: ContactFact;
  category: FactCategory;
  resolution: 'use_newer' | 'use_higher_confidence' | 'needs_review';
  resolvedFact: ContactFact;
}

// ============================================
// SIMILARITY SCORING
// ============================================

/**
 * Calculate semantic similarity between two fact contents
 * Returns a score between 0 (completely different) and 1 (identical)
 */
function calculateSimilarity(content1: string, content2: string): number {
  const norm1 = normalizeContent(content1);
  const norm2 = normalizeContent(content2);

  // Exact match
  if (norm1 === norm2) return 1.0;

  // One contains the other (substring match)
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const shorter = Math.min(norm1.length, norm2.length);
    const longer = Math.max(norm1.length, norm2.length);
    return 0.7 + (0.3 * shorter / longer);
  }

  // Word overlap (Jaccard similarity)
  const words1 = new Set(norm1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(norm2.split(/\s+/).filter(w => w.length > 2));

  if (words1.size === 0 && words2.size === 0) return 1.0;
  if (words1.size === 0 || words2.size === 0) return 0.0;

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

function normalizeContent(content: string): string {
  return content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================
// CONTRADICTION DETECTION
// ============================================

/**
 * Check if two facts contradict each other
 */
function detectContradiction(
  fact1: ContactFact,
  fact2: ContactFact
): boolean {
  // Same category, similar topic, but different values
  if (fact1.category !== fact2.category) return false;

  const similarity = calculateSimilarity(fact1.content, fact2.content);

  // If very similar, not a contradiction (just duplicate/update)
  if (similarity > 0.7) return false;

  // Category-specific contradiction patterns
  switch (fact1.category) {
    case 'location':
      // Different locations mentioned
      return hasLocationContradiction(fact1.content, fact2.content);

    case 'occupation':
      // Different job titles or companies
      return hasOccupationContradiction(fact1.content, fact2.content);

    case 'relationship':
      // Different relationship status
      return hasRelationshipContradiction(fact1.content, fact2.content);

    case 'contact_info':
      // Same type of contact info but different values
      return hasContactInfoContradiction(fact1.content, fact2.content);

    default:
      // For other categories, use a stricter similarity threshold
      // If moderately similar but not the same, could be contradiction
      return similarity > 0.3 && similarity < 0.6;
  }
}

function hasLocationContradiction(content1: string, content2: string): boolean {
  // Extract location indicators
  const locationWords1 = extractLocationWords(content1);
  const locationWords2 = extractLocationWords(content2);

  // If both mention specific cities/countries that are different
  const cities1 = locationWords1.cities;
  const cities2 = locationWords2.cities;

  if (cities1.length > 0 && cities2.length > 0) {
    const intersection = cities1.filter(c => cities2.includes(c));
    if (intersection.length === 0) {
      // Different cities mentioned - but check for "moving" context
      const movingPattern = /mov(ed|ing)|relocat(ed|ing)|used to live/i;
      if (movingPattern.test(content1) || movingPattern.test(content2)) {
        return false; // Not a contradiction, just a move
      }
      return true;
    }
  }

  return false;
}

function extractLocationWords(content: string): { cities: string[] } {
  // Common city/location patterns
  const cityPattern = /\b(live[sd]? in|from|based in|located in|moved to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi;
  const cities: string[] = [];

  let match;
  while ((match = cityPattern.exec(content)) !== null) {
    cities.push(match[2].toLowerCase());
  }

  return { cities };
}

function hasOccupationContradiction(content1: string, content2: string): boolean {
  // Job title patterns
  const jobPattern = /(?:work[s]? (?:as|at|for)|(?:is|was) (?:a|an)?)\s+([^,.]+)/gi;

  const jobs1 = extractPattern(content1, jobPattern);
  const jobs2 = extractPattern(content2, jobPattern);

  if (jobs1.length > 0 && jobs2.length > 0) {
    // Check if any jobs match
    const similar = jobs1.some(j1 =>
      jobs2.some(j2 => calculateSimilarity(j1, j2) > 0.5)
    );
    if (!similar) {
      // Check for "used to" or "previously" patterns
      const previousPattern = /used to|previously|former|ex-/i;
      if (previousPattern.test(content1) || previousPattern.test(content2)) {
        return false; // Career change, not contradiction
      }
      return true;
    }
  }

  return false;
}

function hasRelationshipContradiction(content1: string, content2: string): boolean {
  // Relationship status patterns
  const statusPatterns = [
    /\b(single|married|engaged|divorced|dating|in a relationship)\b/i,
    /\b(boyfriend|girlfriend|husband|wife|partner|spouse|fiancé|fiancée)\b/i,
  ];

  for (const pattern of statusPatterns) {
    const match1 = content1.match(pattern);
    const match2 = content2.match(pattern);

    if (match1 && match2 && match1[1].toLowerCase() !== match2[1].toLowerCase()) {
      // Check if one is clearly older
      // (Would need timestamps, handled in resolution)
      return true;
    }
  }

  return false;
}

function hasContactInfoContradiction(content1: string, content2: string): boolean {
  // Phone number patterns
  const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;
  const phone1 = content1.match(phonePattern);
  const phone2 = content2.match(phonePattern);

  if (phone1 && phone2 && phone1[0] !== phone2[0]) {
    return true; // Different phone numbers
  }

  // Email patterns
  const emailPattern = /\b[\w.-]+@[\w.-]+\.\w+\b/i;
  const email1 = content1.match(emailPattern);
  const email2 = content2.match(emailPattern);

  if (email1 && email2 && email1[0].toLowerCase() !== email2[0].toLowerCase()) {
    return true; // Different emails
  }

  return false;
}

function extractPattern(content: string, pattern: RegExp): string[] {
  const results: string[] = [];
  let match;
  const regex = new RegExp(pattern.source, pattern.flags);
  while ((match = regex.exec(content)) !== null) {
    if (match[1]) results.push(match[1].trim().toLowerCase());
  }
  return results;
}

// ============================================
// CONTRADICTION RESOLUTION
// ============================================

/**
 * Resolve a contradiction between two facts
 */
function resolveContradiction(
  existing: ContactFact,
  incoming: ContactFact
): Contradiction {
  const resolution = determineResolution(existing, incoming);

  let resolvedFact: ContactFact;

  switch (resolution) {
    case 'use_newer':
      resolvedFact = {
        ...incoming,
        supersededBy: undefined,
        isActive: true,
      };
      break;

    case 'use_higher_confidence':
      if (incoming.confidence > existing.confidence) {
        resolvedFact = {
          ...incoming,
          supersededBy: undefined,
          isActive: true,
        };
      } else {
        resolvedFact = {
          ...existing,
          lastConfirmed: new Date().toISOString(),
        };
      }
      break;

    case 'needs_review':
    default:
      // Default to newer but flag for review
      resolvedFact = {
        ...incoming,
        confidence: Math.min(incoming.confidence, 0.5), // Lower confidence
        isActive: true,
      };
      break;
  }

  return {
    existingFact: existing,
    incomingFact: incoming,
    category: existing.category,
    resolution,
    resolvedFact,
  };
}

function determineResolution(
  existing: ContactFact,
  incoming: ContactFact
): Contradiction['resolution'] {
  const existingTime = new Date(existing.lastConfirmed).getTime();
  const incomingTime = new Date(incoming.source.timestamp).getTime();
  const ageDiff = incomingTime - existingTime;

  // If incoming is significantly newer (>7 days), prefer it
  if (ageDiff > 7 * 24 * 60 * 60 * 1000) {
    return 'use_newer';
  }

  // If confidence difference is significant
  if (Math.abs(incoming.confidence - existing.confidence) > 0.3) {
    return 'use_higher_confidence';
  }

  // If incoming is from tier 2 (LLM) and existing is from tier 1 (regex)
  if (incoming.source.tier === 2 && existing.source.tier === 1) {
    return 'use_higher_confidence';
  }

  // Can't auto-resolve
  return 'needs_review';
}

// ============================================
// MAIN DEDUPLICATION FUNCTION
// ============================================

/**
 * Deduplicate facts, merging incoming facts with existing ones
 * Handles updates, contradictions, and supersession
 */
export function deduplicateFacts(
  existing: ContactFact[],
  incoming: ContactFact[]
): DeduplicationResult {
  const mergedFacts: ContactFact[] = [];
  const supersededFacts: ContactFact[] = [];
  const contradictions: Contradiction[] = [];
  const processedIncoming = new Set<string>();

  // Group existing facts by category for faster lookup
  const existingByCategory = new Map<FactCategory, ContactFact[]>();
  for (const fact of existing) {
    if (!fact.isActive) continue;
    const list = existingByCategory.get(fact.category) || [];
    list.push(fact);
    existingByCategory.set(fact.category, list);
  }

  // Process each incoming fact
  for (const incomingFact of incoming) {
    const categoryFacts = existingByCategory.get(incomingFact.category) || [];
    let matched = false;

    for (const existingFact of categoryFacts) {
      const similarity = calculateSimilarity(
        existingFact.content,
        incomingFact.content
      );

      if (similarity > 0.85) {
        // High similarity - merge/update
        matched = true;
        processedIncoming.add(incomingFact.id);

        // Update the existing fact with new confirmation
        const updatedFact: ContactFact = {
          ...existingFact,
          lastConfirmed: incomingFact.source.timestamp,
          // Increase confidence slightly on reconfirmation
          confidence: Math.min(1, existingFact.confidence + 0.05),
        };
        mergedFacts.push(updatedFact);
        break;
      } else if (detectContradiction(existingFact, incomingFact)) {
        // Contradiction detected
        matched = true;
        processedIncoming.add(incomingFact.id);

        const resolution = resolveContradiction(existingFact, incomingFact);
        contradictions.push(resolution);

        // Mark old fact as superseded
        supersededFacts.push({
          ...existingFact,
          supersededBy: resolution.resolvedFact.id,
          isActive: false,
        });

        // Add resolved fact
        mergedFacts.push(resolution.resolvedFact);
        break;
      }
    }

    if (!matched) {
      // New unique fact
      mergedFacts.push(incomingFact);
      processedIncoming.add(incomingFact.id);
    }
  }

  // Add remaining existing facts that weren't affected
  for (const existingFact of existing) {
    if (!existingFact.isActive) {
      supersededFacts.push(existingFact);
      continue;
    }

    const alreadyMerged = mergedFacts.some(
      f => f.id === existingFact.id ||
           calculateSimilarity(f.content, existingFact.content) > 0.85
    );

    if (!alreadyMerged) {
      mergedFacts.push(existingFact);
    }
  }

  return {
    mergedFacts,
    supersededFacts,
    contradictions,
    stats: {
      kept: mergedFacts.length,
      superseded: supersededFacts.length,
      contradictions: contradictions.length,
      newFacts: incoming.filter(f => !existing.some(
        e => calculateSimilarity(e.content, f.content) > 0.85
      )).length,
    },
  };
}

// ============================================
// FACT PRUNING
// ============================================

export interface PruningOptions {
  /** Maximum facts to keep per category */
  maxPerCategory: number;
  /** Maximum age in days for low-confidence facts */
  maxAgeForLowConfidence: number;
  /** Confidence threshold for pruning old facts */
  confidenceThreshold: number;
}

const DEFAULT_PRUNING_OPTIONS: PruningOptions = {
  maxPerCategory: 20,
  maxAgeForLowConfidence: 90, // 3 months
  confidenceThreshold: 0.4,
};

/**
 * Prune old, low-confidence, or excessive facts
 */
export function pruneFacts(
  facts: ContactFact[],
  options: PruningOptions = DEFAULT_PRUNING_OPTIONS
): { kept: ContactFact[]; pruned: ContactFact[] } {
  const now = Date.now();
  const kept: ContactFact[] = [];
  const pruned: ContactFact[] = [];

  // Group by category
  const byCategory = new Map<FactCategory, ContactFact[]>();
  for (const fact of facts) {
    if (!fact.isActive) {
      pruned.push(fact);
      continue;
    }

    const list = byCategory.get(fact.category) || [];
    list.push(fact);
    byCategory.set(fact.category, list);
  }

  // Process each category
  for (const [_, categoryFacts] of byCategory) {
    // Sort by recency * confidence
    const scored = categoryFacts.map(f => {
      const ageMs = now - new Date(f.lastConfirmed).getTime();
      const ageDays = ageMs / (24 * 60 * 60 * 1000);
      const recencyScore = Math.max(0, 1 - ageDays / 180); // Decay over 6 months
      const score = f.confidence * (0.7 + 0.3 * recencyScore);
      return { fact: f, score, ageDays };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Keep top N, prune old low-confidence ones
    for (let i = 0; i < scored.length; i++) {
      const { fact, ageDays } = scored[i];

      if (i >= options.maxPerCategory) {
        // Exceeds limit
        pruned.push({ ...fact, isActive: false });
      } else if (
        ageDays > options.maxAgeForLowConfidence &&
        fact.confidence < options.confidenceThreshold
      ) {
        // Old and low confidence
        pruned.push({ ...fact, isActive: false });
      } else {
        kept.push(fact);
      }
    }
  }

  return { kept, pruned };
}

// ============================================
// MERGE HELPER
// ============================================

/**
 * Convenience function to merge and prune facts in one operation
 */
export function mergeAndPruneFacts(
  existing: ContactFact[],
  incoming: ContactFact[],
  pruningOptions?: PruningOptions
): {
  facts: ContactFact[];
  contradictions: Contradiction[];
  stats: DeduplicationResult['stats'] & { pruned: number };
} {
  // First deduplicate
  const dedupeResult = deduplicateFacts(existing, incoming);

  // Then prune
  const pruneResult = pruneFacts(dedupeResult.mergedFacts, pruningOptions);

  return {
    facts: pruneResult.kept,
    contradictions: dedupeResult.contradictions,
    stats: {
      ...dedupeResult.stats,
      pruned: pruneResult.pruned.length,
    },
  };
}
