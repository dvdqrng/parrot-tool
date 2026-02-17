/**
 * Tier 1 Local Extraction
 * Free, instant extraction using regex and heuristics
 * Runs on every message with zero latency
 */

import { BeeperMessage } from '@/lib/types';

// ============================================
// RESULT TYPES
// ============================================

export interface DateMention {
  raw: string;
  parsed?: Date;
  context: string;
}

export interface AttachmentInfo {
  type: 'url' | 'file' | 'image' | 'location' | 'video' | 'audio';
  content: string;
  context?: string;
}

export interface StyleSignals {
  wordCount: number;
  charCount: number;
  hasEmoji: boolean;
  emojiCount: number;
  capitalization: 'proper' | 'all_lower' | 'all_caps' | 'mixed';
  punctuationStyle: 'full' | 'minimal' | 'none';
  lineBreaks: number;
  isVoiceNote: boolean;
  avgWordLength: number;
  questionCount: number;
  exclamationCount: number;
}

export interface Tier1ExtractionResult {
  // Contact info detected
  emails: string[];
  phones: string[];
  urls: string[];
  socialHandles: string[];

  // Temporal mentions
  dates: DateMention[];

  // Artifacts
  attachments: AttachmentInfo[];

  // Style signals
  styleSignals: StyleSignals;

  // Platform detection
  platform: string;

  // Extracted entities
  mentions: string[]; // @mentions
  hashtags: string[];

  // Message metadata
  messageId: string;
  chatId: string;
  isFromMe: boolean;
  timestamp: string;
}

// ============================================
// REGEX PATTERNS
// ============================================

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX =
  /(\+?1?\s*[-.(]?\d{3}[-.)]\s*\d{3}[-.]?\d{4})|(\+\d{1,3}\s?\d{6,14})/g;
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
const SOCIAL_REGEX = /@[a-zA-Z0-9_]{1,30}/g;
const HASHTAG_REGEX = /#[a-zA-Z0-9_]+/g;

const DATE_PATTERNS = [
  // Month day, year
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(st|nd|rd|th)?,?\s*\d{0,4}/gi,
  // Numeric dates
  /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g,
  /\b\d{1,2}-\d{1,2}(-\d{2,4})?\b/g,
  // Day names
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
  // Relative dates
  /\b(today|tomorrow|yesterday|next week|this week|next month|this month)\b/gi,
  // Time mentions
  /\b(at\s+)?\d{1,2}(:\d{2})?\s*(am|pm|AM|PM)?\b/g,
];

// ============================================
// EXTRACTION FUNCTIONS
// ============================================

export function extractTier1(message: BeeperMessage): Tier1ExtractionResult {
  const text = message.text || '';

  return {
    emails: extractEmails(text),
    phones: extractPhones(text),
    urls: extractUrls(text),
    socialHandles: extractSocialHandles(text),
    dates: extractDates(text),
    attachments: extractAttachments(message),
    styleSignals: analyzeStyle(text, message),
    platform: message.platform || 'unknown',
    mentions: extractMentions(text),
    hashtags: extractHashtags(text),
    messageId: message.id,
    chatId: message.chatId,
    isFromMe: message.isFromMe,
    timestamp: message.timestamp,
  };
}

function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) || [];
  return [...new Set(matches)];
}

function extractPhones(text: string): string[] {
  const matches = text.match(PHONE_REGEX) || [];
  return [...new Set(matches.map(p => p.trim()))];
}

function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX) || [];
  return [...new Set(matches)];
}

function extractSocialHandles(text: string): string[] {
  const matches = text.match(SOCIAL_REGEX) || [];
  return [...new Set(matches)];
}

function extractMentions(text: string): string[] {
  const matches = text.match(SOCIAL_REGEX) || [];
  return [...new Set(matches)];
}

function extractHashtags(text: string): string[] {
  const matches = text.match(HASHTAG_REGEX) || [];
  return [...new Set(matches)];
}

function extractDates(text: string): DateMention[] {
  const dates: DateMention[] = [];
  const seen = new Set<string>();

  for (const pattern of DATE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const raw = match[0];
      if (seen.has(raw.toLowerCase())) continue;
      seen.add(raw.toLowerCase());

      dates.push({
        raw,
        context: getContext(text, match.index, 40),
        parsed: tryParseDate(raw),
      });
    }
  }

  return dates;
}

function tryParseDate(text: string): Date | undefined {
  try {
    const now = new Date();
    const lower = text.toLowerCase();

    // Handle relative dates
    if (lower === 'today') return now;
    if (lower === 'tomorrow') {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      return d;
    }
    if (lower === 'yesterday') {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      return d;
    }

    // Try standard parsing
    const parsed = new Date(text);
    if (!isNaN(parsed.getTime())) return parsed;

    return undefined;
  } catch {
    return undefined;
  }
}

function extractAttachments(message: BeeperMessage): AttachmentInfo[] {
  const attachments: AttachmentInfo[] = [];

  // URLs from text
  const urls = extractUrls(message.text || '');
  for (const url of urls) {
    attachments.push({ type: 'url', content: url });
  }

  // Message attachments
  if (message.attachments) {
    for (const att of message.attachments) {
      let type: AttachmentInfo['type'] = 'file';

      if (att.type === 'img' || att.isGif || att.isSticker) {
        type = 'image';
      } else if (att.type === 'video') {
        type = 'video';
      } else if (att.type === 'audio' || att.isVoiceNote) {
        type = 'audio';
      }

      attachments.push({
        type,
        content: att.srcURL || att.fileName || '',
        context: att.fileName,
      });
    }
  }

  return attachments;
}

function analyzeStyle(text: string, message: BeeperMessage): StyleSignals {
  const words = text.split(/\s+/).filter(Boolean);
  const emojiMatches = text.match(/\p{Emoji}/gu) || [];

  // Capitalization analysis
  const letters = text.replace(/[^a-zA-Z]/g, '');
  const upperCount = (letters.match(/[A-Z]/g) || []).length;
  const lowerCount = (letters.match(/[a-z]/g) || []).length;

  let capitalization: StyleSignals['capitalization'] = 'mixed';
  if (letters.length > 0) {
    if (upperCount === 0 && lowerCount > 0) {
      capitalization = 'all_lower';
    } else if (lowerCount === 0 && upperCount > 0) {
      capitalization = 'all_caps';
    } else if (upperCount / letters.length < 0.15) {
      capitalization = 'all_lower';
    } else {
      // Check if proper case (first letter of sentences capitalized)
      const sentences = text.split(/[.!?]+/).filter(Boolean);
      const properCased = sentences.filter(s => /^\s*[A-Z]/.test(s));
      if (properCased.length >= sentences.length * 0.7) {
        capitalization = 'proper';
      }
    }
  }

  // Punctuation
  const hasPeriods = /[.!?]$/.test(text.trim());
  const hasCommas = /,/.test(text);
  let punctuationStyle: StyleSignals['punctuationStyle'] = 'none';
  if (hasPeriods && hasCommas) {
    punctuationStyle = 'full';
  } else if (hasPeriods || hasCommas) {
    punctuationStyle = 'minimal';
  }

  // Questions and exclamations
  const questionCount = (text.match(/\?/g) || []).length;
  const exclamationCount = (text.match(/!/g) || []).length;

  // Average word length
  const avgWordLength =
    words.length > 0
      ? words.reduce((sum, w) => sum + w.length, 0) / words.length
      : 0;

  return {
    wordCount: words.length,
    charCount: text.length,
    hasEmoji: emojiMatches.length > 0,
    emojiCount: emojiMatches.length,
    capitalization,
    punctuationStyle,
    lineBreaks: (text.match(/\n/g) || []).length,
    isVoiceNote: message.attachments?.some(a => a.isVoiceNote) || false,
    avgWordLength,
    questionCount,
    exclamationCount,
  };
}

function getContext(text: string, index: number, chars: number): string {
  const start = Math.max(0, index - chars);
  const end = Math.min(text.length, index + chars);
  let context = text.slice(start, end);

  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';

  return context.trim();
}

// ============================================
// BATCH EXTRACTION
// ============================================

export function extractTier1Batch(
  messages: BeeperMessage[]
): Tier1ExtractionResult[] {
  return messages.map(extractTier1);
}

// ============================================
// AGGREGATION HELPERS
// ============================================

export function aggregateStyleSignals(
  results: Tier1ExtractionResult[]
): Partial<StyleSignals> | null {
  if (results.length === 0) return null;

  const styles = results.map(r => r.styleSignals);

  // Average numeric values
  const avgWordCount = average(styles.map(s => s.wordCount));
  const avgCharCount = average(styles.map(s => s.charCount));
  const avgEmojiCount = average(styles.map(s => s.emojiCount));
  const avgWordLen = average(styles.map(s => s.avgWordLength));

  // Mode for categorical values
  const capitalization = mode(styles.map(s => s.capitalization));
  const punctuationStyle = mode(styles.map(s => s.punctuationStyle));

  return {
    wordCount: Math.round(avgWordCount),
    charCount: Math.round(avgCharCount),
    emojiCount: Math.round(avgEmojiCount),
    hasEmoji: avgEmojiCount > 0,
    capitalization: capitalization as StyleSignals['capitalization'],
    punctuationStyle: punctuationStyle as StyleSignals['punctuationStyle'],
    avgWordLength: avgWordLen,
    lineBreaks: 0,
    isVoiceNote: false,
    questionCount: 0,
    exclamationCount: 0,
  };
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function mode<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;

  const counts = new Map<T, number>();
  for (const item of arr) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }

  let maxCount = 0;
  let maxItem: T | undefined;
  for (const [item, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxItem = item;
    }
  }

  return maxItem;
}
