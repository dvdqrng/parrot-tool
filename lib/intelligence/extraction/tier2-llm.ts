/**
 * Tier 2 LLM Extraction
 * Batched per-contact extraction using Claude API
 * Extracts semantic facts, relationship classification, and action items
 */

import { BeeperMessage } from '@/lib/types';
import {
  ContactFact,
  RelationshipClassification,
  ActionItem,
  FactCategory,
  RelationshipType,
  CommitmentStrength,
} from '../knowledge/types';

// ============================================
// RESULT TYPES
// ============================================

export interface Tier2ExtractionResult {
  facts: ContactFact[];
  relationship: RelationshipClassification;
  actionItems: ActionItem[];
  summary: string;
  topics: string[];
}

export interface Tier2ExtractionRequest {
  chatId: string;
  contactId: string;
  contactName: string;
  platform: string;
  messages: BeeperMessage[];
  existingFacts?: ContactFact[];
  existingRelationship?: RelationshipClassification;
}

// ============================================
// EXTRACTION API CALL
// ============================================

import { getApiKey, getActiveProvider } from '@/lib/intelligence-settings';

const LOG_PREFIX = '[Tier2LLM]';

export async function extractTier2(
  request: Tier2ExtractionRequest
): Promise<Tier2ExtractionResult> {
  try {
    // Get provider and API key from localStorage settings
    const provider = getActiveProvider();
    const apiKey = getApiKey(provider);

    console.log(`${LOG_PREFIX} extractTier2: ${request.messages.length} messages for ${request.contactName} (${request.platform})`, {
      chatId: request.chatId,
      existingFacts: request.existingFacts?.length || 0,
      existingRelationship: request.existingRelationship?.type || 'none',
      provider,
      hasApiKey: !!apiKey,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Pass provider and API key to server (server can't access localStorage)
    headers['x-ai-provider'] = provider;
    if (apiKey) {
      headers['x-ai-key'] = apiKey;
    }

    const response = await fetch('/api/intelligence/extract', {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Extraction failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
    }

    const result = await response.json();

    console.log(`${LOG_PREFIX} ✓ extractTier2 result for ${request.contactName}:`, {
      newFacts: result.facts?.length || 0,
      relationship: result.relationship?.type || 'unknown',
      relationshipConfidence: result.relationship?.confidence?.toFixed(2) || '0',
      actionItems: result.actionItems?.length || 0,
      topics: result.topics?.slice(0, 5) || [],
      hasSummary: !!result.summary,
    });

    return result;
  } catch (error) {
    console.error(`${LOG_PREFIX} extractTier2 FAILED:`, error);
    // Return empty result on failure
    return {
      facts: [],
      relationship: {
        type: 'unknown',
        confidence: 0,
        evolution: [],
        lastUpdated: new Date().toISOString(),
      },
      actionItems: [],
      summary: '',
      topics: [],
    };
  }
}

// ============================================
// PROMPT BUILDING
// ============================================

// Batch size for processing - how many messages per extraction call
export const EXTRACTION_BATCH_SIZE = 100;

export function buildExtractionPrompt(
  request: Tier2ExtractionRequest
): string {
  const { contactName, platform, messages, existingFacts } = request;

  // Process ALL messages passed in (batching happens in background worker)
  const messageContext = messages
    .map(m => {
      const sender = m.isFromMe ? 'Me' : contactName;
      const time = new Date(m.timestamp).toLocaleString();
      return `[${time}] ${sender}: ${m.text || '[media]'}`;
    })
    .join('\n');

  // Format existing facts - show them so LLM knows what NOT to re-extract
  const existingFactsContext = existingFacts?.length
    ? `\n\nALREADY KNOWN FACTS (DO NOT re-extract these - only extract NEW information):\n${existingFacts.map(f => `- [${f.category}] ${f.content}`).join('\n')}`
    : '';

  return `Analyze this conversation between me and ${contactName} on ${platform}.

CONVERSATION:
${messageContext}
${existingFactsContext}

Extract NEW facts from this conversation that are NOT already in the "ALREADY KNOWN FACTS" list above.

Return JSON in this format:
{
  "facts": [
    {
      "category": "location|occupation|relationship|preference|plan|contact_info|personal|professional|interest|event",
      "content": "The fact in natural language",
      "confidence": 0.0-1.0
    }
  ],
  "relationship": {
    "type": "close_friend|friend|acquaintance|professional|family|romantic|service_provider|unknown",
    "confidence": 0.0-1.0,
    "reasoning": "Brief explanation"
  },
  "actionItems": [
    {
      "content": "What was promised or needs to be done",
      "commitment": "firm|soft|social_pleasantry",
      "dueDate": "ISO date if mentioned, null otherwise"
    }
  ],
  "summary": "A 1-2 sentence summary of the relationship and recent context",
  "topics": ["Main topics discussed"]
}

Rules:
1. CRITICAL: Do NOT re-extract facts that are already in the ALREADY KNOWN FACTS list above
2. Only extract facts that are clearly stated or strongly implied
3. For action items, distinguish between firm commitments ("I'll send it tomorrow") vs soft ("we should hang out sometime") vs social pleasantries ("let's catch up soon")
4. Relationship type should reflect the overall tone and content of conversations
5. Be conservative with confidence scores
6. Focus on facts that would be useful for future conversations
7. If no new facts are found, return an empty facts array: "facts": []

Respond ONLY with valid JSON.`;
}

// ============================================
// RESPONSE PARSING
// ============================================

export function parseExtractionResponse(
  responseText: string,
  request: Tier2ExtractionRequest
): Tier2ExtractionResult {
  const now = new Date().toISOString();

  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonText = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonText);

    // Transform facts
    const facts: ContactFact[] = (parsed.facts || []).map(
      (f: { category: string; content: string; confidence: number }, i: number) => ({
        id: `fact-${request.chatId}-${Date.now()}-${i}`,
        category: validateCategory(f.category),
        content: f.content,
        confidence: Math.min(1, Math.max(0, f.confidence || 0.5)),
        source: {
          messageId: request.messages[request.messages.length - 1]?.id || '',
          chatId: request.chatId,
          platform: request.platform,
          timestamp: now,
          extractedAt: now,
          tier: 2 as const,
        },
        firstSeen: now,
        lastConfirmed: now,
        isActive: true,
      })
    );

    // Transform relationship
    const relationship: RelationshipClassification = {
      type: validateRelationshipType(parsed.relationship?.type),
      confidence: Math.min(1, Math.max(0, parsed.relationship?.confidence || 0)),
      evolution: request.existingRelationship?.evolution || [],
      lastUpdated: now,
    };

    // Add evolution event if type changed
    if (
      request.existingRelationship &&
      request.existingRelationship.type !== relationship.type
    ) {
      relationship.evolution.push({
        type: 'detected',
        from: request.existingRelationship.type,
        to: relationship.type,
        confidence: relationship.confidence,
        timestamp: now,
        reason: parsed.relationship?.reasoning,
      });
    }

    // Transform action items
    const actionItems: ActionItem[] = (parsed.actionItems || []).map(
      (a: { content: string; commitment: string; dueDate?: string }, i: number) => ({
        id: `action-${request.chatId}-${Date.now()}-${i}`,
        content: a.content,
        commitment: validateCommitment(a.commitment),
        dueDate: a.dueDate || undefined,
        status: 'pending' as const,
        source: {
          messageId: request.messages[request.messages.length - 1]?.id || '',
          chatId: request.chatId,
          platform: request.platform,
          timestamp: now,
          extractedAt: now,
          tier: 2 as const,
        },
        createdAt: now,
      })
    );

    return {
      facts,
      relationship,
      actionItems,
      summary: parsed.summary || '',
      topics: parsed.topics || [],
    };
  } catch (error) {
    console.error('Failed to parse extraction response:', error);
    return {
      facts: [],
      relationship: {
        type: 'unknown',
        confidence: 0,
        evolution: [],
        lastUpdated: now,
      },
      actionItems: [],
      summary: '',
      topics: [],
    };
  }
}

// ============================================
// VALIDATION HELPERS
// ============================================

const VALID_CATEGORIES: FactCategory[] = [
  'location',
  'occupation',
  'relationship',
  'preference',
  'plan',
  'contact_info',
  'personal',
  'professional',
  'interest',
  'event',
];

function validateCategory(category: string): FactCategory {
  if (VALID_CATEGORIES.includes(category as FactCategory)) {
    return category as FactCategory;
  }
  return 'personal';
}

const VALID_RELATIONSHIP_TYPES: RelationshipType[] = [
  'close_friend',
  'friend',
  'acquaintance',
  'professional',
  'family',
  'romantic',
  'service_provider',
  'unknown',
];

function validateRelationshipType(type: string): RelationshipType {
  if (VALID_RELATIONSHIP_TYPES.includes(type as RelationshipType)) {
    return type as RelationshipType;
  }
  return 'unknown';
}

const VALID_COMMITMENTS: CommitmentStrength[] = [
  'firm',
  'soft',
  'social_pleasantry',
];

function validateCommitment(commitment: string): CommitmentStrength {
  if (VALID_COMMITMENTS.includes(commitment as CommitmentStrength)) {
    return commitment as CommitmentStrength;
  }
  return 'soft';
}
