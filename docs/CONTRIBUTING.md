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

---

## How Can I Contribute?

### Reporting Bugs

**Before submitting a bug report**:
1. Check the [troubleshooting guide](TROUBLESHOOTING.md)
2. Search existing [GitHub issues](https://github.com/yourusername/beeper-kanban/issues)
3. Verify you're on the latest version

**How to submit a good bug report**:

Include:
- **Clear title**: Descriptive summary of the issue
- **Description**: Detailed explanation of the problem
- **Steps to reproduce**: Step-by-step instructions
- **Expected behavior**: What you expected to happen
- **Actual behavior**: What actually happened
- **Screenshots**: If applicable
- **Environment**: Browser, OS, Node.js version
- **Console logs**: Any error messages

### Suggesting Features

**Before suggesting a feature**:
1. Search existing feature requests
2. Consider if it fits the project scope

**How to suggest a feature**:

Include:
- **Title**: Clear feature name
- **Problem**: What problem does this solve?
- **Proposed solution**: How should it work?
- **Use cases**: Real-world scenarios

### Contributing Code

We welcome code contributions! Areas where help is appreciated:

- **Bug fixes**: Addressing existing issues
- **Features**: Implementing new functionality
- **Documentation**: Improving guides and examples
- **Performance**: Optimization improvements

### Contributing Documentation

Documentation improvements are always welcome:

- Fix typos or unclear explanations
- Add examples and use cases
- Improve code comments

---

## Development Setup

### Prerequisites

- Node.js 18+ (LTS recommended)
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
git fetch upstream
git checkout main
git merge upstream/main
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
interface User {
  id: string
  name: string
}

// Use type for unions
type Status = 'active' | 'inactive'
```

**Avoid `any`**:
```typescript
// Bad
const data: any = fetchData()

// Good
const data: BeeperMessage = fetchData()
```

### React

**Use functional components**:
```typescript
export function MyComponent({ data }: Props) {
  return <div>{data}</div>
}
```

**Extract complex logic into hooks**:
```typescript
export function useMessages() {
  const [messages, setMessages] = useState<BeeperMessage[]>([])
  // ... logic
  return { messages, refetch }
}
```

### Naming Conventions

- **Files**: kebab-case (`my-component.tsx`)
- **Components**: PascalCase (`MyComponent`)
- **Hooks**: camelCase with `use` prefix (`useMessages`)
- **Variables**: camelCase (`myVariable`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Types/Interfaces**: PascalCase (`BeeperMessage`)

---

## Commit Guidelines

### Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples**:

```bash
feat(crm): add contact activity tracking
fix(api): handle null avatarUrl in message cards
docs(readme): update installation instructions
refactor(hooks): extract message processing logic
```

---

## Pull Request Process

### Before Submitting

1. **Update your branch**:
```bash
git fetch upstream
git rebase upstream/main
```

2. **Check linting**:
```bash
npm run lint
```

3. **Check types**:
```bash
npx tsc --noEmit
```

4. **Test manually**:
- Test your changes thoroughly
- Test on different browsers
- Test edge cases

5. **Update documentation** if needed

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
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made
- Added X feature
- Fixed Y bug

## Testing
- [ ] Tested locally
- [ ] Tested on Chrome
- [ ] Tested on Firefox

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
```

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

**When adding new features**:

- **New API route**: `app/api/`
- **New component**: `components/`
- **New hook**: `hooks/`
- **New type**: `lib/types.ts`
- **New utility**: `lib/`

---

## Recognition

Contributors will be recognized in:

- `README.md` contributors section
- GitHub contributors page
- Release notes (for significant contributions)

Thank you for contributing to Beeper Kanban!

---

## Questions?

- **General questions**: GitHub Discussions
- **Bug reports**: GitHub Issues
- **Feature requests**: GitHub Issues

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
