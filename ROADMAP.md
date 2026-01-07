# Code Quality Refactoring Roadmap

This document tracks code quality improvements, refactoring tasks, and technical debt resolution for the Parrot project.

## 🔴 High Priority Tasks

### 1. Create Logging Utility
**Problem**: 173 console statements scattered across codebase causing performance overhead and log noise in production.

**Affected Files**:
- `lib/storage.ts` - 42 console statements
- `hooks/use-autopilot-engine.ts` - 30+ statements
- `hooks/use-autopilot-scheduler.ts` - 8 statements
- `contexts/autopilot-context.tsx` - 5 statements
- `components/message-bottom-section.tsx` - 13 statements
- 36+ other files

**Solution**:
- Create `lib/logger.ts` with configurable log levels
- Replace all console.* calls with logger methods
- Add environment-based log filtering (disable debug logs in production)

**Estimated Impact**: ~200 lines changed, improved production performance

---

### 2. Refactor app/page.tsx (Monster Component)
**Problem**: 756-line component violating Single Responsibility Principle with 22 useCallback hooks and 15 pieces of state.

**Current Responsibilities**:
- Message fetching and caching
- Draft management (CRUD operations)
- Autopilot integration
- AI chat management
- Contact selection
- Archive/unarchive operations
- Send message logic
- UI state management
- Event handlers for all operations

**Solution**: Split into focused components:
```
components/dashboard/
├── DashboardContainer.tsx     (orchestrator, 100 lines)
├── MessageManager.tsx         (message/draft hooks, 150 lines)
├── AutopilotManager.tsx       (autopilot logic, 100 lines)
├── PanelManager.tsx           (UI panels state, 150 lines)
└── BottomBar.tsx              (bottom controls, 80 lines)
```

**Estimated Impact**: 756 lines → 5 components (~580 lines total), improved maintainability

---

### 3. Abstract Storage.ts Patterns
**Problem**: 1049 lines with 40+ functions repeating identical try-catch + localStorage patterns.

**Repetitive Pattern** (appears 40+ times):
```typescript
export function loadX(): X {
  if (typeof window === 'undefined') return defaultX;
  try {
    const stored = localStorage.getItem(KEY);
    if (!stored) return defaultX;
    return JSON.parse(stored) as X;
  } catch {
    console.error('Failed to load X');
    return defaultX;
  }
}
```

**Solution**: Create `StorageManager<T>` generic class to eliminate ~300 lines of boilerplate.

**Estimated Impact**: 1049 lines → ~700 lines (30% reduction)

---

### 4. Consolidate Send Message Logic
**Problem**: Three nearly identical send message implementations across codebase.

**Duplicate Implementations**:
- `app/page.tsx:handleSend()` (lines 483-514)
- `app/page.tsx:handleSendFromPanel()` (lines 533-564)
- `hooks/use-batch-send.ts` (separate implementation)

**Solution**: Create `hooks/use-send-message.ts` with single, reusable implementation.

**Estimated Impact**: ~60 lines eliminated, consistent error handling

---

## 🟡 Medium Priority Tasks

### 5. Review and Reduce useCallback Usage
**Problem**: 138 useCallback instances, many unnecessary (over-optimization).

**Files with Most**:
- `app/page.tsx` - 22 callbacks
- `components/ai-chat-panel.tsx` - 12 callbacks
- `hooks/use-autopilot-scheduler.ts` - 10 callbacks
- `hooks/use-autopilot-agents.ts` - 9 callbacks

**Criteria for Keeping useCallback**:
1. Passed to React.memo components
2. Used as dependency in other hooks
3. Provably causes re-render issues

**Solution**: Remove unnecessary useCallback wrappers, keep only where performance impact is measurable.

**Estimated Impact**: ~50 useCallback hooks removed, simpler code

---

### 6. Extract API Header Building Helper
**Problem**: Identical header construction code duplicated 5+ times in `app/page.tsx`.

**Duplicate Pattern** (lines 242, 296, 341, 490, 540):
```typescript
const headers: HeadersInit = { 'Content-Type': 'application/json' };
if (settings.beeperAccessToken) {
  headers['x-beeper-token'] = settings.beeperAccessToken;
}
```

**Solution**: Create `lib/api-headers.ts` with helper functions.

**Estimated Impact**: ~20 lines eliminated, DRY principle applied

---

### 7. Consolidate Cache Merge Functions
**Problem**: Multiple cache merge functions with identical logic.

**Redundant Functions** in `storage.ts`:
- `mergeCachedAvatars()` (lines 258-263)
- `mergeCachedChatInfo()` (lines 294-299)
- Both do: `{ ...existing, ...newData }`

**Solution**: Create generic `mergeCache<T>()` function.

**Estimated Impact**: ~15 lines eliminated, type-safe merging

---

### 8. Create Constants File for Magic Numbers
**Problem**: 20+ magic numbers scattered throughout codebase.

**Examples**:
- `10000` - Poll interval (app/page.tsx:75)
- `500` - Max processed messages (use-autopilot-engine.ts:118)
- `1000` - Refresh delay (app/page.tsx:513)
- `500` - Cleanup threshold (autopilot-context.tsx:96)

**Solution**: Create `lib/constants.ts` with named constants:
```typescript
export const POLLING_INTERVALS = {
  MESSAGES: 10_000,
  REFRESH_DELAY: 1_000,
} as const;

export const AUTOPILOT_LIMITS = {
  MAX_PROCESSED_MESSAGES: 500,
  CLEANUP_THRESHOLD: 500,
} as const;
```

**Estimated Impact**: Improved code readability and maintainability

---

### 9. Standardize Error Handling
**Problem**: Inconsistent error handling - some functions throw, others toast/return.

**Examples**:
- `app/page.tsx:504` - `throw new Error(result.error)`
- `app/page.tsx:270` - `toast.error(result.error)` (doesn't throw)

**Solution**: Establish error handling strategy:
- API errors: Toast + return error object
- Unexpected errors: Throw
- Background operations: Log + continue

**Estimated Impact**: Consistent error UX across application

---

## 🟢 Low Priority Tasks (Deferred)

### 10. Inline/Consolidate Small Utilities
- `lib/time-utils.ts` - Only 1 export
- `lib/compose-refs.ts` - Rarely used utility

**Action**: Move to shared `utils.ts` or inline.

---

### 11. Add Runtime Validation for localStorage
**Problem**: Type assertions without validation (`as Draft[]`).

**Solution**: Use Zod schemas for localStorage data validation.

**Impact**: Improved type safety, graceful handling of corrupted data.

---

### 12. Document ESLint Disable Comments
**Problem**: ESLint disables without justification comments.

**Files**:
- `app/page.tsx:121`
- `hooks/use-messages.ts:190`

**Solution**: Add justification comments or fix dependency arrays.

---

## 📊 Impact Summary

| Task | Priority | Lines Changed | Files Affected | Complexity |
|------|----------|---------------|----------------|------------|
| 1. Logging Utility | High | ~200 | 41 | Medium |
| 2. Refactor app/page.tsx | High | ~756 → 580 | 6 | High |
| 3. Abstract storage.ts | High | ~300 eliminated | 1 | Medium |
| 4. Consolidate send logic | High | ~60 eliminated | 3 | Low |
| 5. Review useCallback | Medium | ~50 hooks removed | 10+ | Medium |
| 6. Extract API headers | Medium | ~20 eliminated | 1 | Low |
| 7. Consolidate cache merging | Medium | ~15 eliminated | 1 | Low |
| 8. Constants file | Medium | ~30 changed | 8+ | Low |
| 9. Standardize errors | Medium | ~40 changed | 15+ | Medium |
| **Total (High+Medium)** | - | **~1,300 lines** | **50+ files** | - |

---

## Implementation Order

### Phase 1: Foundation (Tasks 1, 6, 8)
1. Create logging utility
2. Extract API header helpers
3. Create constants file

**Why First**: These are foundational utilities needed by other refactorings.

---

### Phase 2: Storage Layer (Task 3, 7)
1. Abstract storage.ts patterns
2. Consolidate cache merge functions

**Why Second**: Storage layer used throughout the app; refactor before component changes.

---

### Phase 3: Application Logic (Tasks 4, 9)
1. Consolidate send message logic
2. Standardize error handling

**Why Third**: Clean up business logic before splitting components.

---

### Phase 4: Component Architecture (Task 2, 5)
1. Refactor app/page.tsx into smaller components
2. Review and reduce useCallback usage

**Why Last**: Depends on all previous refactorings being complete.

---

## Success Metrics

- **Code Volume**: Reduce total codebase by ~15% (~1,300 lines)
- **Maintainability**: Average component size < 300 lines
- **Performance**: Remove production logging overhead
- **Consistency**: Standardized error handling and API patterns
- **Type Safety**: Generic abstractions reduce type assertions

---

## Notes

- All changes should maintain existing functionality (no breaking changes)
- Add tests for new utilities and abstractions
- Update documentation as components are refactored
- Consider creating migration guide if breaking changes are unavoidable

---

**Created**: 2025-12-19
**Status**: Ready for implementation
**Target Completion**: Phase 1-3 (High/Medium Priority)
