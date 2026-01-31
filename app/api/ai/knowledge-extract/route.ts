import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { AiProvider } from '@/lib/types';
import { callAiProvider, handleAiProviderError } from '@/lib/ai-provider';
import { AI_TOKENS, AI_TEMPERATURE } from '@/lib/ai-constants';

interface KnowledgeExtractBody {
  threadContext: string;
  senderName: string;
  existingKnowledge?: string; // formatted existing knowledge for dedup
  // Provider settings
  provider?: AiProvider;
  ollamaModel?: string;
  ollamaBaseUrl?: string;
}

interface ExtractedFact {
  category: string;
  content: string;
  confidence: number;
  source: 'observed' | 'stated' | 'inferred';
  aboutEntity: 'contact' | 'user' | 'conversation';
}

interface KnowledgeExtractResponse {
  facts: ExtractedFact[];
  conversationTone?: string;
  primaryLanguage?: string;
  topicHistory?: string[];
  relationshipType?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: KnowledgeExtractBody = await request.json();
    const {
      threadContext,
      senderName,
      existingKnowledge,
      provider = 'anthropic',
      ollamaModel = 'deepseek-v3',
      ollamaBaseUrl,
    } = body;

    if (!threadContext) {
      return NextResponse.json(
        { error: 'threadContext is required' },
        { status: 400 }
      );
    }

    const existingSection = existingKnowledge
      ? `\n\nAlready known facts (DO NOT repeat these, only extract NEW information):\n${existingKnowledge}`
      : '';

    const systemPrompt = `You are a knowledge extraction assistant. Your job is to analyze conversation history and extract structured facts, carefully distinguishing WHO each fact is about.

CRITICAL CONTEXT: In the conversation, "Me" is the USER who owns this app. "${senderName}" is the OTHER person — the contact.

Each fact MUST include an "aboutEntity" field:
- "contact": Facts about ${senderName} (the other person). Example: If ${senderName} says "I love hiking" → aboutEntity: "contact"
- "user": Facts about "Me" (the user) that were shared in this conversation. Example: If Me says "I'm going to Berlin next week" → aboutEntity: "user"
- "conversation": Facts about the conversation dynamic, shared context, or the relationship between both people. Example: "They typically chat in German" → aboutEntity: "conversation"

Extract ONLY new, specific, factual information. Do not repeat information that is already known.${existingSection}

Categories for facts:
- preference: Likes/dislikes, preferences, habits
- schedule: Availability, time zones, work hours, events, travel plans
- relationship: How they relate to each other, mutual connections
- topic: Subjects of interest, frequently discussed topics
- sentiment: Emotional state, attitudes toward things
- communication: Communication preferences, response patterns
- personal: Personal details (location, family, hobbies)
- professional: Work-related info (job, company, projects)

For each fact, provide:
- category: One of the categories above
- content: The fact (1 sentence, specific and concrete). Always name the subject clearly — start with "${senderName}..." for contact facts, "User..." for user facts, or describe the dynamic for conversation facts.
- confidence: 0-100 how confident you are this is accurate
- source: "stated" (explicitly said), "observed" (clear from behavior), "inferred" (reasonable conclusion)
- aboutEntity: "contact", "user", or "conversation"

Also identify:
- conversationTone: The overall tone (e.g., "casual and friendly", "professional", "humorous")
- primaryLanguage: The primary language used in the conversation
- topicHistory: List of main topics discussed (max 5)
- relationshipType: The apparent relationship (e.g., "friend", "colleague", "client", "family")

Respond in JSON format:
{
  "facts": [
    { "category": "preference", "content": "${senderName} prefers morning meetings", "confidence": 85, "source": "stated", "aboutEntity": "contact" },
    { "category": "schedule", "content": "User is traveling to Berlin next week", "confidence": 90, "source": "stated", "aboutEntity": "user" },
    { "category": "communication", "content": "They typically communicate in German", "confidence": 80, "source": "observed", "aboutEntity": "conversation" }
  ],
  "conversationTone": "casual and friendly",
  "primaryLanguage": "English",
  "topicHistory": ["project deadline", "weekend plans"],
  "relationshipType": "colleague"
}

Be selective — only extract facts with confidence >= 50. Quality over quantity.`;

    const anthropicKey = request.headers.get('x-anthropic-key') || process.env.ANTHROPIC_API_KEY;
    const openaiKey = request.headers.get('x-openai-key') || process.env.OPENAI_API_KEY;

    const userPrompt = `Conversation between "Me" (the user) and ${senderName} (the contact):

${threadContext}

Extract knowledge from this conversation. For each fact, clearly mark "aboutEntity" as "contact" (about ${senderName}), "user" (about Me), or "conversation" (about the relationship/dynamic).`;

    const responseText = await callAiProvider({
      provider,
      systemPrompt,
      userPrompt,
      maxTokens: AI_TOKENS.KNOWLEDGE,
      temperature: AI_TEMPERATURE.SUMMARY,
      ollamaModel,
      ollamaBaseUrl,
      anthropicKey,
      openaiKey,
    });

    // Parse JSON response
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed: KnowledgeExtractResponse = JSON.parse(jsonMatch[0]);

      // Validate and filter facts
      const validCategories = ['preference', 'schedule', 'relationship', 'topic', 'sentiment', 'communication', 'personal', 'professional'];
      const validSources = ['observed', 'stated', 'inferred'];
      const validEntities = ['contact', 'user', 'conversation'];

      const rawFacts = parsed.facts || [];
      const validFacts = rawFacts
        .map(f => ({
          ...f,
          // Default aboutEntity to 'contact' if missing or invalid
          aboutEntity: validEntities.includes(f.aboutEntity) ? f.aboutEntity : 'contact' as const,
        }))
        .filter(f =>
          validCategories.includes(f.category) &&
          validSources.includes(f.source) &&
          typeof f.content === 'string' &&
          typeof f.confidence === 'number' &&
          f.confidence >= 50
        );

      logger.debug('[Knowledge Extract] Parsed facts:', {
        rawCount: rawFacts.length,
        validCount: validFacts.length,
        entities: validFacts.reduce((acc, f) => {
          acc[f.aboutEntity] = (acc[f.aboutEntity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      });

      return NextResponse.json({
        data: {
          facts: validFacts,
          conversationTone: parsed.conversationTone || undefined,
          primaryLanguage: parsed.primaryLanguage || undefined,
          topicHistory: Array.isArray(parsed.topicHistory) ? parsed.topicHistory.slice(0, 5) : undefined,
          relationshipType: parsed.relationshipType || undefined,
        }
      });
    } catch (parseError) {
      logger.error('Failed to parse knowledge extract response:', parseError instanceof Error ? parseError : String(parseError));
      return NextResponse.json({
        data: {
          facts: [],
        }
      });
    }
  } catch (error) {
    logger.error('Error extracting knowledge:', error instanceof Error ? error : String(error));
    const { error: errorMessage, status } = handleAiProviderError(error);
    return NextResponse.json({ error: errorMessage }, { status });
  }
}
