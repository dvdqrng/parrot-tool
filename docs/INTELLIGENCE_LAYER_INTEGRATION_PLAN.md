# Intelligence Layer Integration Plan

## Current State Analysis

### Existing Architecture Strengths

Your current architecture provides an excellent foundation for the intelligence layer:

1. **Unified Data Pipeline** (`BeeperDataProvider` → `useBeeperData()`)
   - Single source of truth for all Beeper data
   - Server-side caching with TTL
   - Polling with diff-based updates (10s interval)
   - localStorage persistence

2. **CRM System** (`useCrm()`)
   - Contact profiles with platform links
   - Tag-based organization
   - Interaction stats tracking
   - Cross-platform identity linking

3. **Storage Infrastructure** (`lib/storage.ts`, `lib/storage-manager.ts`)
   - Mature localStorage abstraction
   - Type-safe storage managers
   - Timestamped caching

4. **Component Patterns**
   - Context-based state management
   - Container/presentational separation
   - Hooks for business logic

### Integration Points

The intelligence layer will integrate at these points:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     EXISTING BEEPER DATA PIPELINE                    │
│  BeeperDataProvider → useBeeperData() → Messages, Accounts, etc.   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     NEW: INTELLIGENCE LAYER                          │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   Extraction Pipeline                         │   │
│  │  • Tier 1: Local (regex, patterns) - every message           │   │
│  │  • Tier 2: LLM (batched per-contact)                         │   │
│  │  • Tier 3: Ambient Stream (cross-chat user state)            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                               │                                      │
│                               ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   Knowledge Store (IndexedDB)                 │   │
│  │  • Contact Intelligence (extends CrmContactProfile)          │   │
│  │  • User Intelligence (NEW)                                   │   │
│  │  • Relationship Graph                                         │   │
│  │  • Style Models                                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                               │                                      │
│                               ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   Multi-Agent System                          │   │
│  │  • Interaction Layer (user-facing)                           │   │
│  │  • Orchestrator                                               │   │
│  │  • Infrastructure Agents (Knowledge, Style, Platform, User)  │   │
│  │  • Dynamic Agents (per contact, per activity, per task)      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                               │                                      │
│                               ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   Triggers System                             │   │
│  │  • Scheduled, Recurring, Conditional                         │   │
│  │  • Pattern-based, Event-triggered                            │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation + Type System (Week 1-3)

### 1.1 Core Type Definitions

Create the full type system for intelligence layer:

**File: `lib/intelligence/knowledge/types.ts`**

```typescript
// Contact Intelligence (extends existing CrmContactProfile)
export interface ContactIntelligence extends CrmContactProfile {
  // Facts with provenance
  facts: ContactFact[];

  // Relationship classification
  relationship: RelationshipClassification;

  // Platform-specific style profiles
  styleProfiles: Map<string, StyleFingerprint>;

  // Action items
  actionItems: ActionItem[];

  // AI-generated summary
  summary?: string;
  summaryGeneratedAt?: string;
}

export interface ContactFact {
  id: string;
  category: FactCategory;
  content: string;
  confidence: number; // 0-1
  source: FactSource;
  firstSeen: string;
  lastConfirmed: string;
  supersededBy?: string; // ID of fact that replaced this
}

export type FactCategory =
  | 'location'
  | 'occupation'
  | 'relationship'
  | 'preference'
  | 'plan'
  | 'contact_info'
  | 'personal'
  | 'professional';

export interface FactSource {
  messageId: string;
  chatId: string;
  platform: string;
  timestamp: string;
  extractedAt: string;
  tier: 1 | 2 | 3;
}

export interface RelationshipClassification {
  type: RelationshipType;
  confidence: number;
  evolution: RelationshipEvent[];
  lastUpdated: string;
}

export type RelationshipType =
  | 'close_friend'
  | 'friend'
  | 'acquaintance'
  | 'professional'
  | 'family'
  | 'romantic'
  | 'service_provider'
  | 'unknown';

export interface ActionItem {
  id: string;
  content: string;
  commitment: 'firm' | 'soft' | 'social_pleasantry';
  dueDate?: string;
  status: 'pending' | 'completed' | 'expired';
  source: FactSource;
}
```

**File: `lib/intelligence/user-state/types.ts`**

```typescript
// User Intelligence - what the system knows about YOU
export interface UserIntelligence {
  // What you're currently doing
  activeContexts: ActiveContext[];

  // What you're talking about, ranked
  activeTopics: TopicCluster[];

  // Information you're sharing with people
  distributedInfo: DistributedInfoItem[];

  // Things you explain repeatedly
  canonicalExplanations: CanonicalExplanation[];

  // Your current communication patterns
  communicationMode: CommunicationMode;

  // Current priorities
  currentPriorities: Priority[];

  // Artifacts being shared
  sharedArtifacts: SharedArtifact[];

  // Last updated
  lastUpdated: string;
}

export interface ActiveContext {
  id: string;
  label: string;
  confidence: number;
  firstDetected: string;
  lastUpdated: string;
  relatedContacts: string[]; // contactIds
  keyFacts: CanonicalFact[];
  platformDistribution: Record<string, string[]>; // platform -> contactIds
  status: 'active' | 'winding_down' | 'completed';
  autoExpiry?: string;
}

export interface TopicCluster {
  id: string;
  topic: string;
  keywords: string[];
  frequency: number;
  recency: number; // weighted score
  relatedMessages: MessageRef[];
  firstMentioned: string;
  lastMentioned: string;
}

export interface DistributedInfoItem {
  id: string;
  content: string;
  variations: string[];
  sharedWith: string[]; // contactIds
  notYetSharedWith: string[]; // relevant contactIds who haven't received
  firstShared: string;
  lastShared: string;
  sourceMessages: MessageRef[];
}

export interface CanonicalExplanation {
  id: string;
  topic: string;
  shortVersion: string;
  longVersion: string;
  variations: Record<RelationshipType, string>;
  frequency: number;
  lastUsed: string;
}

export type CommunicationMode =
  | 'high_social'    // lots of quick messages, organizing
  | 'heads_down'     // focused, few messages
  | 'mixed'          // normal patterns
  | 'catching_up';   // responding to backlog

export interface SharedArtifact {
  id: string;
  type: 'url' | 'file' | 'image' | 'location' | 'contact_info';
  content: string;
  sharedWith: string[];
  sharedOn: string[]; // platforms
  firstShared: string;
  context: string;
}

export interface MessageRef {
  messageId: string;
  chatId: string;
  platform: string;
  timestamp: string;
}

export interface CanonicalFact {
  label: string;
  value: string;
  confidence: number;
}

export interface Priority {
  id: string;
  label: string;
  confidence: number;
  relatedContexts: string[];
}
```

**File: `lib/intelligence/style/types.ts`**

```typescript
export interface StyleFingerprint {
  // Length patterns
  avgMessageLength: number;
  messageBreaking: 'single_long' | 'multiple_short' | 'mixed';

  // Formatting
  capitalization: 'proper' | 'all_lower' | 'all_caps' | 'mixed';
  punctuation: 'full' | 'minimal' | 'none';
  emojiUsage: 'heavy' | 'moderate' | 'light' | 'none';

  // Tone
  formality: 'formal' | 'casual' | 'very_casual';

  // Platform-specific
  platform: string;

  // Confidence
  sampleSize: number;
  confidence: number;

  // Exemplar messages
  exemplarIds: string[];

  // Last updated
  lastUpdated: string;
}

export interface StyleMatrix {
  // Global baseline
  globalBaseline: StyleFingerprint;

  // Per-platform clusters
  platformClusters: Record<string, StyleFingerprint>;

  // Per-relationship-type clusters
  relationshipClusters: Record<RelationshipType, StyleFingerprint>;

  // Per-contact (strongest signal)
  contactStyles: Record<string, Record<string, StyleFingerprint>>; // contactId -> platform -> style
}

export interface StyleInstruction {
  instructions: string; // Natural language for drafting
  exemplars: string[];  // Example messages
  confidence: number;
}
```

**File: `lib/intelligence/agents/types.ts`**

```typescript
export type AgentId = string;

export type AgentType =
  | 'interaction_layer'
  | 'orchestrator'
  | 'knowledge'
  | 'style'
  | 'platform'
  | 'user_state'
  | 'conversation'
  | 'activity'
  | 'task'
  | 'trigger';

export type AgentLifecycle =
  | 'active'    // currently in use (<24h)
  | 'warm'      // used in last week
  | 'cool'      // used in last month, compressed
  | 'dormant'   // >30 days, archived
  | 'completed'; // finished, knowledge archived

export interface Agent {
  id: AgentId;
  type: AgentType;

  // For dynamic agents
  contextId?: string; // contactId, activityId, taskId
  platform?: string;

  // Lifecycle
  lifecycle: AgentLifecycle;
  createdAt: string;
  lastActiveAt: string;

  // Operational memory (compressed for cool/dormant)
  memory: AgentMemory;
}

export interface AgentMemory {
  // Full history for active/warm
  history?: AgentInteraction[];

  // Compressed summary for cool/dormant
  summary?: string;

  // Key learnings that persist
  learnings: string[];

  // Stats
  totalInteractions: number;
  successRate: number;
}

export interface AgentInteraction {
  id: string;
  timestamp: string;
  type: 'draft' | 'analysis' | 'query' | 'action';
  input: unknown;
  output: unknown;
  userEdits?: string; // for drafts
  accepted: boolean;
}

export interface AgentMessage {
  from: AgentId;
  to: AgentId;
  type: 'request' | 'response' | 'inform' | 'consult';
  payload: {
    task: string;
    context: Record<string, unknown>;
    constraints?: string[];
    priority: 'high' | 'normal' | 'low';
  };
  conversationId: string;
  timestamp: string;
}
```

### 1.2 IndexedDB Knowledge Store

Replace localStorage with IndexedDB for intelligence data (localStorage retained for settings/simple data):

**File: `lib/intelligence/knowledge/store.ts`**

```typescript
import Dexie, { Table } from 'dexie';
import { ContactIntelligence, UserIntelligence } from './types';
import { Agent } from '../agents/types';
import { StyleMatrix } from '../style/types';

export class IntelligenceDB extends Dexie {
  contacts!: Table<ContactIntelligence, string>;
  userState!: Table<UserIntelligence, string>; // single row keyed by 'current'
  agents!: Table<Agent, string>;
  styleMatrix!: Table<StyleMatrix, string>; // single row keyed by 'current'
  extractionQueue!: Table<ExtractionQueueItem, string>;

  constructor() {
    super('BeeperIntelligence');

    this.version(1).stores({
      contacts: 'id, *platformLinks.chatId, updatedAt',
      userState: 'id', // 'current' key
      agents: 'id, type, lifecycle, contextId, lastActiveAt',
      styleMatrix: 'id', // 'current' key
      extractionQueue: 'id, chatId, priority, scheduledFor',
    });
  }
}

export const intelligenceDb = new IntelligenceDB();

// Store operations
export const contactStore = {
  async get(contactId: string): Promise<ContactIntelligence | undefined> {
    return intelligenceDb.contacts.get(contactId);
  },

  async getByChatId(chatId: string): Promise<ContactIntelligence | undefined> {
    return intelligenceDb.contacts
      .where('platformLinks.chatId')
      .equals(chatId)
      .first();
  },

  async upsert(contact: ContactIntelligence): Promise<void> {
    await intelligenceDb.contacts.put(contact);
  },

  async getAll(): Promise<ContactIntelligence[]> {
    return intelligenceDb.contacts.toArray();
  },

  async delete(contactId: string): Promise<void> {
    await intelligenceDb.contacts.delete(contactId);
  },
};

export const userStateStore = {
  async get(): Promise<UserIntelligence | undefined> {
    return intelligenceDb.userState.get('current');
  },

  async set(state: UserIntelligence): Promise<void> {
    await intelligenceDb.userState.put({ ...state, id: 'current' });
  },

  async update(updates: Partial<UserIntelligence>): Promise<void> {
    const current = await this.get();
    if (current) {
      await this.set({ ...current, ...updates, lastUpdated: new Date().toISOString() });
    }
  },
};

export const agentStore = {
  async get(agentId: string): Promise<Agent | undefined> {
    return intelligenceDb.agents.get(agentId);
  },

  async getByContext(contextId: string, platform?: string): Promise<Agent | undefined> {
    let query = intelligenceDb.agents.where('contextId').equals(contextId);
    const agents = await query.toArray();
    if (platform) {
      return agents.find(a => a.platform === platform);
    }
    return agents[0];
  },

  async getByLifecycle(lifecycle: AgentLifecycle): Promise<Agent[]> {
    return intelligenceDb.agents.where('lifecycle').equals(lifecycle).toArray();
  },

  async upsert(agent: Agent): Promise<void> {
    await intelligenceDb.agents.put(agent);
  },

  async updateLifecycle(agentId: string, lifecycle: AgentLifecycle): Promise<void> {
    await intelligenceDb.agents.update(agentId, { lifecycle });
  },

  async countActive(): Promise<number> {
    return intelligenceDb.agents
      .where('lifecycle')
      .anyOf(['active', 'warm'])
      .count();
  },
};
```

### 1.3 Integration with Existing CRM

Bridge between existing CRM (localStorage) and new Intelligence (IndexedDB):

**File: `lib/intelligence/knowledge/crm-bridge.ts`**

```typescript
import { CrmContactProfile } from '@/lib/types';
import { loadCrmContacts } from '@/lib/storage';
import { ContactIntelligence } from './types';
import { contactStore } from './store';

/**
 * Sync existing CRM contacts to Intelligence store
 * Called on app init and when CRM updates
 */
export async function syncCrmToIntelligence(): Promise<void> {
  const crmContacts = loadCrmContacts();

  for (const [id, crm] of Object.entries(crmContacts)) {
    const existing = await contactStore.get(id);

    if (existing) {
      // Merge CRM updates into intelligence
      await contactStore.upsert({
        ...existing,
        ...crm, // CRM fields override
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Create new intelligence record from CRM
      await contactStore.upsert(crmToIntelligence(crm));
    }
  }
}

function crmToIntelligence(crm: CrmContactProfile): ContactIntelligence {
  return {
    ...crm,
    facts: [],
    relationship: {
      type: 'unknown',
      confidence: 0,
      evolution: [],
      lastUpdated: new Date().toISOString(),
    },
    styleProfiles: new Map(),
    actionItems: [],
  };
}

/**
 * Get enriched contact (CRM + Intelligence)
 */
export async function getEnrichedContact(
  chatId: string
): Promise<ContactIntelligence | null> {
  return (await contactStore.getByChatId(chatId)) || null;
}
```

### 1.4 Tier 1 Local Extraction

Free, instant extraction that runs on every message:

**File: `lib/intelligence/extraction/tier1-local.ts`**

```typescript
import { BeeperMessage } from '@/lib/types';
import { ContactFact, FactCategory, FactSource } from '../knowledge/types';

export interface Tier1ExtractionResult {
  // Contact info detected
  emails: string[];
  phones: string[];
  urls: string[];
  socialHandles: string[];

  // Temporal mentions
  dates: DateMention[];

  // Artifacts
  attachments: AttachmentInfo[];

  // Style signals
  styleSignals: StyleSignals;

  // Platform detection
  platform: string;
}

export interface DateMention {
  raw: string;
  parsed?: Date;
  context: string;
}

export interface AttachmentInfo {
  type: 'url' | 'file' | 'image' | 'location';
  content: string;
  context?: string;
}

export interface StyleSignals {
  wordCount: number;
  charCount: number;
  hasEmoji: boolean;
  emojiCount: number;
  capitalization: 'proper' | 'all_lower' | 'all_caps' | 'mixed';
  punctuationStyle: 'full' | 'minimal' | 'none';
  lineBreaks: number;
  isVoiceNote: boolean;
}

// Regex patterns
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+?1?\s*[-.(]?\d{3}[-.)]\s*\d{3}[-.]?\d{4})/g;
const URL_REGEX = /https?:\/\/[^\s<>\"{}|\\^`\[\]]+/g;
const SOCIAL_REGEX = /@[a-zA-Z0-9_]{1,30}/g;
const DATE_PATTERNS = [
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(st|nd|rd|th)?,?\s*\d{0,4}/gi,
  /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g,
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
  /\b(today|tomorrow|yesterday|next week|this week)\b/gi,
];

export function extractTier1(message: BeeperMessage): Tier1ExtractionResult {
  const text = message.text || '';

  return {
    emails: (text.match(EMAIL_REGEX) || []),
    phones: (text.match(PHONE_REGEX) || []),
    urls: (text.match(URL_REGEX) || []),
    socialHandles: (text.match(SOCIAL_REGEX) || []),
    dates: extractDates(text),
    attachments: extractAttachments(message),
    styleSignals: analyzeStyle(text, message),
    platform: message.platform || 'unknown',
  };
}

function extractDates(text: string): DateMention[] {
  const dates: DateMention[] = [];

  for (const pattern of DATE_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      dates.push({
        raw: match[0],
        context: getContext(text, match.index!, 30),
      });
    }
  }

  return dates;
}

function extractAttachments(message: BeeperMessage): AttachmentInfo[] {
  const attachments: AttachmentInfo[] = [];

  // URLs from text
  const urls = (message.text || '').match(URL_REGEX) || [];
  for (const url of urls) {
    attachments.push({ type: 'url', content: url });
  }

  // Message attachments
  if (message.attachments) {
    for (const att of message.attachments) {
      if (att.type === 'img') {
        attachments.push({ type: 'image', content: att.srcURL || '' });
      } else if (att.type !== 'unknown') {
        attachments.push({ type: 'file', content: att.fileName || '' });
      }
    }
  }

  return attachments;
}

function analyzeStyle(text: string, message: BeeperMessage): StyleSignals {
  const words = text.split(/\s+/).filter(Boolean);
  const emojiMatches = text.match(/[\p{Emoji}]/gu) || [];

  // Capitalization analysis
  const hasUpper = /[A-Z]/.test(text);
  const hasLower = /[a-z]/.test(text);
  const allUpper = hasUpper && !hasLower;
  const allLower = hasLower && !hasUpper;

  // Punctuation
  const hasPeriods = /[.!?]$/.test(text.trim());
  const hasCommas = /,/.test(text);

  return {
    wordCount: words.length,
    charCount: text.length,
    hasEmoji: emojiMatches.length > 0,
    emojiCount: emojiMatches.length,
    capitalization: allUpper ? 'all_caps' : allLower ? 'all_lower' : hasUpper ? 'proper' : 'mixed',
    punctuationStyle: hasPeriods && hasCommas ? 'full' : hasPeriods || hasCommas ? 'minimal' : 'none',
    lineBreaks: (text.match(/\n/g) || []).length,
    isVoiceNote: message.attachments?.some(a => a.isVoiceNote) || false,
  };
}

function getContext(text: string, index: number, chars: number): string {
  const start = Math.max(0, index - chars);
  const end = Math.min(text.length, index + chars);
  return text.slice(start, end);
}
```

### 1.5 Extraction Queue

Background queue for Tier 2 LLM extraction:

**File: `lib/intelligence/extraction/queue.ts`**

```typescript
import { intelligenceDb } from '../knowledge/store';

export interface ExtractionQueueItem {
  id: string;
  chatId: string;
  contactId: string;
  messageIds: string[];
  priority: 'high' | 'normal' | 'low';
  scheduledFor: string;
  attempts: number;
  lastError?: string;
  createdAt: string;
}

export const extractionQueue = {
  async add(item: Omit<ExtractionQueueItem, 'id' | 'attempts' | 'createdAt'>): Promise<void> {
    await intelligenceDb.extractionQueue.put({
      ...item,
      id: `${item.chatId}-${Date.now()}`,
      attempts: 0,
      createdAt: new Date().toISOString(),
    });
  },

  async getNext(limit: number = 10): Promise<ExtractionQueueItem[]> {
    const now = new Date().toISOString();
    return intelligenceDb.extractionQueue
      .where('scheduledFor')
      .belowOrEqual(now)
      .limit(limit)
      .sortBy('priority');
  },

  async markComplete(id: string): Promise<void> {
    await intelligenceDb.extractionQueue.delete(id);
  },

  async markFailed(id: string, error: string): Promise<void> {
    const item = await intelligenceDb.extractionQueue.get(id);
    if (item) {
      if (item.attempts >= 3) {
        // Give up after 3 attempts
        await this.markComplete(id);
      } else {
        await intelligenceDb.extractionQueue.update(id, {
          attempts: item.attempts + 1,
          lastError: error,
          scheduledFor: new Date(Date.now() + 60000 * Math.pow(2, item.attempts)).toISOString(),
        });
      }
    }
  },
};
```

### 1.6 Intelligence Context

React context for accessing intelligence layer:

**File: `contexts/intelligence-context.tsx`**

```typescript
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useBeeperData } from '@/hooks/use-beeper-data';
import { ContactIntelligence, UserIntelligence } from '@/lib/intelligence/knowledge/types';
import { contactStore, userStateStore } from '@/lib/intelligence/knowledge/store';
import { syncCrmToIntelligence } from '@/lib/intelligence/knowledge/crm-bridge';
import { extractTier1 } from '@/lib/intelligence/extraction/tier1-local';
import { extractionQueue } from '@/lib/intelligence/extraction/queue';

interface IntelligenceContextValue {
  // Contact intelligence
  getContactIntelligence: (chatId: string) => Promise<ContactIntelligence | null>;

  // User state
  userState: UserIntelligence | null;

  // Status
  isInitialized: boolean;
  extractionQueueSize: number;

  // Actions
  triggerExtraction: (chatId: string) => Promise<void>;
  refreshUserState: () => Promise<void>;
}

const IntelligenceContext = createContext<IntelligenceContextValue | null>(null);

export function IntelligenceProvider({ children }: { children: ReactNode }) {
  const { messages } = useBeeperData();
  const [isInitialized, setIsInitialized] = useState(false);
  const [userState, setUserState] = useState<UserIntelligence | null>(null);
  const [extractionQueueSize, setExtractionQueueSize] = useState(0);
  const [processedMessageIds] = useState(() => new Set<string>());

  // Initialize on mount
  useEffect(() => {
    async function init() {
      await syncCrmToIntelligence();
      const state = await userStateStore.get();
      setUserState(state || null);
      setIsInitialized(true);
    }
    init();
  }, []);

  // Process new messages with Tier 1 extraction
  useEffect(() => {
    if (!isInitialized) return;

    for (const message of messages) {
      if (processedMessageIds.has(message.id)) continue;
      processedMessageIds.add(message.id);

      // Run Tier 1 extraction (synchronous, free)
      const tier1Result = extractTier1(message);

      // TODO: Store tier1 results, queue for tier2 if needed
      console.log('Tier1 extraction:', message.id, tier1Result);
    }
  }, [messages, isInitialized, processedMessageIds]);

  const getContactIntelligence = useCallback(async (chatId: string) => {
    return contactStore.getByChatId(chatId) || null;
  }, []);

  const triggerExtraction = useCallback(async (chatId: string) => {
    await extractionQueue.add({
      chatId,
      contactId: '', // Will be resolved
      messageIds: [],
      priority: 'high',
      scheduledFor: new Date().toISOString(),
    });
    const queue = await extractionQueue.getNext(100);
    setExtractionQueueSize(queue.length);
  }, []);

  const refreshUserState = useCallback(async () => {
    const state = await userStateStore.get();
    setUserState(state || null);
  }, []);

  return (
    <IntelligenceContext.Provider value={{
      getContactIntelligence,
      userState,
      isInitialized,
      extractionQueueSize,
      triggerExtraction,
      refreshUserState,
    }}>
      {children}
    </IntelligenceContext.Provider>
  );
}

export function useIntelligence(): IntelligenceContextValue {
  const context = useContext(IntelligenceContext);
  if (!context) {
    throw new Error('useIntelligence must be used within IntelligenceProvider');
  }
  return context;
}
```

---

## Phase 2: Per-Contact Intelligence (Week 4-6)

### 2.1 Tier 2 LLM Extraction

**File: `lib/intelligence/extraction/tier2-llm.ts`**

Batched per-contact extraction using Claude API:

```typescript
import { BeeperMessage } from '@/lib/types';
import { ContactFact, RelationshipClassification, ActionItem } from '../knowledge/types';

export interface Tier2ExtractionResult {
  facts: ContactFact[];
  relationship: RelationshipClassification;
  actionItems: ActionItem[];
  summary: string;
}

export async function extractTier2(
  messages: BeeperMessage[],
  existingFacts: ContactFact[]
): Promise<Tier2ExtractionResult> {
  // Build prompt with message context and existing facts
  const prompt = buildExtractionPrompt(messages, existingFacts);

  const response = await fetch('/api/intelligence/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, messages }),
  });

  return response.json();
}

function buildExtractionPrompt(
  messages: BeeperMessage[],
  existingFacts: ContactFact[]
): string {
  // Detailed prompt for fact extraction, relationship classification,
  // action item detection, and summary generation
  return `...`;
}
```

**File: `app/api/intelligence/extract/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function POST(request: Request) {
  const { prompt, messages } = await request.json();

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-latest', // Use Haiku for cost efficiency
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  // Parse structured output
  const result = parseExtractionResponse(response.content[0].text);

  return NextResponse.json(result);
}
```

### 2.2 Fact Deduplication & Contradiction Resolution

**File: `lib/intelligence/knowledge/deduplication.ts`**

```typescript
import { ContactFact } from './types';

export function deduplicateFacts(
  existing: ContactFact[],
  incoming: ContactFact[]
): ContactFact[] {
  // Category-level deduplication
  // Newer facts supersede older ones in same category
  // Contradiction detection and resolution
}

export function resolveContradiction(
  fact1: ContactFact,
  fact2: ContactFact
): ContactFact {
  // Use recency, confidence, and source quality to resolve
}
```

### 2.3 Relationship Classification

**File: `lib/intelligence/extraction/relationship-classifier.ts`**

Classify relationship type from conversation patterns:

```typescript
export function classifyRelationship(
  messages: BeeperMessage[],
  tier1Results: Tier1ExtractionResult[]
): RelationshipClassification {
  // Analyze:
  // - Message frequency and patterns
  // - Formality level
  // - Topic distribution
  // - Response times
  // Return classification with confidence
}
```

---

## Phase 3: Style Matrix (Week 7-9)

### 3.1 Style Model

**File: `lib/intelligence/style/model.ts`**

```typescript
import { StyleFingerprint, StyleMatrix, StyleInstruction } from './types';
import { RelationshipType } from '../knowledge/types';

export class StyleModel {
  private matrix: StyleMatrix;

  // Build fingerprint from messages
  buildFingerprint(messages: BeeperMessage[]): StyleFingerprint;

  // Resolve style for context
  resolveStyle(contactId: string, platform: string): StyleFingerprint;

  // Get natural language instructions for drafting
  getStyleInstructions(contactId: string, platform: string): StyleInstruction;

  // Fallback hierarchy
  private fallbackChain(
    contactId: string,
    platform: string,
    relationshipType: RelationshipType
  ): StyleFingerprint;
}
```

### 3.2 Cold Start System

**File: `lib/intelligence/style/cold-start.ts`**

```typescript
// Platform × Relationship default style matrix
const COLD_START_MATRIX: Record<string, Record<RelationshipType, StyleFingerprint>> = {
  whatsapp: {
    close_friend: { /* casual, emoji-heavy, short */ },
    professional: { /* semi-formal, moderate length */ },
    // ...
  },
  linkedin: {
    professional: { /* formal, proper punctuation */ },
    // ...
  },
  // ...
};

export function getColdStartStyle(
  platform: string,
  relationshipType: RelationshipType
): StyleFingerprint {
  return COLD_START_MATRIX[platform]?.[relationshipType]
    || COLD_START_MATRIX['default'][relationshipType]
    || DEFAULT_STYLE;
}
```

---

## Phase 4: Ambient Stream + User Intelligence (Week 10-12)

### 4.1 Ambient Stream Processor

**File: `lib/intelligence/user-state/ambient-processor.ts`**

```typescript
import { UserIntelligence, TopicCluster, ActiveContext, DistributedInfoItem } from './types';

export class AmbientStreamProcessor {
  private windowHours: number = 48;

  // Process sent messages in aggregate
  async process(sentMessages: BeeperMessage[]): Promise<Partial<UserIntelligence>> {
    const windowStart = new Date(Date.now() - this.windowHours * 60 * 60 * 1000);
    const recentMessages = sentMessages.filter(
      m => new Date(m.timestamp) > windowStart
    );

    return {
      activeTopics: await this.clusterTopics(recentMessages),
      activeContexts: await this.inferContexts(recentMessages),
      distributedInfo: await this.trackDistribution(recentMessages),
      communicationMode: this.detectMode(recentMessages),
    };
  }

  private async clusterTopics(messages: BeeperMessage[]): Promise<TopicCluster[]>;
  private async inferContexts(messages: BeeperMessage[]): Promise<ActiveContext[]>;
  private async trackDistribution(messages: BeeperMessage[]): Promise<DistributedInfoItem[]>;
  private detectMode(messages: BeeperMessage[]): CommunicationMode;
}
```

### 4.2 User State Agent

**File: `lib/intelligence/agents/infrastructure/user-state-agent.ts`**

```typescript
import { UserIntelligence } from '../../user-state/types';
import { userStateStore } from '../../knowledge/store';

export class UserStateAgent {
  async getCurrentState(): Promise<UserIntelligence | null> {
    return userStateStore.get();
  }

  async getActiveContexts(): Promise<ActiveContext[]> {
    const state = await this.getCurrentState();
    return state?.activeContexts || [];
  }

  async getDistributedInfo(topic?: string): Promise<DistributedInfoItem[]> {
    const state = await this.getCurrentState();
    const items = state?.distributedInfo || [];
    if (topic) {
      return items.filter(i => i.content.toLowerCase().includes(topic.toLowerCase()));
    }
    return items;
  }

  async whoKnowsAbout(topic: string): Promise<string[]> {
    const info = await this.getDistributedInfo(topic);
    return [...new Set(info.flatMap(i => i.sharedWith))];
  }

  async whoDoesntKnowAbout(topic: string, relevantContacts: string[]): Promise<string[]> {
    const knowers = new Set(await this.whoKnowsAbout(topic));
    return relevantContacts.filter(c => !knowers.has(c));
  }
}
```

---

## Phase 5: Multi-Agent System (Week 13-16)

### 5.1 Interaction Layer

**File: `lib/intelligence/agents/interaction-layer.ts`**

```typescript
export class InteractionLayer {
  // The wait pattern - filter noise
  private shouldSurface(message: SystemMessage): 'now' | 'later' | 'absorb';

  // Format response for user
  formatResponse(agentOutput: unknown, context: MessageContext): string;

  // Insert draft verbatim (no personality overlay)
  formatDraft(draft: string, meta: DraftMeta): DraftPresentation;
}
```

### 5.2 Orchestrator

**File: `lib/intelligence/agents/orchestrator.ts`**

```typescript
import { Agent, AgentType } from './types';
import { agentStore } from '../knowledge/store';

export class Orchestrator {
  private readonly MAX_ACTIVE_AGENTS = 50;

  // Route to existing or spawn new agent
  async route(request: AgentMessage): Promise<Agent> {
    // Check for existing agent
    let agent = await this.findExistingAgent(request);

    if (!agent) {
      // Check roster limits
      await this.enforceRosterLimits();

      // Spawn new agent
      agent = await this.spawnAgent(request);
    }

    return agent;
  }

  private async findExistingAgent(request: AgentMessage): Promise<Agent | null>;
  private async spawnAgent(request: AgentMessage): Promise<Agent>;
  private async enforceRosterLimits(): Promise<void>;

  // Lifecycle management
  async transitionAgent(agentId: string, newLifecycle: AgentLifecycle): Promise<void>;
  async runLifecycleMaintenance(): Promise<void>;
}
```

### 5.3 Conversation Agent

**File: `lib/intelligence/agents/dynamic/conversation-agent.ts`**

```typescript
export class ConversationAgent {
  constructor(
    private contactId: string,
    private platform: string,
    private knowledgeAgent: KnowledgeAgent,
    private styleAgent: StyleAgent,
    private userStateAgent: UserStateAgent,
    private platformAgent: PlatformAgent
  ) {}

  async draftReply(incomingMessage: BeeperMessage): Promise<DraftResult> {
    // 1. Get contact knowledge
    const contact = await this.knowledgeAgent.getContactProfile(this.contactId);

    // 2. Get style instructions
    const style = await this.styleAgent.getStyleInstructions(this.contactId, this.platform);

    // 3. Get user state - what am I currently doing? what have I told others?
    const userContext = await this.userStateAgent.getCurrentState();
    const relevantInfo = await this.userStateAgent.getDistributedInfo(/* topic from message */);

    // 4. Get platform norms
    const platformNorms = await this.platformAgent.getPlatformNorms(this.platform);

    // 5. Assemble context and draft
    return this.generateDraft({
      contact,
      style,
      userContext,
      relevantInfo,
      platformNorms,
      incomingMessage,
    });
  }

  private async generateDraft(context: DraftContext): Promise<DraftResult>;
}
```

---

## Phase 6: Triggers System (Week 17-19)

### 6.1 Trigger Store

**File: `lib/intelligence/triggers/store.ts`**

```typescript
export interface Trigger {
  id: string;
  type: 'scheduled' | 'recurring' | 'conditional' | 'pattern' | 'event';
  ownerAgentId: string;

  // Schedule (for scheduled/recurring)
  schedule?: string; // iCal VEVENT format

  // Condition (for conditional/pattern)
  condition?: TriggerCondition;

  // Action
  action: TriggerAction;

  // State
  enabled: boolean;
  lastFired?: string;
  nextFire?: string;

  createdAt: string;
}

export interface TriggerCondition {
  type: 'message_from' | 'keyword' | 'no_contact' | 'context_change';
  params: Record<string, unknown>;
}

export interface TriggerAction {
  type: 'notify' | 'draft' | 'summarize' | 'execute_agent';
  params: Record<string, unknown>;
}
```

### 6.2 Scheduler

**File: `lib/intelligence/triggers/scheduler.ts`**

```typescript
export class TriggerScheduler {
  private checkInterval: number = 60000; // 1 minute

  start(): void {
    setInterval(() => this.checkTriggers(), this.checkInterval);
  }

  private async checkTriggers(): Promise<void> {
    const triggers = await triggerStore.getDue();

    for (const trigger of triggers) {
      await this.fireTrigger(trigger);
    }
  }

  private async fireTrigger(trigger: Trigger): Promise<void> {
    // Reactivate owner agent
    // Execute action
    // Update trigger state
  }
}
```

---

## Phase 7: AI Companion UI (Week 20-23)

The intelligence layer needs a home - an AI companion panel that feels like a proactive friend watching alongside you. Not every chat needs it, so it's opt-in per chat via an activation button.

### 7.1 Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           MESSAGE PANEL (existing)                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Chat Header                                              [👤] [✕]  │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │                     Chat Messages                                   │   │
│  │                     (ScrollArea)                                    │   │
│  │                                                                     │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │  Message Input                                    [🔮] [Send] │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  │        ↑                                                            │   │
│  │    AI Orb Button - activates companion panel                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘

When activated:
┌────────────────────────────────────────────────────────────────────────────┐
│  MESSAGE PANEL                    │  AI COMPANION PANEL                    │
│  ┌────────────────────────────┐   │  ┌────────────────────────────────┐   │
│  │ Chat Header         [👤][✕]│   │  │ 🔮 Companion        [⚙️] [✕]   │   │
│  ├────────────────────────────┤   │  ├────────────────────────────────┤   │
│  │                            │   │  │ "I noticed Max asked about     │   │
│  │    Chat Messages           │   │  │  the party - here's what       │   │
│  │                            │   │  │  you've told others..."        │   │
│  │                            │   │  │                                │   │
│  │                            │   │  │ ┌────────────────────────────┐ │   │
│  │                            │   │  │ │ Draft suggestion           │ │   │
│  │                            │   │  │ │ [Use] [Edit] [Dismiss]     │ │   │
│  │                            │   │  │ └────────────────────────────┘ │   │
│  │                            │   │  │                                │   │
│  │                            │   │  │ Quick actions:                 │   │
│  │                            │   │  │ [📝 Draft reply]              │   │
│  │                            │   │  │ [📎 Send file]                │   │
│  │                            │   │  │ [🔍 Search history]           │   │
│  ├────────────────────────────┤   │  │ [📊 Contact insights]         │   │
│  │ Input              [🔮][▶]│   │  ├────────────────────────────────┤   │
│  └────────────────────────────┘   │  │ Ask me anything...      [Send]│   │
└────────────────────────────────────┴──┴────────────────────────────────┴───┘
```

### 7.2 The AI Orb Button

A small animated sphere button positioned next to the send button. Clicking it activates the AI Companion for this specific chat.

**File: `components/intelligence/ai-orb-button.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AiOrbButtonProps {
  isActive: boolean;
  onClick: () => void;
  hasNotification?: boolean;
  isThinking?: boolean;
  className?: string;
}

export function AiOrbButton({
  isActive,
  onClick,
  hasNotification = false,
  isThinking = false,
  className,
}: AiOrbButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      className={cn(
        'relative w-9 h-9 rounded-full',
        'bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600',
        'shadow-lg shadow-purple-500/25',
        'hover:shadow-purple-500/40 hover:scale-105',
        'transition-all duration-200',
        'flex items-center justify-center',
        isActive && 'ring-2 ring-purple-400 ring-offset-2 ring-offset-background',
        className
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title={isActive ? 'AI Companion active' : 'Activate AI Companion'}
    >
      {/* Animated inner glow */}
      <motion.div
        className="absolute inset-1 rounded-full bg-white/20"
        animate={isThinking ? {
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.4, 0.2],
        } : {}}
        transition={{ repeat: Infinity, duration: 1.5 }}
      />

      {/* Core orb */}
      <div className="w-4 h-4 rounded-full bg-white/80" />

      {/* Notification dot */}
      {hasNotification && !isActive && (
        <motion.div
          className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
        />
      )}

      {/* Active state particles */}
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            boxShadow: [
              '0 0 0 0 rgba(139, 92, 246, 0.4)',
              '0 0 0 8px rgba(139, 92, 246, 0)',
            ],
          }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        />
      )}
    </motion.button>
  );
}
```

### 7.3 The AI Companion Panel

The main panel where the AI companion lives. It's a conversational interface that proactively offers help.

**File: `components/intelligence/ai-companion-panel.tsx`**

```typescript
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  X,
  Settings,
  Sparkles,
  FileText,
  Search,
  BarChart3,
  Send,
  Paperclip,
  Loader2,
  Check,
  Pencil,
  XCircle,
} from 'lucide-react';
import { useCompanion } from '@/hooks/use-companion';
import { cn } from '@/lib/utils';

interface AiCompanionPanelProps {
  chatId: string;
  contactName: string;
  platform: string;
  isOpen: boolean;
  onClose: () => void;
  onUseDraft: (text: string) => void;
}

export function AiCompanionPanel({
  chatId,
  contactName,
  platform,
  isOpen,
  onClose,
  onUseDraft,
}: AiCompanionPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isThinking,
    pendingDraft,
    suggestions,
    contactInsights,
    userContext,
    send,
    acceptDraft,
    editDraft,
    dismissDraft,
    requestDraft,
    requestInsights,
    searchHistory,
  } = useCompanion({ chatId, contactName, platform });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-slot="scroll-area-viewport"]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    send(input);
    setInput('');
  }, [input, send]);

  const handleUseDraft = useCallback((text: string) => {
    onUseDraft(text);
    acceptDraft();
  }, [onUseDraft, acceptDraft]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 320, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="h-full bg-card border-l flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-medium">Companion</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="p-3 space-y-3">
          {/* Proactive context banner */}
          {userContext && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3 text-xs"
            >
              <p className="text-purple-700 dark:text-purple-300">
                {userContext}
              </p>
            </motion.div>
          )}

          {/* Conversation messages */}
          {messages.map((msg, idx) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'flex',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[90%] rounded-lg px-3 py-2 text-xs',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}

          {/* Thinking indicator */}
          {isThinking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Thinking...</span>
            </motion.div>
          )}

          {/* Pending draft */}
          {pendingDraft && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/50 dark:to-indigo-950/50 rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center gap-2 text-xs font-medium text-violet-700 dark:text-violet-300">
                <FileText className="h-3 w-3" />
                <span>Suggested reply</span>
              </div>
              <p className="text-xs whitespace-pre-wrap">{pendingDraft.text}</p>
              {pendingDraft.context && (
                <p className="text-xs text-muted-foreground italic">
                  {pendingDraft.context}
                </p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleUseDraft(pendingDraft.text)}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Use
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs"
                  onClick={() => editDraft(pendingDraft.text)}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={dismissDraft}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Dismiss
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* Quick actions */}
      <div className="shrink-0 p-2 border-t bg-muted/30">
        <div className="flex flex-wrap gap-1">
          <QuickAction
            icon={<FileText className="h-3 w-3" />}
            label="Draft reply"
            onClick={requestDraft}
          />
          <QuickAction
            icon={<Paperclip className="h-3 w-3" />}
            label="Send file"
            onClick={() => {/* TODO */}}
          />
          <QuickAction
            icon={<Search className="h-3 w-3" />}
            label="Search"
            onClick={searchHistory}
          />
          <QuickAction
            icon={<BarChart3 className="h-3 w-3" />}
            label="Insights"
            onClick={requestInsights}
          />
        </div>
      </div>

      <Separator />

      {/* Input area */}
      <div className="shrink-0 p-3">
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything..."
            className="h-8 text-xs"
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <Button
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 text-xs gap-1"
      onClick={onClick}
    >
      {icon}
      {label}
    </Button>
  );
}
```

### 7.4 The Companion Hook

Manages the companion's state, conversation, and proactive behaviors.

**File: `hooks/use-companion.ts`**

```typescript
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useIntelligence } from '@/contexts/intelligence-context';
import { useBeeperData } from '@/hooks/use-beeper-data';

interface CompanionMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface PendingDraft {
  text: string;
  context?: string; // e.g., "Based on what you told Sarah yesterday"
}

interface UseCompanionOptions {
  chatId: string;
  contactName: string;
  platform: string;
}

export function useCompanion({ chatId, contactName, platform }: UseCompanionOptions) {
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);
  const [userContext, setUserContext] = useState<string | null>(null);

  const { getContactIntelligence, userState } = useIntelligence();
  const { sentMessages } = useBeeperData();

  const hasInitialized = useRef(false);

  // Initialize companion with proactive context on mount
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    initializeCompanion();
  }, [chatId]);

  const initializeCompanion = async () => {
    setIsThinking(true);

    try {
      // Get contact intelligence
      const contact = await getContactIntelligence(chatId);

      // Build proactive context
      const context = await buildProactiveContext(contact, userState, chatId);

      if (context) {
        setUserContext(context);

        // Add initial greeting
        addAssistantMessage(
          `Hey! I see you're chatting with ${contactName}. ${context}`
        );
      } else {
        addAssistantMessage(
          `I'm here to help with your conversation with ${contactName}. Just ask!`
        );
      }
    } finally {
      setIsThinking(false);
    }
  };

  const buildProactiveContext = async (
    contact: ContactIntelligence | null,
    userState: UserIntelligence | null,
    chatId: string
  ): Promise<string | null> => {
    const insights: string[] = [];

    // Check if we have relevant distributed info
    if (userState?.distributedInfo) {
      // Look for topics this contact might not know about yet
      const relevantInfo = userState.distributedInfo.filter(
        info => !info.sharedWith.includes(chatId) && info.sharedWith.length > 0
      );

      if (relevantInfo.length > 0) {
        insights.push(
          `I noticed you've been telling others about "${relevantInfo[0].content.slice(0, 50)}..." - want me to help share that here too?`
        );
      }
    }

    // Check for pending action items
    if (contact?.actionItems) {
      const pending = contact.actionItems.filter(a => a.status === 'pending');
      if (pending.length > 0) {
        insights.push(
          `You mentioned you'd "${pending[0].content}" - want me to help with that?`
        );
      }
    }

    // Check active contexts
    if (userState?.activeContexts) {
      const relevantContexts = userState.activeContexts.filter(
        ctx => ctx.relatedContacts.includes(chatId)
      );
      if (relevantContexts.length > 0) {
        insights.push(
          `I see this relates to your "${relevantContexts[0].label}" - I have all the details handy.`
        );
      }
    }

    return insights.length > 0 ? insights[0] : null;
  };

  const addAssistantMessage = (content: string) => {
    setMessages(prev => [...prev, {
      id: `${Date.now()}-assistant`,
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
    }]);
  };

  const addUserMessage = (content: string) => {
    setMessages(prev => [...prev, {
      id: `${Date.now()}-user`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }]);
  };

  // Send a message to the companion
  const send = useCallback(async (content: string) => {
    addUserMessage(content);
    setIsThinking(true);

    try {
      const response = await fetch('/api/intelligence/companion/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          contactName,
          platform,
          message: content,
          history: messages.slice(-10), // Last 10 messages for context
        }),
      });

      const result = await response.json();

      if (result.draft) {
        setPendingDraft({
          text: result.draft,
          context: result.draftContext,
        });
      }

      addAssistantMessage(result.response);
    } catch (error) {
      addAssistantMessage("Sorry, I couldn't process that. Try again?");
    } finally {
      setIsThinking(false);
    }
  }, [chatId, contactName, platform, messages]);

  // Request a draft reply
  const requestDraft = useCallback(async () => {
    setIsThinking(true);
    addAssistantMessage("Let me draft something for you...");

    try {
      const response = await fetch('/api/intelligence/companion/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          contactName,
          platform,
        }),
      });

      const result = await response.json();

      setPendingDraft({
        text: result.draft,
        context: result.context,
      });

      addAssistantMessage(
        result.context
          ? `Here's a draft based on ${result.context}:`
          : "Here's a suggested reply:"
      );
    } catch (error) {
      addAssistantMessage("Sorry, I couldn't generate a draft right now.");
    } finally {
      setIsThinking(false);
    }
  }, [chatId, contactName, platform]);

  // Accept the pending draft
  const acceptDraft = useCallback(() => {
    setPendingDraft(null);
    addAssistantMessage("Great! I've added it to your message.");
  }, []);

  // Edit the draft (just dismisses and lets user modify in input)
  const editDraft = useCallback((text: string) => {
    setPendingDraft(null);
    addAssistantMessage("I've put it in your message box for editing.");
  }, []);

  // Dismiss the draft
  const dismissDraft = useCallback(() => {
    setPendingDraft(null);
    addAssistantMessage("No problem, let me know if you want something different.");
  }, []);

  // Request contact insights
  const requestInsights = useCallback(async () => {
    setIsThinking(true);

    try {
      const contact = await getContactIntelligence(chatId);

      if (contact?.facts && contact.facts.length > 0) {
        const factsSummary = contact.facts
          .slice(0, 5)
          .map(f => `• ${f.content}`)
          .join('\n');

        addAssistantMessage(
          `Here's what I know about ${contactName}:\n\n${factsSummary}`
        );
      } else {
        addAssistantMessage(
          `I'm still learning about ${contactName}. Chat more and I'll pick up on the details!`
        );
      }
    } finally {
      setIsThinking(false);
    }
  }, [chatId, contactName, getContactIntelligence]);

  // Search conversation history
  const searchHistory = useCallback(async () => {
    addAssistantMessage(
      "What are you looking for? Type your search and I'll find it in your conversation history."
    );
    // The next user message will be treated as a search query
  }, []);

  return {
    messages,
    isThinking,
    pendingDraft,
    suggestions: [], // Future: quick suggestion chips
    contactInsights: null, // Future: structured insights
    userContext,
    send,
    acceptDraft,
    editDraft,
    dismissDraft,
    requestDraft,
    requestInsights,
    searchHistory,
  };
}
```

### 7.5 Companion Chat API

Server-side handler for companion conversations.

**File: `app/api/intelligence/companion/chat/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { contactStore, userStateStore } from '@/lib/intelligence/knowledge/store';

const anthropic = new Anthropic();

export async function POST(request: Request) {
  const { chatId, contactName, platform, message, history } = await request.json();

  // Gather context
  const contact = await contactStore.getByChatId(chatId);
  const userState = await userStateStore.get();

  // Build system prompt with all intelligence
  const systemPrompt = buildCompanionSystemPrompt({
    contactName,
    platform,
    contact,
    userState,
  });

  // Build conversation history
  const messages = history.map((m: any) => ({
    role: m.role,
    content: m.content,
  }));

  messages.push({ role: 'user', content: message });

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-latest',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const responseText = response.content[0].type === 'text'
    ? response.content[0].text
    : '';

  // Check if response contains a draft
  const draftMatch = responseText.match(/<draft>([\s\S]*?)<\/draft>/);
  const draft = draftMatch ? draftMatch[1].trim() : null;
  const cleanResponse = responseText.replace(/<draft>[\s\S]*?<\/draft>/, '').trim();

  return NextResponse.json({
    response: cleanResponse,
    draft,
    draftContext: draft ? 'Based on your recent conversations' : null,
  });
}

function buildCompanionSystemPrompt({
  contactName,
  platform,
  contact,
  userState,
}: {
  contactName: string;
  platform: string;
  contact: any;
  userState: any;
}): string {
  return `You are a helpful AI companion assisting the user with their conversation with ${contactName} on ${platform}.

You have access to the following intelligence:

## About ${contactName}
${contact?.facts?.map((f: any) => `- ${f.content}`).join('\n') || 'No facts recorded yet.'}

Relationship: ${contact?.relationship?.type || 'unknown'}

## What the user is currently doing
${userState?.activeContexts?.map((c: any) => `- ${c.label}`).join('\n') || 'No active contexts.'}

## What the user has been telling others
${userState?.distributedInfo?.slice(0, 3).map((i: any) => `- "${i.content}" (shared with ${i.sharedWith.length} people)`).join('\n') || 'No distributed info.'}

## Your role
- Be proactive and helpful
- Offer to draft replies when appropriate
- Surface relevant context the user might have forgotten
- Keep responses concise and natural
- Match the user's tone

When you want to suggest a draft reply, wrap it in <draft></draft> tags. The draft should match the user's style for this platform and relationship.

Do not be overly formal or robotic. You're a friend watching alongside them, helping out.`;
}
```

### 7.6 Integration with MessagePanel

Update the MessagePanel to include the AI Orb and Companion Panel.

**Updated `components/message-panel.tsx` structure:**

```typescript
// Add to imports
import { AiOrbButton } from '@/components/intelligence/ai-orb-button';
import { AiCompanionPanel } from '@/components/intelligence/ai-companion-panel';

// Add state
const [isCompanionOpen, setIsCompanionOpen] = useState(false);

// In the render, wrap in a flex container
return (
  <div className="flex h-full">
    {/* Main message panel */}
    <div className={cn(
      'h-full transition-all duration-300 ease-in-out',
      isOpen ? (isCompanionOpen ? 'w-96' : 'w-96') : 'w-0'
    )}>
      {/* ... existing panel content ... */}

      {/* Update bottom section to include AI Orb */}
      <div className="shrink-0 p-4">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <MessageBottomSection
              chatId={chatId || null}
              chatName={title}
              draftText={draftText}
              onDraftTextChange={setDraftText}
              isSending={isSending}
              sendSuccess={sendSuccess}
              onSend={handleSend}
            />
          </div>
          <AiOrbButton
            isActive={isCompanionOpen}
            onClick={() => setIsCompanionOpen(!isCompanionOpen)}
            hasNotification={/* TODO: track pending suggestions */}
            isThinking={/* TODO: track companion thinking state */}
          />
        </div>
      </div>
    </div>

    {/* AI Companion Panel */}
    <AnimatePresence>
      {isCompanionOpen && chatId && (
        <AiCompanionPanel
          chatId={chatId}
          contactName={title}
          platform={platform}
          isOpen={isCompanionOpen}
          onClose={() => setIsCompanionOpen(false)}
          onUseDraft={(text) => setDraftText(text)}
        />
      )}
    </AnimatePresence>
  </div>
);
```

### 7.7 Companion Tools

The companion has access to a rich toolset:

```typescript
export type CompanionTool =
  // Drafting
  | { type: 'draft_reply'; params: { style?: string; length?: 'short' | 'medium' | 'long' } }
  | { type: 'rewrite_draft'; params: { text: string; instruction: string } }

  // Knowledge
  | { type: 'get_contact_facts'; params: { categories?: string[] } }
  | { type: 'search_history'; params: { query: string } }
  | { type: 'who_knows_about'; params: { topic: string } }

  // Files & Attachments
  | { type: 'suggest_file'; params: { context: string } }
  | { type: 'prepare_attachment'; params: { fileId: string } }

  // User State
  | { type: 'get_active_contexts'; params: {} }
  | { type: 'get_distributed_info'; params: { topic?: string } }
  | { type: 'get_canonical_explanation'; params: { topic: string } }

  // Actions
  | { type: 'set_reminder'; params: { content: string; when: string } }
  | { type: 'create_action_item'; params: { content: string; contact?: string } };
```

### 7.8 Proactive Behaviors

The companion doesn't just wait for requests - it proactively helps:

```typescript
interface ProactiveBehavior {
  trigger: ProactiveTrigger;
  action: ProactiveAction;
  cooldown: number; // Don't trigger again within this many seconds
}

type ProactiveTrigger =
  | { type: 'new_message_received'; filter?: { fromContact?: boolean } }
  | { type: 'user_typing_paused'; duration: number }
  | { type: 'context_relevant'; contextId: string }
  | { type: 'action_item_due'; contactId: string }
  | { type: 'long_time_no_reply'; hours: number };

type ProactiveAction =
  | { type: 'show_context'; content: string }
  | { type: 'suggest_draft'; draft: string; reason: string }
  | { type: 'remind_action_item'; item: ActionItem }
  | { type: 'surface_distributed_info'; info: DistributedInfoItem };
```

**Example proactive behaviors:**

1. **New message received**: "They mentioned 'birthday' - you've been organizing one! Want me to share the details?"

2. **User typing paused**: "Need help? I can draft something based on your usual replies to Max."

3. **Action item due**: "You mentioned you'd send Sarah the photos - want me to help with that?"

4. **Distributed info relevant**: "You've told 5 other people about the party address - want to share it here too?"

---

## Phase 8.5: Auto-Soul Extraction (Post-Plan Addition)

### Motivation

The Soul/Identity layer originally required manual form entry for personality traits, communication style, etc. A key insight changed this: **the user is the common thread across every chat on the platform**. Years of sent messages across all conversations reveal personality, tone, communication patterns, values, and habits far more richly than any manual form.

Auto-Soul Extraction samples the user's sent messages across all chats, sends them to an LLM for identity trait extraction, and merges results into the existing `UserSoul`. The Soul Editor transforms from a manual creation form into a review/edit UI.

### 8.5.1 Extended UserSoul Type

**File: `lib/intelligence/user-state/soul.ts`** (modified)

Added `SoulTrait` interface and `extractedTraits` array to `UserSoul`:

```typescript
export type SoulTraitCategory =
  | 'personality'
  | 'communication_style'
  | 'value'
  | 'background'
  | 'habit'
  | 'preference'
  | 'identity';

export interface SoulTrait {
  id: string;
  category: SoulTraitCategory;
  content: string;           // "Uses lowercase in casual chats"
  confidence: number;        // 0-1
  evidence: string[];        // Sample message snippets that support this
  extractedAt: string;
  userVerified?: boolean;    // Pinned by user — survives re-extraction
  userEdited?: boolean;      // Content manually modified
  isActive: boolean;
}

// Added to UserSoul interface:
extractedTraits: SoulTrait[];
lastExtractionAt?: string;
```

- `createDefaultSoul()` updated to include `extractedTraits: []`
- `isSoulConfigured()` updated to also check `extractedTraits.filter(t => t.isActive).length > 0`
- `renderSoulBlock()` updated to render extracted traits grouped by category (Personality, Communication Style, Values, Background, Habits, Preferences, Identity) after the existing manual fields

### 8.5.2 Soul Extractor Module

**File: `lib/intelligence/extraction/soul-extractor.ts`** (new)

Complete extraction pipeline:

```typescript
// Message sampling - diversifies across chats, filters noise, prefers recent
export function sampleMessagesForSoulExtraction(
  allMessages: BeeperMessage[],
  maxMessages?: number  // default 200
): BeeperMessage[]

// Prompt building - anonymizes conversations, lists existing traits to avoid re-extraction
export function buildSoulExtractionPrompt(request: SoulExtractionRequest): string

// Response parsing - validates categories, assigns IDs, skips duplicates of verified traits
export function parseSoulExtractionResponse(
  responseText: string,
  existingTraits: SoulTrait[]
): SoulTrait[]

// Trait merging - preserves pinned/edited, boosts confidence on re-confirmation
export function mergeSoulTraits(
  existing: SoulTrait[],
  incoming: SoulTrait[]
): { mergedTraits: SoulTrait[]; newCount: number; updatedCount: number }
```

**Sampling strategy** (`sampleMessagesForSoulExtraction`):
1. Filter to `isFromMe === true` only
2. Filter out very short messages (< 15 chars — "ok", "thanks", "lol")
3. Diversify across chats: round-robin sampling from each unique chatId
4. 70% from last 30 days, 30% from older messages for stability
5. Cap at `maxMessages` (default 200) to stay within token budget

**Trait merging** (`mergeSoulTraits`):
- `userVerified` traits are never overwritten
- `userEdited` traits are never overwritten
- Re-confirmed traits get confidence boost (+0.1, capped at 1.0)
- Similarity detection uses word overlap ratio (>60% threshold)
- Evidence arrays are deduplicated and capped at 5 items

### 8.5.3 Soul Extraction API Route

**File: `app/api/intelligence/extract/route.ts`** (modified)

Added `mode: 'soul'` branch to existing extraction API:

```typescript
if (body.mode === 'soul') {
  const prompt = buildSoulExtractionPrompt(body);
  const response = await llmClient.chat({
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 2048,
  });
  const traits = parseSoulExtractionResponse(response.content, body.existingTraits || []);
  return NextResponse.json({ traits });
}
```

Uses same cost-efficient models as contact extraction (Haiku / GPT-4o-mini).

### 8.5.4 Background Worker Integration

**File: `lib/intelligence/background-worker.ts`** (modified)

Added `runSoulExtraction()` to the worker tick cycle:

```typescript
// In WorkerConfig:
soulExtractionIntervalMs: number;  // default: 30 * 60 * 1000 (30 min)

// In tick(), after global scan:
if (now - this.state.lastSoulExtraction >= this.config.soulExtractionIntervalMs) {
  await this.runSoulExtraction();
  this.state.lastSoulExtraction = now;
}
```

`runSoulExtraction()` flow:
1. Loads all cached messages via `loadCachedMessages()`
2. Samples with `sampleMessagesForSoulExtraction()`
3. Loads current soul from `soulStore.get()`
4. Calls `/api/intelligence/extract` with `mode: 'soul'`
5. Merges new traits with `mergeSoulTraits()`
6. Saves updated soul via `soulStore.set()`
7. Emits `soul_updated` event

### 8.5.5 Event Bus Extension

**File: `lib/intelligence/event-bus.ts`** (modified)

Added soul event type:

```typescript
| { type: 'soul_updated'; traitCount: number; newTraits: number }
```

### 8.5.6 Companion Soul Refresh

**File: `hooks/use-companion.ts`** (modified)

Subscribes to `soul_updated` event to refresh the cached soul reference, ensuring the next companion API call uses updated soul traits:

```typescript
useEffect(() => {
  const unsubscribe = eventBus.on('soul_updated', async () => {
    const updatedSoul = await soulStore.get();
    soulRef.current = updatedSoul;
  });
  return unsubscribe;
}, []);
```

### 8.5.7 Soul Editor UI Transformation

**File: `components/intelligence/soul-editor.tsx`** (rewritten)

Transformed from manual creation form to review/edit UI:

- **Extracted traits section**: Grouped by category, sorted by pinned-first then confidence
- **Per-trait actions**: Pin/unpin (sets `userVerified`), inline edit (sets `userEdited`), delete (sets `isActive: false`)
- **Evidence display**: Expandable evidence snippets per trait with confidence badge
- **Extraction status**: Shows trait count, last extraction time
- **Manual overrides**: Collapsed under expandable "Manual Overrides" section (name, bio, toneKeywords, etc.)
- **Auto-refresh**: Subscribes to `soul_updated` events

---

## Phase 8: Observability & Debug (Week 24-26)

### 7.1 Debug Components

**File: `components/intelligence/debug/user-state-dashboard.tsx`**

Visual display of current User Intelligence:
- Active contexts with confidence
- Topic clusters ranked
- Information distribution map
- Communication mode indicator

**File: `components/intelligence/debug/knowledge-explorer.tsx`**

Browse all facts per contact:
- Category filters
- Provenance display
- Edit/delete capabilities
- Supersession history

**File: `components/intelligence/debug/agent-roster.tsx`**

Agent lifecycle management:
- Active/warm/cool/dormant counts
- Manual archive/reactivate
- Memory size indicators

### 7.2 Metrics

**File: `lib/intelligence/instrumentation/metrics.ts`**

```typescript
export interface IntelligenceMetrics {
  // Draft quality
  draftAcceptanceRate: number;
  draftEditRate: { noEdits: number; minorEdits: number; majorEdits: number };

  // Extraction accuracy
  factEditRate: number;
  userStateOverrideRate: number;

  // Agent efficiency
  agentReuseRate: number;
  avgAgentResponseTime: number;

  // Cost
  tier1Extractions: number; // free
  tier2Extractions: number;
  ambientProcessorRuns: number;
  draftGenerations: number;

  // Cross-chat intelligence
  userIntelligenceUsageRate: number; // % of drafts using user state
}
```

---

## File Structure

```
lib/intelligence/
  knowledge/
    types.ts                    ✅ Phase 1 - COMPLETE
    store.ts                    ✅ Phase 1 - COMPLETE
    crm-bridge.ts               ✅ Phase 1 - COMPLETE
    deduplication.ts            ✅ Phase 2 - COMPLETE (includes contradiction resolution, pruning)
    identity-linking.ts         ✅ Phase 2 - COMPLETE (cross-platform contact linking)
  user-state/
    types.ts                    ✅ Phase 1 - COMPLETE
    soul.ts                     ✅ Phase 8.5 - COMPLETE (SoulTrait type, extractedTraits, renderSoulBlock with traits)
    ambient-processor.ts        ✅ Phase 4 - COMPLETE
    canonical-explanations.ts   ✅ Phase 4 - COMPLETE
  extraction/
    tier1-local.ts              ✅ Phase 1 - COMPLETE
    tier2-llm.ts                ✅ Phase 2 - COMPLETE
    soul-extractor.ts           ✅ Phase 8.5 - COMPLETE (soul trait sampling, prompt, parsing, merging)
    relationship-classifier.ts  ✅ Phase 2 - COMPLETE
  style/
    model.ts                    ✅ Phase 3 - COMPLETE (includes fingerprinting)
    resolver.ts                 ✅ Phase 3 - COMPLETE (fallback hierarchy)
    clusters.ts                 ✅ Phase 3 - COMPLETE (k-means clustering)
  agents/
    types.ts                    ✅ Phase 1 - COMPLETE
    orchestrator.ts             ✅ Phase 5 - COMPLETE (routing, lifecycle, roster limits)
    infrastructure/
      knowledge-agent.ts        ✅ Phase 5 - COMPLETE
      style-agent.ts            ✅ Phase 5 - COMPLETE
      user-state-agent.ts       ✅ Phase 5 - COMPLETE
    dynamic/
      conversation-agent.ts     ✅ Phase 5 - COMPLETE (per-contact-per-platform drafting)
  triggers/
    types.ts                    ✅ Phase 6 - COMPLETE
    store.ts                    ✅ Phase 6 - COMPLETE
    scheduler.ts                ✅ Phase 6 - COMPLETE
  companion-state-store.ts      ✅ Phase 7 - COMPLETE
  activity-log.ts               ✅ Phase 7 - COMPLETE
  proactive-engine.ts           ✅ Phase 7 - COMPLETE
  instrumentation/
    metrics.ts                  ✅ Phase 8 - COMPLETE

contexts/
  intelligence-context.tsx      ✅ Phase 1 - COMPLETE
  beeper-data-context.tsx       ✅ (existing data pipeline)

hooks/
  use-beeper-data.ts            ✅ (existing)
  use-companion.ts              ✅ Phase 7 - COMPLETE

components/intelligence/
  ai-orb-button.tsx             ✅ Phase 7 - COMPLETE
  ai-companion-panel.tsx        ✅ Phase 7 - COMPLETE
  stream-of-consciousness.tsx   ✅ Phase 7 - COMPLETE
  soul-editor.tsx               ✅ Phase 8.5 - COMPLETE (review/edit UI for auto-extracted traits)
  debug/
    index.ts                    ✅ Phase 8 - COMPLETE
    user-state-dashboard.tsx    ✅ Phase 8 - COMPLETE
    knowledge-explorer.tsx      ✅ Phase 8 - COMPLETE
    agent-roster.tsx            ✅ Phase 8 - COMPLETE
    metrics-dashboard.tsx       ✅ Phase 8 - COMPLETE

app/settings/intelligence/
  page.tsx                      ✅ Intelligence settings
  debug/
    page.tsx                    ✅ Phase 8 - COMPLETE (debug dashboard page)
```

---

## Dependencies to Add

```json
{
  "dependencies": {
    "dexie": "^4.0.0",
    "@anthropic-ai/sdk": "^0.20.0",
    "framer-motion": "^11.0.0"
  }
}
```

Note: `framer-motion` is for the AI Orb animations and smooth panel transitions.

---

## Integration Checklist

### Phase 1 Prerequisites
- [x] Install Dexie for IndexedDB
- [x] Add Anthropic SDK
- [x] Create type definitions
- [x] Set up IndexedDB schema
- [x] Create CRM bridge
- [x] Implement Tier 1 extraction
- [x] Create extraction queue
- [x] Add IntelligenceProvider to layout

### Phase 2 Per-Contact Intelligence
- [x] Tier 2 LLM extraction
- [x] Fact deduplication
- [x] Contradiction resolution
- [x] Relationship classifier
- [x] Identity linking (cross-platform)

### Phase 3 Style Matrix
- [x] Style model with fingerprinting
- [x] Style resolver with fallback hierarchy
- [x] K-means clustering for style groups

### Phase 4 Ambient Stream
- [x] Ambient stream processor
- [x] Canonical explanations tracking

### Phase 5 Multi-Agent System
- [x] Agent orchestrator (routing, lifecycle)
- [x] Knowledge agent
- [x] Style agent
- [x] User state agent
- [x] Conversation agent (per-contact-per-platform)

### Phase 6 Triggers System
- [x] Trigger type definitions
- [x] Trigger store
- [x] Trigger scheduler with condition evaluators

### Phase 7 AI Companion UI
- [x] AI Orb button
- [x] AI Companion panel
- [x] Stream of consciousness component
- [x] Companion hook
- [x] Proactive engine
- [x] Activity log

### Phase 8.5 Auto-Soul Extraction
- [x] SoulTrait type and extractedTraits on UserSoul
- [x] renderSoulBlock() renders traits grouped by category
- [x] Soul extractor module (sampling, prompt, parsing, merging)
- [x] Soul extraction mode in extract API route
- [x] soul_updated event type
- [x] Background worker soul extraction with time-gated tick
- [x] Companion soul refresh on soul_updated event
- [x] Soul Editor transformed to review/edit UI

### Phase 8 Observability & Debug
- [x] Metrics collector
- [x] User state dashboard
- [x] Knowledge explorer
- [x] Agent roster
- [x] Metrics dashboard
- [x] Debug page at /settings/intelligence/debug

### Provider Integration

Update `app/layout.tsx`:

```tsx
import { IntelligenceProvider } from '@/contexts/intelligence-context';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <BeeperDataProvider>
          <IntelligenceProvider>
            {/* existing providers */}
            {children}
          </IntelligenceProvider>
        </BeeperDataProvider>
      </body>
    </html>
  );
}
```

---

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| IndexedDB size limits | Implement pruning in Phase 7, archive old data |
| LLM costs | Tier system, Haiku for routine ops, visible cost estimates |
| User state inference errors | Confidence scores, transparent dashboard, easy correction |
| Agent roster bloat | 50 agent limit, LRU lifecycle management |
| Cross-chat info leakage | Relationship-aware filtering, tag sensitive contexts |
| Performance impact | Tier 1 is sync/free, background queues for LLM ops |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Fact accuracy | >85% correct on review |
| User state accuracy | >75% correct without override |
| Draft acceptance | >60% with ≤1 edit |
| Cross-chat reuse | >30% of drafts use user intelligence |
| Cold start quality | >40% acceptance for <10 message contacts |
| Agent response time | <3s simple, <8s complex |
| Cost efficiency | <$5/day typical, <$12/day power user |

---

## Phase Summary

| Phase | Duration | Focus | Status |
|-------|----------|-------|--------|
| 1 | Weeks 1-3 | Foundation + Type System | ✅ COMPLETE |
| 2 | Weeks 4-6 | Per-Contact Intelligence | ✅ COMPLETE |
| 3 | Weeks 7-9 | Style Matrix | ✅ COMPLETE |
| 4 | Weeks 10-12 | Ambient Stream + User Intelligence | ✅ COMPLETE |
| 5 | Weeks 13-16 | Multi-Agent System | ✅ COMPLETE |
| 6 | Weeks 17-19 | Triggers System | ✅ COMPLETE |
| **7** | **Weeks 20-23** | **AI Companion UI** | ✅ COMPLETE |
| 8 | Weeks 24-26 | Observability & Debug | ✅ COMPLETE |
| **8.5** | **Post-plan** | **Auto-Soul Extraction** | ✅ COMPLETE |

**Total: ~26 weeks + post-plan additions**

---

---

## CRITICAL ARCHITECTURAL FIXES REQUIRED

### Problem Analysis: Why the System Feels Static and Reactive

After deep analysis of the codebase, I identified **three fundamental architectural mistakes** that prevent the intelligence layer from being proactive:

---

### Mistake #1: No Heartbeat (Components Built But Never Started)

**What the plan intended:**
```
Messages arrive → Extraction Pipeline → Knowledge Store → Agents process →
Triggers fire → Proactive actions surface
```

**What we actually built:**
```
Messages arrive → Tier 1 runs (only sync part) → Queue fills up → Nothing processes it
Trigger scheduler exists → Nothing calls start()
Agents exist → Nothing instantiates them
```

**Evidence:**
- [scheduler.ts:423](lib/intelligence/triggers/scheduler.ts#L423): `startTriggerScheduler()` exists but is never called
- [store.ts:311](lib/intelligence/knowledge/store.ts#L311): `extractionQueueStore.getNext()` exists but nothing calls it
- [orchestrator.ts](lib/intelligence/agents/orchestrator.ts): Complete orchestrator that's never used

**The Fix - Add Background Worker:**

We need a heartbeat that runs continuously, processing queues and checking for proactive opportunities.

```typescript
// lib/intelligence/background-worker.ts
export class IntelligenceBackgroundWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly TICK_INTERVAL = 30000; // 30 seconds

  start(): void {
    if (this.intervalId) return;

    console.log('[BackgroundWorker] Starting intelligence heartbeat...');

    // Start the trigger scheduler
    startTriggerScheduler();

    // Start the main processing loop
    this.intervalId = setInterval(() => this.tick(), this.TICK_INTERVAL);

    // Run immediately
    this.tick();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    stopTriggerScheduler();
  }

  private async tick(): Promise<void> {
    console.log('[BackgroundWorker] Tick...');

    // 1. Process extraction queue (Tier 2 LLM extraction)
    await this.processExtractionQueue();

    // 2. Run ambient processing if enough time has passed
    await this.runAmbientProcessingIfDue();

    // 3. Check for proactive opportunities
    await this.checkProactiveOpportunities();

    // 4. Run agent lifecycle maintenance
    await this.runAgentMaintenance();
  }

  private async processExtractionQueue(): Promise<void> {
    const items = await extractionQueueStore.getNext(5);
    for (const item of items) {
      try {
        await this.processExtractionItem(item);
        await extractionQueueStore.markComplete(item.id);
      } catch (error) {
        await extractionQueueStore.markFailed(item.id, error.message);
      }
    }
  }

  private async checkProactiveOpportunities(): Promise<void> {
    // Check each active chat for proactive actions
    // This feeds into the proactive engine
  }
}

// Singleton
let worker: IntelligenceBackgroundWorker | null = null;

export function startIntelligenceWorker(): void {
  if (!worker) {
    worker = new IntelligenceBackgroundWorker();
  }
  worker.start();
}

export function stopIntelligenceWorker(): void {
  worker?.stop();
}
```

**Integration point - Start in IntelligenceProvider:**
```typescript
// contexts/intelligence-context.tsx
useEffect(() => {
  if (typeof window !== 'undefined' && isInitialized) {
    startIntelligenceWorker();
    return () => stopIntelligenceWorker();
  }
}, [isInitialized]);
```

---

### Mistake #2: Companion Bypasses Agent Architecture

**What the plan intended:**
```
User request → useCompanion → Orchestrator.route() → ConversationAgent →
  → KnowledgeAgent (get contact facts)
  → StyleAgent (get style instructions)
  → UserStateAgent (get distributed info)
→ Rich, contextual response
```

**What we actually built:**
```
User request → useCompanion → Direct fetch('/api/intelligence/companion/draft') →
→ API builds its own context from scratch
→ Entire agent architecture is bypassed
```

**Evidence:**
- [use-companion.ts:244](hooks/use-companion.ts): Direct `fetch()` call to API
- [conversation-agent.ts:244](lib/intelligence/agents/dynamic/conversation-agent.ts): Same direct `fetch()` inside the agent
- The `Orchestrator.route()` method is never called anywhere in the codebase

**The Fix - Wire Companion Through Agents:**

```typescript
// hooks/use-companion.ts - FIXED

import { getOrchestrator } from '@/lib/intelligence/agents/orchestrator';
import { getConversationAgent } from '@/lib/intelligence/agents/dynamic/conversation-agent';

const requestDraft = useCallback(async () => {
  setIsThinking(true);
  addAssistantMessage("Let me draft something for you...");

  try {
    // 1. Get or create a conversation agent through the orchestrator
    const orchestrator = getOrchestrator();
    const agent = await orchestrator.route({
      type: 'conversation',
      contextId: chatId,
      platform: platform,
      priority: 'normal',
      payload: { intent: 'draft_reply' },
    });

    // 2. Use the conversation agent (which coordinates infrastructure agents)
    const conversationAgent = getConversationAgent(chatId, chatId, platform);
    const result = await conversationAgent.draftReply(
      recentMessages, // from useBeeperData
      undefined // no specific intent
    );

    setPendingDraft({
      text: result.draft,
      context: result.reasoning,
    });

    addAssistantMessage(
      result.context.relevantDistributedInfo.length > 0
        ? `Here's a draft based on what you've been telling others:`
        : "Here's a suggested reply:"
    );
  } catch (error) {
    addAssistantMessage("Sorry, I couldn't generate a draft right now.");
  } finally {
    setIsThinking(false);
  }
}, [chatId, platform, recentMessages]);
```

---

### Mistake #3: One-Way Data Pipeline, Not Event-Driven

**What the plan intended:**
```
Message arrives → Event emitted → Multiple listeners respond:
  → Trigger scheduler evaluates message triggers
  → Proactive engine checks if draft suggestion needed
  → Knowledge extraction queued
  → Activity log updated
```

**What we actually built:**
```
Message arrives → React state updates → One useEffect runs → That's it
- No event bus
- Trigger scheduler's onMessage() never called
- Proactive engine never evaluates incoming messages
```

**Evidence:**
- [scheduler.ts:376](lib/intelligence/triggers/scheduler.ts#L376): `onMessage()` handler exists
- [proactive-engine.ts:146](lib/intelligence/proactive-engine.ts#L146): `determineProactiveAction()` exists
- Neither is ever called when messages arrive

**The Fix - Add Event Bus:**

```typescript
// lib/intelligence/event-bus.ts
type IntelligenceEvent =
  | { type: 'message_received'; message: BeeperMessage }
  | { type: 'message_sent'; message: BeeperMessage }
  | { type: 'chat_opened'; chatId: string }
  | { type: 'chat_closed'; chatId: string }
  | { type: 'companion_opened'; chatId: string }
  | { type: 'extraction_complete'; chatId: string; facts: ContactFact[] }
  | { type: 'user_state_updated'; updates: Partial<UserIntelligence> };

type EventHandler = (event: IntelligenceEvent) => void | Promise<void>;

class IntelligenceEventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  on(eventType: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    return () => this.handlers.get(eventType)?.delete(handler);
  }

  emit(event: IntelligenceEvent): void {
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error('[EventBus] Handler error:', error);
        }
      }
    }

    // Also emit to '*' handlers (catch-all)
    const globalHandlers = this.handlers.get('*');
    if (globalHandlers) {
      for (const handler of globalHandlers) {
        try {
          handler(event);
        } catch (error) {
          console.error('[EventBus] Global handler error:', error);
        }
      }
    }
  }
}

export const eventBus = new IntelligenceEventBus();

// Wire up listeners in background worker
export function setupEventListeners(): void {
  const scheduler = getTriggerScheduler();

  // When message received, evaluate triggers
  eventBus.on('message_received', async (event) => {
    if (event.type !== 'message_received') return;
    await scheduler.onMessage(event.message);
  });

  // When companion opened, run proactive analysis
  eventBus.on('companion_opened', async (event) => {
    if (event.type !== 'companion_opened') return;
    const action = determineProactiveAction('panel_opened', {
      chatId: event.chatId,
      recentMessages: [], // would fetch from store
    });
    if (action) {
      // Surface the proactive action to UI
    }
  });
}
```

**Emit events from BeeperDataProvider:**
```typescript
// contexts/beeper-data-context.tsx
useEffect(() => {
  // Detect new messages
  const newMessages = messages.filter(m => !previousMessagesRef.current.has(m.id));

  for (const message of newMessages) {
    eventBus.emit({ type: 'message_received', message });
    previousMessagesRef.current.add(m.id);
  }
}, [messages]);
```

---

### Summary: Three Files to Create/Modify

| File | Purpose | Status |
|------|---------|--------|
| `lib/intelligence/background-worker.ts` | Heartbeat that processes queues | **CREATE** |
| `lib/intelligence/event-bus.ts` | Event system for reactive triggers | **CREATE** |
| `hooks/use-companion.ts` | Wire through agent architecture | **MODIFY** |
| `contexts/intelligence-context.tsx` | Start background worker | **MODIFY** |
| `contexts/beeper-data-context.tsx` | Emit message events | **MODIFY** |

---

### Corrected Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CORRECTED DATA FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────────────────────┐
                    │         BeeperDataProvider           │
                    │  (Polls API, updates message state)  │
                    └────────────────┬─────────────────────┘
                                     │
                                     ▼
                    ┌──────────────────────────────────────┐
                    │            EVENT BUS                 │
                    │   eventBus.emit('message_received')  │
                    └────────────────┬─────────────────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
            ▼                        ▼                        ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│  Trigger Scheduler │   │  Proactive Engine │   │  Background Worker │
│   onMessage()     │   │  determineAction() │   │  processQueue()   │
└────────┬──────────┘   └────────┬──────────┘   └────────┬──────────┘
         │                       │                       │
         ▼                       ▼                       ▼
   Fire matching           Surface draft           Process Tier2
   triggers                suggestions             extraction

                    ┌──────────────────────────────────────┐
                    │           ORCHESTRATOR               │
                    │   route() → spawn/reuse agents       │
                    └────────────────┬─────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
        ┌───────────────────┐           ┌───────────────────┐
        │ Infrastructure    │           │ Dynamic Agents    │
        │ Agents (singletons)│          │ (per-contact)     │
        │ • KnowledgeAgent  │           │ • ConversationAgent│
        │ • StyleAgent      │           │ • ActivityAgent   │
        │ • UserStateAgent  │           │ • TaskAgent       │
        └───────────────────┘           └───────────────────┘
```

---

## Implementation Status: ~95% COMPLETE

### What's Built

**Auto-Soul Extraction (Phase 8.5):**
- Soul trait extraction from sent messages across all chats
- Message sampling with diversity (round-robin across chats, 70/30 recent/older split)
- LLM-based trait extraction (personality, communication_style, value, background, habit, preference, identity)
- Trait merging with deduplication (word overlap >60%), confidence boosting on re-confirmation
- User-pinned and user-edited traits preserved across re-extractions
- Background worker integration with configurable interval
- Soul Editor transformed from manual form to review/edit UI with pin/edit/delete per trait
- Auto-refresh via soul_updated event bus integration

**Core Infrastructure:**
- IndexedDB storage with Dexie (contacts, user state, agents, triggers)
- CRM bridge for syncing existing contacts to intelligence store
- Intelligence context provider for React integration

**Extraction Pipeline:**
- Tier 1: Local regex-based extraction (emails, phones, URLs, dates, style signals)
- Tier 2: LLM-based extraction with batching
- Relationship classifier using conversation patterns
- Fact deduplication and contradiction resolution

**Style System:**
- Style fingerprinting from sent messages
- K-means clustering for style groups
- Style resolver with fallback hierarchy (contact → platform → relationship → global → cold_start)

**User State:**
- Ambient stream processor for tracking user context
- Canonical explanations detection and tracking
- Cross-platform identity linking

**Multi-Agent System:**
- Orchestrator with routing and lifecycle management (active → warm → cool → dormant → completed)
- 50 agent roster limit with LRU eviction
- Infrastructure agents: Knowledge, Style, User State
- Dynamic conversation agents (per-contact-per-platform)

**Triggers:**
- Full trigger type system (scheduled, recurring, conditional, pattern, event)
- Trigger store with CRUD operations
- Scheduler with condition evaluators and action executors

**AI Companion UI:**
- AI Orb button with animated gradient sphere
- Companion panel with chat interface
- Stream of consciousness component
- Proactive engine and activity log

**Observability:**
- Metrics collection (drafts, extraction, agents, cost, performance)
- User state dashboard
- Knowledge explorer (browse facts per contact)
- Agent roster viewer
- Metrics dashboard with cost tracking

### Remaining Work (Optional Enhancements)

1. **LLM Integration**: Wire up actual API calls in conversation agent and companion chat
2. **API Routes**: Create `/api/intelligence/companion/chat` and `/api/intelligence/companion/draft` endpoints
3. **Message Panel Integration**: Connect AI Orb and Companion Panel to MessagePanel component
4. **Real-time Triggers**: Connect trigger scheduler to message stream
5. **Cost Tracking**: Implement actual token counting from API responses

### Phase 7 is the User-Facing Milestone

The AI Companion (Phase 7) is where users first experience the intelligence layer. With all phases complete:
- Intelligence silently builds in the background
- Facts are extracted and deduplicated
- User state is tracked across conversations
- Style models form and refine
- The companion surfaces insights proactively

Everything comes together in a friendly, proactive companion that feels like a knowledgeable friend who's been watching all your conversations.

With Auto-Soul Extraction (Phase 8.5), the system also learns who *you* are — your personality, communication patterns, values, and habits — directly from your sent messages. This means the companion drafts replies that sound like you, not like a generic AI, and the soul profile improves automatically over time without manual configuration.
