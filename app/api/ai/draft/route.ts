import { NextRequest, NextResponse } from 'next/server';
import { ToneSettings, AiProvider, WritingStylePatterns } from '@/lib/types';
import { callAiProvider, handleAiProviderError } from '@/lib/ai-provider';
import { AI_TOKENS, AI_TEMPERATURE, DEFAULT_OLLAMA_MODEL } from '@/lib/ai-constants';

interface GoalAnalysis {
  isGoalAchieved: boolean;
  confidence: number;
  reasoning: string;
}

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
  // Autopilot-specific features
  agentSystemPrompt?: string;
  agentGoal?: string;
  detectGoalCompletion?: boolean;
  // Human-like behavior flags
  emojiOnlyResponse?: boolean;
  suggestClosing?: boolean;
  messagesInConversation?: number;
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
      ollamaModel = DEFAULT_OLLAMA_MODEL,
      ollamaBaseUrl,
      agentSystemPrompt,
      agentGoal,
      detectGoalCompletion = false,
      // Human-like behaviors
      emojiOnlyResponse = false,
      suggestClosing = false,
      messagesInConversation = 0,
    } = body;

    // For autopilot mode with goals, originalMessage can be empty (proactive messages)
    // Otherwise it's required
    if (!originalMessage && !agentGoal) {
      return NextResponse.json(
        { error: 'originalMessage is required (unless using agentGoal for proactive messages)' },
        { status: 400 }
      );
    }

    // Handle emoji-only response - return just an emoji based on user's frequent emojis or context
    if (emojiOnlyResponse) {
      // Use user's frequent emojis if available, otherwise use common acknowledgment emojis
      const userEmojis = writingStyle?.frequentEmojis || [];
      const fallbackEmojis = ['👍', '😊', '🙌', '✨', '💯', '🔥', '❤️', '😄'];
      const emojiPool = userEmojis.length > 0 ? userEmojis : fallbackEmojis;
      const selectedEmoji = emojiPool[Math.floor(Math.random() * emojiPool.length)];

      return NextResponse.json({
        data: {
          suggestedReply: selectedEmoji,
          isEmojiOnly: true,
        }
      });
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
    // For Ollama, we need a more explicit, example-heavy prompt
    let writingStyleSection = '';
    if (writingStyle) {
      const styleDetails: string[] = [];

      // Sample messages - these are the most important for voice matching
      if (writingStyle.sampleMessages && writingStyle.sampleMessages.length > 0) {
        const sampleCount = provider === 'ollama' ? 10 : 8;
        styleDetails.push(`Here are examples of how this user actually writes messages:\n${writingStyle.sampleMessages.slice(0, sampleCount).map(m => `- "${m}"`).join('\n')}`);
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
        const emphasisLevel = provider === 'ollama' ? 'CRITICAL' : 'IMPORTANT';
        writingStyleSection = `\n\n<user_writing_style>\n${emphasisLevel}: Mimic this user's actual writing style as closely as possible. Match their vocabulary, emoji usage, abbreviations, punctuation, and overall voice.\n\n${styleDetails.join('\n\n')}\n</user_writing_style>`;
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

    // Build goal detection section (for autopilot)
    const goalDetectionSection = detectGoalCompletion && agentGoal ? `

<goal_detection>
Your goal for this conversation: "${agentGoal}"

IMPORTANT FORMAT:
1. First, write your natural human-like reply to the message
2. Then, add the goal analysis in the specific format below

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

    // Build conversation closing section
    const conversationClosingSection = suggestClosing ? `

<conversation_closing>
This conversation has been idle for a while. Consider naturally wrapping up or suggesting to continue later.
You might:
- Acknowledge the conversation pause naturally ("anyway, I should probably...")
- Suggest picking it up later ("let's chat more later")
- End with a friendly sign-off that matches the user's style
Don't force it if the incoming message clearly wants to continue the conversation.
</conversation_closing>` : '';

    // Build conversation fatigue hint
    const fatigueHint = messagesInConversation > 20 ? `
Note: This has been a longer conversation (${messagesInConversation} messages). Keep responses concise and natural - avoid overly lengthy replies.` : '';

    // Language matching instruction - detect from the original message and thread context
    const languageInstruction = `
LANGUAGE: Reply in the SAME LANGUAGE as the incoming message. If the message is in German, reply in German. If in English, reply in English. Do not switch or translate.`;

    // Create enhanced few-shot examples for Ollama to help with style matching
    let fewShotExamples = '';
    if (provider === 'ollama' && writingStyle && writingStyle.sampleMessages.length > 0) {
      // Create transformations that show how to match the user's style
      const examples: string[] = [];

      // Example 1: Demonstrate brevity and lowercase if applicable
      if (writingStyle.capitalizationStyle === 'lowercase' || writingStyle.avgWordsPerMessage < 15) {
        examples.push(`Example of this user's style:
Generic: "That sounds great! I would be happy to help with that."
This user: "${writingStyle.sampleMessages[0]}"`);
      }

      // Example 2: Show emoji usage if applicable
      if (writingStyle.frequentEmojis && writingStyle.frequentEmojis.length > 0) {
        const emojiExample = writingStyle.sampleMessages.find(m => writingStyle.frequentEmojis.some(e => m.includes(e)));
        if (emojiExample) {
          examples.push(`This user uses emojis like: ${writingStyle.frequentEmojis.slice(0, 5).join(' ')}\nExample: "${emojiExample}"`);
        }
      }

      if (examples.length > 0) {
        fewShotExamples = `\n\n<style_examples>\n${examples.join('\n\n')}\n</style_examples>`;
      }
    }

    // Build system prompt
    const baseSystemPrompt = agentSystemPrompt
      ? `You are an AI acting as a human in a conversation. Your responses should be completely natural and human-like.\n\n${agentSystemPrompt}\n\n${toneInstruction}`
      : `You are helping draft message replies that sound exactly like the user wrote them. ${toneInstruction}`;

    const systemPrompt = `${baseSystemPrompt}${writingStyleSection}${fewShotExamples}${contextSection}
${languageInstruction}${conversationClosingSection}${fatigueHint}

${agentGoal ? `CRITICAL RULES:
1. Reply in the SAME LANGUAGE as the incoming message
2. Sound exactly like a real human - use the user's writing style if provided
3. Work towards your goal naturally without being pushy or obvious
4. Match message length to the user's typical style
5. Don't introduce yourself as AI or mention being automated
6. Be conversational and authentic
7. Provide ONLY the reply text (and goal analysis if requested)` : `Guidelines:
- CRITICAL: Reply in the SAME LANGUAGE as the message you're replying to
- CRITICAL: Make the reply sound like it came from this specific user - use their vocabulary, emoji patterns, abbreviations, and writing quirks
- CRITICAL: Output ONLY the reply message itself - NO explanations, NO reasoning, NO alternatives, NO meta-commentary
- DO NOT include phrases like "Here's a reply" or "I suggest" - just write the actual message
- STUDY THE SAMPLE MESSAGES ABOVE - they show exactly how this user writes. Copy their patterns, word choice, and style
- Match the user's actual message length and style from the sample messages
- If the user uses lowercase, write in lowercase. If they use emojis, include appropriate emojis from their frequent list
- Use their specific expressions and abbreviations naturally
- Keep the response natural and conversational
- Don't include greetings like "Hi" or "Hey" unless the user typically uses them in the samples
- Use the conversation history and any AI discussion context to inform your reply`}
${goalDetectionSection}`;

    const userPrompt = originalMessage
      ? (conversationContext
          ? `Context from conversation:\n${conversationContext}\n\nMessage from ${senderName}:\n"${originalMessage}"\n\nSuggest a reply:`
          : `Message from ${senderName}:\n"${originalMessage}"\n\nSuggest a reply:`)
      : `Generate a proactive message to start or continue this conversation naturally.
Work towards your goal: "${agentGoal}"

Consider the conversation history and create an engaging, contextual message.`;

    // Helper function to extract final answer from reasoning models like DeepSeek
    const extractFinalAnswer = (text: string): string => {
      // Strategy 1: Look for quoted text - often the actual reply is in quotes
      const quotedMatches = text.match(/"([^"]+)"/g);
      if (quotedMatches && quotedMatches.length > 0) {
        // Get the first substantial quoted text (longer than 10 chars)
        const substantialQuote = quotedMatches.find(q => q.length > 12);
        if (substantialQuote) {
          // Remove the quotes and return
          return substantialQuote.replace(/^"|"$/g, '').trim();
        }
      }

      // Strategy 2: Remove content within tags
      let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
      cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

      // Strategy 3: Remove meta-commentary phrases
      cleaned = cleaned.replace(/Sure,?\s+here'?s?\s+.*?version.*?:/gi, '');
      cleaned = cleaned.replace(/This keeps the tone.*$/gim, '');
      cleaned = cleaned.replace(/Let me know if.*$/gim, '');
      cleaned = cleaned.replace(/But maybe.*$/gim, '');
      cleaned = cleaned.replace(/So,?\s+the revised version.*?:/gi, '');
      cleaned = cleaned.replace(/\bmaybe\b.*\bmore\s+(casual|informal|formal)\b.*$/gim, '');

      // Strategy 4: Remove reasoning indicators
      const lines = cleaned.split('\n');
      const filteredLines = lines.filter(line => {
        const lower = line.toLowerCase().trim();
        if (!lower) return true; // Keep empty lines

        // Skip lines that are pure reasoning
        const reasoningPhrases = [
          'first', 'okay', 'so', 'now', 'let me', 'i need', 'i should',
          'the user wants', 'analyzing', 'understanding', 'considering',
          'this keeps', 'this version', 'here\'s', 'sure,', 'maybe',
        ];

        const startsWithReasoning = reasoningPhrases.some(phrase => lower.startsWith(phrase));
        if (startsWithReasoning && line.length > 40) return false;

        return true;
      });

      cleaned = filteredLines.join('\n').trim();

      // Strategy 5: If multiple paragraphs remain, take the first substantial one
      const paragraphs = cleaned.split('\n\n').filter(p => p.trim().length > 5);
      if (paragraphs.length > 0) {
        return paragraphs[0].trim();
      }

      return cleaned.trim();
    };

    const anthropicKey = request.headers.get('x-anthropic-key') || process.env.ANTHROPIC_API_KEY;
    const openaiKey = request.headers.get('x-openai-key') || process.env.OPENAI_API_KEY;

    // Call AI provider
    let suggestedReply = await callAiProvider({
      provider,
      systemPrompt,
      userPrompt,
      maxTokens: AI_TOKENS.DRAFT,
      temperature: AI_TEMPERATURE.DRAFT,
      ollamaModel,
      ollamaBaseUrl,
      anthropicKey,
      openaiKey,
    });

    // Extract final answer if model outputs reasoning (especially for Ollama/reasoning models)
    suggestedReply = extractFinalAnswer(suggestedReply);

    // Parse the response - extract reply and goal analysis
    let finalReply = suggestedReply.trim();
    let goalAnalysis: GoalAnalysis | undefined;

    if (detectGoalCompletion) {
      // Extract goal analysis if present
      const goalAnalysisMatch = suggestedReply.match(/<goal_analysis>\s*(\{[\s\S]*?\})\s*<\/goal_analysis>/);
      if (goalAnalysisMatch) {
        try {
          goalAnalysis = JSON.parse(goalAnalysisMatch[1]);
          // Remove the goal analysis from the reply
          finalReply = suggestedReply.replace(/<goal_analysis>[\s\S]*?<\/goal_analysis>/, '').trim();
        } catch (e) {
          console.error('Failed to parse goal analysis:', e);
        }
      }
    }

    // Validate that we have a meaningful reply
    const looksLikeJson = /^\s*\{[\s\S]*\}\s*$/.test(finalReply);
    const containsMetadataOnly = /^(isGoalAchieved|confidence|reasoning)/.test(finalReply);

    if (!finalReply || finalReply.length < 3 || looksLikeJson || containsMetadataOnly) {
      console.error('[Draft] Invalid reply generated:', {
        finalReply: finalReply.slice(0, 100),
        suggestedReply: suggestedReply.slice(0, 200)
      });
      return NextResponse.json(
        { error: 'Failed to generate a valid reply. The AI returned only metadata or an empty response.' },
        { status: 500 }
      );
    }

    // Split into multiple messages if needed (based on writing style)
    let suggestedMessages: string[] | undefined;
    if (writingStyle?.avgWordsPerMessage) {
      const wordCount = finalReply.split(/\s+/).length;
      const avgWords = writingStyle.avgWordsPerMessage;

      // If reply is significantly longer than user's average, consider splitting
      if (wordCount > avgWords * 2) {
        const sentences = finalReply.match(/[^.!?]+[.!?]+/g) || [finalReply];
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

    return NextResponse.json({
      data: {
        suggestedReply: finalReply,
        suggestedMessages,
        goalAnalysis,
      }
    });
  } catch (error) {
    console.error('Error generating draft:', error);
    const { error: errorMessage, status } = handleAiProviderError(error);
    return NextResponse.json({ error: errorMessage }, { status });
  }
}
