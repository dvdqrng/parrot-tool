/**
 * Attention Model
 * Scores which chats deserve the user's attention.
 * Pure functions — no LLM dependency, no side effects.
 */

import { RelationshipType } from './knowledge/types';

// ============================================
// TYPES
// ============================================

export interface AttentionSignal {
  chatId: string;
  contactName?: string;

  // Message state
  hasUnread: boolean;
  lastMessageFromThem?: {
    text: string;
    timestamp: string;
  };
  lastMessageFromMe?: {
    timestamp: string;
  };

  // Content signals
  hasUnansweredQuestion: boolean;
  hasUrgencyKeywords: boolean;
  urgencyKeywords: string[];

  // Intelligence signals
  relationshipType: RelationshipType;
  pendingActionItems: number;
  activeContextOverlap: boolean; // This chat is part of an active context
}

export interface AttentionScore {
  chatId: string;
  contactName?: string;
  score: number; // 0-100
  reason: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

// ============================================
// CONSTANTS
// ============================================

const URGENCY_KEYWORDS = [
  'urgent', 'asap', 'emergency', 'immediately', 'critical',
  'deadline', 'today', 'tonight', 'right now', 'need this',
  'time sensitive', 'last chance', 'final',
];

const QUESTION_MARKERS = ['?', 'can you', 'could you', 'would you', 'will you', 'are you', 'do you', 'what', 'when', 'where', 'how', 'why'];

const RELATIONSHIP_WEIGHTS: Record<RelationshipType, number> = {
  family: 1.0,
  romantic: 1.0,
  close_friend: 0.8,
  friend: 0.6,
  professional: 0.5,
  acquaintance: 0.3,
  service_provider: 0.2,
  unknown: 0.4,
};

// ============================================
// SIGNAL BUILDER
// ============================================

export function buildAttentionSignal(params: {
  chatId: string;
  contactName?: string;
  messages: Array<{
    text: string;
    isFromMe: boolean;
    timestamp: string;
  }>;
  relationshipType?: RelationshipType;
  pendingActionItems?: number;
  activeContextOverlap?: boolean;
}): AttentionSignal {
  const {
    chatId,
    contactName,
    messages,
    relationshipType = 'unknown',
    pendingActionItems = 0,
    activeContextOverlap = false,
  } = params;

  // Find last message from them and from me
  const lastFromThem = [...messages].reverse().find(m => !m.isFromMe);
  const lastFromMe = [...messages].reverse().find(m => m.isFromMe);

  // Check for unanswered question
  const hasUnansweredQuestion = !!(
    lastFromThem &&
    (!lastFromMe || new Date(lastFromThem.timestamp) > new Date(lastFromMe.timestamp)) &&
    isQuestion(lastFromThem.text)
  );

  // Check for urgency keywords
  const urgencyKeywords: string[] = [];
  if (lastFromThem) {
    const textLower = lastFromThem.text.toLowerCase();
    for (const kw of URGENCY_KEYWORDS) {
      if (textLower.includes(kw)) {
        urgencyKeywords.push(kw);
      }
    }
  }

  return {
    chatId,
    contactName,
    hasUnread: !!lastFromThem && (!lastFromMe || new Date(lastFromThem.timestamp) > new Date(lastFromMe.timestamp)),
    lastMessageFromThem: lastFromThem
      ? { text: lastFromThem.text, timestamp: lastFromThem.timestamp }
      : undefined,
    lastMessageFromMe: lastFromMe
      ? { timestamp: lastFromMe.timestamp }
      : undefined,
    hasUnansweredQuestion,
    hasUrgencyKeywords: urgencyKeywords.length > 0,
    urgencyKeywords,
    relationshipType,
    pendingActionItems,
    activeContextOverlap,
  };
}

// ============================================
// SCORING
// ============================================

export function scoreAttention(signal: AttentionSignal): AttentionScore {
  let score = 0;
  const reasons: string[] = [];

  // 1. Unanswered question (+30)
  if (signal.hasUnansweredQuestion) {
    score += 30;
    reasons.push('unanswered question');
  }

  // 2. Urgency keywords (+20)
  if (signal.hasUrgencyKeywords) {
    score += 20;
    reasons.push(`urgency: ${signal.urgencyKeywords.join(', ')}`);
  }

  // 3. Pending action items (+15, capped)
  if (signal.pendingActionItems > 0) {
    score += Math.min(15, signal.pendingActionItems * 5);
    reasons.push(`${signal.pendingActionItems} pending action(s)`);
  }

  // 4. Relationship weight (+0 to +10)
  const relWeight = RELATIONSHIP_WEIGHTS[signal.relationshipType] || 0.4;
  score += Math.round(relWeight * 10);

  // 5. Time decay — how long since their last message
  if (signal.lastMessageFromThem && signal.hasUnread) {
    const ageMs = Date.now() - new Date(signal.lastMessageFromThem.timestamp).getTime();
    const ageMinutes = ageMs / (1000 * 60);

    if (ageMinutes <= 15) {
      // Very fresh — no time pressure yet
      score += 0;
    } else if (ageMinutes <= 60) {
      score += 5;
      reasons.push('waiting 15-60min');
    } else if (ageMinutes <= 240) {
      score += 15;
      reasons.push('waiting 1-4h');
    } else if (ageMinutes <= 1440) {
      score += 20;
      reasons.push('waiting 4-24h');
    } else {
      score += 25;
      reasons.push('waiting >24h');
    }
  }

  // 6. Active context overlap (+5)
  if (signal.activeContextOverlap) {
    score += 5;
    reasons.push('related to active context');
  }

  // 7. Penalty: ball is in their court (-10)
  if (!signal.hasUnread && signal.lastMessageFromMe) {
    score -= 10;
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine urgency
  let urgency: AttentionScore['urgency'];
  if (score >= 80) urgency = 'critical';
  else if (score >= 60) urgency = 'high';
  else if (score >= 30) urgency = 'medium';
  else urgency = 'low';

  return {
    chatId: signal.chatId,
    contactName: signal.contactName,
    score,
    reason: reasons.length > 0 ? reasons.join('; ') : 'no significant signals',
    urgency,
  };
}

// ============================================
// RANKING
// ============================================

export function rankChats(signals: AttentionSignal[]): AttentionScore[] {
  return signals
    .map(scoreAttention)
    .sort((a, b) => b.score - a.score);
}

// ============================================
// HELPERS
// ============================================

function isQuestion(text: string): boolean {
  const lower = text.toLowerCase().trim();
  for (const marker of QUESTION_MARKERS) {
    if (lower.includes(marker)) return true;
  }
  return false;
}

/**
 * Detect urgency keywords in a text string.
 * Exported for use by background worker.
 */
export function detectUrgency(text: string): string[] {
  const lower = text.toLowerCase();
  return URGENCY_KEYWORDS.filter(kw => lower.includes(kw));
}
