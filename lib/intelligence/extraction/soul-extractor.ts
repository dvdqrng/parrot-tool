/**
 * Soul Extractor
 * Samples user's sent messages across all chats and extracts identity traits
 * via LLM. Traits are merged into the UserSoul for prompt injection.
 */

import { BeeperMessage } from '@/lib/types';
import { SoulTrait, SoulTraitCategory } from '../user-state/soul';

// ============================================
// TYPES
// ============================================

export interface SoulExtractionRequest {
  mode: 'soul';
  sentMessages: Array<{
    text: string;
    chatId: string;
    timestamp: string;
    recipientName?: string;
  }>;
  existingTraits: SoulTrait[];
}

// ============================================
// MESSAGE SAMPLING
// ============================================

const LOG_PREFIX = '[SoulExtractor]';

/**
 * Sample sent messages for soul extraction.
 * Diversifies across chats, filters noise, prefers recent messages.
 */
export function sampleMessagesForSoulExtraction(
  allMessages: BeeperMessage[],
  maxMessages: number = 200
): BeeperMessage[] {
  // 1. Filter to sent messages only
  const sent = allMessages.filter(m => m.isFromMe && m.text);

  // 2. Filter out very short messages (noise: "ok", "thanks", "lol", etc.)
  const substantive = sent.filter(m => (m.text || '').trim().length >= 15);

  if (substantive.length === 0) {
    console.log(`${LOG_PREFIX} sampleMessages: No substantive sent messages found`);
    return [];
  }

  // 3. Group by chatId
  const byChatId = new Map<string, BeeperMessage[]>();
  for (const msg of substantive) {
    const list = byChatId.get(msg.chatId) || [];
    list.push(msg);
    byChatId.set(msg.chatId, list);
  }

  // 4. Sort each chat's messages by recency (newest first)
  for (const [, msgs] of byChatId) {
    msgs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // 5. Sample proportionally across chats with recency bias
  //    70% from last 30 days, 30% from older messages
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const recentPool: BeeperMessage[] = [];
  const olderPool: BeeperMessage[] = [];

  for (const [, msgs] of byChatId) {
    for (const msg of msgs) {
      if (new Date(msg.timestamp).getTime() > thirtyDaysAgo) {
        recentPool.push(msg);
      } else {
        olderPool.push(msg);
      }
    }
  }

  const recentBudget = Math.min(Math.ceil(maxMessages * 0.7), recentPool.length);
  const olderBudget = Math.min(maxMessages - recentBudget, olderPool.length);

  // Sample from each pool, diversifying across chats
  const sampled: BeeperMessage[] = [
    ...diverseSample(recentPool, recentBudget, byChatId.size),
    ...diverseSample(olderPool, olderBudget, byChatId.size),
  ];

  console.log(`${LOG_PREFIX} sampleMessages: ${substantive.length} substantive → ${sampled.length} sampled (${byChatId.size} chats, ${recentPool.length} recent, ${olderPool.length} older)`);

  return sampled;
}

/**
 * Sample messages diversified across chats (round-robin by chatId).
 */
function diverseSample(
  pool: BeeperMessage[],
  budget: number,
  _totalChats: number
): BeeperMessage[] {
  if (pool.length <= budget) return [...pool];

  // Group pool by chatId
  const byChatId = new Map<string, BeeperMessage[]>();
  for (const msg of pool) {
    const list = byChatId.get(msg.chatId) || [];
    list.push(msg);
    byChatId.set(msg.chatId, list);
  }

  const result: BeeperMessage[] = [];
  const chatIds = Array.from(byChatId.keys());
  const perChat = Math.max(1, Math.floor(budget / chatIds.length));

  // Take up to perChat from each chat
  for (const chatId of chatIds) {
    const msgs = byChatId.get(chatId)!;
    result.push(...msgs.slice(0, perChat));
  }

  // If under budget, fill from remaining
  if (result.length < budget) {
    const used = new Set(result.map(m => m.id));
    for (const msg of pool) {
      if (result.length >= budget) break;
      if (!used.has(msg.id)) {
        result.push(msg);
        used.add(msg.id);
      }
    }
  }

  return result.slice(0, budget);
}

// ============================================
// PROMPT BUILDING
// ============================================

/**
 * Build the LLM prompt for soul extraction.
 * Groups messages by anonymized conversation, shows existing traits.
 */
export function buildSoulExtractionPrompt(request: SoulExtractionRequest): string {
  const { sentMessages, existingTraits } = request;

  // Group messages by chatId and anonymize
  const byChatId = new Map<string, typeof sentMessages>();
  for (const msg of sentMessages) {
    const list = byChatId.get(msg.chatId) || [];
    list.push(msg);
    byChatId.set(msg.chatId, list);
  }

  // Build anonymized conversation blocks
  const chatBlocks: string[] = [];
  let chatIndex = 0;
  for (const [, msgs] of byChatId) {
    chatIndex++;
    const personLabel = `Person ${String.fromCharCode(64 + Math.min(chatIndex, 26))}`;
    const sorted = [...msgs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const lines = sorted.map(m => {
      const time = new Date(m.timestamp).toLocaleDateString();
      return `[${time}] Me → ${personLabel}: ${m.text}`;
    });
    chatBlocks.push(`--- Conversation with ${personLabel} ---\n${lines.join('\n')}`);
  }

  // Format existing traits
  const existingTraitsContext = existingTraits.length > 0
    ? `\n\nALREADY KNOWN TRAITS (DO NOT re-extract these — only extract NEW observations):\n${existingTraits.filter(t => t.isActive).map(t => `- [${t.category}] ${t.content}`).join('\n')}`
    : '';

  return `Analyze my sent messages across multiple conversations to understand who I am as a person.

MY SENT MESSAGES:
${chatBlocks.join('\n\n')}
${existingTraitsContext}

Based on my writing across these conversations, extract identity traits about me. Look for patterns in:
- **personality**: Am I introverted/extroverted? Analytical? Empathetic? Humorous?
- **communication_style**: Do I use lowercase? Short messages? Long paragraphs? Emojis? Formal/casual?
- **value**: What do I seem to care about? Family? Work? Health? Learning?
- **background**: Occupation, education, location, life stage clues
- **habit**: Recurring behaviors (e.g., "replies late at night", "sends voice notes")
- **preference**: Food, music, activities, technology preferences
- **identity**: Age range, languages, cultural markers

Return JSON in this format:
{
  "traits": [
    {
      "category": "personality|communication_style|value|background|habit|preference|identity",
      "content": "Clear description of the trait",
      "confidence": 0.0-1.0,
      "evidence": ["Short quote from messages that supports this trait", "Another quote"]
    }
  ]
}

Rules:
1. CRITICAL: Do NOT re-extract traits already listed in ALREADY KNOWN TRAITS
2. Only extract traits clearly supported by the messages — no speculation
3. Keep evidence quotes short (under 60 chars) and representative
4. Be specific: "Uses lowercase in casual conversations" not just "casual writer"
5. Aim for 5-15 traits total, covering diverse categories
6. Confidence should reflect how consistent the pattern is across messages

Respond ONLY with valid JSON.`;
}

// ============================================
// RESPONSE PARSING
// ============================================

const VALID_SOUL_CATEGORIES: SoulTraitCategory[] = [
  'personality',
  'communication_style',
  'value',
  'background',
  'habit',
  'preference',
  'identity',
];

function validateSoulCategory(category: string): SoulTraitCategory {
  if (VALID_SOUL_CATEGORIES.includes(category as SoulTraitCategory)) {
    return category as SoulTraitCategory;
  }
  return 'personality';
}

/**
 * Parse the LLM response into SoulTrait objects.
 * Skips traits that duplicate userVerified existing traits.
 */
export function parseSoulExtractionResponse(
  responseText: string,
  existingTraits: SoulTrait[]
): SoulTrait[] {
  const now = new Date().toISOString();

  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonText = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonText);
    const rawTraits = parsed.traits || [];

    // Get verified trait contents for dedup
    const verifiedContents = new Set(
      existingTraits
        .filter(t => t.userVerified && t.isActive)
        .map(t => t.content.toLowerCase().trim())
    );

    const traits: SoulTrait[] = [];

    for (let i = 0; i < rawTraits.length; i++) {
      const raw = rawTraits[i];
      if (!raw.content || !raw.category) continue;

      const content = String(raw.content).trim();

      // Skip if it duplicates a verified trait
      if (verifiedContents.has(content.toLowerCase())) continue;

      traits.push({
        id: `soul-trait-${Date.now()}-${i}`,
        category: validateSoulCategory(raw.category),
        content,
        confidence: Math.min(1, Math.max(0, raw.confidence || 0.5)),
        evidence: Array.isArray(raw.evidence)
          ? raw.evidence.map((e: unknown) => String(e).slice(0, 100))
          : [],
        extractedAt: now,
        isActive: true,
      });
    }

    console.log(`${LOG_PREFIX} parseSoulExtractionResponse: ${rawTraits.length} raw → ${traits.length} valid traits`);
    return traits;
  } catch (error) {
    console.error(`${LOG_PREFIX} parseSoulExtractionResponse: Failed to parse`, error);
    return [];
  }
}

// ============================================
// TRAIT MERGING
// ============================================

/**
 * Merge newly extracted traits with existing traits.
 * - userVerified traits are never overwritten
 * - userEdited traits are never overwritten
 * - Similar traits update confidence if re-confirmed
 * - New traits are appended
 */
export function mergeSoulTraits(
  existing: SoulTrait[],
  incoming: SoulTrait[]
): { mergedTraits: SoulTrait[]; newCount: number; updatedCount: number } {
  const result = [...existing];
  let newCount = 0;
  let updatedCount = 0;

  for (const trait of incoming) {
    // Find similar existing trait
    const existingIdx = result.findIndex(e =>
      e.isActive &&
      e.category === trait.category &&
      isSimilarTrait(e.content, trait.content)
    );

    if (existingIdx >= 0) {
      const existing = result[existingIdx];

      // Never overwrite user-pinned or user-edited traits
      if (existing.userVerified || existing.userEdited) continue;

      // Update confidence if re-confirmed (boost by 0.1, capped at 1.0)
      result[existingIdx] = {
        ...existing,
        confidence: Math.min(1.0, existing.confidence + 0.1),
        extractedAt: trait.extractedAt,
        evidence: deduplicateEvidence([...existing.evidence, ...trait.evidence]),
      };
      updatedCount++;
    } else {
      result.push(trait);
      newCount++;
    }
  }

  return { mergedTraits: result, newCount, updatedCount };
}

/**
 * Check if two trait descriptions are semantically similar (simple heuristic).
 */
function isSimilarTrait(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const na = normalize(a);
  const nb = normalize(b);

  // Exact match
  if (na === nb) return true;

  // One contains the other
  if (na.includes(nb) || nb.includes(na)) return true;

  // Word overlap > 60%
  const wordsA = new Set(na.split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(nb.split(/\s+/).filter(w => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }

  const overlapRatio = overlap / Math.min(wordsA.size, wordsB.size);
  return overlapRatio > 0.6;
}

/**
 * Deduplicate evidence strings.
 */
function deduplicateEvidence(evidence: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const e of evidence) {
    const normalized = e.toLowerCase().trim();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(e);
    }
  }
  return result.slice(0, 5); // Cap at 5 evidence items
}
