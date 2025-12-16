import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { AiProvider } from '@/lib/types';
import { ollamaChat, OllamaMessage, getFirstAvailableModel } from '@/lib/ollama';

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
      ollamaModel = 'gemma3:4b',
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

    const userPrompt = `Conversation with ${senderName}:

${threadContext}

Provide a handoff summary:`;

    let responseText: string;

    if (provider === 'ollama') {
      try {
        let modelToUse = ollamaModel;
        const messages: OllamaMessage[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ];

        try {
          responseText = await ollamaChat(ollamaBaseUrl, modelToUse, messages, 500);
        } catch (modelError) {
          console.log(`[ConversationSummary] Model ${modelToUse} failed, trying first available model`);
          const firstAvailable = await getFirstAvailableModel(ollamaBaseUrl);
          if (firstAvailable) {
            modelToUse = firstAvailable;
            responseText = await ollamaChat(ollamaBaseUrl, modelToUse, messages, 500);
          } else {
            throw modelError;
          }
        }
      } catch (error) {
        console.error('Ollama error:', error);
        return NextResponse.json(
          { error: 'Failed to connect to Ollama. Make sure Ollama is running and has models installed.' },
          { status: 503 }
        );
      }
    } else {
      const anthropicKey = request.headers.get('x-anthropic-key') || process.env.ANTHROPIC_API_KEY;

      if (!anthropicKey) {
        return NextResponse.json(
          { error: 'Anthropic API key not configured' },
          { status: 401 }
        );
      }

      const anthropic = new Anthropic({ apiKey: anthropicKey });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const textContent = response.content.find(block => block.type === 'text');
      responseText = textContent?.type === 'text' ? textContent.text : '';
    }

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
      console.error('Failed to parse summary response:', parseError);
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
    console.error('Error generating conversation summary:', error);

    if (error instanceof Error && error.message.includes('API key')) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate conversation summary' },
      { status: 500 }
    );
  }
}
