# Roadmap: Next Steps

**Last Review**: 2025-12-19
**Completed**: Phase 1-3 (Foundation & Consolidation)
**Status**: 🟢 Build Passing | 🟡 Further Optimization Needed

---

## Executive Summary

The initial refactoring successfully established foundation utilities and reduced code duplication. However, code review reveals significant opportunities for further improvement:

### Key Metrics (Current State)
- **Largest File**: `components/ui/kanban.tsx` (1,117 lines)
- **Console Statements**: 84 remaining across codebase
- **SSR Checks**: 34 `typeof window === 'undefined'` checks
- **Test Coverage**: 0% (no test files)
- **app/page.tsx**: Still 726 lines with 23 useCallback hooks
- **storage.ts**: 952 lines (still has refactoring opportunities)

### Prioritized Next Steps
1. 🔴 **Critical**: Complete storage.ts refactoring
2. 🔴 **Critical**: Split large components (5 files > 600 lines)
3. 🟡 **High**: Add test infrastructure
4. 🟡 **High**: Complete console statement replacement
5. 🟢 **Medium**: Component architecture improvements
6. 🟢 **Medium**: Performance optimizations

---

## Phase 4: Complete Storage Refactoring 🔴 CRITICAL

### 4.1 Finish storage.ts Migration to StorageManager

**Current State**: 952 lines, partially refactored
**Target**: ~750 lines (20% reduction)

**Remaining Functions to Refactor**:

#### Hidden Chats (Lines 233-331)
```typescript
// Current: Manual Set operations
const HIDDEN_CHATS_KEY = 'beeper-kanban-hidden-chats';
const HIDDEN_CHATS_META_KEY = 'beeper-kanban-hidden-chats-meta';

export function loadHiddenChats(): Set<string> { /* 8 lines */ }
export function saveHiddenChats(hiddenChats: Set<string>): void { /* 7 lines */ }
export function addHiddenChat(...): Set<string> { /* 12 lines */ }
export function removeHiddenChat(chatId: string): Set<string> { /* 11 lines */ }

// Refactor to:
const hiddenChatsManager = new SetStorageManager<string>(
  STORAGE_KEYS.HIDDEN_CHATS,
  'hiddenChats'
);
const hiddenChatsMetaManager = new StorageManager<HiddenChatInfo[]>(
  STORAGE_KEYS.HIDDEN_CHATS_META,
  [],
  'hiddenChatsMeta'
);

export const loadHiddenChats = () => hiddenChatsManager.load();
export const addHiddenChat = (chatId: string, meta?: HiddenChatInfo) => {
  hiddenChatsManager.add(chatId);
  if (meta) {
    hiddenChatsMetaManager.update(current => [...current, meta]);
  }
  return hiddenChatsManager.load();
};
// Reduce from 38 lines to ~15 lines
```

#### Tone & Writing Style (Lines 333-420)
```typescript
// Current: 87 lines with boilerplate
const TONE_SETTINGS_KEY = 'beeper-kanban-tone-settings';
const WRITING_STYLE_KEY = 'beeper-kanban-writing-style';

export function loadToneSettings(): ToneSettings { /* 11 lines */ }
export function saveToneSettings(settings: ToneSettings): void { /* 7 lines */ }
export function loadWritingStylePatterns(): WritingStylePatterns { /* 11 lines */ }
export function saveWritingStylePatterns(patterns: WritingStylePatterns): void { /* 7 lines */ }

// Refactor to:
const toneSettingsManager = new StorageManager<ToneSettings>(
  STORAGE_KEYS.TONE_SETTINGS,
  DEFAULT_TONE_SETTINGS,
  'toneSettings'
);
const writingStyleManager = new StorageManager<WritingStylePatterns>(
  STORAGE_KEYS.WRITING_STYLE,
  DEFAULT_WRITING_STYLE,
  'writingStyle'
);

export const loadToneSettings = () => toneSettingsManager.load();
export const saveToneSettings = (settings: ToneSettings) => toneSettingsManager.save(settings);
// Reduce from 36 lines to ~6 lines
```

#### Autopilot Storage (Lines 421-700+)
Similar pattern for:
- Autopilot agents
- Chat autopilot configs
- Activity entries
- Scheduled actions
- Handoff summaries

**Estimated Impact**:
- Remove ~200 lines of boilerplate
- Consistent error handling across all storage
- Type-safe operations

**Time Estimate**: 3-4 hours

---

## Phase 5: Split Large Components 🔴 CRITICAL

### 5.1 Component Size Targets

**Problem**: 5 components > 600 lines violate Single Responsibility Principle

| Component | Current | Target | Priority |
|-----------|---------|--------|----------|
| `ui/kanban.tsx` | 1,117 lines | N/A (3rd party) | Low |
| `message-panel.tsx` | 785 lines | <300 lines | 🔴 HIGH |
| `tone-settings.tsx` | 708 lines | <300 lines | 🟡 MEDIUM |
| `ai-chat-panel.tsx` | 622 lines | <300 lines | 🔴 HIGH |
| `agent-form.tsx` | 613 lines | <300 lines | 🟡 MEDIUM |

### 5.2 message-panel.tsx Refactoring (785 → ~450 lines)

**Current Responsibilities** (too many):
1. Thread context loading
2. Message history display
3. Attachment rendering
4. Draft generation
5. Message sending
6. Autopilot integration
7. AI chat coordination
8. Media handling

**Split Into**:
```
components/message-panel/
├── MessagePanel.tsx              (150 lines - orchestrator)
├── MessageThread.tsx             (200 lines - history display)
├── MediaAttachments.tsx          (150 lines - media rendering)
├── MessageComposer.tsx           (150 lines - input & send)
├── AutopilotControls.tsx         (100 lines - autopilot UI)
└── hooks/
    └── use-message-thread.ts     (100 lines - thread logic)
```

**Benefits**:
- ✅ Easier to test individual concerns
- ✅ Reusable MediaAttachments component
- ✅ Simplified MessagePanel orchestration
- ✅ Isolated autopilot logic

**Time Estimate**: 4-5 hours

### 5.3 ai-chat-panel.tsx Refactoring (622 → ~400 lines)

**Split Into**:
```
components/ai-chat/
├── AiChatPanel.tsx               (150 lines - container)
├── ChatMessages.tsx              (150 lines - message list)
├── ChatInput.tsx                 (100 lines - input)
├── DraftActions.tsx              (100 lines - draft controls)
└── hooks/
    └── use-ai-chat.ts            (150 lines - chat logic)
```

**Time Estimate**: 3-4 hours

### 5.4 tone-settings.tsx Refactoring (708 → ~400 lines)

**Split Into**:
```
components/tone-settings/
├── ToneSettings.tsx              (150 lines - container)
├── ToneSliders.tsx               (100 lines - tone controls)
├── WritingStyleForm.tsx          (200 lines - style inputs)
└── WritingStyleAnalysis.tsx      (150 lines - analysis display)
```

**Time Estimate**: 3-4 hours

### 5.5 app/page.tsx Further Refactoring (726 → ~400 lines)

**Already Identified in Original Roadmap** - Now with updated estimates:

**Create**:
```
app/dashboard/
├── page.tsx                      (100 lines - layout & routing)
├── components/
│   ├── DashboardLayout.tsx       (150 lines - UI structure)
│   ├── KanbanContainer.tsx       (200 lines - board logic)
│   ├── PanelManager.tsx          (150 lines - panel state)
│   └── BottomBar.tsx             (100 lines - controls)
└── hooks/
    ├── use-dashboard-state.ts    (150 lines - state management)
    └── use-message-operations.ts (150 lines - CRUD operations)
```

**Time Estimate**: 6-8 hours (largest refactoring)

**Total Component Refactoring Time**: 20-25 hours

---

## Phase 6: Testing Infrastructure 🟡 HIGH PRIORITY

### 6.1 Current State: Zero Tests

**Problem**: No test files found (168 test search returned 0)

**Test Strategy**:
1. **Unit Tests**: Utilities and hooks
2. **Integration Tests**: Component interactions
3. **E2E Tests**: Critical user flows

### 6.2 Setup Testing Infrastructure

**Install Dependencies**:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D @testing-library/user-event jsdom
```

**Create Test Configuration**:
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

### 6.3 Priority Test Targets

#### Phase 6.1: Utility Tests (Easy Wins)
1. **lib/logger.ts** - Test log levels, environment filtering
2. **lib/api-headers.ts** - Test header construction
3. **lib/constants.ts** - Validate constant values
4. **lib/storage-manager.ts** - Test CRUD operations

**Example Test**:
```typescript
// lib/__tests__/storage-manager.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageManager } from '../storage-manager';

describe('StorageManager', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should load default value when storage is empty', () => {
    const manager = new StorageManager('test-key', { value: 0 });
    expect(manager.load()).toEqual({ value: 0 });
  });

  it('should save and load data correctly', () => {
    const manager = new StorageManager('test-key', { value: 0 });
    manager.save({ value: 42 });
    expect(manager.load()).toEqual({ value: 42 });
  });

  // ... more tests
});
```

**Time Estimate**: 6-8 hours for utility tests

#### Phase 6.2: Hook Tests (Medium Difficulty)
1. **use-send-message.ts** - Test send logic, error handling
2. **use-drafts.ts** - Test CRUD operations
3. **use-settings.ts** - Test settings persistence

**Time Estimate**: 10-12 hours for hook tests

#### Phase 6.3: Component Tests (Higher Difficulty)
1. **DraftComposer** - Test editing, saving
2. **MessageCard** - Test rendering, interactions
3. **AutopilotControls** - Test mode switching

**Time Estimate**: 15-20 hours for component tests

**Total Testing Time**: 30-40 hours for comprehensive coverage

**Target Coverage**: 70% for critical paths

---

## Phase 7: Complete Console Replacement 🟡 HIGH PRIORITY

### 7.1 Current State: 84 Console Statements Remaining

**Breakdown by File Type**:
- API routes: ~20 statements
- Components: ~30 statements
- Hooks: ~15 statements
- Other utilities: ~19 statements

### 7.2 Systematic Replacement Plan

**Script to Find All**:
```bash
# Find all console statements
find . -name "*.ts" -o -name "*.tsx" | \
  xargs grep -n "console\." | \
  grep -v node_modules | \
  grep -v ".next"
```

**Replace Pattern**:
```typescript
// Before
console.log('Debug info', data);
console.error('Error occurred', error);

// After
logger.debug('Debug info', data);
logger.error('Error occurred', error);
```

**Files Needing Updates**:
1. All API routes in `app/api/**/*.ts`
2. Component files in `components/**/*.tsx`
3. Remaining hooks in `hooks/**/*.ts`
4. Utility files in `lib/**/*.ts`

**Time Estimate**: 4-5 hours

---

## Phase 8: Refactor SSR Checks 🟢 MEDIUM PRIORITY

### 8.1 Current State: 34 typeof window Checks

**Problem**: Repeated pattern throughout codebase

**Current Pattern**:
```typescript
export function someFunction() {
  if (typeof window === 'undefined') return defaultValue;
  // ... localStorage access
}
```

**Solution**: Use storage-manager's isServer() internally

**Refactor Approach**:
1. All new functions should use StorageManager (already has isServer())
2. Remaining manual checks can be centralized

**Helper Addition to storage-manager.ts**:
```typescript
/**
 * Check if running in server environment
 */
export function isServer(): boolean {
  return typeof window === 'undefined';
}

// Export for use in other files
```

**Files to Update**:
- Remaining functions in `lib/storage.ts`
- Component initialization in hooks
- Utility functions accessing browser APIs

**Time Estimate**: 2-3 hours

---

## Phase 9: useCallback Optimization 🟢 MEDIUM PRIORITY

### 9.1 Current State: 138 useCallback Instances

**Problem**: Over-optimization without measurable benefit

**Analysis Required**:
For each `useCallback`:
1. Is it passed to a `React.memo` component?
2. Is it used as a dependency in other hooks?
3. Does it cause re-render issues?

If **none of above**, remove the memoization.

### 9.2 app/page.tsx Review (23 useCallback hooks)

**Likely Removable** (not passed to memo components):
```typescript
// Example removals
const handleCardClick = useCallback((card: KanbanCard) => {
  setSelectedCard(prev => prev?.id === card.id ? null : card);
}, []); // No dependencies, not passed to memo - REMOVE

const handleHide = useCallback((card: KanbanCard) => {
  const chatId = card.message?.chatId;
  if (!chatId) return;
  // ... simple operation
}, []); // REMOVE
```

**Should Keep** (complex deps or passed to children):
```typescript
const handleMoveToColumn = useCallback(async (card, from, to) => {
  // Complex async operation with settings deps
  // Used in MessageBoard which could be memoized
}, [settings, avatars, chatInfo, createDraft, updateDraft]); // KEEP
```

**Strategy**:
1. Audit each useCallback in app/page.tsx
2. Remove unnecessary ones
3. Add React.memo to components receiving callbacks

**Estimated Removal**: ~8-10 unnecessary useCallback hooks in app/page.tsx

**Time Estimate**: 3-4 hours for full audit

---

## Phase 10: Performance Optimizations 🟢 MEDIUM PRIORITY

### 10.1 Add Strategic React.memo

**Current State**: Only 1 React.memo usage found

**Candidates for Memoization**:
```typescript
// components/kanban/message-card.tsx
export const MessageCard = React.memo(({ card, onCardClick, ... }) => {
  // Expensive rendering logic
}, (prevProps, nextProps) => {
  // Custom comparison
  return prevProps.card.id === nextProps.card.id &&
         prevProps.card.timestamp === nextProps.card.timestamp;
});

// components/message-panel/MessageThread.tsx
export const MessageThread = React.memo(({ messages, ... }) => {
  // Renders large lists
});
```

**Targets**:
1. MessageCard (renders frequently)
2. MessageThread (large lists)
3. AutopilotStatusBadge (re-renders on config changes)
4. DraftCard (many instances)

**Time Estimate**: 2-3 hours

### 10.2 Optimize Large List Rendering

**Problem**: message-panel.tsx renders full thread history

**Solution**: Virtual scrolling for large message lists

**Implementation**:
```bash
npm install @tanstack/react-virtual
```

```typescript
// In MessageThread.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

export function MessageThread({ messages }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimated message height
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div key={virtualItem.index} style={{
            transform: `translateY(${virtualItem.start}px)`
          }}>
            <Message message={messages[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Time Estimate**: 4-5 hours

### 10.3 Debounce Heavy Operations

**Targets**:
1. Message polling (currently every 10s - could be smarter)
2. Search/filter inputs (need debouncing)
3. Auto-save operations

**Implementation**:
```typescript
// lib/use-debounce.ts
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
```

**Time Estimate**: 2-3 hours

**Total Performance Optimization Time**: 10-15 hours

---

## Phase 11: Code Quality Improvements 🟢 MEDIUM PRIORITY

### 11.1 Add ESLint Rules

**Missing Rules**:
```json
{
  "rules": {
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "react-hooks/exhaustive-deps": "warn",
    "no-unused-vars": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": "warn"
  }
}
```

**Time Estimate**: 1-2 hours

### 11.2 Add Pre-commit Hooks

**Setup Husky**:
```bash
npm install -D husky lint-staged
npx husky init
```

**Configure**:
```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

**Time Estimate**: 1-2 hours

### 11.3 Add Type Validation for localStorage

**Problem**: Type assertions without validation

**Solution**: Add Zod schemas

```bash
npm install zod
```

```typescript
// lib/schemas.ts
import { z } from 'zod';

export const DraftSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  recipientName: z.string(),
  draftText: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  avatarUrl: z.string().optional(),
  isGroup: z.boolean().optional(),
});

export const DraftsSchema = z.array(DraftSchema);

// Update StorageManager to validate
class ValidatedStorageManager<T> extends StorageManager<T> {
  constructor(
    key: string,
    defaultValue: T,
    private schema: z.ZodSchema<T>,
    debugName?: string
  ) {
    super(key, defaultValue, debugName);
  }

  load(): T {
    const data = super.load();
    try {
      return this.schema.parse(data);
    } catch (error) {
      logger.warn(`Invalid data in ${this.key}, using default`, error);
      return this.defaultValue;
    }
  }
}
```

**Time Estimate**: 6-8 hours for all schemas

---

## Phase 12: Documentation Improvements 🟢 LOW PRIORITY

### 12.1 Add JSDoc Comments

**Target**: All public functions and hooks

**Example**:
```typescript
/**
 * Send a message to a Beeper chat
 *
 * @param chatId - The chat identifier
 * @param text - The message text to send
 * @returns Result object with success status and optional error
 *
 * @example
 * ```typescript
 * const result = await sendMessage('chat-123', 'Hello!');
 * if (result.success) {
 *   console.log('Message sent');
 * }
 * ```
 */
export async function sendMessage(chatId: string, text: string): Promise<SendResult>
```

**Time Estimate**: 10-12 hours for full codebase

### 12.2 Update README with Architecture Diagram

**Add**:
- Component hierarchy diagram
- Data flow visualization
- State management overview

**Time Estimate**: 2-3 hours

---

## Summary & Prioritization

### Critical Path (Must Do)

| Phase | Task | Time | Impact | Priority |
|-------|------|------|--------|----------|
| 4 | Complete storage.ts refactoring | 3-4h | High | 🔴 |
| 5 | Split large components | 20-25h | Very High | 🔴 |
| 7 | Complete console replacement | 4-5h | Medium | 🟡 |
| **Total Critical** | | **27-34h** | | |

### High Value (Should Do)

| Phase | Task | Time | Impact | Priority |
|-------|------|------|--------|----------|
| 6 | Add testing infrastructure | 30-40h | Very High | 🟡 |
| 8 | Refactor SSR checks | 2-3h | Low | 🟢 |
| 9 | useCallback optimization | 3-4h | Low | 🟢 |
| **Total High Value** | | **35-47h** | | |

### Nice to Have (Could Do)

| Phase | Task | Time | Impact | Priority |
|-------|------|------|--------|----------|
| 10 | Performance optimizations | 10-15h | Medium | 🟢 |
| 11 | Code quality improvements | 8-12h | Medium | 🟢 |
| 12 | Documentation | 12-15h | Low | 🟢 |
| **Total Nice to Have** | | **30-42h** | | |

### Total Effort Estimate

- **Critical**: 27-34 hours
- **High Value**: 35-47 hours
- **Nice to Have**: 30-42 hours
- **TOTAL**: **92-123 hours** (~2-3 weeks of development)

---

## Recommended Implementation Order

### Sprint 1 (1 week - Critical Items)
1. Complete storage.ts refactoring (Day 1)
2. Split message-panel.tsx (Day 2)
3. Split ai-chat-panel.tsx (Day 2-3)
4. Complete console replacement (Day 3)
5. Split app/page.tsx (Day 4-5)

### Sprint 2 (1 week - Testing)
1. Setup test infrastructure (Day 1)
2. Write utility tests (Day 2)
3. Write hook tests (Day 3-4)
4. Write component tests (Day 5)

### Sprint 3 (1 week - Polish)
1. Performance optimizations (Day 1-2)
2. Code quality improvements (Day 3)
3. useCallback optimization (Day 4)
4. Documentation updates (Day 5)

---

## Success Metrics

### Code Quality Targets
- ✅ **File Size**: No files > 500 lines (except types.ts)
- ✅ **Test Coverage**: >70% for critical paths
- ✅ **Console Statements**: 0 (all using logger)
- ✅ **Component Complexity**: Average <300 lines
- ✅ **Build Time**: <5 seconds
- ✅ **Type Safety**: No `any` types in new code

### Performance Targets
- ✅ **LCP**: <2.5s (Largest Contentful Paint)
- ✅ **FID**: <100ms (First Input Delay)
- ✅ **CLS**: <0.1 (Cumulative Layout Shift)
- ✅ **Bundle Size**: <500KB (gzipped)

---

## Conclusion

The refactoring has established a solid foundation, but significant work remains to reach production-grade quality. The roadmap above provides a clear path forward with realistic time estimates and prioritization.

**Immediate Next Steps**:
1. ✅ Review this roadmap with team
2. ✅ Prioritize based on business needs
3. ✅ Begin Sprint 1 (Critical Items)
4. ✅ Track progress in project board

**Questions to Answer**:
- What is the timeline for production readiness?
- What is the risk tolerance for technical debt?
- What level of test coverage is required?
- Are performance optimizations critical for MVP?

---

**Document Status**: ✅ Ready for Review
**Next Review**: After Sprint 1 completion
**Owner**: Development Team
