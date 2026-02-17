/**
 * Relationship Classifier
 * Classifies the relationship type between the user and a contact
 * based on conversation patterns, message frequency, and content analysis.
 */

import { BeeperMessage } from '@/lib/types';
import {
  RelationshipType,
  RelationshipClassification,
  RelationshipEvent,
} from '../knowledge/types';
import { Tier1ExtractionResult } from './tier1-local';

// ============================================
// CLASSIFICATION SIGNALS
// ============================================

interface ClassificationSignals {
  // Communication patterns
  messageFrequency: 'high' | 'medium' | 'low';
  responseTime: 'fast' | 'moderate' | 'slow';
  initiationBalance: 'user_initiates' | 'balanced' | 'contact_initiates';

  // Content patterns
  formality: 'formal' | 'casual' | 'very_casual';
  emojiUsage: 'heavy' | 'moderate' | 'light' | 'none';
  topicDiversity: 'narrow' | 'moderate' | 'diverse';

  // Relationship indicators
  termsOfEndearment: boolean;
  familyTerms: boolean;
  professionalTerms: boolean;
  romanticIndicators: boolean;

  // Platform context
  platform: string;

  // Confidence in signals
  sampleSize: number;
}

// ============================================
// SIGNAL EXTRACTION
// ============================================

/**
 * Extract classification signals from messages
 */
export function extractClassificationSignals(
  messages: BeeperMessage[],
  tier1Results: Tier1ExtractionResult[]
): ClassificationSignals {
  const myMessages = messages.filter(m => m.isFromMe);
  const theirMessages = messages.filter(m => !m.isFromMe);
  const allText = messages.map(m => m.text || '').join(' ').toLowerCase();

  // Message frequency (messages per day)
  const frequency = calculateMessageFrequency(messages);

  // Response time analysis
  const responseTime = analyzeResponseTime(messages);

  // Who initiates conversations
  const initiationBalance = analyzeInitiationBalance(messages);

  // Formality from tier1 results
  const formality = analyzeFormality(tier1Results.filter((_, i) => messages[i].isFromMe));

  // Emoji usage
  const emojiUsage = analyzeEmojiUsage(tier1Results);

  // Topic diversity
  const topicDiversity = analyzeTopicDiversity(messages);

  // Relationship indicators
  const termsOfEndearment = detectTermsOfEndearment(allText);
  const familyTerms = detectFamilyTerms(allText);
  const professionalTerms = detectProfessionalTerms(allText);
  const romanticIndicators = detectRomanticIndicators(allText);

  // Platform
  const platform = messages[0]?.platform || 'unknown';

  return {
    messageFrequency: frequency,
    responseTime,
    initiationBalance,
    formality,
    emojiUsage,
    topicDiversity,
    termsOfEndearment,
    familyTerms,
    professionalTerms,
    romanticIndicators,
    platform,
    sampleSize: messages.length,
  };
}

function calculateMessageFrequency(
  messages: BeeperMessage[]
): 'high' | 'medium' | 'low' {
  if (messages.length < 2) return 'low';

  const timestamps = messages.map(m => new Date(m.timestamp).getTime());
  const firstMsg = Math.min(...timestamps);
  const lastMsg = Math.max(...timestamps);
  const durationDays = (lastMsg - firstMsg) / (24 * 60 * 60 * 1000);

  if (durationDays < 1) return 'high'; // Many messages in one day

  const messagesPerDay = messages.length / Math.max(1, durationDays);

  if (messagesPerDay > 10) return 'high';
  if (messagesPerDay > 2) return 'medium';
  return 'low';
}

function analyzeResponseTime(
  messages: BeeperMessage[]
): 'fast' | 'moderate' | 'slow' {
  const responseTimes: number[] = [];

  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1];
    const curr = messages[i];

    // Only measure if it's a reply (different sender)
    if (prev.isFromMe !== curr.isFromMe) {
      const prevTime = new Date(prev.timestamp).getTime();
      const currTime = new Date(curr.timestamp).getTime();
      const diff = currTime - prevTime;

      if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
        // Within 24 hours
        responseTimes.push(diff);
      }
    }
  }

  if (responseTimes.length === 0) return 'moderate';

  const avgResponseMinutes =
    responseTimes.reduce((a, b) => a + b, 0) /
    responseTimes.length /
    (60 * 1000);

  if (avgResponseMinutes < 5) return 'fast';
  if (avgResponseMinutes < 60) return 'moderate';
  return 'slow';
}

function analyzeInitiationBalance(
  messages: BeeperMessage[]
): 'user_initiates' | 'balanced' | 'contact_initiates' {
  // Find conversation starts (gaps > 4 hours)
  const conversations: { startedByMe: boolean }[] = [];
  let lastMsgTime = 0;

  for (const msg of messages) {
    const msgTime = new Date(msg.timestamp).getTime();
    const gap = msgTime - lastMsgTime;

    if (gap > 4 * 60 * 60 * 1000 || lastMsgTime === 0) {
      // New conversation
      conversations.push({ startedByMe: msg.isFromMe });
    }

    lastMsgTime = msgTime;
  }

  if (conversations.length < 2) return 'balanced';

  const myInitiations = conversations.filter(c => c.startedByMe).length;
  const ratio = myInitiations / conversations.length;

  if (ratio > 0.65) return 'user_initiates';
  if (ratio < 0.35) return 'contact_initiates';
  return 'balanced';
}

function analyzeFormality(
  myResults: Tier1ExtractionResult[]
): 'formal' | 'casual' | 'very_casual' {
  if (myResults.length === 0) return 'casual';

  let formalCount = 0;
  let casualCount = 0;
  let veryCasualCount = 0;

  for (const result of myResults) {
    const style = result.styleSignals;

    if (style.capitalization === 'proper' && style.punctuationStyle === 'full') {
      formalCount++;
    } else if (
      style.capitalization === 'all_lower' &&
      style.punctuationStyle === 'none'
    ) {
      veryCasualCount++;
    } else {
      casualCount++;
    }
  }

  const total = myResults.length;
  if (formalCount / total > 0.5) return 'formal';
  if (veryCasualCount / total > 0.5) return 'very_casual';
  return 'casual';
}

function analyzeEmojiUsage(
  results: Tier1ExtractionResult[]
): 'heavy' | 'moderate' | 'light' | 'none' {
  if (results.length === 0) return 'light';

  const avgEmoji =
    results.reduce((sum, r) => sum + r.styleSignals.emojiCount, 0) /
    results.length;

  if (avgEmoji > 2) return 'heavy';
  if (avgEmoji > 0.5) return 'moderate';
  if (avgEmoji > 0) return 'light';
  return 'none';
}

function analyzeTopicDiversity(
  messages: BeeperMessage[]
): 'narrow' | 'moderate' | 'diverse' {
  // Simple: count unique words used
  const allWords = new Set<string>();
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'i', 'me', 'my', 'you', 'your', 'he', 'she', 'it', 'we', 'they',
    'and', 'but', 'or', 'so', 'if', 'then', 'that', 'this',
  ]);

  for (const msg of messages) {
    const words = (msg.text || '').toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length > 3 && !stopWords.has(word)) {
        allWords.add(word);
      }
    }
  }

  const diversityRatio = allWords.size / Math.max(1, messages.length);

  if (diversityRatio > 5) return 'diverse';
  if (diversityRatio > 2) return 'moderate';
  return 'narrow';
}

// ============================================
// INDICATOR DETECTION
// ============================================

function detectTermsOfEndearment(text: string): boolean {
  const patterns = [
    /\b(babe|baby|honey|sweetie|sweetheart|dear|darling|love)\b/i,
    /\b(hun|bby|bb)\b/i,
    /❤️|💕|💗|💓|💖|💘|💝|😘|😍|🥰/,
  ];

  return patterns.some(p => p.test(text));
}

function detectFamilyTerms(text: string): boolean {
  const patterns = [
    /\b(mom|dad|mother|father|mum|papa|mama)\b/i,
    /\b(brother|sister|bro|sis)\b/i,
    /\b(grandma|grandpa|grandmother|grandfather|granny|gramps)\b/i,
    /\b(aunt|uncle|cousin|nephew|niece)\b/i,
    /\b(son|daughter|kid|kids|children)\b/i,
  ];

  return patterns.some(p => p.test(text));
}

function detectProfessionalTerms(text: string): boolean {
  const patterns = [
    /\b(meeting|deadline|project|client|boss|colleague|coworker)\b/i,
    /\b(invoice|contract|proposal|budget|quarterly)\b/i,
    /\b(office|workplace|team|department|manager)\b/i,
    /\b(regards|sincerely|best wishes|thank you for your time)\b/i,
    /\b(per our conversation|following up|as discussed)\b/i,
  ];

  return patterns.some(p => p.test(text));
}

function detectRomanticIndicators(text: string): boolean {
  const patterns = [
    /\b(date|dating|boyfriend|girlfriend|partner)\b/i,
    /\b(love you|miss you|can't wait to see you)\b/i,
    /\b(anniversary|valentine|romantic)\b/i,
    /\b(kiss|hug|cuddle)\b/i,
  ];

  return patterns.some(p => p.test(text));
}

// ============================================
// CLASSIFICATION LOGIC
// ============================================

interface ClassificationScore {
  type: RelationshipType;
  score: number;
  reasons: string[];
}

/**
 * Score each relationship type based on signals
 */
function scoreRelationshipTypes(
  signals: ClassificationSignals
): ClassificationScore[] {
  const scores: ClassificationScore[] = [
    { type: 'close_friend', score: 0, reasons: [] },
    { type: 'friend', score: 0, reasons: [] },
    { type: 'acquaintance', score: 0, reasons: [] },
    { type: 'professional', score: 0, reasons: [] },
    { type: 'family', score: 0, reasons: [] },
    { type: 'romantic', score: 0, reasons: [] },
    { type: 'service_provider', score: 0, reasons: [] },
    { type: 'unknown', score: 0.1, reasons: ['baseline'] },
  ];

  const getScore = (type: RelationshipType) =>
    scores.find(s => s.type === type)!;

  // Family signals
  if (signals.familyTerms) {
    getScore('family').score += 0.5;
    getScore('family').reasons.push('family terms detected');
  }

  // Romantic signals
  if (signals.romanticIndicators || signals.termsOfEndearment) {
    getScore('romantic').score += 0.4;
    getScore('romantic').reasons.push('romantic indicators');
  }
  if (signals.termsOfEndearment && !signals.familyTerms) {
    getScore('romantic').score += 0.2;
  }

  // Professional signals
  if (signals.professionalTerms) {
    getScore('professional').score += 0.4;
    getScore('professional').reasons.push('professional terms');
  }
  if (signals.formality === 'formal') {
    getScore('professional').score += 0.2;
    getScore('professional').reasons.push('formal communication');
  }
  if (signals.platform === 'linkedin') {
    getScore('professional').score += 0.3;
    getScore('professional').reasons.push('LinkedIn platform');
  }

  // Friend signals
  if (signals.messageFrequency === 'high' && !signals.professionalTerms) {
    getScore('close_friend').score += 0.3;
    getScore('friend').score += 0.2;
    getScore('close_friend').reasons.push('high message frequency');
  }
  if (signals.formality === 'very_casual') {
    getScore('close_friend').score += 0.2;
    getScore('friend').score += 0.1;
    getScore('close_friend').reasons.push('very casual communication');
  }
  if (signals.emojiUsage === 'heavy') {
    getScore('close_friend').score += 0.15;
    getScore('friend').score += 0.1;
  }
  if (signals.responseTime === 'fast') {
    getScore('close_friend').score += 0.1;
    getScore('friend').score += 0.05;
  }
  if (signals.initiationBalance === 'balanced') {
    getScore('close_friend').score += 0.1;
    getScore('friend').score += 0.1;
  }
  if (signals.topicDiversity === 'diverse') {
    getScore('close_friend').score += 0.15;
    getScore('friend').score += 0.1;
    getScore('close_friend').reasons.push('diverse topics');
  }

  // Acquaintance signals
  if (signals.messageFrequency === 'low') {
    getScore('acquaintance').score += 0.3;
    getScore('acquaintance').reasons.push('low message frequency');
  }
  if (signals.topicDiversity === 'narrow') {
    getScore('acquaintance').score += 0.2;
    getScore('service_provider').score += 0.1;
  }
  if (signals.responseTime === 'slow') {
    getScore('acquaintance').score += 0.1;
  }

  // Service provider signals
  if (
    signals.initiationBalance === 'user_initiates' &&
    signals.professionalTerms &&
    signals.topicDiversity === 'narrow'
  ) {
    getScore('service_provider').score += 0.3;
    getScore('service_provider').reasons.push('one-sided professional interaction');
  }

  // Normalize scores
  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
  for (const score of scores) {
    score.score = totalScore > 0 ? score.score / totalScore : 0;
  }

  return scores.sort((a, b) => b.score - a.score);
}

// ============================================
// MAIN CLASSIFICATION FUNCTION
// ============================================

/**
 * Classify the relationship with a contact
 */
export function classifyRelationship(
  messages: BeeperMessage[],
  tier1Results: Tier1ExtractionResult[],
  existingClassification?: RelationshipClassification
): RelationshipClassification {
  const now = new Date().toISOString();

  if (messages.length < 3) {
    // Not enough data
    return existingClassification || {
      type: 'unknown',
      confidence: 0,
      evolution: [],
      lastUpdated: now,
    };
  }

  const signals = extractClassificationSignals(messages, tier1Results);
  const scores = scoreRelationshipTypes(signals);

  const topScore = scores[0];
  const secondScore = scores[1];

  // Calculate confidence based on score gap and sample size
  let confidence = topScore.score;

  // Higher confidence if clear winner
  if (topScore.score - secondScore.score > 0.2) {
    confidence = Math.min(0.95, confidence + 0.1);
  }

  // Lower confidence for small sample
  if (signals.sampleSize < 10) {
    confidence *= 0.7;
  } else if (signals.sampleSize < 20) {
    confidence *= 0.85;
  }

  // Build evolution history
  const evolution: RelationshipEvent[] = existingClassification?.evolution || [];

  // Add event if type changed
  if (existingClassification && existingClassification.type !== topScore.type) {
    // Only change if new classification is significantly more confident
    if (confidence > existingClassification.confidence + 0.1) {
      evolution.push({
        type: 'detected',
        from: existingClassification.type,
        to: topScore.type,
        confidence,
        timestamp: now,
        reason: topScore.reasons.join(', '),
      });
    } else {
      // Keep existing classification
      return {
        ...existingClassification,
        lastUpdated: now,
      };
    }
  }

  return {
    type: topScore.type,
    confidence: Math.min(0.95, Math.max(0, confidence)),
    evolution,
    lastUpdated: now,
  };
}

// ============================================
// BATCH CLASSIFICATION
// ============================================

/**
 * Classify multiple contacts in batch
 */
export function classifyRelationshipsBatch(
  contactMessages: Map<string, BeeperMessage[]>,
  tier1ResultsByContact: Map<string, Tier1ExtractionResult[]>,
  existingClassifications: Map<string, RelationshipClassification>
): Map<string, RelationshipClassification> {
  const results = new Map<string, RelationshipClassification>();

  for (const [contactId, messages] of contactMessages) {
    const tier1Results = tier1ResultsByContact.get(contactId) || [];
    const existing = existingClassifications.get(contactId);

    results.set(
      contactId,
      classifyRelationship(messages, tier1Results, existing)
    );
  }

  return results;
}
