# Unified Agent Pipeline Architecture

> **Status:** All Phases Complete (1-6)
> **Last Updated:** 2026-01-30
> **Tracking:** This is the living project doc. Updated as implementation progressed.

---

## Goal

Replace the current fragmented AI system (2 separate pipelines, 7 duplicate fetch call sites, inconsistent context) with a single unified pipeline that all AI features flow through, plus a per-chat knowledge system that accumulates intelligence over time.

---

## What Changed (Before → After)

### Problems Solved

| Problem | Resolution |
|---------|------------|
| **7 duplicate fetch call sites** manually building headers, loading context, and calling fetch | All 7 callers now use `useAiPipeline()` — zero direct fetch calls remain |
| **Inconsistent headers** — some use `getAIHeaders()`, others manually build, some send both API keys | Pipeline builds headers once via `loadSharedContext()`, consistent for all callers |
| **Unbounded thread context** — `updateThreadContextWithNewMessages` kept ALL messages forever | Capped at 100 messages via `MAX_THREAD_CONTEXT_MESSAGES` in `lib/storage.ts` |
| **Autopilot blind to AI chat** — autopilot never saw AI chat sidebar discussions | Pipeline's `loadChatContext()` loads AI chat summary for ALL intents, including autopilot drafts |
| **No persistent knowledge** — no structured memory across sessions | Per-chat knowledge system: `ChatKnowledge` with facts, tone, language, topics, relationship type |
| **`page.tsx` and `use-batch-draft-generator.ts` missing thread context** | Pipeline automatically loads full context for every caller — immediate quality improvement |

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  CALLERS (components/hooks)                          │
│  MessagePanel, DraftComposer, MessageModal,          │
│  AiChatPanel, AutopilotEngine, BatchDraftGenerator,  │
│  page.tsx (drag-to-draft)                            │
│                                                      │
│  All call: useAiPipeline().generateDraft()           │
│            useAiPipeline().sendChatMessage()          │
│            useAiPipeline().generateSummary()          │
│            useAiPipeline().extractKnowledge()         │
└──────────────────┬───────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────┐
│  UNIFIED PIPELINE (lib/ai-pipeline.ts)               │
│                                                      │
│  1. Load shared context (settings, tone, style)      │
│  2. Load chat context (thread, AI chat, knowledge)   │
│  3. Load agent config (if applicable)                │
│  4. Route by intent → correct API route + body       │
│  5. Call API, parse response                         │
└──────────────────┬───────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────┐
│  API ROUTES (server-side)                            │
│                                                      │
│  /api/ai/draft              (+ knowledgeContext)     │
│  /api/ai/chat               (+ knowledgeContext)     │
│  /api/ai/conversation-summary                        │
│  /api/ai/knowledge-extract  (NEW)                    │
└──────────────────────────────────────────────────────┘
```

---

## New Files Created

### `lib/ai-pipeline.ts` (~400 lines)

Client-side orchestrator. Single entry point for all AI features.

**Types:**
- `AiIntent`: `'draft-reply' | 'draft-proactive' | 'interactive-chat' | 'conversation-summary' | 'knowledge-extract'`
- `AiPipelineRequest`: intent, chatId, senderName, optional message/agent/behavior fields, abort signal
- `AiPipelineResponse`: text, suggestedMessages, goalAnalysis, extractedFacts, summary fields, knowledge fields
- `GoalAnalysis`: isGoalAchieved, confidence, reasoning
- `ExtractedFact`: category, content, confidence, source

**Internal functions:**
- `loadSharedContext()`: settings, tone, writing style, provider config, headers
- `loadChatContext(chatId)`: thread context, AI chat summary, knowledge context
- `loadAgentContext(agentId)`: agent lookup, system prompt, goal
- `buildDraftRequest()`, `buildChatRequest()`, `buildSummaryRequest()`: intent → API route + body
- `parseDraftResponse()`, `parseChatResponse()`, `parseSummaryResponse()`, `parseKnowledgeResponse()`: normalize responses

**Entry point:**
- `executeAiPipeline(request)`: orchestrates all of the above

### `hooks/use-ai-pipeline.ts` (~190 lines)

React hook wrapping the pipeline with convenient methods:

- `generateDraft(chatId, originalMessage, senderName, options?)` → `DraftResult`
- `generateBatchDrafts(messages[], signal?)` → `Array<{chatId, draft}>`
- `sendChatMessage(chatId, senderName, userMessage, chatHistory)` → `string`
- `generateSummary(chatId, senderName, agentId)` → `AiPipelineResponse`
- `extractKnowledge(chatId, senderName)` → `AiPipelineResponse` (also persists facts to storage)

### `app/api/ai/knowledge-extract/route.ts` (~140 lines)

Server-side API route for extracting structured facts from conversation history.

- Input: threadContext, existingKnowledge (for dedup), senderName, provider config
- Output: JSON with `facts[]`, `conversationTone`, `primaryLanguage`, `topicHistory`, `relationshipType`
- Validates fact categories and confidence thresholds (>= 50)
- Deduplication: existing knowledge passed to prompt so AI only extracts NEW facts

---

## Files Modified

### Types & Storage

| File | Changes |
|------|---------|
| `lib/types.ts` | Added `ChatFact`, `ChatFactCategory`, `ChatFactSource`, `ChatKnowledge` interfaces |
| `lib/constants.ts` | Added `CHAT_KNOWLEDGE: 'parrot-chat-knowledge'` storage key |
| `lib/storage.ts` | Added `getChatKnowledge()`, `saveChatKnowledge()`, `mergeChatFacts()`, `formatKnowledgeForPrompt()`. Fixed thread context truncation (cap at 100 messages) |

### API Routes

| File | Changes |
|------|---------|
| `app/api/ai/chat/route.ts` | Accepts optional `knowledgeContext` and `writingStyleContext`, appends to system prompt |
| `app/api/ai/draft/route.ts` | Accepts optional `knowledgeContext`, appends to context section |

### Migrated Callers (7 total)

| File | What changed |
|------|-------------|
| `components/message-panel.tsx` | Replaced manual fetch + context loading with `useAiPipeline().generateDraft()` |
| `components/draft-composer.tsx` | Replaced manual fetch + context loading with `useAiPipeline().generateDraft()` |
| `components/message-modal.tsx` | Replaced manual fetch + context loading with `useAiPipeline().generateDraft()` |
| `components/ai-chat-panel.tsx` | Replaced manual fetch with `useAiPipeline().sendChatMessage()`. Added `chatId` prop |
| `app/page.tsx` (drag-to-draft) | Replaced manual fetch (was missing threadContext!) with `useAiPipeline().generateDraft()` |
| `hooks/use-batch-draft-generator.ts` | Replaced manual fetch (was missing threadContext!) with `useAiPipeline().generateDraft()` |
| `hooks/use-autopilot-engine.ts` | Replaced 3 fetch calls: `handleIncomingMessage` → `generateDraft()`, `generateHandoffSummary` → `generateSummary()`, `generateProactiveMessage` → `generateDraft()`. Added knowledge extraction trigger every 5th message |

---

## Implementation Phases

### Phase 1: Foundation (no behavior changes) ✅
- [x] 1. Create `lib/ai-pipeline.ts` with full pipeline logic
- [x] 2. Create `hooks/use-ai-pipeline.ts` React hook
- [x] 3. Add optional `knowledgeContext`/`writingStyleContext` params to existing API routes (backwards compatible)
- [x] 4. Fix thread context truncation in `lib/storage.ts` (cap at 100 messages)

### Phase 2: Migrate callers (one at a time, each independently testable) ✅
- [x] 5. Migrate `components/message-panel.tsx`
- [x] 6. Migrate `components/draft-composer.tsx`
- [x] 7. Migrate `app/page.tsx` drag-to-draft
- [x] 8. Migrate `hooks/use-batch-draft-generator.ts`
- [x] 9. Migrate `hooks/use-autopilot-engine.ts` (most complex — agent config, goal detection, behavior flags)
- [x] 10. Migrate `components/ai-chat-panel.tsx`

### Phase 3: Migrate remaining callers ✅
- [x] 11. Migrate `components/message-modal.tsx`
- [x] 12. Verify every caller now uses the pipeline — no direct fetch to AI routes remains

### Phase 4: Legacy Code Removal (dedicated sweep) ✅

All old AI plumbing removed during migration. Audit results:

- [x] 13. **Old header-building code**: All inline header construction removed from migrated files. Pipeline handles headers.
- [x] 14. **Old context-loading code**: All inline context calls removed from AI callers. Non-AI uses (UI display in message-panel.tsx) correctly retained.
- [x] 15. **Old fetch calls**: All direct `fetch('/api/ai/draft|chat')` calls removed from all 7 callers.
- [x] 16. **`lib/api-headers.ts`**: Kept — still used by `getBeeperHeaders()` in `page.tsx` and `use-send-message.ts` for non-AI Beeper API calls. AI callers no longer import from it directly.
- [x] 17. **Unused imports**: Swept all migrated files — no orphaned AI imports remain.
- [x] 18. **Grep audit**: `grep "fetch.*api/ai/(draft|chat|conversation)"` returns ZERO results outside `lib/ai-pipeline.ts`.
- [x] 19. **Dead export audit**: `formatThreadContextForPrompt` and `getThreadContext` are still used by `message-panel.tsx` for UI display (non-AI). `formatAiChatSummaryForPrompt` is used by pipeline + `use-ai-chat-history.ts`. All exports are still legitimately used.

### Phase 5: Knowledge system ✅
- [x] 20. Add `ChatKnowledge` types to `lib/types.ts`, storage key to `lib/constants.ts`, storage functions to `lib/storage.ts`
- [x] 21. Create `/app/api/ai/knowledge-extract/route.ts`
- [x] 22. Add knowledge extraction triggers (every 5th autopilot message, plus `extractKnowledge()` available from `useAiPipeline` hook for manual use)
- [x] 23. Pipeline passes `knowledgeContext` to draft and chat routes — knowledge now flows through automatically

### Phase 6: Final verification ✅
- [x] 24. Full grep audit: `grep "fetch.*api/ai/(draft|chat|conversation|knowledge)"` returns ZERO results — only `lib/ai-pipeline.ts` makes AI API calls
- [x] 25. All entry points verified: message-panel, draft-composer, message-modal, ai-chat-panel, page.tsx drag-to-draft, batch-draft-generator, autopilot-engine (handleIncomingMessage + generateProactiveMessage + handoff summary)
- [x] 26. `npx tsc --noEmit` — zero TypeScript errors

---

## Key Design Decisions

1. **Client-side orchestration, server-side execution.** Pipeline assembles context on client (where localStorage lives), sends to thin API routes on server (where API keys are used).

2. **Intent-based API.** Callers declare WHAT they want (`draft-reply`, `interactive-chat`), not which route to hit. Pipeline handles routing.

3. **Context is automatic.** No caller ever manually loads tone, writing style, thread context, AI chat history, or knowledge. Pipeline does it all.

4. **Knowledge is additive and bounded.** Facts accumulate, capped at 50/chat, lowest-confidence pruned. localStorage stays bounded.

5. **Keep separate API routes.** Draft, chat, summary, and knowledge-extract serve genuinely different prompt structures. Consolidating would create a monster route. The unification happens at the client pipeline layer.

6. **Backwards compatible migration.** Every change was additive. New optional params on existing routes. Callers migrated one at a time.

---

## Knowledge System Details

### Data Model

```typescript
ChatKnowledge {
  chatId: string;
  facts: ChatFact[];           // max 50, pruned by confidence
  conversationTone?: string;   // e.g. "casual and friendly"
  primaryLanguage?: string;    // e.g. "English"
  topicHistory: string[];      // max 20, most recent topics
  relationshipType?: string;   // e.g. "colleague", "friend"
  updatedAt: string;
  createdAt: string;
}

ChatFact {
  id: string;
  category: ChatFactCategory;  // preference | schedule | relationship | topic | sentiment | communication | personal | professional
  content: string;             // e.g. "Prefers morning meetings"
  confidence: number;          // 0-100, min 50 to be stored
  source: ChatFactSource;      // observed | stated | inferred
  firstObserved: string;
  lastObserved: string;
  mentions: number;            // reinforced on duplicate extraction
}
```

### How Knowledge Flows

1. **Extraction triggers:**
   - Every 5th autopilot message (`use-autopilot-engine.ts` line 256)
   - Manual via `useAiPipeline().extractKnowledge(chatId, senderName)`

2. **Storage:** `mergeChatFacts()` deduplicates by category + content, boosts confidence on reinforcement, prunes to 50 facts

3. **Consumption:** `loadChatContext()` in the pipeline formats knowledge via `formatKnowledgeForPrompt()` and passes it as `knowledgeContext` to draft and chat API routes

4. **In prompts:** API routes append knowledge as `<knowledge>` XML sections in the system prompt

---

## Manual Testing Checklist

- [ ] Generate draft from message panel — verify AI response
- [ ] Generate draft from draft composer — verify AI response
- [ ] Drag message to drafts column — verify draft generated with full context
- [ ] Batch generate drafts — verify all drafts generated
- [ ] Autopilot: enable agent, send message — verify agent responds
- [ ] Autopilot: trigger goal completion — verify handoff summary generated
- [ ] AI Chat sidebar: send message — verify response uses thread context
- [ ] Knowledge: after 5+ autopilot messages, check localStorage for `parrot-chat-knowledge` key
- [ ] Verify thread context truncation: load 200+ messages, check localStorage size stays bounded

---

## Key Files Reference

| Area | File |
|------|------|
| **Unified pipeline** | `lib/ai-pipeline.ts` |
| **Pipeline React hook** | `hooks/use-ai-pipeline.ts` |
| **Knowledge extract route** | `app/api/ai/knowledge-extract/route.ts` |
| AI provider abstraction | `lib/ai-provider.ts` |
| AI constants | `lib/ai-constants.ts` |
| Header building | `lib/api-headers.ts` |
| All storage (incl. knowledge) | `lib/storage.ts` |
| All types (incl. ChatKnowledge) | `lib/types.ts` |
| Storage keys (incl. CHAT_KNOWLEDGE) | `lib/constants.ts` |
| Agent templates | `lib/agent-templates.ts` |
| Draft API route | `app/api/ai/draft/route.ts` |
| Chat API route | `app/api/ai/chat/route.ts` |
| Summary API route | `app/api/ai/conversation-summary/route.ts` |
| Autopilot engine | `hooks/use-autopilot-engine.ts` |
| Autopilot scheduler | `hooks/use-autopilot-scheduler.ts` |
| Batch draft generator | `hooks/use-batch-draft-generator.ts` |
| AI Chat sidebar UI | `components/ai-chat-panel.tsx` |
| Message panel UI | `components/message-panel.tsx` |
| Message modal UI | `components/message-modal.tsx` |
| Draft composer UI | `components/draft-composer.tsx` |
| Main orchestration | `app/page.tsx` |
