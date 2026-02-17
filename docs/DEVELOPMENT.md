# Development Guide

This guide covers everything you need to know to develop and contribute to Beeper Kanban.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Structure](#code-structure)
- [Adding Features](#adding-features)
- [Testing](#testing)
- [Code Style](#code-style)
- [Common Tasks](#common-tasks)
- [Debugging](#debugging)
- [Deployment](#deployment)

---

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn
- Git
- Code editor (VS Code recommended)
- Beeper account for testing

### Initial Setup

1. **Clone the repository**:
```bash
git clone https://github.com/yourusername/beeper-kanban.git
cd beeper-kanban
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
- Error Lens
- GitLens

---

## Development Workflow

### Branch Strategy

```
main (production-ready)
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

---

## Code Structure

### Project Layout

```
beeper-kanban/
├── app/
│   ├── api/beeper/       # API routes (unified data endpoint)
│   ├── settings/         # Settings pages
│   ├── layout.tsx        # Root layout with providers
│   └── page.tsx          # Main kanban board
├── components/
│   ├── kanban/           # Board components
│   ├── ui/               # shadcn/ui components
│   └── *.tsx             # Feature components
├── contexts/
│   ├── beeper-data-context.tsx  # Unified data provider
│   ├── settings-context.tsx     # App settings
│   └── auth-context.tsx         # Authentication
├── hooks/
│   ├── use-beeper-data.ts      # Main data hook
│   ├── use-crm.ts              # CRM functionality
│   └── *.ts                    # Other hooks
├── lib/
│   ├── beeper/                 # Data pipeline
│   │   ├── types.ts
│   │   ├── cache.ts
│   │   ├── transforms.ts
│   │   └── data-service.ts
│   ├── types.ts               # Type definitions
│   ├── storage.ts             # LocalStorage utilities
│   └── *.ts                   # Other utilities
└── docs/                      # Documentation
```

### Key Patterns

**Unified Data Provider**:
```typescript
// All Beeper data flows through BeeperDataProvider
const { messages, accounts, isLoading } = useBeeperData()
```

**Custom Hooks Pattern**:
```typescript
// hooks/use-my-feature.ts
export function useMyFeature() {
  const [data, setData] = useState([])
  // ... logic
  return { data, actions }
}
```

**Context Pattern**:
```typescript
// contexts/my-context.tsx
const MyContext = createContext<MyContextValue | null>(null)

export function MyProvider({ children }: { children: ReactNode }) {
  // State and logic
  return (
    <MyContext.Provider value={value}>
      {children}
    </MyContext.Provider>
  )
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
    const token = request.headers.get('x-beeper-token')
    if (!token) {
      return NextResponse.json(
        { error: 'Missing token' },
        { status: 401 }
      )
    }

    const data = await fetchSomeData(token)
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
```

2. **Add types** (if needed) in `lib/types.ts`

3. **Create hook** (if needed) in `hooks/`

### Adding a New Component

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
      <Button onClick={onAction}>Action</Button>
    </div>
  )
}
```

### Adding a New Setting

1. **Update types** in `lib/types.ts`:
```typescript
export interface AppSettings {
  // ... existing settings
  myNewSetting?: boolean
}
```

2. **Update default settings** in `lib/storage.ts`

3. **Add UI** in settings page

### Adding Storage Utilities

```typescript
// lib/storage.ts
const MY_DATA_KEY = 'parrot-my-data'

export function saveMyData(data: MyData): void {
  localStorage.setItem(MY_DATA_KEY, JSON.stringify(data))
}

export function loadMyData(): MyData | null {
  const item = localStorage.getItem(MY_DATA_KEY)
  if (!item) return null
  try {
    return JSON.parse(item)
  } catch {
    return null
  }
}
```

---

## Testing

### Manual Testing Checklist

Before submitting PR:

- [ ] All existing features still work
- [ ] New feature works as expected
- [ ] Tested on Chrome, Firefox, Safari
- [ ] Tested light and dark mode
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Tested with different Beeper accounts

### Unit Tests (Future)

Using Jest and React Testing Library:

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

---

## Code Style

### TypeScript

**Use explicit types**:
```typescript
// Good
const messages: BeeperMessage[] = []

// Bad
const messages = []
```

**Prefer interfaces for objects**:
```typescript
interface User {
  id: string
  name: string
}

// Use type for unions
type Status = 'active' | 'inactive'
```

### React

**Use functional components**:
```typescript
export function MyComponent({ data }: Props) {
  return <div>{data}</div>
}
```

**Destructure props**:
```typescript
// Good
export function MyComponent({ data }: Props) {
  return <div>{data}</div>
}
```

### Naming Conventions

- **Components**: PascalCase (`MyComponent`)
- **Hooks**: camelCase with `use` prefix (`useMessages`)
- **Files**: kebab-case (`my-component.tsx`)
- **Types**: PascalCase (`BeeperMessage`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_MESSAGES`)

---

## Common Tasks

### Adding a New Column to Kanban

1. **Update types**:
```typescript
// lib/types.ts
export type ColumnId = 'unread' | 'drafts' | 'sent' | 'my-new-column'
```

2. **Update MessageBoard component**

3. **Add column header logic**

### Adding a Platform Icon

```typescript
// components/platform-icon.tsx
const iconMap: Record<string, IconComponent> = {
  // ... existing
  'my-platform': MyPlatformIcon
}
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

### Common Issues

**"Messages not loading"**:
1. Check browser console for errors
2. Verify Beeper token in Network tab
3. Check API response
4. Verify Beeper Desktop is running

**"TypeScript errors"**:
```bash
npx tsc --noEmit
```

---

## Deployment

### Production Build

```bash
npm run build
npm run start
```

### Vercel Deployment

```bash
npm i -g vercel
vercel
vercel --prod
```

### Environment Variables

Add to `.env.local`:
```
NEXT_PUBLIC_API_URL=https://api.example.com
```

---

## Resources

### Documentation
- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Tools
- [Beeper API](https://beeper.com)

---

## Support

For development questions:
1. Check this guide
2. Review existing code
3. Check relevant documentation
4. Open an issue with details

Happy coding!
