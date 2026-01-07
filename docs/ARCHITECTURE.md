# Architecture Documentation

## Overview

Parrot is built as a modern Next.js application with a client-side heavy architecture. The application follows React best practices with hooks, contexts, and component composition patterns.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser/Electron                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Next.js Frontend (React)                 │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │  │
│  │  │   Kanban    │  │   Message    │  │  Settings   │  │  │
│  │  │   Board     │  │   Panel      │  │   Pages     │  │  │
│  │  └─────────────┘  └──────────────┘  └─────────────┘  │  │
│  │           │                │                │          │  │
│  │  ┌────────┴────────────────┴────────────────┘          │  │
│  │  │         Contexts & State Management                 │  │
│  │  │   - Settings Context                                │  │
│  │  │   - Autopilot Context                               │  │
│  │  │   - Custom Hooks (Messages, Drafts, etc.)          │  │
│  │  └────────────────────┬───────────────────────────────┘  │
│  └───────────────────────┼───────────────────────────────┘  │
│                          │                                   │
│  ┌───────────────────────┼───────────────────────────────┐  │
│  │         Next.js API Routes (Server-Side)              │  │
│  │  ┌──────────────┐  ┌───────────────┐  ┌───────────┐  │  │
│  │  │  Beeper API  │  │   AI API      │  │  Ollama   │  │  │
│  │  │  Integration │  │  Integration  │  │  API      │  │  │
│  │  └──────┬───────┘  └───────┬───────┘  └─────┬─────┘  │  │
│  └─────────┼──────────────────┼────────────────┼────────┘  │
└────────────┼──────────────────┼────────────────┼───────────┘
             │                  │                │
             ▼                  ▼                ▼
    ┌────────────────┐  ┌──────────────┐  ┌──────────────┐
    │  Beeper API    │  │ Anthropic/   │  │   Ollama     │
    │  (Remote)      │  │ OpenAI API   │  │  (Local)     │
    └────────────────┘  └──────────────┘  └──────────────┘
```

## Data Flow

### Message Loading Flow

```
1. User opens app
2. Settings Context loads from LocalStorage
3. useMessages hook fetches from /api/beeper/messages
4. API route calls Beeper Desktop API
5. Messages are processed and categorized
6. UI renders Kanban board with columns
```

### Draft Generation Flow

```
1. User drags message to Drafts column (or clicks Generate All)
2. Optimistic draft created with "Generating..." text
3. POST to /api/ai/draft with message context
4. API route:
   - Loads tone settings and writing style from storage
   - Calls selected AI provider (Anthropic/OpenAI/Ollama)
   - Returns generated draft
5. Draft updated in state
6. UI reflects new draft
```

### Autopilot Flow

```
1. User enables autopilot for a chat
2. ChatAutopilotConfig saved to LocalStorage
3. AutopilotContext monitors for new messages
4. When message arrives:
   - AutopilotEngine processes message
   - Applies agent's system prompt and goal
   - Generates draft or schedules action
   - Logs activity
   - Updates UI
5. Scheduler executes queued actions
6. On goal completion:
   - Generates handoff summary
   - Updates status based on goal completion behavior
```

## Directory Structure

### `/app` - Next.js App Directory

#### `/app/page.tsx`
Main kanban board interface. Handles:
- Message loading and display
- Drag-and-drop functionality
- Draft creation and management
- Autopilot integration
- UI state management

#### `/app/layout.tsx`
Root layout with providers:
- Settings Context Provider
- Autopilot Context Provider
- Theme Provider
- Toast notifications (Sonner)

#### `/app/api` - API Routes

**Beeper Integration**:
- `beeper/messages/route.ts` - Fetch unread messages
- `beeper/user-messages/route.ts` - Fetch sent messages
- `beeper/archived/route.ts` - Fetch archived messages
- `beeper/send/route.ts` - Send messages
- `beeper/chats/[chatId]/archive/route.ts` - Archive chat
- `beeper/chats/[chatId]/unarchive/route.ts` - Unarchive chat
- `beeper/accounts/route.ts` - Get connected accounts
- `beeper/contacts/route.ts` - Get contacts

**AI Integration**:
- `ai/draft/route.ts` - Generate draft replies
- `ai/chat/route.ts` - AI chat assistant
- `ai/conversation-summary/route.ts` - Generate summaries

**Other**:
- `avatar/route.ts` - Proxy avatar images
- `media/route.ts` - Handle media attachments
- `ollama/models/route.ts` - List Ollama models

#### `/app/settings` - Settings Pages
- `platforms/page.tsx` - Platform selection
- `api-keys/page.tsx` - API key management
- `tone/page.tsx` - Writing style configuration
- `hidden-chats/page.tsx` - Hidden chat management
- `data/page.tsx` - Data export/import
- `autopilot/page.tsx` - Autopilot overview
- `autopilot/agents/page.tsx` - Agent list
- `autopilot/agents/new/page.tsx` - Create agent
- `autopilot/agents/[id]/page.tsx` - Edit agent
- `autopilot/activity/page.tsx` - Activity log

### `/components` - React Components

#### `/components/kanban`
Kanban board components:
- `message-board.tsx` - Main board with columns
- `message-card.tsx` - Individual message/draft card
- `column-header.tsx` - Column headers with actions

#### `/components/autopilot`
Autopilot-related components:
- `agent-form.tsx` - Agent creation/editing form
- `autopilot-status-badge.tsx` - Status indicator
- `autopilot-activity-log.tsx` - Activity log display
- `autopilot-controls-bar.tsx` - Control buttons
- `autopilot-current-activity.tsx` - Current activity display
- `autopilot-active-section.tsx` - Active autopilot section
- `autopilot-header-status.tsx` - Header status display
- `chat-autopilot-config.tsx` - Per-chat configuration
- `handoff-summary-card.tsx` - Handoff notification card

#### `/components/message-input`
Message input components:
- `manual-input-section.tsx` - Manual message input
- `draft-approval-section.tsx` - Draft approval UI
- `autopilot-status-display.tsx` - Autopilot status
- `autopilot-config-form.tsx` - Configuration form
- `autopilot-config-icons.tsx` - Icon components

#### `/components/ui`
Reusable UI components from Radix UI:
- Button, Dialog, Input, Textarea, Select, etc.
- `animated-gradient-sphere.tsx` - Animated background

#### Other Components
- `message-panel.tsx` - Right-side message detail panel
- `ai-chat-panel.tsx` - AI chat assistant panel
- `message-detail.tsx` - Message detail modal
- `draft-composer.tsx` - Draft editing dialog
- `contacts-dialog.tsx` - Contact selection
- `tone-settings.tsx` - Tone configuration UI
- `theme-toggle.tsx` - Dark/light mode toggle
- `platform-icon.tsx` - Platform-specific icons

### `/contexts` - React Contexts

#### `settings-context.tsx`
Global app settings:
- Selected account IDs
- API keys (Beeper, Anthropic, OpenAI)
- AI provider selection
- Ollama configuration
- UI preferences

#### `autopilot-context.tsx`
Autopilot state management:
- Process new messages
- Manage scheduled actions
- Track activity
- Generate handoff summaries
- Configuration version tracking

### `/hooks` - Custom React Hooks

#### Message & Data Hooks
- `use-messages.ts` - Fetch and manage messages
- `use-archived.ts` - Fetch archived messages
- `use-drafts.ts` - Draft management (CRUD)
- `use-accounts.ts` - Account fetching
- `use-ai-chat-history.ts` - Per-thread AI chat

#### Batch Operation Hooks
- `use-batch-draft-generator.ts` - Generate multiple drafts
- `use-batch-send.ts` - Send multiple drafts

#### Autopilot Hooks
- `use-autopilot-agents.ts` - Agent CRUD operations
- `use-chat-autopilot.ts` - Per-chat autopilot config
- `use-autopilot-engine.ts` - Core autopilot logic
- `use-autopilot-scheduler.ts` - Action scheduling
- `use-autopilot-events.ts` - Event handling
- `use-pending-drafts.ts` - Pending draft management
- `use-scheduler-status.ts` - Scheduler status
- `use-last-activity.ts` - Last activity tracking

#### Other Hooks
- `use-settings.ts` - Settings management

### `/lib` - Utility Libraries

#### `types.ts`
TypeScript type definitions for:
- Beeper API types (BeeperMessage, BeeperAccount, etc.)
- App types (Draft, AppSettings, KanbanCard)
- Autopilot types (AutopilotAgent, ChatAutopilotConfig, etc.)
- Writing style types (ToneSettings, WritingStylePatterns)

#### `storage.ts`
LocalStorage utilities for:
- App settings
- Drafts
- Hidden chats
- Tone settings and writing style
- Autopilot configurations
- Scheduled actions
- Activity logs
- AI chat history

#### `ollama.ts`
Ollama API integration:
- Model listing
- Chat completions
- Error handling

#### `autopilot-events.ts`
Event system for autopilot:
- Event emitter
- Type-safe event handlers

#### `time-utils.ts`
Time-related utilities:
- Delay calculations
- Activity hour checks
- Timestamp formatting

## State Management

### Client-Side State

The app uses a combination of:

1. **React Context**: For global state (Settings, Autopilot)
2. **Custom Hooks**: For data fetching and management
3. **Local Component State**: For UI-specific state
4. **LocalStorage**: For persistence

### State Flow

```
LocalStorage
    ↓
Settings Context → Components
    ↓
Custom Hooks (useMessages, useDrafts, etc.)
    ↓
API Routes → External APIs
```

### Key State Patterns

**Optimistic Updates**:
- Draft creation shows immediately with placeholder
- Archive actions update UI before API call
- Failed operations revert state

**Polling**:
- Messages auto-refresh every 10 seconds
- Autopilot scheduler runs continuously

**Event-Driven**:
- Autopilot uses event emitter for coordination
- Components subscribe to autopilot events

## API Design

### Next.js API Routes

All API routes follow REST conventions:

**Request Flow**:
```
1. Client sends request with headers
2. API route validates authentication
3. Route calls external API or processes data
4. Response formatted as { data, error }
5. Client handles response
```

**Authentication**:
- Beeper token passed via `x-beeper-token` header
- Anthropic key via `x-anthropic-key` header
- OpenAI key handled similarly

**Error Handling**:
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

**Composition**:
- Small, focused components
- Props for customization
- Children for flexibility

**Hooks for Logic**:
- Extract complex logic into custom hooks
- Keep components focused on rendering

### Example Component Structure

```typescript
// Container Component (app/page.tsx)
export default function Home() {
  const { messages } = useMessages()
  const { drafts, createDraft } = useDrafts()

  const handleDragDrop = async (card, toColumn) => {
    // Business logic
  }

  return <MessageBoard onDrop={handleDragDrop} />
}

// Presentational Component
export function MessageBoard({ onDrop }) {
  return (
    <DndContext onDragEnd={onDrop}>
      {/* UI rendering */}
    </DndContext>
  )
}
```

## Autopilot System Architecture

### Core Components

1. **AutopilotContext**: Global autopilot state
2. **useAutopilotEngine**: Message processing logic
3. **useAutopilotScheduler**: Action execution
4. **ChatAutopilotConfig**: Per-chat configuration

### Processing Pipeline

```
New Message
    ↓
AutopilotContext.processNewMessages()
    ↓
useAutopilotEngine.processMessage()
    ↓
├─ Check if autopilot enabled for chat
├─ Load agent configuration
├─ Generate response using AI
├─ Apply human-like delays
├─ Schedule action (if self-driving)
└─ Log activity
    ↓
useAutopilotScheduler.executeActions()
    ↓
Send message (if time reached)
    ↓
Check goal completion
    ↓
Generate handoff (if needed)
```

### Human-Like Behavior Implementation

**Reply Delays**:
```typescript
const delay = contextAware
  ? calculateContextAwareDelay(recentMessages)
  : randomBetween(min, max)
```

**Activity Hours**:
```typescript
const now = new Date()
if (now.getHours() < startHour || now.getHours() > endHour) {
  return // Don't respond outside hours
}
```

**Typing Indicators**:
```typescript
const typingDuration = (words / wpm) * 60 * 1000
scheduleAction('typing-indicator', now)
scheduleAction('send-message', now + typingDuration)
```

## Performance Considerations

### Optimization Strategies

1. **Virtualization**: Could be added for large message lists
2. **Memoization**: Used in message filtering logic
3. **Debouncing**: On search and filter inputs
4. **Code Splitting**: Next.js automatic code splitting
5. **Image Optimization**: Next.js Image component for avatars

### Current Performance Characteristics

- Message polling: 10 second interval
- Autopilot scheduler: Runs continuously
- LocalStorage: Synchronous operations (potential bottleneck)
- No real-time updates (polling-based)

### Future Improvements

- WebSocket for real-time updates
- IndexedDB for large data storage
- Virtual scrolling for message lists
- Service Worker for offline support

## Security Architecture

### Data Security

**Storage**:
- All sensitive data in LocalStorage
- No server-side storage of credentials
- API keys never logged

**API Communication**:
- HTTPS only
- Tokens in headers (not URL params)
- CORS properly configured

**Beeper Integration**:
- Uses official Beeper Desktop API
- Access token required for all operations
- No credential storage

### Privacy

- No analytics or tracking
- AI requests only to selected provider
- Option for local Ollama (complete privacy)
- No telemetry

## Testing Strategy

### Recommended Testing Approach

**Unit Tests**:
- Utility functions in `/lib`
- Custom hooks (with React Testing Library)
- Component logic

**Integration Tests**:
- API routes
- Context + Hook interactions
- Complete user flows

**E2E Tests**:
- Main workflows (message → draft → send)
- Autopilot scenarios
- Settings configuration

### Test Structure

```
__tests__/
├── lib/
│   ├── storage.test.ts
│   └── time-utils.test.ts
├── hooks/
│   ├── use-messages.test.ts
│   └── use-drafts.test.ts
├── components/
│   └── kanban/
│       └── message-card.test.tsx
└── integration/
    └── draft-flow.test.ts
```

## Deployment Architecture

### Web Deployment

**Vercel** (Recommended):
```bash
npm run build
vercel deploy
```

**Other Platforms**:
- Netlify
- AWS Amplify
- Self-hosted Node.js server

### Electron Deployment

**Build Process**:
```bash
npm run build
electron-builder
```

**Distribution**:
- macOS: `.dmg` installer
- Windows: `.exe` installer
- Linux: `.AppImage` or `.deb`

### Environment Variables

Not currently used, but could be added:
```
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

## Scalability Considerations

### Current Limitations

1. **LocalStorage Size**: 5-10MB limit
2. **Polling Overhead**: Could become inefficient
3. **Client-Side Processing**: Limited by browser

### Scaling Solutions

**For High Message Volume**:
- Implement pagination
- Add message search/filtering
- Virtual scrolling
- IndexedDB for storage

**For Multiple Users** (future):
- Backend database
- Real-time sync
- User authentication
- Shared autopilot agents

## Technology Choices Rationale

### Why Next.js?
- Server-side rendering capability
- API routes for backend logic
- Excellent developer experience
- Built-in optimization

### Why LocalStorage?
- Simple persistence
- No backend required
- Fast access
- Privacy-friendly

### Why Beeper Desktop API?
- Official integration
- Multi-platform support
- Active development
- Good documentation

### Why Multiple AI Providers?
- Flexibility for users
- Cost optimization
- Privacy options (Ollama)
- Feature comparison

## Future Architecture Plans

1. **Real-Time Updates**: WebSocket integration
2. **Backend Service**: Optional cloud sync
3. **Mobile Apps**: React Native version
4. **Plugin System**: Custom integrations
5. **Advanced Analytics**: Message insights
6. **Team Features**: Shared agents and templates
