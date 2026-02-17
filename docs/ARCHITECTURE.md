# Architecture Documentation

## Overview

Beeper Kanban is built as a modern Next.js application with a unified data pipeline architecture. The application follows React best practices with hooks, contexts, and component composition patterns.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Next.js Frontend (React)                 │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │  │
│  │  │   Kanban    │  │   Message    │  │  Settings   │  │  │
│  │  │   Board     │  │   Panel      │  │   Pages     │  │  │
│  │  └─────────────┘  └──────────────┘  └─────────────┘  │  │
│  │           │                │                │          │  │
│  │  ┌────────┴────────────────┴────────────────┘          │  │
│  │  │         Contexts & State Management                 │  │
│  │  │   - BeeperDataProvider (unified data)              │  │
│  │  │   - SettingsContext (app settings)                 │  │
│  │  │   - AuthContext (authentication)                   │  │
│  │  └────────────────────┬───────────────────────────────┘  │
│  └───────────────────────┼───────────────────────────────┘  │
│                          │                                   │
│  ┌───────────────────────┼───────────────────────────────┐  │
│  │         Next.js API Routes (Server-Side)              │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │           /api/beeper/data (Unified)             │ │  │
│  │  │  - BeeperDataService                             │ │  │
│  │  │  - Server-side caching                           │ │  │
│  │  │  - Shared transforms                             │ │  │
│  │  └──────────────────────┬───────────────────────────┘ │  │
│  └─────────────────────────┼─────────────────────────────┘  │
└────────────────────────────┼────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │  Beeper API    │
                    │  (via SDK)     │
                    └────────────────┘
```

## Unified Data Pipeline

The application uses a centralized data pipeline that eliminates redundant API calls and provides a single source of truth for all Beeper data.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BEEPER SDK                                │
│         (ONE call to chats.list, ONE to accounts.list)          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              BeeperDataService (Server-Side)                     │
│  - Single entry point for all Beeper data                       │
│  - In-memory cache with TTL                                     │
│  - Shared transforms (participant names, avatars, etc.)         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                /api/beeper/data (Unified Endpoint)              │
│  GET ?slices=accounts,chats,messages&accountIds=...             │
│  Returns: { accounts, messages, chatInfo, avatars, userInfo }   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              BeeperDataProvider (Client-Side)                    │
│  - React Context for all Beeper data                            │
│  - Polling with diff-based updates                              │
│  - localStorage persistence                                      │
│  - Computed views (unread, sent, archived)                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Consumer Hooks                                │
│  useBeeperData() - Full access to all data                      │
│  useCrm()        - CRM contact management                       │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. User opens app
2. BeeperDataProvider initializes
3. Provider fetches from /api/beeper/data?slices=accounts,chats
4. BeeperDataService calls Beeper SDK once
5. Data cached server-side and returned
6. Provider stores in React state + localStorage
7. Components consume via useBeeperData() hook
8. Polling updates at 10-second intervals
```

## Directory Structure

### `/app` - Next.js App Directory

#### `/app/page.tsx`
Main kanban board interface. Handles:
- Message display in columns
- Drag-and-drop functionality
- Message selection
- CRM integration

#### `/app/layout.tsx`
Root layout with providers:
- BeeperDataProvider (unified data)
- SettingsContext Provider
- AuthContext Provider
- Theme Provider
- Toast notifications (Sonner)

#### `/app/api` - API Routes

**Unified Data Endpoint**:
- `beeper/data/route.ts` - Single endpoint for all data (accounts, messages, archived)

**Chat Operations**:
- `beeper/chats/route.ts` - Fetch messages for a specific chat
- `beeper/chats/[chatId]/archive/route.ts` - Archive chat
- `beeper/chats/[chatId]/unarchive/route.ts` - Unarchive chat

**Mutations**:
- `beeper/send/route.ts` - Send messages
- `beeper/contacts/route.ts` - Get contacts for new conversations

**Utilities**:
- `avatar/route.ts` - Proxy avatar images
- `media/route.ts` - Handle media attachments
- `attachments/route.ts` - Attachment handling

#### `/app/settings` - Settings Pages
- `platforms/page.tsx` - Platform selection
- `hidden-chats/page.tsx` - Hidden chat management
- `data/page.tsx` - Data export/import
- `account/page.tsx` - Account settings

### `/components` - React Components

#### `/components/kanban`
Kanban board components:
- `message-board.tsx` - Main board with columns
- `message-card.tsx` - Individual message card
- `column-header.tsx` - Column headers with actions

#### `/components/message-input`
Message input components:
- `manual-input-section.tsx` - Manual message input

#### `/components/ui`
Reusable UI components from shadcn/ui:
- Button, Dialog, Input, Textarea, Select, etc.

#### Other Components
- `message-panel.tsx` - Right-side message detail panel
- `message-modal.tsx` - Message detail modal
- `contacts-dialog.tsx` - Contact selection
- `contacts-view.tsx` - CRM contacts view
- `contact-profile-panel.tsx` - Contact profile display
- `theme-toggle.tsx` - Dark/light mode toggle
- `platform-icon.tsx` - Platform-specific icons

### `/contexts` - React Contexts

#### `beeper-data-context.tsx`
Unified data provider:
- All messages (unread, sent, archived)
- Accounts
- Chat info and avatars
- User info
- Polling and refresh

#### `settings-context.tsx`
Global app settings:
- Selected account IDs
- Beeper access token
- UI preferences

#### `auth-context.tsx`
Authentication state:
- User session
- Login/logout

### `/hooks` - Custom React Hooks

#### Data Hooks
- `use-beeper-data.ts` - Access unified Beeper data context
- `use-chat-history.ts` - Fetch full chat history with pagination
- `use-crm.ts` - CRM contact management
- `use-drafts.ts` - Draft management (CRUD)
- `use-accounts.ts` - Account fetching (onboarding)

#### Action Hooks
- `use-send-message.ts` - Send messages
- `use-batch-send.ts` - Send multiple messages

#### Utility Hooks
- `use-settings.ts` - Settings management

### `/lib` - Utility Libraries

#### `/lib/beeper/` - Beeper Data Pipeline
- `types.ts` - Data pipeline types
- `cache.ts` - Server-side TTL cache
- `transforms.ts` - Shared data transforms
- `data-service.ts` - Core data service

#### `beeper-client.ts`
Beeper SDK client:
- Client initialization
- Platform detection
- Token management

#### `types.ts`
TypeScript type definitions for:
- Beeper API types (BeeperMessage, BeeperAccount, etc.)
- App types (Draft, AppSettings, KanbanCard)
- CRM types (CrmContactProfile)

#### `storage.ts`
LocalStorage utilities for:
- App settings
- Drafts
- Hidden chats
- CRM contacts and mappings
- Message caching

#### `constants.ts`
Application constants:
- Polling intervals
- Storage keys

#### `time-utils.ts`
Time-related utilities:
- Timestamp formatting
- Relative time display

## State Management

### Client-Side State

The app uses a combination of:

1. **React Context**: For global state (BeeperData, Settings, Auth)
2. **Custom Hooks**: For data access and actions
3. **Local Component State**: For UI-specific state
4. **LocalStorage**: For persistence

### State Flow

```
LocalStorage
    ↓
BeeperDataProvider → useBeeperData() → Components
    ↓
Settings Context → useSettingsContext() → Components
    ↓
Auth Context → useAuth() → Components
```

### Key State Patterns

**Single Source of Truth**:
- All Beeper data flows through BeeperDataProvider
- No duplicate fetching of the same data
- Computed views derived from base data

**Polling with Caching**:
- Client polls every 10 seconds
- Server caches data with TTL
- Reduces redundant API calls

**Optimistic Updates**:
- Archive actions update UI before API call
- Failed operations revert state

## API Design

### Unified Endpoint

The `/api/beeper/data` endpoint consolidates all data fetching:

**Request**:
```
GET /api/beeper/data?slices=accounts,chats,archived&accountIds=id1,id2
Headers: x-beeper-token: <token>
```

**Response**:
```json
{
  "accounts": [...],
  "messages": [...],
  "archivedMessages": [...],
  "userInfo": {...},
  "chatInfo": {...},
  "avatars": {...},
  "_meta": { "fetchedAt": "..." }
}
```

### Error Handling

```typescript
try {
  const result = await externalAPI()
  return NextResponse.json({ data: result })
} catch (error) {
  return NextResponse.json(
    { error: error.message },
    { status: 500 }
  )
}
```

## Component Architecture

### Component Patterns

**Container/Presentational Split**:
- Container: `app/page.tsx` (logic)
- Presentational: `components/kanban/message-board.tsx` (UI)

**Context Consumption**:
```typescript
export default function Home() {
  const { messages, accounts, isLoading } = useBeeperData()
  const { contacts, updateContact } = useCrm()

  // Business logic

  return <MessageBoard messages={messages} />
}
```

**Hooks for Logic**:
- Extract complex logic into custom hooks
- Keep components focused on rendering

## Performance Considerations

### Current Optimizations

1. **Unified Data Fetching**: Single API call instead of multiple
2. **Server-Side Caching**: TTL-based cache reduces Beeper API calls
3. **Client-Side Caching**: localStorage persistence
4. **Polling Efficiency**: Diff-based updates
5. **Code Splitting**: Next.js automatic code splitting

### Performance Characteristics

- Message polling: 10 second interval
- Server cache TTL: 30 seconds for chats, 5 minutes for accounts
- LocalStorage: Synchronous but fast for small data

### Future Improvements

- WebSocket for real-time updates
- Virtual scrolling for large message lists
- IndexedDB for large data storage

## Security Architecture

### Data Security

**Storage**:
- All sensitive data in LocalStorage
- No server-side storage of credentials
- API keys never logged

**API Communication**:
- HTTPS only
- Tokens in headers (not URL params)

**Beeper Integration**:
- Uses official Beeper SDK
- Access token required for all operations

### Privacy

- No analytics or tracking
- All data stays local
- No telemetry

## Technology Choices

### Why Next.js?
- Server-side API routes
- Excellent developer experience
- Built-in optimization
- TypeScript support

### Why Unified Data Pipeline?
- Eliminates redundant API calls
- Single source of truth
- Easier to extend
- Better caching

### Why LocalStorage?
- Simple persistence
- No backend required
- Fast access
- Privacy-friendly

### Why Beeper SDK?
- Official integration
- Multi-platform support
- Type-safe API
