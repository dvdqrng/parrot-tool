# AI Pipeline Deep Dive

A comprehensive technical guide to the AI system in Beeper Kanban - how context flows through drafts, autopilot, and AI chat, how providers are selected, and how agents work.

## Table of Contents

- [System Overview](#system-overview)
- [AI Provider Architecture](#ai-provider-architecture)
- [Context Management](#context-management)
- [Draft Generation Pipeline](#draft-generation-pipeline)
- [AI Chat Assistant Pipeline](#ai-chat-assistant-pipeline)
- [Autopilot Agent System](#autopilot-agent-system)
- [Context Flow Diagrams](#context-flow-diagrams)
- [Storage Layer](#storage-layer)
- [Provider Selection](#provider-selection)
- [Advanced Features](#advanced-features)

---

## System Overview

### The Three AI Systems

Beeper Kanban has three interconnected AI systems:

1. **Draft Generation**: One-off AI-powered reply suggestions
2. **AI Chat Assistant**: Conversational help per thread
3. **Autopilot Agents**: Autonomous conversation handlers

### Unified AI Backend

All three systems share:
- **Same provider infrastructure** (Anthropic, OpenAI, Ollama)
- **Same context sources** (tone settings, writing style, thread history)
- **Same API endpoints** (`/api/ai/draft`, `/api/ai/chat`)
- **Seamless provider switching** without code changes

```
┌─────────────────────────────────────────────────────────┐
│                     User Interface                       │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐  │
│  │  Draft   │    │ AI Chat  │    │    Autopilot     │  │
│  │Generator │    │Assistant │    │     Agents       │  │
│  └────┬─────┘    └────┬─────┘    └────────┬─────────┘  │
└───────┼───────────────┼───────────────────┼─────────────┘
        │               │                   │
        └───────────────┴───────────────────┘
                        │
        ┌───────────────┴────────────────┐
        │    Unified Context Builder      │
        │  - Tone Settings                │
        │  - Writing Style                │
        │  - Thread History               │
        │  - AI Chat Context              │
        └───────────────┬────────────────┘
                        │
        ┌───────────────┴────────────────┐
        │      Provider Router            │
        │  (Anthropic | OpenAI | Ollama) │
        └───────────────┬────────────────┘
                        │
        ┌───────────────┴────────────────┐
        │         AI Response             │
        └─────────────────────────────────┘
```

---

## AI Provider Architecture

### Provider Abstraction Layer

Located in: `app/api/ai/draft/route.ts` and `app/api/ai/chat/route.ts`

#### Design Philosophy

**Single API Endpoint, Multiple Providers**:
```typescript
POST /api/ai/draft
{
  "provider": "anthropic" | "openai" | "ollama",
  "originalMessage": "...",
  // Provider-specific options automatically handled
}
```

**No Client-Side Provider Logic**:
- Client doesn't know about provider details
- Provider selection happens server-side
- API keys handled securely via headers or body

### Provider Implementation

#### 1. Anthropic (Claude)

**File**: `app/api/ai/draft/route.ts:422-448`

```typescript
// Anthropic integration
const anthropic = new Anthropic({
  apiKey: anthropicKey,
});

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 300,
  system: systemPrompt,  // Full context here
  messages: [
    { role: 'user', content: userPrompt }
  ],
});
```

**Why Claude**:
- Excellent instruction following
- Great at matching writing styles
- Nuanced tone control
- Strong reasoning capabilities

**Models Used**:
- Drafts: `claude-sonnet-4-20250514` (balanced speed/quality)
- Chat: `claude-sonnet-4-20250514`
- Summaries: `claude-3-haiku` (fast, cheap)

#### 2. OpenAI (GPT)

**File**: `app/api/ai/draft/route.ts:392-420`

```typescript
// OpenAI integration
const openai = new OpenAI({
  apiKey: openaiKey,
});

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  max_tokens: 300,
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ],
});
```

**Why GPT**:
- Familiar to many users
- Good performance
- Wide model selection

**Models Used**:
- Drafts: `gpt-4o` (latest, best quality)
- Chat: `gpt-4o`
- Alternative: `gpt-3.5-turbo` (faster, cheaper)

#### 3. Ollama (Local)

**File**: `app/api/ai/draft/route.ts:358-390`, `lib/ollama.ts`

```typescript
// Ollama integration (local models)
const messages: OllamaMessage[] = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userPrompt },
];

suggestedReply = await ollamaChat(
  ollamaBaseUrl,  // Default: http://localhost:11434
  modelToUse,     // e.g., 'llama2', 'deepseek-v3'
  messages,
  300,           // max_tokens
  0.8           // temperature (higher for variety)
);
```

**Why Ollama**:
- Complete privacy (no data leaves machine)
- No API costs
- Works offline
- Customizable models

**Recommended Models**:
- `deepseek-v3`: Best quality, reasoning-capable
- `llama3`: Good balance
- `llama2`: Smaller, faster
- `mistral`: Compact, efficient

**Special Handling**:
Ollama models (especially reasoning models like DeepSeek) need output post-processing:

```typescript
// Extract final answer from reasoning output
const extractFinalAnswer = (text: string): string => {
  // Remove <think> tags
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // Extract quoted text
  const quotedMatches = text.match(/"([^"]+)"/g);
  if (quotedMatches) {
    return quotedMatches[0].replace(/^"|"$/g, '');
  }

  // Remove meta-commentary
  cleaned = cleaned.replace(/Sure,?\s+here'?s?\s+.*?version.*?:/gi, '');

  return cleaned.trim();
};
```

### Provider Selection Flow

```
User configures in Settings → API Keys
         ↓
Settings saved to LocalStorage
         ↓
Client makes API call with provider param
         ↓
API route reads provider from body/header
         ↓
Switch statement routes to correct SDK
         ↓
Same prompt sent to different backend
         ↓
Response normalized to common format
         ↓
Client receives uniform response
```

**Settings Storage** (`lib/storage.ts:116-139`):
```typescript
interface AppSettings {
  aiProvider?: 'anthropic' | 'openai' | 'ollama';
  anthropicApiKey?: string;
  openaiApiKey?: string;
  ollamaModel?: string;
  ollamaBaseUrl?: string;
}
```

**API Key Handling**:
```typescript
// Anthropic: Via header (more secure)
const anthropicKey = request.headers.get('x-anthropic-key');

// OpenAI: Via header or body
const openaiKey = request.headers.get('x-openai-key') || body.openaiApiKey;

// Ollama: No auth needed (local)
```

---

## Context Management

### Context Sources

The AI has access to multiple context sources that enrich responses:

```
1. Tone Settings (Global)
   ├─ Brief ↔ Detailed slider (0-100)
   └─ Formal ↔ Casual slider (0-100)

2. Writing Style Patterns (Per User)
   ├─ Sample messages
   ├─ Common phrases
   ├─ Frequent emojis
   ├─ Punctuation style
   └─ Capitalization style

3. Thread Context (Per Conversation)
   ├─ Message history
   ├─ Participant names
   └─ Timestamps

4. AI Chat Context (Per Thread)
   ├─ Previous AI conversations
   └─ User questions/feedback

5. Agent Configuration (Autopilot Only)
   ├─ System prompt
   ├─ Goal definition
   └─ Behavioral settings
```

### Context Building Process

**File**: `app/api/ai/draft/route.ts:88-290`

#### Step 1: Tone Instructions

```typescript
// From tone settings (briefDetailed: 0-100, formalCasual: 0-100)
let toneInstruction: string;

if (toneSettings) {
  const lengthDesc = briefDetailed < 30
    ? 'Keep responses very brief and to the point.'
    : briefDetailed < 70
      ? 'Use moderate length responses.'
      : 'Provide detailed, thorough responses.';

  const styleDesc = formalCasual < 30
    ? 'Use formal, professional language.'
    : formalCasual < 70
      ? 'Use a balanced, friendly tone.'
      : 'Use casual, relaxed language with informal expressions.';

  toneInstruction = `${lengthDesc} ${styleDesc}`;
}
```

#### Step 2: Writing Style Section

```typescript
// Build from analyzed patterns
let writingStyleSection = '';
if (writingStyle) {
  const styleDetails: string[] = [];

  // Sample messages - MOST IMPORTANT
  if (writingStyle.sampleMessages.length > 0) {
    styleDetails.push(
      `Here are examples of how this user actually writes:\n${
        writingStyle.sampleMessages
          .slice(0, 8)
          .map(m => `- "${m}"`)
          .join('\n')
      }`
    );
  }

  // Emojis
  if (writingStyle.frequentEmojis.length > 0) {
    styleDetails.push(
      `User frequently uses these emojis: ${writingStyle.frequentEmojis.join(' ')}`
    );
  }

  // Abbreviations, punctuation, etc.
  // ...

  writingStyleSection = `\n\n<user_writing_style>\n${styleDetails.join('\n\n')}\n</user_writing_style>`;
}
```

#### Step 3: Conversation Context

```typescript
// Thread history
let contextSection = '';
if (threadContext) {
  contextSection += `\n\nConversation history with ${senderName}:\n<conversation>\n${threadContext}\n</conversation>`;
}

// AI chat discussion
if (aiChatSummary) {
  contextSection += `\n\nRecent AI assistant discussion about this conversation:\n<ai_discussion>\n${aiChatSummary}\n</ai_discussion>`;
}
```

#### Step 4: Agent-Specific Context (Autopilot)

```typescript
// Agent's personality and goal
const baseSystemPrompt = agentSystemPrompt
  ? `You are an AI acting as a human in a conversation.\n\n${agentSystemPrompt}\n\n${toneInstruction}`
  : `You are helping draft message replies that sound exactly like the user wrote them. ${toneInstruction}`;

// Goal detection (if enabled)
const goalDetectionSection = detectGoalCompletion && agentGoal ? `
<goal_detection>
Your goal for this conversation: "${agentGoal}"

After generating your reply, analyze if this goal is achieved.
Include a goal analysis in this format at the END:

<goal_analysis>
{
  "isGoalAchieved": true/false,
  "confidence": 0-100,
  "reasoning": "brief explanation"
}
</goal_analysis>
</goal_detection>` : '';
```

#### Step 5: Human-Like Behavior Hints (Autopilot)

```typescript
// Conversation fatigue
const fatigueHint = messagesInConversation > 20
  ? `Note: This has been a longer conversation (${messagesInConversation} messages). Keep responses concise.`
  : '';

// Closing suggestion
const conversationClosingSection = suggestClosing ? `
<conversation_closing>
This conversation has been idle for a while. Consider naturally wrapping up.
</conversation_closing>` : '';
```

#### Final System Prompt

```typescript
const systemPrompt = `
${baseSystemPrompt}
${writingStyleSection}
${contextSection}
${languageInstruction}
${conversationClosingSection}
${fatigueHint}
${goalDetectionSection}

CRITICAL RULES:
1. Reply in the SAME LANGUAGE as the incoming message
2. Sound exactly like a real human - use the user's writing style
3. Match message length to the user's typical style
4. Don't introduce yourself as AI
5. Be conversational and authentic
`;
```

### Context Storage

**LocalStorage Keys** (`lib/storage.ts`):

```typescript
// Tone settings (global)
'beeper-kanban-tone-settings': ToneSettings

// Writing style (global)
'beeper-kanban-writing-style': WritingStylePatterns

// Thread context (per chat)
'beeper-kanban-thread-context': {
  [chatId]: ThreadContext
}

// AI chat history (per chat)
'beeper-kanban-ai-chat-history': {
  [chatId]: AiChatMessage[]
}
```

**Thread Context Structure**:
```typescript
interface ThreadContext {
  chatId: string;
  senderName: string;
  messages: ThreadContextMessage[];
  lastUpdated: string;
}

interface ThreadContextMessage {
  id: string;
  text: string;
  isFromMe: boolean;
  senderName: string;
  timestamp: string;
}
```

### Context Updates

**When Thread Context Updates**:
```typescript
// In message panel component
useEffect(() => {
  if (message && messageHistory) {
    const contextMessages: ThreadContextMessage[] = messageHistory.map(m => ({
      id: m.id,
      text: m.text,
      isFromMe: m.isFromMe,
      senderName: m.senderName,
      timestamp: m.timestamp,
    }));

    updateThreadContextWithNewMessages(
      message.chatId,
      message.senderName,
      contextMessages
    );
  }
}, [message, messageHistory]);
```

**Format for Prompt**:
```typescript
export function formatThreadContextForPrompt(context: ThreadContext | null): string {
  if (!context || context.messages.length === 0) return '';

  return context.messages
    .map(m => `${m.isFromMe ? 'Me' : m.senderName}: ${m.text}`)
    .join('\n');
}

// Example output:
// John: Hey, are you free tomorrow?
// Me: Yes, I'm available after 2pm
// John: Perfect! Let's meet at the cafe
```

---

## Draft Generation Pipeline

### Flow Diagram

```
User Action (Drag to Drafts / Click Generate)
         ↓
Client creates optimistic draft
         ↓
POST /api/ai/draft
{
  originalMessage: "...",
  senderName: "...",
  toneSettings: {...},
  writingStyle: {...},
  threadContext: "...",
  aiChatSummary: "...",
  provider: "anthropic"
}
         ↓
Server builds system prompt
  ├─ Load tone settings
  ├─ Load writing style
  ├─ Format thread context
  └─ Add language instructions
         ↓
Send to AI provider
         ↓
AI generates response
         ↓
Parse & clean response
         ↓
Extract goal analysis (if autopilot)
         ↓
Split into multi-message (if needed)
         ↓
Return to client
{
  data: {
    suggestedReply: "...",
    suggestedMessages?: ["...", "..."],
    goalAnalysis?: {...}
  }
}
         ↓
Client updates draft with real text
         ↓
User reviews and sends
```

### Implementation Details

**Client Side** (`app/page.tsx:227-284`):

```typescript
const handleMoveToColumn = async (card, fromColumn, toColumn) => {
  if (fromColumn === 'unread' && toColumn === 'drafts') {
    const message = card.message;

    // 1. Create optimistic draft immediately
    const optimisticDraft = createDraft(
      message,
      'Generating response...',  // Placeholder
      avatarUrl,
      isGroup
    );

    const toastId = toast.loading('Generating draft...');

    try {
      // 2. Call API
      const response = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-anthropic-key': settings.anthropicApiKey,
        },
        body: JSON.stringify({
          originalMessage: message.text,
          senderName: message.senderName,
          toneSettings: loadToneSettings(),
          writingStyle: loadWritingStylePatterns(),
          provider: settings.aiProvider || 'anthropic',
          ollamaModel: settings.ollamaModel,
          ollamaBaseUrl: settings.ollamaBaseUrl,
        }),
      });

      const result = await response.json();

      // 3. Update draft with AI text
      if (result.data?.suggestedReply) {
        updateDraft(optimisticDraft.id, {
          draftText: result.data.suggestedReply
        });
        toast.success('Draft created', { id: toastId });
      }
    } catch (error) {
      // Keep draft but show error
      updateDraft(optimisticDraft.id, { draftText: '' });
      toast.error('Failed to generate draft', { id: toastId });
    }
  }
};
```

**Server Side** (`app/api/ai/draft/route.ts`):

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    originalMessage,
    senderName,
    toneSettings,
    writingStyle,
    threadContext,
    aiChatSummary,
    provider = 'anthropic',
    agentSystemPrompt,  // If called by autopilot
    agentGoal,          // If autopilot
    detectGoalCompletion = false,
  } = body;

  // Build context
  const systemPrompt = buildSystemPrompt({
    toneSettings,
    writingStyle,
    threadContext,
    aiChatSummary,
    agentSystemPrompt,
    agentGoal,
  });

  const userPrompt = `Message from ${senderName}:\n"${originalMessage}"\n\nSuggest a reply:`;

  // Route to provider
  let suggestedReply: string;
  if (provider === 'anthropic') {
    suggestedReply = await callAnthropic(systemPrompt, userPrompt);
  } else if (provider === 'openai') {
    suggestedReply = await callOpenAI(systemPrompt, userPrompt);
  } else {
    suggestedReply = await callOllama(systemPrompt, userPrompt);
  }

  // Parse response
  let finalReply = suggestedReply.trim();
  let goalAnalysis = extractGoalAnalysis(suggestedReply);

  // Multi-message split (if needed)
  let suggestedMessages = splitIntoMessages(finalReply, writingStyle);

  return NextResponse.json({
    data: {
      suggestedReply: finalReply,
      suggestedMessages,
      goalAnalysis,
    }
  });
}
```

### Special Features

#### Emoji-Only Responses

For quick acknowledgments:

```typescript
if (emojiOnlyResponse) {
  const userEmojis = writingStyle?.frequentEmojis || [];
  const fallbackEmojis = ['👍', '😊', '🙌'];
  const emojiPool = userEmojis.length > 0 ? userEmojis : fallbackEmojis;
  const selectedEmoji = emojiPool[Math.floor(Math.random() * emojiPool.length)];

  return NextResponse.json({
    data: { suggestedReply: selectedEmoji, isEmojiOnly: true }
  });
}
```

#### Multi-Message Splitting

Based on user's typical message length:

```typescript
if (writingStyle?.avgWordsPerMessage) {
  const wordCount = finalReply.split(/\s+/).length;
  const avgWords = writingStyle.avgWordsPerMessage;

  if (wordCount > avgWords * 2) {
    // Split into 2-3 messages
    const sentences = finalReply.match(/[^.!?]+[.!?]+/g) || [finalReply];
    const messageCount = Math.min(3, Math.ceil(sentences.length / 2));

    suggestedMessages = [];
    for (let i = 0; i < sentences.length; i += sentencesPerMessage) {
      const messageSentences = sentences.slice(i, i + sentencesPerMessage);
      suggestedMessages.push(messageSentences.join(' ').trim());
    }
  }
}
```

#### Language Detection & Matching

```typescript
const languageInstruction = `
LANGUAGE: Reply in the SAME LANGUAGE as the incoming message.
If the message is in German, reply in German.
If in English, reply in English.
Do not switch or translate.
`;
```

---

## AI Chat Assistant Pipeline

### Purpose

The AI Chat Assistant is a **per-thread conversational helper** that:
- Answers questions about the conversation
- Helps brainstorm replies
- Provides multiple draft options
- Offers tactical advice

### Flow Diagram

```
User clicks message card
         ↓
Message panel opens
         ↓
User clicks AI chat icon (💬)
         ↓
AI chat panel slides out
         ↓
Load chat history for this thread
         ↓
User types question: "How should I respond?"
         ↓
POST /api/ai/chat
{
  messageContext: "...",  // Current conversation
  senderName: "...",
  chatHistory: [{role, content}, ...],  // AI chat history
  userMessage: "How should I respond?",
  provider: "anthropic"
}
         ↓
Server builds system prompt
  ├─ Include conversation context
  ├─ Add assistant instructions
  └─ Maintain chat history
         ↓
Send to AI provider
         ↓
AI responds with advice/drafts
         ↓
Parse <draft> tags if present
         ↓
Return response
{
  data: { response: "..." }
}
         ↓
Display in chat panel
         ↓
User can click "Use Draft" if provided
         ↓
Draft text inserted into message input
```

### Implementation

**Client Side** (`components/ai-chat-panel.tsx`):

```typescript
const handleSubmit = async (userMessage: string) => {
  // Add user message to UI
  const newMessages = [
    ...messages,
    { id: generateId(), role: 'user', content: userMessage }
  ];
  setMessages(newMessages);

  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anthropic-key': settings.anthropicApiKey,
      },
      body: JSON.stringify({
        messageContext: threadContext,  // Full conversation
        senderName,
        chatHistory: messages,  // AI chat history
        userMessage,
        provider: settings.aiProvider,
      }),
    });

    const result = await response.json();

    // Add AI response
    const updatedMessages = [
      ...newMessages,
      {
        id: generateId(),
        role: 'assistant',
        content: result.data.response
      }
    ];

    setMessages(updatedMessages);

    // Save to storage (persists per thread)
    saveAiChatForThread(chatId, updatedMessages);
  } catch (error) {
    toast.error('Failed to get AI response');
  }
};
```

**Server Side** (`app/api/ai/chat/route.ts:23-196`):

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    messageContext,      // Conversation with the other person
    senderName,
    chatHistory,        // AI chat history
    userMessage,
    provider = 'anthropic',
  } = body;

  // System prompt with conversation context
  const systemPrompt = `You are a helpful assistant helping the user manage their messages and draft replies.

You have access to the following conversation context from a chat with ${senderName}:

<conversation_context>
${messageContext}
</conversation_context>

You can help the user by:
- Drafting reply messages
- Summarizing the conversation
- Suggesting talking points
- Brainstorming ideas related to the conversation
- Answering questions about the conversation content

When drafting replies:
- Keep them concise and natural
- Match the tone of typical chat messages
- Don't be overly formal unless requested
- When providing draft options, wrap EACH draft in <draft> tags like this:
  <draft>Your draft message here</draft>

Be helpful, concise, and friendly in your responses.`;

  // Build messages array with chat history
  let responseText: string;

  if (provider === 'anthropic') {
    const messages: Anthropic.MessageParam[] = chatHistory.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    responseText = response.content.find(block => block.type === 'text')?.text || '';
  }

  // ... similar for OpenAI and Ollama

  return NextResponse.json({
    data: { response: responseText.trim() }
  });
}
```

### Draft Extraction

**Client extracts `<draft>` tags**:

```typescript
const extractDrafts = (text: string): string[] => {
  const draftRegex = /<draft>(.*?)<\/draft>/gs;
  const matches = text.matchAll(draftRegex);
  return Array.from(matches).map(match => match[1].trim());
};

// In AI chat panel:
const drafts = extractDrafts(aiResponse);
if (drafts.length > 0) {
  // Show "Use Draft" buttons
  drafts.forEach(draft => {
    <Button onClick={() => onUseDraft(draft)}>
      Use Draft
    </Button>
  });
}
```

### Persistence

**Per-Thread Storage** (`lib/storage.ts:569-619`):

```typescript
// Save AI chat history for a specific thread
export function saveAiChatForThread(chatId: string, messages: AiChatMessage[]): void {
  const history = loadAiChatHistory();
  history[chatId] = messages;  // Keyed by chatId
  saveAiChatHistory(history);
}

// Load when opening message panel
const messages = getAiChatForThread(chatId);
```

**Storage Structure**:
```json
{
  "beeper-kanban-ai-chat-history": {
    "chat-123": [
      { "id": "msg-1", "role": "user", "content": "How should I respond?" },
      { "id": "msg-2", "role": "assistant", "content": "Here are some options..." }
    ],
    "chat-456": [
      { "id": "msg-3", "role": "user", "content": "What's the tone here?" },
      { "id": "msg-4", "role": "assistant", "content": "The tone is casual..." }
    ]
  }
}
```

---

## Autopilot Agent System

### Architecture Overview

```
AutopilotProvider (Context)
         │
         ├─ Wraps entire app
         ├─ Monitors new messages
         └─ Coordinates engine & scheduler
         │
         ├─────────────────────┬─────────────────────┐
         │                     │                     │
  AutopilotEngine       AutopilotScheduler   Activity Log
  (Message Handler)     (Action Executor)    (Persistence)
         │                     │                     │
         ├─ Process messages   ├─ Execute actions   ├─ Track events
         ├─ Generate drafts    ├─ Timing control    ├─ Goal detection
         ├─ Check goals        ├─ Read receipts     └─ Handoff summaries
         └─ Apply behaviors    └─ Typing indicators
```

### Agent Definition

**Storage**: `lib/storage.ts:807-858`

```typescript
interface AutopilotAgent {
  id: string;
  name: string;
  description: string;
  goal: string;                    // e.g., "Schedule a meeting"
  systemPrompt: string;            // Personality and instructions
  behavior: AgentBehaviorSettings; // Human-like settings
  goalCompletionBehavior: 'auto-disable' | 'maintenance' | 'handoff';
  createdAt: string;
  updatedAt: string;
}

interface AgentBehaviorSettings {
  // Reply delays
  replyDelayMin: number;           // e.g., 60 seconds
  replyDelayMax: number;           // e.g., 300 seconds
  replyDelayContextAware: boolean; // Faster in active convos

  // Activity hours
  activityHoursEnabled: boolean;
  activityHoursStart: number;      // e.g., 9 (9 AM)
  activityHoursEnd: number;        // e.g., 22 (10 PM)
  activityHoursTimezone: string;

  // Typing simulation
  typingIndicatorEnabled: boolean;
  typingSpeedWpm: number;          // e.g., 40

  // Read receipts
  readReceiptEnabled: boolean;
  readReceiptDelayMin: number;
  readReceiptDelayMax: number;

  // Multi-message
  multiMessageEnabled: boolean;
  multiMessageDelayMin: number;
  multiMessageDelayMax: number;

  // Response rate (simulate being busy)
  responseRate: number;            // 0-100

  // Emoji-only responses
  emojiOnlyResponseEnabled: boolean;
  emojiOnlyResponseChance: number; // 0-100

  // Conversation fatigue
  conversationFatigueEnabled: boolean;
  fatigueTriggerMessages: number;
  fatigueResponseReduction: number;

  // Natural closing
  conversationClosingEnabled: boolean;
  closingTriggerIdleMinutes: number;
}
```

### Per-Chat Configuration

**Storage**: `lib/storage.ts:862-903`

```typescript
interface ChatAutopilotConfig {
  chatId: string;
  enabled: boolean;
  agentId: string;                 // Which agent is handling this
  mode: 'manual-approval' | 'self-driving';
  status: 'inactive' | 'active' | 'paused' | 'goal-completed' | 'error';

  // Self-driving time limit
  selfDrivingDurationMinutes?: number;
  selfDrivingStartedAt?: string;
  selfDrivingExpiresAt?: string;

  // Goal override
  goalCompletionBehaviorOverride?: GoalCompletionBehavior;

  // Tracking
  messagesHandled: number;
  lastActivityAt?: string;
  errorCount: number;
  lastError?: string;

  createdAt: string;
  updatedAt: string;
}
```

### Message Processing Flow

**Entry Point** (`contexts/autopilot-context.tsx:72-100`):

```typescript
// In AutopilotProvider
const processNewMessages = useCallback((messages: BeeperMessage[]) => {
  // Filter to only new, unread messages not from us
  const newMessages = messages.filter(m => {
    if (m.isFromMe) return false;
    if (m.isRead) return false;
    if (processedMessageIds.current.has(m.id)) return false;
    return true;
  });

  // Process each new message
  for (const message of newMessages) {
    processedMessageIds.current.add(message.id);
    engine.handleIncomingMessage(message);
  }
}, [engine]);
```

**Engine Processing** (`hooks/use-autopilot-engine.ts:100-400`):

```typescript
const handleIncomingMessage = async (message: BeeperMessage) => {
  const { chatId, id: messageId, text, senderName } = message;

  // 1. Check if autopilot is enabled
  const config = getChatAutopilotConfig(chatId);
  if (!config || !config.enabled || config.status !== 'active') {
    return; // Skip
  }

  // 2. Check if self-driving has expired
  if (config.mode === 'self-driving' && config.selfDrivingExpiresAt) {
    if (new Date() > new Date(config.selfDrivingExpiresAt)) {
      // Expired - disable autopilot
      saveChatAutopilotConfig({
        ...config,
        enabled: false,
        status: 'inactive',
      });
      return;
    }
  }

  // 3. Get the agent
  const agent = getAutopilotAgentById(config.agentId);
  if (!agent) {
    onError?.(chatId, 'Agent not found');
    return;
  }

  // 4. Check activity hours
  const withinHours = isWithinActivityHours(agent.behavior);
  if (!withinHours) {
    return; // Outside activity hours
  }

  // 5. Log received message
  addAutopilotActivityEntry({
    id: generateId(),
    chatId,
    agentId: agent.id,
    type: 'message-received',
    timestamp: new Date().toISOString(),
    messageText: text,
  });

  // 6. Calculate effective response rate (with fatigue)
  let effectiveResponseRate = agent.behavior.responseRate ?? 100;

  if (agent.behavior.conversationFatigueEnabled) {
    const fatigueMessages = agent.behavior.fatigueTriggerMessages ?? 15;
    const fatigueReduction = agent.behavior.fatigueResponseReduction ?? 5;

    if (config.messagesHandled >= fatigueMessages) {
      const extraMessages = config.messagesHandled - fatigueMessages;
      const reduction = Math.min(extraMessages * fatigueReduction, 50);
      effectiveResponseRate = Math.max(30, effectiveResponseRate - reduction);
    }
  }

  // 7. Response rate lottery
  const shouldRespond = Math.random() * 100 < effectiveResponseRate;
  if (!shouldRespond) {
    addAutopilotActivityEntry({
      id: generateId(),
      chatId,
      agentId: agent.id,
      type: 'skipped-busy',
      timestamp: new Date().toISOString(),
    });
    return; // Skip this message
  }

  // 8. Check for emoji-only response
  const shouldSendEmojiOnly =
    agent.behavior.emojiOnlyResponseEnabled &&
    Math.random() * 100 < (agent.behavior.emojiOnlyResponseChance ?? 0);

  // 9. Generate draft using AI
  const draft = await generateDraftWithAgent(message, agent, {
    emojiOnlyResponse: shouldSendEmojiOnly,
    messagesInConversation: config.messagesHandled,
  });

  // 10. Log draft generated
  addAutopilotActivityEntry({
    id: generateId(),
    chatId,
    agentId: agent.id,
    type: 'draft-generated',
    timestamp: new Date().toISOString(),
    draftText: draft.text,
  });

  // 11. Check goal completion
  if (draft.goalAnalysis?.isGoalAchieved) {
    await handleGoalCompletion(chatId, agent, config, draft.goalAnalysis);
    return;
  }

  // 12. Schedule or show draft based on mode
  if (config.mode === 'self-driving') {
    // Calculate delay
    const delay = calculateReplyDelay(agent.behavior, config);
    const scheduledFor = new Date(Date.now() + delay * 1000);

    // Schedule send action
    scheduler.scheduleAction({
      id: generateId(),
      chatId,
      agentId: agent.id,
      type: 'send-message',
      scheduledFor: scheduledFor.toISOString(),
      messageText: draft.text,
      status: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString(),
    });

    onMessageScheduled?.(chatId, scheduledFor);
  } else {
    // Manual approval - create draft in UI
    createDraft(message, draft.text);
  }
};
```

### Draft Generation with Agent Context

```typescript
const generateDraftWithAgent = async (
  message: BeeperMessage,
  agent: AutopilotAgent,
  options: {
    emojiOnlyResponse?: boolean;
    messagesInConversation?: number;
  }
) => {
  const settings = loadSettings();
  const toneSettings = loadToneSettings();
  const writingStyle = loadWritingStylePatterns();
  const threadContext = getThreadContext(message.chatId);

  const response = await fetch('/api/ai/draft', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-anthropic-key': settings.anthropicApiKey,
    },
    body: JSON.stringify({
      originalMessage: message.text,
      senderName: message.senderName,
      toneSettings,
      writingStyle,
      threadContext: formatThreadContextForPrompt(threadContext),
      provider: settings.aiProvider,

      // Agent-specific
      agentSystemPrompt: agent.systemPrompt,
      agentGoal: agent.goal,
      detectGoalCompletion: true,

      // Human-like behaviors
      emojiOnlyResponse: options.emojiOnlyResponse,
      messagesInConversation: options.messagesInConversation,
    }),
  });

  const result = await response.json();
  return {
    text: result.data.suggestedReply,
    goalAnalysis: result.data.goalAnalysis,
  };
};
```

### Action Scheduling & Execution

**Scheduler** (`hooks/use-autopilot-scheduler.ts`):

```typescript
export function useAutopilotScheduler(options: UseAutopilotSchedulerOptions) {
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start scheduler (runs every second)
  const start = useCallback(() => {
    if (intervalRef.current) return; // Already running

    intervalRef.current = setInterval(async () => {
      const action = getNextPendingAction();
      if (!action) return;

      // Check if action is due
      const now = new Date();
      const scheduledFor = new Date(action.scheduledFor);
      if (now < scheduledFor) return; // Not yet

      // Mark as executing
      updateScheduledAction(action.id, { status: 'executing' });

      try {
        // Execute the action
        if (action.type === 'send-message') {
          await sendMessage(action.chatId, action.messageText);
        } else if (action.type === 'send-read-receipt') {
          await markAsRead(action.chatId);
        } else if (action.type === 'typing-indicator') {
          // Show typing indicator (Beeper API support needed)
        }

        // Mark as completed
        updateScheduledAction(action.id, { status: 'completed' });
        options.onActionComplete?.(action);
      } catch (error) {
        // Mark as failed
        updateScheduledAction(action.id, {
          status: 'failed',
          lastError: error.message,
          attempts: action.attempts + 1,
        });
        options.onActionError?.(action, error);
      }
    }, 1000); // Check every second

    setIsRunning(true);
  }, [options]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  }, []);

  return { start, stop, isRunning, scheduleAction, cancelChat };
}
```

### Goal Completion & Handoff

```typescript
const handleGoalCompletion = async (
  chatId: string,
  agent: AutopilotAgent,
  config: ChatAutopilotConfig,
  goalAnalysis: GoalAnalysis
) => {
  // Log goal detection
  addAutopilotActivityEntry({
    id: generateId(),
    chatId,
    agentId: agent.id,
    type: 'goal-detected',
    timestamp: new Date().toISOString(),
    metadata: { goalAnalysis },
  });

  // Determine completion behavior
  const behavior = config.goalCompletionBehaviorOverride || agent.goalCompletionBehavior;

  if (behavior === 'auto-disable') {
    // Stop autopilot
    saveChatAutopilotConfig({
      ...config,
      enabled: false,
      status: 'goal-completed',
    });
  } else if (behavior === 'maintenance') {
    // Reduce activity
    saveChatAutopilotConfig({
      ...config,
      status: 'goal-completed',
      // Agent continues but less active
    });
  } else if (behavior === 'handoff') {
    // Generate summary
    const summary = await generateConversationSummary(chatId, agent);

    saveHandoffSummary(summary);

    // Pause until user reviews
    saveChatAutopilotConfig({
      ...config,
      status: 'paused',
    });

    // Trigger handoff notification
    addAutopilotActivityEntry({
      id: generateId(),
      chatId,
      agentId: agent.id,
      type: 'handoff-triggered',
      timestamp: new Date().toISOString(),
    });

    onGoalCompleted?.(chatId, summary);
  }
};
```

---

## Context Flow Diagrams

### Draft Generation Context Flow

```
┌─────────────────────────────────────────────────────┐
│              User Interaction                        │
│  (Drag message to Drafts / Click Generate)         │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│         Context Assembly (Client)                    │
│  ┌─────────────────────────────────────────────┐   │
│  │ 1. Load Tone Settings (LocalStorage)        │   │
│  │    - briefDetailed: 50                       │   │
│  │    - formalCasual: 70                        │   │
│  ├─────────────────────────────────────────────┤   │
│  │ 2. Load Writing Style (LocalStorage)        │   │
│  │    - sampleMessages: [...]                   │   │
│  │    - frequentEmojis: ["😊", "👍"]           │   │
│  ├─────────────────────────────────────────────┤   │
│  │ 3. Get Thread Context (LocalStorage)        │   │
│  │    - formatThreadContextForPrompt()          │   │
│  ├─────────────────────────────────────────────┤   │
│  │ 4. Get AI Chat Summary (if used AI chat)    │   │
│  │    - formatAiChatSummaryForPrompt()          │   │
│  └─────────────────────────────────────────────┘   │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│         API Request (POST /api/ai/draft)             │
│  {                                                   │
│    originalMessage: "Can we meet tomorrow?",        │
│    senderName: "John",                              │
│    toneSettings: { briefDetailed: 50, ... },        │
│    writingStyle: { sampleMessages: [...], ... },   │
│    threadContext: "John: Are you free?\nMe: Yes",  │
│    aiChatSummary: "User asked about tone",         │
│    provider: "anthropic"                            │
│  }                                                   │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│      System Prompt Construction (Server)             │
│  ┌─────────────────────────────────────────────┐   │
│  │ Base Prompt                                  │   │
│  │ "You are helping draft replies..."          │   │
│  ├─────────────────────────────────────────────┤   │
│  │ + Tone Instructions                          │   │
│  │ "Use moderate length. Use casual language." │   │
│  ├─────────────────────────────────────────────┤   │
│  │ + Writing Style Section                      │   │
│  │ "<user_writing_style>                        │   │
│  │  Examples: [sample messages]                 │   │
│  │  Emojis: 😊 👍                              │   │
│  │  Style: lowercase, brief                     │   │
│  │ </user_writing_style>"                       │   │
│  ├─────────────────────────────────────────────┤   │
│  │ + Thread Context                             │   │
│  │ "<conversation>                              │   │
│  │  John: Are you free?                         │   │
│  │  Me: Yes                                     │   │
│  │ </conversation>"                             │   │
│  ├─────────────────────────────────────────────┤   │
│  │ + AI Chat Context                            │   │
│  │ "<ai_discussion>                             │   │
│  │  User asked about tone                       │   │
│  │ </ai_discussion>"                            │   │
│  ├─────────────────────────────────────────────┤   │
│  │ + Language Instruction                       │   │
│  │ "Reply in SAME LANGUAGE as message"          │   │
│  └─────────────────────────────────────────────┘   │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│         AI Provider Call                             │
│                                                      │
│  Anthropic.messages.create({                        │
│    model: "claude-sonnet-4-20250514",               │
│    system: [full system prompt],                    │
│    messages: [{                                     │
│      role: "user",                                  │
│      content: "Message: 'Can we meet tomorrow?'     │
│                Suggest a reply:"                    │
│    }]                                               │
│  })                                                  │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│         AI Response                                  │
│  "yeah tomorrow works! what time?"                  │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│         Post-Processing (Server)                     │
│  - Clean up response                                │
│  - Extract goal analysis (if autopilot)             │
│  - Split into multi-message (if needed)             │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│         Return to Client                             │
│  {                                                   │
│    data: {                                           │
│      suggestedReply: "yeah tomorrow works! ...",    │
│      suggestedMessages: ["yeah tomorrow works!",    │
│                           "what time?"]              │
│    }                                                 │
│  }                                                   │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│         Update Draft (Client)                        │
│  - Replace "Generating..." with AI text             │
│  - Save to LocalStorage                             │
│  - Display in Drafts column                         │
└─────────────────────────────────────────────────────┘
```

### Autopilot Agent Context Flow

```
┌─────────────────────────────────────────────────────┐
│         New Message Arrives                          │
│  BeeperMessage { chatId, text, senderName, ... }    │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│      AutopilotProvider.processNewMessages()          │
│  - Filter to new, unread, not from me               │
│  - Check if already processed                        │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│      AutopilotEngine.handleIncomingMessage()         │
│                                                      │
│  1. Load ChatAutopilotConfig                        │
│     - Is autopilot enabled?                          │
│     - Which agent?                                   │
│     - What mode?                                     │
│                                                      │
│  2. Load AutopilotAgent                             │
│     - System prompt                                  │
│     - Goal                                           │
│     - Behavior settings                              │
│                                                      │
│  3. Check Activity Hours                             │
│     - Current time within agent's hours?             │
│                                                      │
│  4. Calculate Response Rate (with fatigue)           │
│     - Base: agent.behavior.responseRate              │
│     - Apply fatigue reduction                        │
│     - Lottery: should respond?                       │
│                                                      │
│  5. Determine Response Type                          │
│     - Emoji-only? (random chance)                    │
│     - Full message                                   │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│      Context Assembly (Same as Draft)                │
│  + Agent System Prompt                              │
│  + Agent Goal                                        │
│  + Goal Detection Instructions                       │
│  + Behavior Hints (fatigue, closing, etc.)          │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│         API Call (POST /api/ai/draft)                │
│  All standard context +                             │
│  {                                                   │
│    agentSystemPrompt: "You are a professional...",  │
│    agentGoal: "Schedule a meeting",                 │
│    detectGoalCompletion: true,                      │
│    emojiOnlyResponse: false,                        │
│    messagesInConversation: 5                        │
│  }                                                   │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│      Enhanced System Prompt (Server)                 │
│  "You are an AI acting as a human.                  │
│                                                      │
│  [Agent's system prompt]                            │
│                                                      │
│  [Standard tone/style/context]                      │
│                                                      │
│  <goal_detection>                                    │
│  Your goal: 'Schedule a meeting'                    │
│  After reply, add goal analysis:                    │
│  <goal_analysis>                                     │
│  { isGoalAchieved: true/false, ... }                │
│  </goal_analysis>                                    │
│  </goal_detection>                                   │
│                                                      │
│  CRITICAL RULES:                                     │
│  1. Reply in SAME LANGUAGE                          │
│  2. Sound exactly like a human                      │
│  3. Work towards your goal naturally                │
│  4. Don't be pushy or obvious                       │
│  ..."                                                │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│         AI Response with Goal Analysis               │
│  "Sure! I'm free tomorrow afternoon. How about 2pm? │
│                                                      │
│  <goal_analysis>                                     │
│  {                                                   │
│    "isGoalAchieved": true,                          │
│    "confidence": 90,                                │
│    "reasoning": "Date and time proposed and         │
│                  likely to be confirmed"            │
│  }                                                   │
│  </goal_analysis>"                                   │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│      Parse Response (Server)                         │
│  - Extract reply text                               │
│  - Extract goal analysis (if present)               │
│  - Split into multi-message                         │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│      Handle Goal Completion (Engine)                 │
│  If goalAnalysis.isGoalAchieved:                    │
│    - Log goal detection                             │
│    - Check goalCompletionBehavior                   │
│    - Auto-disable / Maintenance / Handoff           │
│    - Generate summary (if handoff)                  │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│      Mode-Based Action (Engine)                      │
│                                                      │
│  If Manual Approval:                                │
│    - createDraft()                                  │
│    - Draft appears in Drafts column                 │
│    - User reviews and approves                      │
│                                                      │
│  If Self-Driving:                                   │
│    - Calculate delay (based on behavior)            │
│    - Schedule send action                           │
│    - scheduleAction({                               │
│        type: 'send-message',                        │
│        scheduledFor: now + delay,                   │
│        messageText: reply                           │
│      })                                             │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│      Scheduler Execution                             │
│  (Runs every 1 second)                              │
│                                                      │
│  1. getNextPendingAction()                          │
│  2. Check if scheduledFor time has passed           │
│  3. Execute action:                                 │
│     - Send message via Beeper API                   │
│     - Mark action as completed                      │
│  4. Log activity                                    │
│  5. Increment messagesHandled                       │
└─────────────────────────────────────────────────────┘
```

---

## Storage Layer

### Storage Architecture

**All data stored in browser LocalStorage**:
```
window.localStorage
  ├─ beeper-kanban-settings            (App settings)
  ├─ beeper-kanban-tone-settings       (Tone sliders)
  ├─ beeper-kanban-writing-style       (Writing patterns)
  ├─ beeper-kanban-thread-context      (Per-chat history)
  ├─ beeper-kanban-ai-chat-history     (Per-chat AI conversations)
  ├─ beeper-kanban-drafts              (Draft messages)
  ├─ beeper-kanban-autopilot-agents    (Agent definitions)
  ├─ beeper-kanban-autopilot-chat-configs (Per-chat autopilot config)
  ├─ beeper-kanban-autopilot-activity  (Activity log)
  ├─ beeper-kanban-autopilot-scheduled (Scheduled actions)
  └─ beeper-kanban-autopilot-handoffs  (Handoff summaries)
```

### Key-Value Patterns

**Storage Module** (`lib/storage.ts`):

```typescript
// Simple getter/setter pattern
export function loadToneSettings(): ToneSettings {
  if (typeof window === 'undefined') return DEFAULT_TONE_SETTINGS;

  const stored = localStorage.getItem(TONE_SETTINGS_KEY);
  return stored ? JSON.parse(stored) : DEFAULT_TONE_SETTINGS;
}

export function saveToneSettings(settings: ToneSettings): void {
  localStorage.setItem(TONE_SETTINGS_KEY, JSON.stringify(settings));
}

// Dictionary pattern (keyed by chatId)
export function getThreadContext(chatId: string): ThreadContext | null {
  const store = loadThreadContextStore();
  return store[chatId] || null;
}

export function saveThreadContext(chatId: string, context: ThreadContext): void {
  const store = loadThreadContextStore();
  store[chatId] = context;
  saveThreadContextStore(store);
}
```

### Storage Limits

**LocalStorage Quota**: ~5-10MB per origin

**Optimization Strategies**:
1. **Activity Log Pruning**: Keep only last 500 entries
2. **Thread Context**: Store all messages (no limit - user controls via load more)
3. **AI Chat History**: No limit (per thread)
4. **Scheduled Actions Cleanup**: Remove completed actions after 24 hours

```typescript
// Example: Activity log pruning
const MAX_ACTIVITY_ENTRIES = 500;

export function addAutopilotActivityEntry(entry: AutopilotActivityEntry): void {
  const entries = loadAutopilotActivity();
  entries.push(entry);

  // Prune if over limit
  const pruned = entries.length > MAX_ACTIVITY_ENTRIES
    ? entries.slice(-MAX_ACTIVITY_ENTRIES)
    : entries;

  saveAutopilotActivity(pruned);
}
```

### Data Export/Import

**Export All Data**:
```typescript
// Settings → Data → Export All Data
const exportData = () => {
  const data = {
    settings: loadSettings(),
    drafts: loadDrafts(),
    toneSettings: loadToneSettings(),
    writingStyle: loadWritingStylePatterns(),
    autopilotAgents: loadAutopilotAgents(),
    // ... all other data
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  });

  downloadBlob(blob, `beeper-kanban-export-${Date.now()}.json`);
};
```

**Import Data**:
```typescript
const importData = (file: File) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = JSON.parse(e.target.result);

    saveSettings(data.settings);
    saveDrafts(data.drafts);
    saveToneSettings(data.toneSettings);
    // ... restore all data

    toast.success('Data imported successfully');
    window.location.reload();
  };
  reader.readAsText(file);
};
```

---

## Provider Selection

### Seamless Switching

**Key Design**: Provider is just a parameter, not a code path change.

**Settings UI** (`app/settings/api-keys/page.tsx`):

```typescript
<Select value={settings.aiProvider} onChange={handleProviderChange}>
  <option value="anthropic">Anthropic (Claude)</option>
  <option value="openai">OpenAI (GPT)</option>
  <option value="ollama">Ollama (Local)</option>
</Select>

{settings.aiProvider === 'anthropic' && (
  <Input
    placeholder="Anthropic API Key"
    value={settings.anthropicApiKey}
    onChange={e => updateSettings({ anthropicApiKey: e.target.value })}
  />
)}

{settings.aiProvider === 'openai' && (
  <Input
    placeholder="OpenAI API Key"
    value={settings.openaiApiKey}
    onChange={e => updateSettings({ openaiApiKey: e.target.value })}
  />
)}

{settings.aiProvider === 'ollama' && (
  <>
    <Input
      placeholder="Base URL (default: http://localhost:11434)"
      value={settings.ollamaBaseUrl}
    />
    <Select value={settings.ollamaModel} onChange={handleModelChange}>
      <option value="llama2">Llama 2</option>
      <option value="llama3">Llama 3</option>
      <option value="deepseek-v3">DeepSeek V3</option>
      <option value="mistral">Mistral</option>
    </Select>
  </>
)}
```

**Client Code** (no provider awareness):

```typescript
// Draft generation - same code for all providers
const response = await fetch('/api/ai/draft', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-anthropic-key': settings.anthropicApiKey,  // Optional
    'x-openai-key': settings.openaiApiKey,        // Optional
  },
  body: JSON.stringify({
    originalMessage: message.text,
    provider: settings.aiProvider,  // Just a string!
    ollamaModel: settings.ollamaModel,
    ollamaBaseUrl: settings.ollamaBaseUrl,
    // ... rest of context
  }),
});
```

**Server Router** (`app/api/ai/draft/route.ts:358-448`):

```typescript
// Single switch statement
if (provider === 'ollama') {
  suggestedReply = await ollamaChat(baseUrl, model, messages);
} else if (provider === 'openai') {
  suggestedReply = await openAI.chat.completions.create(...);
} else {
  suggestedReply = await anthropic.messages.create(...);
}
```

### Provider-Specific Optimizations

**Ollama Special Handling**:

1. **Model Fallback**: If requested model unavailable, use first available
2. **Output Cleaning**: Remove reasoning tags from DeepSeek
3. **Higher Temperature**: 0.8 vs 0.7 for more natural variety
4. **Explicit Examples**: More few-shot examples in prompt

```typescript
// Ollama-specific prompt enhancements
if (provider === 'ollama' && writingStyle) {
  // Add few-shot examples for Ollama
  const examples = [
    `Generic: "That sounds great!"`,
    `This user: "${writingStyle.sampleMessages[0]}"`
  ];
  fewShotExamples = `\n\n<style_examples>\n${examples.join('\n')}\n</style_examples>`;
}
```

**Anthropic Optimization**:
- Use `system` parameter (separate from messages)
- Latest model: `claude-sonnet-4-20250514`

**OpenAI Optimization**:
- System prompt in messages array
- Model: `gpt-4o` for best results

---

## Advanced Features

### 1. Multi-Message Splitting

**Purpose**: Match user's typical message length patterns.

```typescript
// If user typically sends short messages, split long replies
if (writingStyle?.avgWordsPerMessage) {
  const wordCount = finalReply.split(/\s+/).length;
  const avgWords = writingStyle.avgWordsPerMessage;

  if (wordCount > avgWords * 2) {
    // User's avg: 10 words, AI generated: 30 words → Split!
    const sentences = finalReply.match(/[^.!?]+[.!?]+/g);
    const messageCount = Math.min(3, Math.ceil(sentences.length / 2));

    suggestedMessages = chunkSentences(sentences, messageCount);
    // Returns: ["First sentence.", "Second and third.", "Fourth."]
  }
}
```

**Scheduler Handling**:
```typescript
if (suggestedMessages && suggestedMessages.length > 1) {
  // Schedule multiple messages with delays
  for (let i = 0; i < suggestedMessages.length; i++) {
    const delay = baseDelay + (i * multiMessageDelay);
    scheduleAction({
      type: 'send-message',
      messageText: suggestedMessages[i],
      scheduledFor: now + delay,
    });
  }
}
```

### 2. Context-Aware Delays

**Purpose**: Respond faster in active conversations.

```typescript
export function calculateReplyDelay(
  behavior: AgentBehaviorSettings,
  config: ChatAutopilotConfig
): number {
  const { replyDelayMin, replyDelayMax, replyDelayContextAware } = behavior;

  if (!replyDelayContextAware) {
    // Simple random delay
    return randomBetween(replyDelayMin, replyDelayMax);
  }

  // Context-aware: check last activity
  const lastActivity = config.lastActivityAt
    ? new Date(config.lastActivityAt)
    : null;

  if (!lastActivity) {
    // New conversation - slower
    return randomBetween(replyDelayMax * 0.7, replyDelayMax);
  }

  const timeSinceActivity = Date.now() - lastActivity.getTime();
  const fiveMinutes = 5 * 60 * 1000;

  if (timeSinceActivity < fiveMinutes) {
    // Active conversation - respond faster
    return randomBetween(replyDelayMin, replyDelayMin * 2);
  } else {
    // Idle conversation - slower
    return randomBetween(replyDelayMax * 0.5, replyDelayMax);
  }
}
```

### 3. Goal Detection & Parsing

**Request** (autopilot enables this):
```typescript
body: {
  detectGoalCompletion: true,
  agentGoal: "Schedule a meeting with confirmed date and time"
}
```

**AI Response**:
```
Sure! I'm free tomorrow at 2pm. Does that work for you?

<goal_analysis>
{
  "isGoalAchieved": false,
  "confidence": 40,
  "reasoning": "Time proposed but not yet confirmed by other party"
}
</goal_analysis>
```

**Parsing** (`app/api/ai/draft/route.ts:454-466`):
```typescript
const goalAnalysisMatch = suggestedReply.match(
  /<goal_analysis>\s*(\{[\s\S]*?\})\s*<\/goal_analysis>/
);

if (goalAnalysisMatch) {
  try {
    goalAnalysis = JSON.parse(goalAnalysisMatch[1]);

    // Remove goal analysis from reply
    finalReply = suggestedReply
      .replace(/<goal_analysis>[\s\S]*?<\/goal_analysis>/, '')
      .trim();
  } catch (e) {
    console.error('Failed to parse goal analysis');
  }
}
```

### 4. Typing Speed Simulation

```typescript
export function calculateTypingDuration(
  text: string,
  wpm: number
): number {
  const words = text.split(/\s+/).length;
  const minutes = words / wpm;
  return Math.floor(minutes * 60 * 1000); // Convert to milliseconds
}

// Usage
const typingDuration = calculateTypingDuration(messageText, agent.behavior.typingSpeedWpm);

scheduleAction({
  type: 'typing-indicator',
  scheduledFor: now,
});

scheduleAction({
  type: 'send-message',
  scheduledFor: now + typingDuration + readReceiptDelay,
});
```

### 5. Conversation Fatigue

**Dynamic Response Rate**:
```typescript
let effectiveResponseRate = agent.behavior.responseRate; // e.g., 85%

if (agent.behavior.conversationFatigueEnabled) {
  const messagesHandled = config.messagesHandled; // e.g., 20
  const fatigueTrigger = agent.behavior.fatigueTriggerMessages; // e.g., 15
  const fatigueReduction = agent.behavior.fatigueResponseReduction; // e.g., 5%

  if (messagesHandled >= fatigueTrigger) {
    const extraMessages = messagesHandled - fatigueTrigger; // 20 - 15 = 5
    const reduction = extraMessages * fatigueReduction; // 5 * 5 = 25%
    effectiveResponseRate = Math.max(30, effectiveResponseRate - reduction); // 85 - 25 = 60%
  }
}

// Lottery
const shouldRespond = Math.random() * 100 < effectiveResponseRate;
```

### 6. Language Detection

**Prompt Instruction**:
```typescript
const languageInstruction = `
LANGUAGE: Reply in the SAME LANGUAGE as the incoming message.
If the message is in German, reply in German.
If in English, reply in English.
Do not switch or translate.
`;
```

**Why This Works**: Modern LLMs are multilingual and can detect language from context automatically. No explicit detection code needed.

---

## Summary

### Key Takeaways

1. **Unified AI Backend**: All three systems (drafts, AI chat, autopilot) share the same infrastructure and context sources.

2. **Provider Abstraction**: Switching between Anthropic, OpenAI, and Ollama requires only changing a parameter - no code changes.

3. **Context is King**: The system assembles rich context from tone settings, writing style, thread history, and AI chat conversations.

4. **Agent-Based Autopilot**: Autonomous agents combine AI generation with human-like behavioral simulation for realistic conversations.

5. **Local-First Storage**: All data lives in browser LocalStorage, giving users complete control and privacy.

6. **Seamless Integration**: Draft generation, AI chat, and autopilot all feed into each other, creating a cohesive AI-powered messaging experience.

### System Strengths

- **Privacy**: Option to run completely local with Ollama
- **Flexibility**: Three AI providers, each with strengths
- **Personalization**: Writing style matching creates authentic responses
- **Scalability**: Autopilot handles high-volume conversations
- **Transparency**: Activity logs show everything the system does

### Future Enhancements

- WebSocket for real-time updates
- More AI providers (Gemini, local LLMs)
- Advanced goal detection with multi-step planning
- Team collaboration features
- Analytics and insights

---

This deep dive should give you complete understanding of how the AI pipeline works from end to end!
