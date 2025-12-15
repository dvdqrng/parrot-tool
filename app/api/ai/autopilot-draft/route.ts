import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ToneSettings, AiProvider, WritingStylePatterns } from '@/lib/types';
import { ollamaChat, OllamaMessage } from '@/lib/ollama';

interface AutopilotDraftBody {
  originalMessage: string;
  senderName: string;
  threadContext?: string;
  // Agent-specific
  agentSystemPrompt: string;
  agentGoal: string;
  // Style settings
  toneSettings?: ToneSettings;
  writingStyle?: WritingStylePatterns;
  // Goal detection
  detectGoalCompletion?: boolean;
  // Provider settings
  provider?: AiProvider;
  ollamaModel?: string;
  ollamaBaseUrl?: string;
}

interface GoalAnalysis {
  isGoalAchieved: boolean;
  confidence: number;
  reasoning: string;
}

interface AutopilotDraftResponse {
  suggestedReply: string;
  suggestedMessages?: string[];
  goalAnalysis?: GoalAnalysis;
}

export async function POST(request: NextRequest) {
  try {
    const body: AutopilotDraftBody = await request.json();
    const {
      originalMessage,
      senderName,
      threadContext,
      agentSystemPrompt,
      agentGoal,
      toneSettings,
      writingStyle,
      detectGoalCompletion = true,
      provider = 'anthropic',
      ollamaModel = 'llama3.1:8b',
      ollamaBaseUrl,
    } = body;

    if (!originalMessage || !agentGoal) {
      return NextResponse.json(
        { error: 'originalMessage and agentGoal are required' },
        { status: 400 }
      );
    }

    // Build tone instructions
    let toneInstruction = '';
    if (toneSettings) {
      const { briefDetailed, formalCasual } = toneSettings;
      const lengthDesc = briefDetailed < 30
        ? 'Keep responses very brief.'
        : briefDetailed < 70
          ? 'Use moderate length.'
          : 'Provide detailed responses.';
      const styleDesc = formalCasual < 30
        ? 'Use formal language.'
        : formalCasual < 70
          ? 'Use a balanced tone.'
          : 'Use casual, relaxed language.';
      toneInstruction = `${lengthDesc} ${styleDesc}`;
    }

    // Build writing style section
    let writingStyleSection = '';
    if (writingStyle) {
      const styleDetails: string[] = [];

      if (writingStyle.sampleMessages?.length > 0) {
        styleDetails.push(`User's writing examples:\n${writingStyle.sampleMessages.slice(0, 5).map(m => `- "${m}"`).join('\n')}`);
      }
      if (writingStyle.frequentEmojis?.length > 0) {
        styleDetails.push(`Emojis: ${writingStyle.frequentEmojis.join(' ')}`);
      }
      if (writingStyle.abbreviations?.length > 0) {
        styleDetails.push(`Abbreviations: ${writingStyle.abbreviations.join(', ')}`);
      }
      if (writingStyle.avgWordsPerMessage) {
        styleDetails.push(`Average message length: ~${writingStyle.avgWordsPerMessage} words`);
      }
      if (writingStyle.capitalizationStyle === 'lowercase') {
        styleDetails.push('Writes in lowercase');
      }

      if (styleDetails.length > 0) {
        writingStyleSection = `\n<user_writing_style>\nMimic this user's writing style:\n${styleDetails.join('\n')}\n</user_writing_style>`;
      }
    }

    // Build goal detection section
    const goalDetectionSection = detectGoalCompletion ? `

<goal_detection>
Your goal for this conversation: "${agentGoal}"

After generating your reply, analyze if this goal is achieved or close to being achieved.
Include a goal analysis in this format at the END of your response:

<goal_analysis>
{
  "isGoalAchieved": true/false,
  "confidence": 0-100,
  "reasoning": "brief explanation"
}
</goal_analysis>

Goal achievement examples:
- "Schedule a meeting": Goal achieved when a specific date/time is agreed upon
- "Qualify lead": Goal achieved when key qualification questions are answered
- "Casual conversation": Goal achieved after 3+ positive exchanges
- "Get contact info": Goal achieved when email/phone is provided
</goal_detection>` : '';

    // Build context section
    let contextSection = '';
    if (threadContext) {
      contextSection = `\n\nConversation history:\n<conversation>\n${threadContext}\n</conversation>`;
    }

    const systemPrompt = `You are an AI acting as a human in a conversation. Your responses should be completely natural and human-like.

${agentSystemPrompt}

${toneInstruction}${writingStyleSection}${contextSection}

CRITICAL RULES:
1. Reply in the SAME LANGUAGE as the incoming message
2. Sound exactly like a real human - use the user's writing style if provided
3. Work towards your goal naturally without being pushy or obvious
4. Match message length to the user's typical style
5. Don't introduce yourself as AI or mention being automated
6. Be conversational and authentic
7. Provide ONLY the reply text (and goal analysis if requested)
${goalDetectionSection}`;

    const userPrompt = `Message from ${senderName}:
"${originalMessage}"

Generate a natural reply that works towards your goal:`;

    let fullResponse: string;

    if (provider === 'ollama') {
      try {
        const messages: OllamaMessage[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ];
        fullResponse = await ollamaChat(ollamaBaseUrl, ollamaModel, messages, 500);
      } catch (error) {
        console.error('Ollama error:', error);
        return NextResponse.json(
          { error: 'Failed to connect to Ollama' },
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
      fullResponse = textContent?.type === 'text' ? textContent.text : '';
    }

    // Parse the response - extract reply and goal analysis
    let suggestedReply = fullResponse.trim();
    let goalAnalysis: GoalAnalysis | undefined;

    if (detectGoalCompletion) {
      // Extract goal analysis if present
      const goalAnalysisMatch = fullResponse.match(/<goal_analysis>\s*(\{[\s\S]*?\})\s*<\/goal_analysis>/);
      if (goalAnalysisMatch) {
        try {
          goalAnalysis = JSON.parse(goalAnalysisMatch[1]);
          // Remove the goal analysis from the reply
          suggestedReply = fullResponse.replace(/<goal_analysis>[\s\S]*?<\/goal_analysis>/, '').trim();
        } catch {
          console.error('Failed to parse goal analysis');
        }
      }
    }

    // Split into multiple messages if needed (based on writing style)
    let suggestedMessages: string[] | undefined;
    if (writingStyle?.avgWordsPerMessage) {
      const wordCount = suggestedReply.split(/\s+/).length;
      const avgWords = writingStyle.avgWordsPerMessage;

      // If reply is significantly longer than user's average, consider splitting
      if (wordCount > avgWords * 2) {
        const sentences = suggestedReply.match(/[^.!?]+[.!?]+/g) || [suggestedReply];
        if (sentences.length >= 2) {
          // Split into 2-3 messages
          const messageCount = Math.min(3, Math.ceil(sentences.length / 2));
          const sentencesPerMessage = Math.ceil(sentences.length / messageCount);

          suggestedMessages = [];
          for (let i = 0; i < sentences.length; i += sentencesPerMessage) {
            const messageSentences = sentences.slice(i, i + sentencesPerMessage);
            suggestedMessages.push(messageSentences.join(' ').trim());
          }

          // Only use multi-message if we actually created multiple
          if (suggestedMessages.length <= 1) {
            suggestedMessages = undefined;
          }
        }
      }
    }

    const response: AutopilotDraftResponse = {
      suggestedReply,
      suggestedMessages,
      goalAnalysis,
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error('Error generating autopilot draft:', error);

    if (error instanceof Error && error.message.includes('API key')) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate autopilot draft' },
      { status: 500 }
    );
  }
}
