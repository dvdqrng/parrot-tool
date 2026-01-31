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

    const systemPrompt = `You are a knowledge extraction assistant. Your job is to analyze conversation history and extract structured facts about the people and topics discussed.

Extract ONLY new, specific, factual information. Do not repeat information that is already known.${existingSection}

Categories for facts:
- preference: Things they like/dislike, preferences, habits
- schedule: Availability, time zones, work hours, events
- relationship: How they relate to the user, mutual connections
- topic: Subjects frequently discussed, interests
- sentiment: Their emotional state, attitudes toward things
- communication: How they prefer to communicate, response patterns
- personal: Personal details (location, family, hobbies)
- professional: Work-related info (job, company, projects)

For each fact, provide:
- category: One of the categories above
- content: The actual fact (1 sentence, specific and concrete)
- confidence: 0-100 how confident you are this is accurate
- source: "stated" (they explicitly said it), "observed" (clear from behavior), "inferred" (reasonable conclusion)

Also identify:
- conversationTone: The overall tone (e.g., "casual and friendly", "professional", "humorous")
- primaryLanguage: The primary language used in the conversation
- topicHistory: List of main topics discussed (max 5)
- relationshipType: The apparent relationship (e.g., "friend", "colleague", "client", "family")

Respond in JSON format:
{
  "facts": [
    { "category": "preference", "content": "Prefers morning meetings", "confidence": 85, "source": "stated" }
  ],
  "conversationTone": "casual and friendly",
  "primaryLanguage": "English",
  "topicHistory": ["project deadline", "weekend plans"],
  "relationshipType": "colleague"
}

Be selective — only extract facts with confidence >= 50. Quality over quantity.`;

    const anthropicKey = request.headers.get('x-anthropic-key') || process.env.ANTHROPIC_API_KEY;
    const openaiKey = request.headers.get('x-openai-key') || process.env.OPENAI_API_KEY;

    const userPrompt = `Conversation with ${senderName}:

${threadContext}

Extract knowledge from this conversation:`;

    const responseText = await callAiProvider({
      provider,
      systemPrompt,
      userPrompt,
      maxTokens: AI_TOKENS.SUMMARY, // Similar size to summary
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

      const validFacts = (parsed.facts || []).filter(f =>
        validCategories.includes(f.category) &&
        validSources.includes(f.source) &&
        typeof f.content === 'string' &&
        typeof f.confidence === 'number' &&
        f.confidence >= 50
      );

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
