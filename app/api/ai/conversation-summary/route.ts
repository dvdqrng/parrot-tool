import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { AiProvider } from '@/lib/types';
import { callAiProvider, handleAiProviderError } from '@/lib/ai-provider';
import { AI_TOKENS, AI_TEMPERATURE } from '@/lib/ai-constants';

interface ConversationSummaryBody {
  threadContext: string;
  agentGoal: string;
  senderName: string;
  // Provider settings
  provider?: AiProvider;
  ollamaModel?: string;
  ollamaBaseUrl?: string;
}

interface ConversationSummaryResponse {
  summary: string;
  keyPoints: string[];
  suggestedNextSteps: string[];
  goalStatus: 'achieved' | 'in-progress' | 'unclear';
}

export async function POST(request: NextRequest) {
  try {
    const body: ConversationSummaryBody = await request.json();
    const {
      threadContext,
      agentGoal,
      senderName,
      provider = 'anthropic',
      ollamaModel = 'deepseek-v3',
      ollamaBaseUrl,
    } = body;

    if (!threadContext || !agentGoal) {
      return NextResponse.json(
        { error: 'threadContext and agentGoal are required' },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a helpful assistant that summarizes conversations for handoff to a human.

Your task is to analyze a conversation and provide:
1. A brief summary of what was discussed
2. Key points from the conversation
3. Suggested next steps for the human taking over
4. Status of the goal

The conversation was managed by an AI autopilot with this goal: "${agentGoal}"

Respond in JSON format:
{
  "summary": "2-3 sentence summary of the conversation",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "suggestedNextSteps": ["step 1", "step 2"],
  "goalStatus": "achieved" | "in-progress" | "unclear"
}

Be concise and actionable. Focus on information the human needs to seamlessly continue the conversation.`;

    const anthropicKey = request.headers.get('x-anthropic-key') || process.env.ANTHROPIC_API_KEY;
    const openaiKey = request.headers.get('x-openai-key') || process.env.OPENAI_API_KEY;

    const userPrompt = `Conversation with ${senderName}:

${threadContext}

Provide a handoff summary:`;

    const responseText = await callAiProvider({
      provider,
      systemPrompt,
      userPrompt,
      maxTokens: AI_TOKENS.SUMMARY,
      temperature: AI_TEMPERATURE.SUMMARY,
      ollamaModel,
      ollamaBaseUrl,
      anthropicKey,
      openaiKey,
    });

    // Parse JSON response
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed: ConversationSummaryResponse = JSON.parse(jsonMatch[0]);

      // Validate the structure
      if (!parsed.summary || !Array.isArray(parsed.keyPoints) || !Array.isArray(parsed.suggestedNextSteps)) {
        throw new Error('Invalid response structure');
      }

      // Ensure goalStatus is valid
      if (!['achieved', 'in-progress', 'unclear'].includes(parsed.goalStatus)) {
        parsed.goalStatus = 'unclear';
      }

      return NextResponse.json({ data: parsed });
    } catch (parseError) {
      logger.error('Failed to parse summary response:', parseError instanceof Error ? parseError : String(parseError));
      // Return a fallback summary
      return NextResponse.json({
        data: {
          summary: 'Unable to generate detailed summary. Please review the conversation history.',
          keyPoints: ['Review conversation history manually'],
          suggestedNextSteps: ['Continue the conversation based on context'],
          goalStatus: 'unclear' as const,
        }
      });
    }
  } catch (error) {
    logger.error('Error generating conversation summary:', error instanceof Error ? error : String(error));
    const { error: errorMessage, status } = handleAiProviderError(error);
    return NextResponse.json({ error: errorMessage }, { status });
  }
}
