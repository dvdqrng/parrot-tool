# Development Guide

This guide covers everything you need to know to develop and contribute to Parrot.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Structure](#code-structure)
- [Adding Features](#adding-features)
- [Testing](#testing)
- [Code Style](#code-style)
- [Common Tasks](#common-tasks)
- [Debugging](#debugging)
- [Performance](#performance)
- [Deployment](#deployment)

---

## Getting Started

### Prerequisites

- Node.js 20+ (LTS recommended)
- npm or yarn
- Git
- Code editor (VS Code recommended)
- Beeper account for testing

### Initial Setup

1. **Clone the repository**:
```bash
git clone https://github.com/yourusername/parrot.git
cd parrot
```

2. **Install dependencies**:
```bash
npm install
```

3. **Start development server**:
```bash
npm run dev
```

4. **Open in browser**:
```
http://localhost:3000
```

### Recommended VS Code Extensions

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript Vue Plugin (Volar)
- Error Lens
- GitLens

---

## Development Workflow

### Branch Strategy

```
main (production-ready)
  ↓
develop (integration branch)
  ↓
feature/your-feature-name (your work)
```

### Creating a Feature

1. **Create branch**:
```bash
git checkout -b feature/my-feature
```

2. **Make changes**
3. **Test locally**
4. **Commit**:
```bash
git add .
git commit -m "feat: add my feature"
```

5. **Push**:
```bash
git push origin feature/my-feature
```

6. **Create Pull Request**

### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: resolve bug
docs: update documentation
style: format code
refactor: restructure code
test: add tests
chore: update dependencies
```

**Examples**:
```bash
feat: add dark mode toggle
fix: resolve message loading race condition
docs: add API documentation
refactor: extract message processing logic
test: add unit tests for storage utilities
chore: update Next.js to 16.0.8
```

---

## Code Structure

### Component Organization

```typescript
// Bad: Everything in one file
export default function Page() {
  // 500 lines of code...
}

// Good: Split into logical components
export default function Page() {
  const { messages } = useMessages()
  const { drafts } = useDrafts()

  return (
    <div>
      <MessageBoard messages={messages} />
      <DraftPanel drafts={drafts} />
    </div>
  )
}
```

### Custom Hooks Pattern

```typescript
// hooks/use-messages.ts
export function useMessages(accountIds: string[]) {
  const [messages, setMessages] = useState<BeeperMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMessages = useCallback(async () => {
    setIsLoading(true)
    try {
      // Fetch logic
      setMessages(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [accountIds])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  return { messages, isLoading, error, refetch: fetchMessages }
}
```

### Context Pattern

```typescript
// contexts/my-context.tsx
interface MyContextValue {
  data: SomeData
  updateData: (data: SomeData) => void
}

const MyContext = createContext<MyContextValue | null>(null)

export function MyProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SomeData>(loadFromStorage())

  const updateData = useCallback((newData: SomeData) => {
    setData(newData)
    saveToStorage(newData)
  }, [])

  return (
    <MyContext.Provider value={{ data, updateData }}>
      {children}
    </MyContext.Provider>
  )
}

export function useMyContext() {
  const context = useContext(MyContext)
  if (!context) {
    throw new Error('useMyContext must be used within MyProvider')
  }
  return context
}
```

---

## Adding Features

### Adding a New API Route

1. **Create route file**:
```typescript
// app/api/my-route/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Get headers
    const token = request.headers.get('x-beeper-token')
    if (!token) {
      return NextResponse.json(
        { error: 'Missing token' },
        { status: 401 }
      )
    }

    // Process request
    const data = await fetchSomeData(token)

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // POST handler
}
```

2. **Add types** (if needed):
```typescript
// lib/types.ts
export interface MyNewType {
  id: string
  name: string
}
```

3. **Create hook** (if needed):
```typescript
// hooks/use-my-feature.ts
export function useMyFeature() {
  const { settings } = useSettingsContext()

  const fetchData = async () => {
    const response = await fetch('/api/my-route', {
      headers: {
        'x-beeper-token': settings.beeperAccessToken!
      }
    })
    const result = await response.json()
    return result.data
  }

  return { fetchData }
}
```

### Adding a New Component

1. **Create component file**:
```typescript
// components/my-component.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface MyComponentProps {
  title: string
  onAction: () => void
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  const [isActive, setIsActive] = useState(false)

  return (
    <div>
      <h2>{title}</h2>
      <Button onClick={onAction}>
        Action
      </Button>
    </div>
  )
}
```

2. **Add to parent**:
```typescript
// app/page.tsx
import { MyComponent } from '@/components/my-component'

export default function Home() {
  const handleAction = () => {
    console.log('Action clicked')
  }

  return (
    <div>
      <MyComponent title="Hello" onAction={handleAction} />
    </div>
  )
}
```

### Adding a New Setting

1. **Update types**:
```typescript
// lib/types.ts
export interface AppSettings {
  // ... existing settings
  myNewSetting?: boolean
}
```

2. **Update default settings**:
```typescript
// lib/storage.ts
const DEFAULT_SETTINGS: AppSettings = {
  // ... existing defaults
  myNewSetting: false
}
```

3. **Add UI in settings page**:
```typescript
// app/settings/page.tsx
<div>
  <label>
    <input
      type="checkbox"
      checked={settings.myNewSetting}
      onChange={(e) => updateSettings({
        myNewSetting: e.target.checked
      })}
    />
    Enable My Feature
  </label>
</div>
```

### Adding Storage Utilities

```typescript
// lib/storage.ts

// Save
export function saveMyData(data: MyData): void {
  localStorage.setItem('my-data', JSON.stringify(data))
}

// Load
export function loadMyData(): MyData | null {
  const item = localStorage.getItem('my-data')
  if (!item) return null
  try {
    return JSON.parse(item)
  } catch {
    return null
  }
}

// Clear
export function clearMyData(): void {
  localStorage.removeItem('my-data')
}
```

---

## Testing

### Unit Tests

Using Jest and React Testing Library (to be set up):

```typescript
// __tests__/lib/storage.test.ts
import { saveMyData, loadMyData } from '@/lib/storage'

describe('storage utilities', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  test('saves and loads data', () => {
    const data = { id: '1', name: 'Test' }
    saveMyData(data)
    const loaded = loadMyData()
    expect(loaded).toEqual(data)
  })
})
```

### Component Tests

```typescript
// __tests__/components/my-component.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MyComponent } from '@/components/my-component'

describe('MyComponent', () => {
  test('renders and handles click', () => {
    const handleAction = jest.fn()
    render(<MyComponent title="Test" onAction={handleAction} />)

    const button = screen.getByText('Action')
    fireEvent.click(button)

    expect(handleAction).toHaveBeenCalled()
  })
})
```

### API Route Tests

```typescript
// __tests__/api/my-route.test.ts
import { GET } from '@/app/api/my-route/route'
import { NextRequest } from 'next/server'

describe('GET /api/my-route', () => {
  test('returns data with valid token', async () => {
    const request = new NextRequest('http://localhost/api/my-route', {
      headers: { 'x-beeper-token': 'valid-token' }
    })

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data).toBeDefined()
  })

  test('returns error without token', async () => {
    const request = new NextRequest('http://localhost/api/my-route')
    const response = await GET(request)

    expect(response.status).toBe(401)
  })
})
```

### Manual Testing Checklist

Before submitting PR:

- [ ] All existing features still work
- [ ] New feature works as expected
- [ ] Tested on Chrome, Firefox, Safari
- [ ] Tested light and dark mode
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Tested with and without AI configured
- [ ] Tested with different Beeper accounts

---

## Code Style

### TypeScript

**Use explicit types**:
```typescript
// Bad
const messages = []

// Good
const messages: BeeperMessage[] = []
```

**Prefer interfaces over types** for objects:
```typescript
// Good
interface User {
  id: string
  name: string
}

// Use type for unions
type Status = 'active' | 'inactive'
```

**Use optional chaining**:
```typescript
// Bad
if (user && user.profile && user.profile.avatar) {
  // ...
}

// Good
if (user?.profile?.avatar) {
  // ...
}
```

### React

**Use functional components**:
```typescript
// Good
export function MyComponent({ data }: Props) {
  return <div>{data}</div>
}
```

**Destructure props**:
```typescript
// Bad
export function MyComponent(props: Props) {
  return <div>{props.data}</div>
}

// Good
export function MyComponent({ data }: Props) {
  return <div>{data}</div>
}
```

**Use const for components**:
```typescript
export const MyComponent = ({ data }: Props) => {
  return <div>{data}</div>
}
```

### Naming Conventions

- **Components**: PascalCase (`MyComponent`)
- **Hooks**: camelCase with `use` prefix (`useMessages`)
- **Files**: kebab-case (`my-component.tsx`)
- **Types**: PascalCase (`BeeperMessage`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_MESSAGES`)

### File Organization

```typescript
// 1. Imports - external first
import { useState } from 'react'
import { Button } from '@/components/ui/button'

// 2. Imports - internal
import { useMessages } from '@/hooks/use-messages'
import { BeeperMessage } from '@/lib/types'

// 3. Types/Interfaces
interface MyComponentProps {
  data: string
}

// 4. Constants
const MAX_ITEMS = 10

// 5. Component
export function MyComponent({ data }: MyComponentProps) {
  // Hooks first
  const [state, setState] = useState()
  const { messages } = useMessages()

  // Event handlers
  const handleClick = () => {
    // ...
  }

  // Render
  return <div>{data}</div>
}
```

---

## Common Tasks

### Adding a New Column to Kanban

1. **Update types**:
```typescript
// lib/types.ts
export type ColumnId = 'unread' | 'drafts' | 'sent' | 'my-new-column'
```

2. **Update MessageBoard component**:
```typescript
// components/kanban/message-board.tsx
const columns: ColumnId[] = ['unread', 'drafts', 'sent', 'my-new-column']
```

3. **Add column header logic**:
```typescript
// components/kanban/column-header.tsx
case 'my-new-column':
  return 'My New Column'
```

### Adding a New AI Provider

1. **Update types**:
```typescript
// lib/types.ts
export type AiProvider = 'anthropic' | 'openai' | 'ollama' | 'my-provider'
```

2. **Add API integration**:
```typescript
// app/api/ai/draft/route.ts
if (provider === 'my-provider') {
  // Integration logic
}
```

3. **Add settings UI**:
```typescript
// app/settings/api-keys/page.tsx
<option value="my-provider">My Provider</option>
```

### Adding a Platform Icon

1. **Add icon mapping**:
```typescript
// components/platform-icon.tsx
const iconMap: Record<string, IconComponent> = {
  // ... existing
  'my-platform': MyPlatformIcon
}
```

2. **Import icon**:
```typescript
import { MyPlatformIcon } from 'lucide-react'
```

### Modifying Message Polling

```typescript
// app/page.tsx
useEffect(() => {
  const interval = setInterval(() => {
    refetch()
  }, 10000) // Change this value (milliseconds)

  return () => clearInterval(interval)
}, [refetch])
```

---

## Debugging

### Browser DevTools

**Console**: Check for errors and logs
```typescript
console.log('Debug:', data)
console.error('Error:', error)
```

**Network Tab**: Monitor API calls
- Check request/response
- Verify headers
- Check timing

**Application Tab**: Inspect LocalStorage
- View stored data
- Manual editing
- Clear storage

**React DevTools**: Inspect component state
- Install React DevTools extension
- View component tree
- Check props and state

### Common Issues

**"Messages not loading"**:
1. Check browser console for errors
2. Verify Beeper token in Network tab
3. Check API response in Network tab
4. Verify Beeper Desktop is running

**"TypeScript errors"**:
```bash
# Check types
npx tsc --noEmit

# Common fix: restart TS server in VS Code
Cmd+Shift+P → "TypeScript: Restart TS Server"
```

**"LocalStorage not persisting"**:
- Check if in incognito/private mode
- Verify storage isn't full
- Check browser settings

### Debug Mode

Add debug logging:

```typescript
// lib/debug.ts
export const DEBUG = process.env.NODE_ENV === 'development'

export function debug(label: string, data: any) {
  if (DEBUG) {
    console.log(`[${label}]`, data)
  }
}

// Usage
debug('Messages loaded', messages)
```

---

## Performance

### Optimization Tips

**Memoization**:
```typescript
// Expensive computation
const processedMessages = useMemo(() => {
  return messages.map(m => processMessage(m))
}, [messages])

// Callbacks
const handleClick = useCallback(() => {
  doSomething()
}, [dependencies])
```

**Lazy Loading**:
```typescript
// Lazy load heavy components
const HeavyComponent = lazy(() => import('./heavy-component'))

<Suspense fallback={<Loading />}>
  <HeavyComponent />
</Suspense>
```

**Virtual Scrolling** (future):
```typescript
// For long message lists
import { VirtualList } from 'react-virtual'

<VirtualList
  height={600}
  itemCount={messages.length}
  itemSize={80}
  renderItem={({ index }) => <MessageCard message={messages[index]} />}
/>
```

### Performance Monitoring

```typescript
// Measure render time
useEffect(() => {
  const start = performance.now()

  return () => {
    const end = performance.now()
    console.log(`Render took ${end - start}ms`)
  }
})
```

---

## Deployment

### Production Build

```bash
# Build
npm run build

# Test production build locally
npm run start
```

### Vercel Deployment

1. **Install Vercel CLI**:
```bash
npm i -g vercel
```

2. **Deploy**:
```bash
vercel
```

3. **Production**:
```bash
vercel --prod
```

### Environment Variables

Add to `.env.local` (not committed):
```
NEXT_PUBLIC_API_URL=https://api.example.com
```

Access in code:
```typescript
const apiUrl = process.env.NEXT_PUBLIC_API_URL
```

### Electron Build

```bash
# Install electron-builder globally
npm install -g electron-builder

# Build for current platform
npm run build
electron-builder

# Build for specific platform
electron-builder --mac
electron-builder --windows
electron-builder --linux
```

### Docker (Optional)

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t parrot .
docker run -p 3000:3000 parrot
```

---

## Contributing

### Pull Request Process

1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests if applicable
5. Update documentation
6. Submit PR with clear description

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested locally
- [ ] Added/updated tests
- [ ] All tests pass

## Screenshots (if applicable)
Add screenshots

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
```

---

## Resources

### Documentation
- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Radix UI](https://radix-ui.com)

### Tools
- [Beeper API](https://beeper.com)
- [Anthropic API](https://docs.anthropic.com)
- [OpenAI API](https://platform.openai.com/docs)
- [Ollama](https://ollama.ai)

### Community
- GitHub Issues
- GitHub Discussions
- Discord (if available)

---

## Support

For development questions:
1. Check this guide
2. Review existing code
3. Check relevant documentation
4. Ask in GitHub Discussions
5. Open an issue with details

Happy coding!
