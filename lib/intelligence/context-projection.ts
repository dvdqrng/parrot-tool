/**
 * Context Projection
 * Intelligently selects which global knowledge to inject into a specific chat context.
 * Replaces hardcoded .slice(0, N) with relevance-scored selection.
 *
 * No LLM calls - pure local scoring function.
 */

import { ContactFact } from './knowledge/types';
import {
  UserIntelligence,
  ActiveContext,
  DistributedInfoItem,
} from './user-state/types';

// ============================================
// TYPES
// ============================================

export interface ProjectionInput {
  // The signal: what are we building context FOR?
  recentMessages: Array<{ text: string; isFromMe: boolean }>;
  userIntent?: string;

  // The knowledge pool
  contactFacts: ContactFact[];
  userState: UserIntelligence | null;

  // Chat identity (for filtering user state)
  chatId?: string;

  // Constraints
  maxFacts?: number; // default 8
  maxContexts?: number; // default 3
  maxDistributedInfo?: number; // default 3
}

export interface ProjectedContext {
  relevantFacts: ContactFact[];
  relevantContexts: ActiveContext[];
  relevantDistributedInfo: DistributedInfoItem[];
  scoring: Array<{ factId: string; score: number; reason: string }>;
}

interface FactScore {
  fact: ContactFact;
  score: number;
  reason: string;
}

// ============================================
// STOPWORDS
// ============================================

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'don', 'now', 'and', 'but', 'or', 'nor', 'if', 'that', 'this', 'what',
  'which', 'who', 'whom', 'these', 'those', 'am', 'it', 'its', 'i', 'me',
  'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her',
  'they', 'them', 'their', 'yeah', 'yes', 'no', 'ok', 'okay', 'hey',
  'hi', 'hello', 'thanks', 'thank', 'please', 'sure', 'like', 'get',
  'got', 'go', 'going', 'know', 'think', 'want', 'let', 'make', 'say',
  'said', 'see', 'look', 'come', 'take', 'give', 'tell', 'thing',
]);

// Category-to-keyword mappings for boosting
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  location: ['where', 'place', 'address', 'city', 'country', 'live', 'move', 'travel', 'visit', 'location', 'meet', 'restaurant', 'bar', 'cafe', 'office', 'home'],
  occupation: ['work', 'job', 'company', 'career', 'role', 'position', 'boss', 'colleague', 'project', 'meeting', 'business', 'professional'],
  preference: ['like', 'love', 'hate', 'prefer', 'favorite', 'enjoy', 'food', 'eat', 'drink', 'music', 'movie', 'show', 'book', 'hobby'],
  plan: ['plan', 'planning', 'when', 'date', 'time', 'schedule', 'tomorrow', 'weekend', 'next', 'event', 'party', 'trip', 'vacation'],
  contact_info: ['number', 'phone', 'email', 'address', 'contact', 'reach', 'call', 'text', 'message'],
  personal: ['birthday', 'age', 'family', 'kid', 'child', 'parent', 'pet', 'dog', 'cat', 'health', 'sick'],
  relationship: ['friend', 'partner', 'wife', 'husband', 'boyfriend', 'girlfriend', 'dating', 'married', 'single'],
  interest: ['hobby', 'sport', 'game', 'play', 'watch', 'read', 'listen', 'learn', 'study'],
  event: ['event', 'party', 'wedding', 'birthday', 'concert', 'conference', 'meeting', 'dinner', 'lunch'],
};

// ============================================
// MAIN FUNCTION
// ============================================

export function projectContext(input: ProjectionInput): ProjectedContext {
  const {
    recentMessages,
    userIntent,
    contactFacts,
    userState,
    chatId,
    maxFacts = 8,
    maxContexts = 3,
    maxDistributedInfo = 3,
  } = input;

  // 1. Extract topic signal from recent messages + intent
  const topicSignal = extractTopicSignal(recentMessages, userIntent);

  // 2. Score each fact
  const scoredFacts = contactFacts
    .filter(f => f.isActive)
    .map(fact => scoreFact(fact, topicSignal));

  // 3. Sort by score, take top N
  scoredFacts.sort((a, b) => b.score - a.score);
  const selectedFacts = scoredFacts.slice(0, maxFacts);

  // 4. Filter user contexts by relevance
  const relevantContexts = filterContexts(
    userState?.activeContexts || [],
    chatId,
    topicSignal,
    maxContexts
  );

  // 5. Filter distributed info by relevance
  const relevantDistributedInfo = filterDistributedInfo(
    userState?.distributedInfo || [],
    chatId,
    topicSignal,
    maxDistributedInfo
  );

  return {
    relevantFacts: selectedFacts.map(s => s.fact),
    relevantContexts,
    relevantDistributedInfo,
    scoring: selectedFacts.map(s => ({
      factId: s.fact.id,
      score: s.score,
      reason: s.reason,
    })),
  };
}

// ============================================
// TOPIC SIGNAL EXTRACTION
// ============================================

function extractTopicSignal(
  messages: Array<{ text: string; isFromMe: boolean }>,
  intent?: string
): Set<string> {
  const keywords = new Set<string>();

  // Use last 3 messages for topic signal
  const recent = messages.slice(-3);

  for (const msg of recent) {
    const words = msg.text.toLowerCase().split(/\s+/);
    for (const word of words) {
      const cleaned = word.replace(/[^a-z]/g, '');
      if (cleaned.length > 2 && !STOPWORDS.has(cleaned)) {
        keywords.add(cleaned);
      }
    }
  }

  // Add intent keywords if provided
  if (intent) {
    const intentWords = intent.toLowerCase().split(/\s+/);
    for (const word of intentWords) {
      const cleaned = word.replace(/[^a-z]/g, '');
      if (cleaned.length > 2 && !STOPWORDS.has(cleaned)) {
        keywords.add(cleaned);
      }
    }
  }

  return keywords;
}

// ============================================
// FACT SCORING
// ============================================

function scoreFact(fact: ContactFact, topicSignal: Set<string>): FactScore {
  let score = 0;
  const reasons: string[] = [];

  // 1. Keyword overlap (weight 0.4, max 40 points)
  const factWords = fact.content.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z]/g, ''));
  let overlap = 0;
  for (const word of factWords) {
    if (topicSignal.has(word)) overlap++;
  }
  const keywordScore = topicSignal.size > 0
    ? Math.min(40, (overlap / Math.max(1, topicSignal.size)) * 40)
    : 0;
  score += keywordScore;
  if (keywordScore > 0) reasons.push(`keyword overlap: ${overlap} matches`);

  // 2. Category relevance (weight 0.2, max 20 points)
  const categoryKeywords = CATEGORY_KEYWORDS[fact.category] || [];
  let categoryOverlap = 0;
  for (const kw of categoryKeywords) {
    if (topicSignal.has(kw)) categoryOverlap++;
  }
  const categoryScore = Math.min(20, categoryOverlap * 7);
  score += categoryScore;
  if (categoryScore > 0) reasons.push(`category ${fact.category} relevant`);

  // 3. Recency (weight 0.2, max 20 points)
  const ageMs = Date.now() - new Date(fact.lastConfirmed || fact.firstSeen).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const recencyScore = Math.max(0, 20 - ageDays * 0.5); // Loses 0.5 points per day
  score += recencyScore;
  if (recencyScore > 15) reasons.push('very recent');

  // 4. Confidence (weight 0.2, max 20 points)
  score += fact.confidence * 20;

  // 5. User-verified bonus (+15 points)
  if ((fact as ContactFact & { userVerified?: boolean }).userVerified) {
    score += 15;
    reasons.push('user verified');
  }

  // Base relevance: if no topic signal, give a small baseline to high-confidence facts
  if (topicSignal.size === 0) {
    score = fact.confidence * 50 + recencyScore;
    reasons.push('no topic signal, using confidence + recency');
  }

  return {
    fact,
    score: Math.round(score * 100) / 100,
    reason: reasons.length > 0 ? reasons.join('; ') : 'baseline score',
  };
}

// ============================================
// USER CONTEXT FILTERING
// ============================================

function filterContexts(
  contexts: ActiveContext[],
  chatId: string | undefined,
  topicSignal: Set<string>,
  maxCount: number
): ActiveContext[] {
  if (contexts.length === 0) return [];

  const scored = contexts
    .filter(ctx => ctx.status === 'active' || ctx.status === 'winding_down')
    .map(ctx => {
      let score = 0;

      // Boost if this chat is in relatedContacts
      if (chatId && ctx.relatedContacts.includes(chatId)) {
        score += 50;
      }

      // Keyword overlap with context label
      const labelWords = ctx.label.toLowerCase().split(/\s+/);
      for (const word of labelWords) {
        if (topicSignal.has(word.replace(/[^a-z]/g, ''))) {
          score += 20;
        }
      }

      // Recency
      const ageMs = Date.now() - new Date(ctx.lastUpdated).getTime();
      const ageHours = ageMs / (1000 * 60 * 60);
      score += Math.max(0, 20 - ageHours * 0.5);

      // Confidence
      score += ctx.confidence * 10;

      return { ctx, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, maxCount).map(s => s.ctx);
}

// ============================================
// DISTRIBUTED INFO FILTERING
// ============================================

function filterDistributedInfo(
  items: DistributedInfoItem[],
  chatId: string | undefined,
  topicSignal: Set<string>,
  maxCount: number
): DistributedInfoItem[] {
  if (items.length === 0) return [];

  const scored = items.map(item => {
    let score = 0;

    // Boost if this contact HASN'T received this info yet
    if (chatId && !item.sharedWith.includes(chatId) && item.sharedWith.length > 0) {
      score += 40; // High value — this is info others know but this contact doesn't
    }

    // Keyword overlap
    const contentWords = item.content.toLowerCase().split(/\s+/);
    for (const word of contentWords) {
      if (topicSignal.has(word.replace(/[^a-z]/g, ''))) {
        score += 15;
      }
    }

    // Recency
    const ageMs = Date.now() - new Date(item.lastShared).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    score += Math.max(0, 20 - ageHours * 0.5);

    return { item, score };
  })
  .filter(s => s.score > 5) // Only include if minimally relevant
  .sort((a, b) => b.score - a.score);

  return scored.slice(0, maxCount).map(s => s.item);
}
