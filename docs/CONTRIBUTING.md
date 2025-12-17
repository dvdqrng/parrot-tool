# Contributing to Beeper Kanban

Thank you for considering contributing to Beeper Kanban! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Guidelines](#coding-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Documentation](#documentation)

---

## Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

**Positive behavior includes**:
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes**:
- Trolling, insulting/derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

### Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported by opening an issue or contacting the project maintainers. All complaints will be reviewed and investigated.

---

## How Can I Contribute?

### Reporting Bugs

**Before submitting a bug report**:
1. Check the [troubleshooting guide](TROUBLESHOOTING.md)
2. Search existing [GitHub issues](https://github.com/yourusername/beeper-kanban/issues)
3. Verify you're on the latest version

**How to submit a good bug report**:

Use the bug report template and include:

- **Clear title**: Descriptive summary of the issue
- **Description**: Detailed explanation of the problem
- **Steps to reproduce**: Step-by-step instructions
- **Expected behavior**: What you expected to happen
- **Actual behavior**: What actually happened
- **Screenshots**: If applicable
- **Environment**:
  - Browser & version
  - OS & version
  - Node.js version
  - App version
- **Console logs**: Any error messages
- **Additional context**: Anything else relevant

**Example**:

```markdown
**Bug**: Drafts not generating for group chats

**Environment**:
- Browser: Chrome 120.0.6099.109
- OS: macOS 14.1
- Node: 20.10.0

**Steps to Reproduce**:
1. Open app
2. Select WhatsApp group chat
3. Click "Generate Draft"
4. Wait

**Expected**: Draft is generated
**Actual**: Spinner never stops, no draft appears

**Console Error**:
```
Error: Cannot read property 'isGroup' of undefined
  at generateDraft (api/ai/draft:45)
```

**Screenshots**: [attached]
```

### Suggesting Features

**Before suggesting a feature**:
1. Check the [roadmap](../README.md#roadmap)
2. Search existing feature requests
3. Consider if it fits the project scope

**How to suggest a feature**:

Use the feature request template and include:

- **Title**: Clear feature name
- **Problem**: What problem does this solve?
- **Proposed solution**: How should it work?
- **Alternatives considered**: Other approaches you've thought about
- **Use cases**: Real-world scenarios
- **Mockups**: If applicable

**Example**:

```markdown
**Feature**: Message search

**Problem**:
With hundreds of messages, finding specific conversations is difficult.

**Proposed Solution**:
Add search bar above kanban board that filters messages by:
- Contact name
- Message content
- Platform
- Date range

**Mockups**: [attached]

**Use Cases**:
- Customer support: Find conversation with specific customer
- Sales: Search for mentions of "pricing" across all chats
- Personal: Find that message from last week about meeting time
```

### Contributing Code

We welcome code contributions! Areas where help is especially appreciated:

- **Bug fixes**: Addressing existing issues
- **Features**: Implementing roadmap items
- **Tests**: Adding test coverage
- **Documentation**: Improving guides and examples
- **Performance**: Optimization improvements
- **Accessibility**: Making the app more accessible

### Contributing Documentation

Documentation improvements are always welcome:

- Fix typos or unclear explanations
- Add examples and use cases
- Improve code comments
- Translate documentation
- Create video tutorials

### Answering Questions

Help others by:

- Answering questions in GitHub Discussions
- Helping in Discord (if available)
- Providing troubleshooting assistance
- Sharing your usage patterns and tips

---

## Development Setup

### Prerequisites

- Node.js 20+ (LTS recommended)
- npm 9+
- Git
- Beeper account (for testing)
- Code editor (VS Code recommended)

### Fork and Clone

1. **Fork the repository** on GitHub

2. **Clone your fork**:
```bash
git clone https://github.com/YOUR_USERNAME/beeper-kanban.git
cd beeper-kanban
```

3. **Add upstream remote**:
```bash
git remote add upstream https://github.com/ORIGINAL_OWNER/beeper-kanban.git
```

4. **Install dependencies**:
```bash
npm install
```

5. **Start development server**:
```bash
npm run dev
```

6. **Open in browser**: http://localhost:3000

### Keeping Your Fork Updated

```bash
# Fetch latest changes from upstream
git fetch upstream

# Merge into your local main
git checkout main
git merge upstream/main

# Push to your fork
git push origin main
```

---

## Coding Guidelines

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
// Good
interface User {
  id: string
  name: string
}

// Use type for unions/intersections
type Status = 'active' | 'inactive'
```

**Avoid `any`**:
```typescript
// Bad
const data: any = fetchData()

// Good
const data: BeeperMessage = fetchData()

// If truly unknown
const data: unknown = fetchData()
```

### React

**Use functional components**:
```typescript
// Good
export function MyComponent({ data }: Props) {
  return <div>{data}</div>
}

// Avoid class components (unless needed)
```

**Extract complex logic into hooks**:
```typescript
// Good
export function useMessages() {
  const [messages, setMessages] = useState<BeeperMessage[]>([])
  // ... logic
  return { messages, refetch }
}
```

**Memoize expensive computations**:
```typescript
const processed = useMemo(() => {
  return messages.map(m => processMessage(m))
}, [messages])
```

**Use callbacks for event handlers**:
```typescript
const handleClick = useCallback(() => {
  doSomething()
}, [dependency])
```

### Naming Conventions

- **Files**: kebab-case (`my-component.tsx`)
- **Components**: PascalCase (`MyComponent`)
- **Hooks**: camelCase with `use` prefix (`useMessages`)
- **Variables**: camelCase (`myVariable`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Types/Interfaces**: PascalCase (`BeeperMessage`)
- **Private functions**: prefix with underscore (`_internalHelper`)

### Code Style

**Use Prettier** (configuration in `.prettierrc`):
```bash
npm run format  # Format all files
```

**Use ESLint**:
```bash
npm run lint    # Check for issues
npm run lint:fix  # Auto-fix issues
```

**Import order**:
```typescript
// 1. External packages
import { useState } from 'react'
import { Button } from '@radix-ui/react-button'

// 2. Internal absolute imports
import { useMessages } from '@/hooks/use-messages'
import { BeeperMessage } from '@/lib/types'

// 3. Relative imports
import { Helper } from './helper'

// 4. Types
import type { Props } from './types'
```

### Comments

**Use JSDoc for functions**:
```typescript
/**
 * Fetches messages from Beeper API
 * @param accountIds - List of account IDs to fetch from
 * @param limit - Maximum number of messages to return
 * @returns Promise with messages and metadata
 */
export async function fetchMessages(
  accountIds: string[],
  limit: number
): Promise<MessagesResponse> {
  // Implementation
}
```

**Explain "why", not "what"**:
```typescript
// Bad
// Loop through messages
messages.forEach(m => process(m))

// Good
// Process messages in order to maintain conversation context
messages.forEach(m => process(m))
```

**Comment complex logic**:
```typescript
// Calculate human-like delay based on conversation context
// Active conversations get faster replies (30-60s)
// Idle conversations get slower replies (2-5m)
const delay = isActive
  ? randomBetween(30, 60)
  : randomBetween(120, 300)
```

---

## Commit Guidelines

### Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

**Examples**:

```bash
feat(autopilot): add conversation fatigue behavior

Implement gradual response rate reduction as conversation
length increases. Reduces engagement by 5% per message
after 15 messages to simulate natural fatigue.

Closes #123

---

fix(api): handle null avatarUrl in message cards

Avatar proxy was crashing when avatarUrl was null.
Added null check and fallback to default avatar.

Fixes #456

---

docs(readme): update installation instructions

Added troubleshooting section for Node.js version issues.

---

refactor(hooks): extract message processing logic

Moved message processing from component to custom hook
for better reusability and testing.
```

### Commit Best Practices

**Keep commits atomic**:
- One logical change per commit
- Commit should be revertible independently

**Write clear messages**:
- Subject line: 50 characters or less
- Body: Wrap at 72 characters
- Explain what and why, not how

**Reference issues**:
- Use `Fixes #123` to close issues
- Use `Refs #123` to reference without closing

---

## Pull Request Process

### Before Submitting

1. **Update your branch**:
```bash
git fetch upstream
git rebase upstream/main
```

2. **Run tests** (when available):
```bash
npm test
```

3. **Check linting**:
```bash
npm run lint
```

4. **Check types**:
```bash
npx tsc --noEmit
```

5. **Test manually**:
- Test your changes thoroughly
- Test on different browsers (Chrome, Firefox, Safari)
- Test edge cases

6. **Update documentation**:
- Update relevant docs
- Add JSDoc comments
- Update changelog if significant

### Creating Pull Request

1. **Push to your fork**:
```bash
git push origin feature/my-feature
```

2. **Create PR on GitHub**

3. **Fill out PR template**:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Related Issues
Fixes #123

## Changes Made
- Added X feature
- Fixed Y bug
- Updated Z documentation

## Testing
- [ ] Tested locally
- [ ] Tested on Chrome
- [ ] Tested on Firefox
- [ ] Tested on Safari
- [ ] Added/updated tests (if applicable)

## Screenshots
(If applicable)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests pass (if applicable)

## Additional Notes
Any additional context
```

### Review Process

1. **Automated checks** run (linting, tests)
2. **Maintainer review** (may request changes)
3. **Address feedback**:
```bash
# Make changes
git add .
git commit -m "Address review feedback"
git push origin feature/my-feature
```
4. **Approval** from maintainer(s)
5. **Merge** (maintainer will merge)

### After Merge

1. **Delete branch**:
```bash
git branch -d feature/my-feature
git push origin --delete feature/my-feature
```

2. **Update local main**:
```bash
git checkout main
git pull upstream main
```

---

## Project Structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed structure.

**Key directories**:

- `app/` - Next.js pages and API routes
- `components/` - React components
- `hooks/` - Custom React hooks
- `lib/` - Utilities and types
- `contexts/` - React contexts
- `docs/` - Documentation
- `public/` - Static assets

**When adding new features**:

- **New API route**: `app/api/`
- **New component**: `components/`
- **New hook**: `hooks/`
- **New type**: `lib/types.ts`
- **New utility**: `lib/`

---

## Testing

### Running Tests

(When test suite is implemented)

```bash
# Run all tests
npm test

# Run specific test file
npm test -- hooks/use-messages.test.ts

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Writing Tests

**Component test example**:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageCard } from '@/components/kanban/message-card'

describe('MessageCard', () => {
  test('displays message content', () => {
    const message = {
      id: '1',
      text: 'Hello world',
      senderName: 'John'
    }

    render(<MessageCard message={message} />)

    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.getByText('John')).toBeInTheDocument()
  })

  test('calls onClick when clicked', () => {
    const handleClick = jest.fn()
    render(<MessageCard message={message} onClick={handleClick} />)

    fireEvent.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

**Hook test example**:
```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { useMessages } from '@/hooks/use-messages'

describe('useMessages', () => {
  test('fetches messages on mount', async () => {
    const { result } = renderHook(() => useMessages(['account1']))

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.messages).toHaveLength(5)
    })
  })
})
```

---

## Documentation

### Updating Docs

**When to update documentation**:
- Adding new features
- Changing existing behavior
- Fixing bugs that users might encounter
- Adding configuration options

**Which docs to update**:
- `README.md` - If feature is user-facing
- `docs/API.md` - If adding/changing API routes
- `docs/CONFIGURATION.md` - If adding settings
- `docs/USER_GUIDE.md` - If changing user workflow
- `docs/DEVELOPMENT.md` - If changing dev setup
- `docs/AUTOPILOT.md` - If changing autopilot system
- Code comments - Always update JSDoc comments

### Documentation Style

- **Be concise**: Get to the point quickly
- **Use examples**: Show, don't just tell
- **Update screenshots**: When UI changes
- **Link between docs**: Cross-reference related docs
- **Keep organized**: Use clear headings and structure

---

## Recognition

Contributors will be recognized in:

- `README.md` contributors section
- GitHub contributors page
- Release notes (for significant contributions)

Thank you for contributing to Beeper Kanban! Your efforts help make this project better for everyone.

---

## Questions?

- **General questions**: GitHub Discussions
- **Bug reports**: GitHub Issues
- **Feature requests**: GitHub Issues
- **Security issues**: Email maintainers privately
- **Other**: Contact maintainers via GitHub

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT License).
