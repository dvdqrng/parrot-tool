# Unified "Tone of Voice" into "Me" Feature Plan

## Overview

Move the Tone of Voice feature into the "Me" section and create a more sophisticated voice system that leverages all analyzed user data (profile facts, relationship patterns, communication style).

**Key Innovations**:
1. **Relationship-aware** - More casual with girlfriend, more formal with boss
2. **Platform-aware** - Professional on LinkedIn/Slack, casual on WhatsApp/Instagram
3. **Sample-message driven** - Lean into real examples rather than numeric adjustments

**Deferred to V2**: Reinforcement Learning loop - ship static voice matching first, validate it works, then add continuous improvement.

---

## Design Principles (Updated)

### 1. Sample Messages Over Numeric Modifiers
Numeric modifiers like `formalityModifier: -5` are fragile and hard to interpret. Instead:
- **Primary signal**: `sampleMessages[]` - real examples of how the user writes in each context
- **Secondary signals**: `toneDescription` (descriptive text for the prompt)
- **Keep modifiers minimal**: Only for significant, measurable differences

### 2. Minimum Message Threshold
Platform styles will have sparse data for many users. Requirements:
- **20-message minimum** to generate a platform style
- Below threshold: fall back to relationship style or global style
- Show "insufficient data" in UI rather than low-confidence guesses

### 3. Clear Merge Hierarchy
When combining relationship + platform styles:
- **More constrained context wins**
- LinkedIn always overrides romantic tone → stay formal
- But romantic relationship can soften a casual platform like WhatsApp

### 4. Ship Static First
Phase 1-6 delivers value without RL complexity. Validate that:
- Voice profiles generate correctly
- AI drafts sound more natural
- Users find the feature useful

Then add RL as enhancement, not core requirement.

---

## Current State Analysis

### Existing Tone of Voice System (`components/tone-settings.tsx`)
- Fetches user messages via `/api/beeper/user-messages`
- Analyzes for two simple sliders:
  - `briefDetailed` (0-100): Message length preference
  - `formalCasual` (0-100): Formality level
- Detects writing patterns (`WritingStylePatterns`):
  - `frequentEmojis[]`: Common emojis used
  - `abbreviations[]`: Shorthand like "u", "lol", "tbh"
  - `languageQuirks[]`: Expressions like "says 'yeah'", "uses..."
  - `punctuationStyle`: Multiple exclamation, ellipsis, caps
  - `capitalizationStyle`: proper/lowercase/mixed
  - `avgWordsPerMessage`: Average word count
  - `sampleMessages[]`: Example messages
- Stored separately in localStorage (`parrot-tone-settings`, `parrot-writing-style-patterns`)

### Existing Me Data System (`lib/me-data-layer.ts`)
Already extracts from ChatKnowledge:
- **Communication facts** (`category: 'communication'`): Response patterns, language style
- **Conversation tone** (`ChatKnowledge.conversationTone`): "intimate", "casual", "formal", "playful", "supportive", "professional"
- **Primary language** (`ChatKnowledge.primaryLanguage`)
- **Relationship type** (`ChatKnowledge.relationshipType`)

### Data We Already Have (Not Yet Used for Voice)
1. **Per-conversation tone**: `ChatKnowledge.conversationTone` varies by relationship
2. **Communication facts**: e.g., "User usually responds within 30 minutes"
3. **Relationship type**: girlfriend, colleague, friend - affects formality
4. **Profile communication section**: Facts about how user communicates
5. **Platform data**: `CrmPlatformLink.platform` - whatsapp, telegram, instagram, slack, linkedin, etc.
   - Can group messages by platform to analyze platform-specific voice patterns

---

## Solution: Unified VoiceProfile in MeData

### New Type: VoiceProfile

```typescript
interface VoiceProfile {
  // Global defaults (current system)
  globalStyle: {
    briefDetailed: number;      // 0-100
    formalCasual: number;       // 0-100
    writingPatterns: WritingStylePatterns;
  };

  // Relationship-based adjustments (how you talk to different people)
  relationshipStyles: Record<RelationshipCategory, StyleAdjustment>;

  // Platform-based adjustments (how you talk on different platforms)
  // Only populated if platform has >= 20 messages analyzed
  platformStyles: Record<string, StyleAdjustment>;

  // Derived from knowledge extraction
  derivedTraits: {
    responseSpeed: 'fast' | 'moderate' | 'slow';
    languages: string[];
    topicExpertise: string[];
  };

  // Analysis metadata
  lastAnalyzedAt: string;
  messageCountAnalyzed: number;
  sourceChatsCount: number;
}

interface StyleAdjustment {
  // PRIMARY: Real examples (most important for prompt)
  sampleMessages: string[];     // 5-10 representative messages
  toneDescription: string;      // e.g., "warm and playful with pet names"

  // SECONDARY: Platform-specific patterns
  commonGreetings?: string[];   // e.g., LinkedIn: "Hope this finds you well"
  commonSignoffs?: string[];    // e.g., Slack: emoji reactions

  // TERTIARY: Numeric hints (use sparingly)
  emojiFrequency: 'more' | 'same' | 'less';

  // Metadata
  messageCount: number;         // How many messages this is based on
  confidence: number;           // 0-100, lower if sparse data
}

type RelationshipCategory = 'romantic' | 'family' | 'friend' | 'colleague' | 'acquaintance';

const MIN_MESSAGES_FOR_STYLE = 20;  // Minimum messages to generate a style
```

---

## Implementation Phases

### Phase 1: Add VoiceProfile Types ✅ COMPLETE
**File: `lib/types.ts`**

Added:
- `VoiceProfile` interface
- `StyleAdjustment` interface
- `RelationshipCategory` type
- Updated `MeData` to include `voiceProfile`

### Phase 2: Create Voice Profile Builder
**File: `lib/voice-profile-builder.ts`** (NEW)

Core functions:
1. `buildVoiceProfileFromKnowledgeBase(base: KnowledgeBase): VoiceProfile`
   - Group conversations by `relationshipType` → build relationshipStyles
   - Group conversations by `platform` → build platformStyles (if >= 20 messages)
   - Extract `conversationTone` patterns per group
   - Collect sample messages for each context

2. `mergeWithToneAnalysis(profile: VoiceProfile, toneSettings: ToneSettings, writingStyle: WritingStylePatterns): VoiceProfile`
   - Combine AI-extracted knowledge with pattern analysis

3. `getContextualStyle(profile: VoiceProfile, relationshipType?: string, platform?: string): StyleAdjustment`
   - Get adjusted style for a specific context
   - Apply hierarchy: platform constraints > relationship tone > global

**Key Logic:**
```typescript
const MIN_MESSAGES_FOR_STYLE = 20;

function deriveRelationshipStyles(
  knowledge: Record<string, ChatKnowledge>,
  userMessages: Record<string, string[]>
): Record<RelationshipCategory, StyleAdjustment> {
  // Group by relationshipType
  const groups = groupBy(Object.entries(knowledge), ([_, k]) =>
    normalizeToCategory(k.relationshipType)
  );

  const result: Record<RelationshipCategory, StyleAdjustment> = {};

  for (const [category, entries] of Object.entries(groups)) {
    const chatIds = entries.map(([chatId]) => chatId);
    const messages = chatIds.flatMap(id => userMessages[id] || []);

    if (messages.length >= MIN_MESSAGES_FOR_STYLE) {
      result[category as RelationshipCategory] = analyzeStyle(entries, messages);
    }
  }

  return result;
}

function derivePlatformStyles(
  knowledge: Record<string, ChatKnowledge>,
  contacts: Record<string, CrmContactProfile>,
  userMessages: Record<string, string[]>
): Record<string, StyleAdjustment> {
  // Map chatId to platform via contacts.platformLinks
  const chatToPlatform = new Map<string, string>();
  for (const contact of Object.values(contacts)) {
    for (const link of contact.platformLinks) {
      chatToPlatform.set(link.chatId, link.platform);
    }
  }

  // Group by platform
  const platformGroups: Record<string, { chatIds: string[], knowledge: ChatKnowledge[] }> = {};
  for (const [chatId, k] of Object.entries(knowledge)) {
    const platform = chatToPlatform.get(chatId) || 'unknown';
    if (!platformGroups[platform]) platformGroups[platform] = { chatIds: [], knowledge: [] };
    platformGroups[platform].chatIds.push(chatId);
    platformGroups[platform].knowledge.push(k);
  }

  const result: Record<string, StyleAdjustment> = {};

  for (const [platform, group] of Object.entries(platformGroups)) {
    const messages = group.chatIds.flatMap(id => userMessages[id] || []);

    // Only create style if we have enough data
    if (messages.length >= MIN_MESSAGES_FOR_STYLE) {
      result[platform] = analyzeStyle(
        group.knowledge.map((k, i) => [group.chatIds[i], k] as [string, ChatKnowledge]),
        messages
      );
    }
  }

  return result;
}

function analyzeStyle(
  knowledgeEntries: [string, ChatKnowledge][],
  messages: string[]
): StyleAdjustment {
  // Get the most common conversationTone
  const tones = knowledgeEntries
    .map(([_, k]) => k.conversationTone)
    .filter(Boolean);
  const dominantTone = mode(tones) || 'casual';

  // Select representative sample messages (diverse, not too long)
  const sampleMessages = selectRepresentativeSamples(messages, 8);

  // Analyze emoji frequency
  const emojiCount = messages.filter(m => hasEmoji(m)).length;
  const emojiRatio = emojiCount / messages.length;
  const emojiFrequency = emojiRatio > 0.5 ? 'more' : emojiRatio < 0.2 ? 'less' : 'same';

  // Extract common greetings/signoffs
  const commonGreetings = extractCommonGreetings(messages);
  const commonSignoffs = extractCommonSignoffs(messages);

  return {
    sampleMessages,
    toneDescription: describeTone(dominantTone, emojiFrequency),
    emojiFrequency,
    commonGreetings: commonGreetings.length > 0 ? commonGreetings : undefined,
    commonSignoffs: commonSignoffs.length > 0 ? commonSignoffs : undefined,
    messageCount: messages.length,
    confidence: calculateConfidence(messages.length),
  };
}

// When generating draft, apply hierarchy
function getCombinedStyle(
  profile: VoiceProfile,
  relationship?: RelationshipCategory,
  platform?: string
): StyleAdjustment | null {
  const relationshipStyle = relationship ? profile.relationshipStyles[relationship] : null;
  const platformStyle = platform ? profile.platformStyles[platform] : null;

  // If no context-specific styles, return null (use global)
  if (!relationshipStyle && !platformStyle) return null;

  // If only one exists, use it
  if (!relationshipStyle) return platformStyle;
  if (!platformStyle) return relationshipStyle;

  // HIERARCHY: Platform format constraints take precedence
  // LinkedIn/Slack formality wins over romantic casualness
  // But relationship provides emotional tone and vocabulary

  const isConstrainedPlatform = ['linkedin', 'email', 'slack'].includes(platform!);

  return {
    // For constrained platforms, use platform's tone; otherwise relationship's
    toneDescription: isConstrainedPlatform
      ? platformStyle.toneDescription
      : relationshipStyle.toneDescription,

    // Combine sample messages (relationship first, then platform)
    sampleMessages: [
      ...relationshipStyle.sampleMessages.slice(0, 4),
      ...platformStyle.sampleMessages.slice(0, 4),
    ],

    // Platform-specific patterns always apply
    commonGreetings: platformStyle.commonGreetings,
    commonSignoffs: platformStyle.commonSignoffs,

    // For emoji: constrained platforms reduce, others follow relationship
    emojiFrequency: isConstrainedPlatform
      ? platformStyle.emojiFrequency
      : relationshipStyle.emojiFrequency,

    // Take the higher confidence
    messageCount: relationshipStyle.messageCount + platformStyle.messageCount,
    confidence: Math.max(relationshipStyle.confidence, platformStyle.confidence),
  };
}
```

### Phase 3: Update MeData Layer
**File: `lib/me-data-layer.ts`**

1. Import `buildVoiceProfileFromKnowledgeBase`
2. Update `buildMeData()`:
   ```typescript
   const voiceProfile = buildVoiceProfileFromKnowledgeBase(base, userMessages);
   return {
     userIdentity,
     profile,
     relationshipGraph,
     voiceProfile,  // NEW
     lastBuiltAt: new Date().toISOString(),
   };
   ```
3. Merge with existing tone settings on build

### Phase 4: Voice Calibration Onboarding
**New File: `components/voice-calibration.tsx`**

First-time setup moment when user has enough message data:

```
┌─────────────────────────────────────────────────┐
│          🎤 Set Up Your Voice                    │
├─────────────────────────────────────────────────┤
│                                                 │
│  We've analyzed 247 of your messages.           │
│  Here's what we learned about how you write:    │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ "hey! yeah that works for me 😊"         │   │
│  │ "sounds good, let's do it"               │   │
│  │ "haha nice one"                          │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Your style appears to be:                      │
│  • Casual and friendly                          │
│  • Uses emoji occasionally                      │
│  • Prefers shorter messages                     │
│                                                 │
│  Does this look right?                          │
│                                                 │
│  [Yes, looks good!]  [Let me adjust]           │
│                                                 │
└─────────────────────────────────────────────────┘
```

If user clicks "Let me adjust":
- Show sliders for briefDetailed and formalCasual
- Allow removing/adding sample messages
- Save preferences to override analyzed values

**Trigger conditions:**
- First time opening AI features after >= 50 messages analyzed
- Store `voiceCalibrationComplete: boolean` in settings

### Phase 5: Update Me Settings UI
**File: `components/me-settings.tsx`**

Add third tab to segmented control:
```typescript
const VIEW_OPTIONS = [
  { value: 'profile', label: 'Profile', icon: User },
  { value: 'relationships', label: 'Relationships', icon: Network },
  { value: 'voice', label: 'Voice', icon: MessageSquare },  // NEW
];
```

Create new `VoiceSettingsView` component:
- Global style sliders (migrate from `ToneSettingsSection`)
- Writing patterns display
- Contextual style preview cards:
  - Show relationship styles (with message counts)
  - Show platform styles (with message counts, or "insufficient data")
- "Recalibrate" button → reopens calibration flow
- "Analyze Messages" button (reuse existing logic)

**UI Preview:**
```
┌─────────────────────────────────────────────────┐
│  [Profile] [Relationships] [*Voice*]            │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─ Global Style ─────────────────────────────┐ │
│  │ Message Length   [═══════●═══] Detailed    │ │
│  │ Communication    [═════●═════] Casual      │ │
│  │                                            │ │
│  │ [Analyze Messages]  Last: 2 days ago       │ │
│  └────────────────────────────────────────────┘ │
│                                                 │
│  ┌─ Your Writing Patterns ────────────────────┐ │
│  │ Emojis: 😊 ❤️ 👍 🎉                         │ │
│  │ Expressions: "yeah", "sounds good", "lol"  │ │
│  │ Style: lowercase, ~12 words/msg            │ │
│  └────────────────────────────────────────────┘ │
│                                                 │
│  ┌─ By Relationship ──────────────────────────┐ │
│  │ ❤️ Romantic (142 msgs)                      │ │
│  │   warm, playful, uses pet names            │ │
│  │ 👨‍👩‍👧 Family (87 msgs)                        │ │
│  │   caring, proper grammar                   │ │
│  │ 👋 Friends (234 msgs)                       │ │
│  │   casual, lots of slang                    │ │
│  │ 💼 Work (45 msgs)                           │ │
│  │   professional, detailed                   │ │
│  └────────────────────────────────────────────┘ │
│                                                 │
│  ┌─ By Platform ──────────────────────────────┐ │
│  │ 💬 WhatsApp (312 msgs)                      │ │
│  │   casual, emoji-heavy, brief               │ │
│  │ 📸 Instagram (28 msgs)                      │ │
│  │   playful, uses reactions                  │ │
│  │ 💼 LinkedIn (8 msgs)                        │ │
│  │   ⚠️ Insufficient data (need 20+)          │ │
│  │ 🔧 Slack (156 msgs)                         │ │
│  │   professional but friendly, emoji         │ │
│  └────────────────────────────────────────────┘ │
│                                                 │
│  [Recalibrate Voice]                            │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Phase 6: Remove Separate Tone Page
**Files to modify:**
- `app/settings/layout.tsx` - Remove "Tone of Voice" nav item
- Delete `app/settings/tone/page.tsx`
- Keep `components/tone-settings.tsx` temporarily for code reuse, then refactor

### Phase 7: Update AI Draft to Use VoiceProfile
**File: `app/api/ai/draft/route.ts`**

Update interface:
```typescript
interface GenerateDraftBody {
  // ... existing
  voiceProfile?: VoiceProfile;
  relationshipType?: RelationshipCategory;
  platform?: string;
}
```

Update prompt construction:
```typescript
function buildVoicePromptSection(
  voiceProfile: VoiceProfile,
  relationshipType?: RelationshipCategory,
  platform?: string
): string {
  const contextStyle = getCombinedStyle(voiceProfile, relationshipType, platform);

  let prompt = `\n## Your Writing Voice\n`;

  // Global style
  const { briefDetailed, formalCasual } = voiceProfile.globalStyle;
  prompt += `Base style: ${describeLengthPreference(briefDetailed)}, ${describeFormalityLevel(formalCasual)}.\n`;

  // Writing patterns
  const patterns = voiceProfile.globalStyle.writingPatterns;
  if (patterns.frequentEmojis?.length > 0) {
    prompt += `Your common emojis: ${patterns.frequentEmojis.join(' ')}\n`;
  }
  if (patterns.abbreviations?.length > 0) {
    prompt += `You use: ${patterns.abbreviations.join(', ')}\n`;
  }

  // Context-specific style
  if (contextStyle) {
    prompt += `\n### For this conversation:\n`;
    prompt += `Tone: ${contextStyle.toneDescription}\n`;

    if (contextStyle.emojiFrequency === 'more') {
      prompt += `Use emoji freely.\n`;
    } else if (contextStyle.emojiFrequency === 'less') {
      prompt += `Minimize emoji usage.\n`;
    }

    if (contextStyle.commonGreetings?.length > 0) {
      prompt += `Common greetings: ${contextStyle.commonGreetings.join(', ')}\n`;
    }

    // MOST IMPORTANT: Sample messages
    if (contextStyle.sampleMessages.length > 0) {
      prompt += `\nExamples of how you write in this context:\n`;
      for (const msg of contextStyle.sampleMessages.slice(0, 5)) {
        prompt += `- "${msg}"\n`;
      }
      prompt += `\nMatch this style closely.\n`;
    }
  }

  return prompt;
}
```

### Phase 8: Storage Migration
**File: `lib/storage.ts`**

Add migration function:
```typescript
function migrateToneSettingsToVoiceProfile(): void {
  // Check for old keys
  const oldTone = localStorage.getItem('parrot-tone-settings');
  const oldStyle = localStorage.getItem('parrot-writing-style-patterns');

  if (!oldTone && !oldStyle) return;

  // Mark that we have legacy settings to merge on next build
  localStorage.setItem('parrot-pending-tone-migration', JSON.stringify({
    toneSettings: oldTone ? JSON.parse(oldTone) : null,
    writingStyle: oldStyle ? JSON.parse(oldStyle) : null,
    migratedAt: new Date().toISOString(),
  }));

  // Don't delete old keys yet - keep for rollback safety
}
```

---

## Key Files

| File | Action | Purpose |
|------|--------|---------|
| `lib/types.ts` | ✅ Modified | Add VoiceProfile, StyleAdjustment types; update MeData |
| `lib/voice-profile-builder.ts` | Create | Build voice profile from knowledge base |
| `components/voice-calibration.tsx` | Create | First-time voice setup onboarding |
| `lib/me-data-layer.ts` | Modify | Include VoiceProfile in buildMeData() |
| `components/me-settings.tsx` | Modify | Add Voice tab, integrate tone settings UI |
| `app/settings/tone/page.tsx` | Delete | Remove separate page |
| `app/settings/layout.tsx` | Modify | Remove Tone nav item |
| `app/api/ai/draft/route.ts` | Modify | Use VoiceProfile with contextual styles |
| `lib/storage.ts` | Modify | Add migration helper |

---

## Data Flow

```
User opens Settings → Me → Voice tab
    ↓
useMeData() hook provides meData.voiceProfile
    ↓
VoiceProfile contains:
    1. globalStyle (from tone analysis + merged settings)
    2. relationshipStyles (derived from relationship-grouped conversations, >= 20 msgs)
    3. platformStyles (derived from platform-grouped conversations, >= 20 msgs)
    4. derivedTraits (from communication facts in profile)
    ↓
User can:
    - Adjust global sliders
    - View detected patterns
    - See relationship previews with message counts
    - See platform previews (or "insufficient data" warning)
    - Trigger re-analysis
    - Recalibrate voice (reopen onboarding)
    ↓
AI Draft Generation:
    1. Get voiceProfile from MeData
    2. Get relationshipType + platform from current chat context
    3. Get combined style (with hierarchy: platform format > relationship tone)
    4. Build voice section for prompt with sample messages
    5. Generate draft that matches user's voice for this specific context
```

---

## Benefits

1. **Unified "Me" experience** - All self-knowledge in one place
2. **Relationship-aware voice** - AI sounds different to girlfriend vs boss
3. **Platform-aware voice** - Formal on LinkedIn, casual on WhatsApp
4. **Sample-driven accuracy** - Real examples > numeric guesses
5. **Data quality gates** - No low-confidence styles from sparse data
6. **Clear onboarding** - User validates their voice profile
7. **Better AI drafts** - More personal, context-appropriate responses
8. **Simpler navigation** - No separate Tone settings page
9. **Single data source** - VoiceProfile built from same MeData layer

---

## Verification

### Basic Functionality
1. Open Settings → Me → Voice tab
2. Verify global sliders display and persist correctly
3. Verify writing patterns (emojis, abbreviations, quirks) display
4. Verify "By Relationship" cards show different descriptions with message counts
5. Verify "By Platform" cards show styles with message counts, or "insufficient data" for sparse platforms
6. Click "Analyze Messages" - should update all patterns
7. Verify `/settings/tone` route returns 404
8. Check localStorage: old keys migrated, new structure in place

### Voice Calibration Onboarding
1. Clear `voiceCalibrationComplete` from settings
2. Navigate to a feature that uses voice
3. Verify calibration modal appears with sample messages
4. Click "Looks good" → verify `voiceCalibrationComplete: true` is saved
5. Click "Let me adjust" → verify sliders/editors appear

### Context-Aware Voice
Test AI draft scenarios:
- Romantic chat on WhatsApp → warm, casual, emoji-heavy
- Colleague on Slack → professional but friendly
- Connection on LinkedIn → very formal (platform overrides romantic if applicable)
- Friend on Instagram → playful, reaction-heavy

### Message Threshold
1. Find a platform with < 20 messages
2. Verify it shows "Insufficient data" in UI
3. Verify AI draft falls back to relationship style or global style

---

## Example Scenarios

| Relationship | Platform | Expected Voice | Notes |
|-------------|----------|----------------|-------|
| girlfriend | whatsapp | Very casual, pet names, lots of emoji ❤️ | Both relationship & platform are casual |
| girlfriend | linkedin | Formal, professional | Platform constraint wins |
| colleague | slack | Professional but uses emoji 👍 | Platform allows some casualness |
| colleague | linkedin | Very formal, no emoji | Both constrained |
| friend | whatsapp | Casual, slang, emoji | Both casual |
| family | imessage | Warm, proper grammar | Relationship sets tone |

---

## Future: Reinforcement Learning (V2)

After validating static voice matching works well, add continuous improvement:

### Concept
- Compare generated drafts to real user messages in same context
- Learn from user edits (what they add/remove)
- Track voice match scores over time

### Key Design Changes from Initial Plan
1. **LLM as evaluator** - Don't use surface metrics (word overlap, emoji count) as the primary signal. Use a small LLM call to holistically evaluate "does this sound like the user?"
2. **Surface metrics as pre-filter** - Only use length/emoji counts to cheaply discard obviously bad drafts before expensive LLM evaluation
3. **IndexedDB for evaluation history** - 500 evaluations could hit localStorage limits; use IndexedDB for learning state

### Deferred Files
- `lib/voice-evaluation.ts` - LLM-based voice match evaluation
- `lib/voice-feedback-store.ts` - IndexedDB store for evaluation history

This keeps V1 focused and shippable while preserving the RL roadmap.
