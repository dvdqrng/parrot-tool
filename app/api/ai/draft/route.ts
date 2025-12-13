import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ToneSettings, AiProvider, WritingStylePatterns } from '@/lib/types';
import { ollamaChat, OllamaMessage } from '@/lib/ollama';

interface GenerateDraftBody {
  originalMessage: string;
  senderName: string;
  conversationContext?: string;
  tone?: 'friendly' | 'professional' | 'casual';
  toneSettings?: ToneSettings;
  writingStyle?: WritingStylePatterns;
  threadContext?: string;
  aiChatSummary?: string;
  // Provider settings
  provider?: AiProvider;
  ollamaModel?: string;
  ollamaBaseUrl?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateDraftBody = await request.json();
    const {
      originalMessage,
      senderName,
      conversationContext,
      tone = 'friendly',
      toneSettings,
      writingStyle,
      threadContext,
      aiChatSummary,
      provider = 'anthropic',
      ollamaModel = 'llama3.1:8b',
      ollamaBaseUrl,
    } = body;

    if (!originalMessage) {
      return NextResponse.json(
        { error: 'originalMessage is required' },
        { status: 400 }
      );
    }

    // Build tone instructions from toneSettings if provided, otherwise fall back to simple tone
    let toneInstruction: string;
    if (toneSettings) {
      const { briefDetailed, formalCasual } = toneSettings;

      // briefDetailed: 0 = very brief, 100 = very detailed
      const lengthDesc = briefDetailed < 30
        ? 'Keep responses very brief and to the point.'
        : briefDetailed < 70
          ? 'Use moderate length responses.'
          : 'Provide detailed, thorough responses.';

      // formalCasual: 0 = very formal, 100 = very casual
      const styleDesc = formalCasual < 30
        ? 'Use formal, professional language.'
        : formalCasual < 70
          ? 'Use a balanced, friendly tone.'
          : 'Use casual, relaxed language with informal expressions.';

      toneInstruction = `${lengthDesc} ${styleDesc}`;
    } else {
      const toneInstructions = {
        friendly: 'Be warm, personable, and use a conversational tone.',
        professional: 'Be polite, concise, and maintain a professional tone.',
        casual: 'Be relaxed, use informal language, and feel free to use common abbreviations.',
      };
      toneInstruction = toneInstructions[tone];
    }

    // Build writing style section from analyzed patterns
    let writingStyleSection = '';
    if (writingStyle) {
      const styleDetails: string[] = [];

      // Sample messages - these are the most important for voice matching
      if (writingStyle.sampleMessages && writingStyle.sampleMessages.length > 0) {
        styleDetails.push(`Here are examples of how this user actually writes messages:\n${writingStyle.sampleMessages.slice(0, 8).map(m => `- "${m}"`).join('\n')}`);
      }

      // Emojis
      if (writingStyle.frequentEmojis && writingStyle.frequentEmojis.length > 0) {
        styleDetails.push(`User frequently uses these emojis: ${writingStyle.frequentEmojis.join(' ')}`);
      }

      // Abbreviations
      if (writingStyle.abbreviations && writingStyle.abbreviations.length > 0) {
        styleDetails.push(`User uses abbreviations like: ${writingStyle.abbreviations.join(', ')}`);
      }

      // Language quirks
      if (writingStyle.languageQuirks && writingStyle.languageQuirks.length > 0) {
        styleDetails.push(`User's expressions: ${writingStyle.languageQuirks.join(', ')}`);
      }

      // Punctuation style
      if (writingStyle.punctuationStyle) {
        const punctDetails: string[] = [];
        if (writingStyle.punctuationStyle.usesMultipleExclamation) {
          punctDetails.push('uses multiple exclamation marks for emphasis');
        }
        if (writingStyle.punctuationStyle.usesEllipsis) {
          punctDetails.push('uses ellipsis (...)');
        }
        if (!writingStyle.punctuationStyle.endsWithPunctuation) {
          punctDetails.push('often skips ending punctuation');
        }
        if (punctDetails.length > 0) {
          styleDetails.push(`Punctuation style: ${punctDetails.join(', ')}`);
        }
      }

      // Capitalization
      if (writingStyle.capitalizationStyle) {
        if (writingStyle.capitalizationStyle === 'lowercase') {
          styleDetails.push('User typically writes in all lowercase');
        } else if (writingStyle.capitalizationStyle === 'proper') {
          styleDetails.push('User uses proper capitalization');
        }
      }

      // Message length
      if (writingStyle.avgWordsPerMessage) {
        styleDetails.push(`User's average message length: ~${writingStyle.avgWordsPerMessage} words`);
      }

      if (styleDetails.length > 0) {
        writingStyleSection = `\n\n<user_writing_style>\nIMPORTANT: Mimic this user's actual writing style as closely as possible. Match their vocabulary, emoji usage, abbreviations, punctuation, and overall voice.\n\n${styleDetails.join('\n\n')}\n</user_writing_style>`;
      }
    }

    // Build context sections
    let contextSection = '';
    if (threadContext) {
      contextSection += `\n\nConversation history with ${senderName}:\n<conversation>\n${threadContext}\n</conversation>`;
    }
    if (aiChatSummary) {
      contextSection += `\n\nRecent AI assistant discussion about this conversation:\n<ai_discussion>\n${aiChatSummary}\n</ai_discussion>`;
    }

    // Language matching instruction - detect from the original message and thread context
    const languageInstruction = `
LANGUAGE: Reply in the SAME LANGUAGE as the incoming message. If the message is in German, reply in German. If in English, reply in English. Do not switch or translate.`;

    const systemPrompt = `You are helping draft message replies that sound exactly like the user wrote them. ${toneInstruction}${writingStyleSection}${contextSection}
${languageInstruction}

Guidelines:
- CRITICAL: Reply in the SAME LANGUAGE as the message you're replying to
- CRITICAL: Make the reply sound like it came from this specific user - use their vocabulary, emoji patterns, abbreviations, and writing quirks
- Match the user's actual message length and style from the sample messages
- If the user uses lowercase, write in lowercase. If they use emojis, include appropriate emojis from their frequent list
- Use their specific expressions and abbreviations naturally
- Keep the response natural and conversational
- Don't include greetings like "Hi" or "Hey" unless the user typically uses them
- Provide just the reply text, no explanations or alternatives
- Use the conversation history and any AI discussion context to inform your reply`;

    const userPrompt = conversationContext
      ? `Context from conversation:\n${conversationContext}\n\nMessage from ${senderName}:\n"${originalMessage}"\n\nSuggest a reply:`
      : `Message from ${senderName}:\n"${originalMessage}"\n\nSuggest a reply:`;

    let suggestedReply: string;

    if (provider === 'ollama') {
      // Use Ollama
      try {
        const messages: OllamaMessage[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ];
        suggestedReply = await ollamaChat(ollamaBaseUrl, ollamaModel, messages, 300);
      } catch (error) {
        console.error('Ollama error:', error);
        return NextResponse.json(
          { error: 'Failed to connect to Ollama. Make sure Ollama is running.' },
          { status: 503 }
        );
      }
    } else {
      // Use Anthropic
      const anthropicKey = request.headers.get('x-anthropic-key') || process.env.ANTHROPIC_API_KEY;

      if (!anthropicKey) {
        return NextResponse.json(
          { error: 'Anthropic API key not configured. Add it in Settings.' },
          { status: 401 }
        );
      }

      const anthropic = new Anthropic({
        apiKey: anthropicKey,
      });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
      });

      // Extract text from the response
      const textContent = response.content.find(block => block.type === 'text');
      suggestedReply = textContent?.type === 'text' ? textContent.text : '';
    }

    return NextResponse.json({
      data: {
        suggestedReply: suggestedReply.trim(),
      }
    });
  } catch (error) {
    console.error('Error generating draft:', error);

    // Check if it's an API key issue
    if (error instanceof Error && error.message.includes('API key')) {
      return NextResponse.json(
        { error: 'Invalid or missing Anthropic API key' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate draft suggestion' },
      { status: 500 }
    );
  }
}
