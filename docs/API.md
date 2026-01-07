# API Documentation

This document describes all API endpoints available in the Parrot application.

## Table of Contents

- [Authentication](#authentication)
- [Beeper API Routes](#beeper-api-routes)
- [AI API Routes](#ai-api-routes)
- [Utility API Routes](#utility-api-routes)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

## Authentication

### Headers

All Beeper API routes require authentication via headers:

```typescript
headers: {
  'Content-Type': 'application/json',
  'x-beeper-token': 'your-beeper-access-token'
}
```

AI API routes may require:

```typescript
headers: {
  'Content-Type': 'application/json',
  'x-anthropic-key': 'your-anthropic-api-key' // When using Anthropic
}
```

OpenAI key is passed in request body when using OpenAI provider.

## Response Format

All API routes return responses in the following format:

```typescript
// Success
{
  data: T // Response data
}

// Error
{
  error: string // Error message
}
```

## Beeper API Routes

### Get Unread Messages

Fetch all unread messages from selected accounts.

**Endpoint**: `GET /api/beeper/messages`

**Query Parameters**:
- `accountIds` (string, required): Comma-separated list of account IDs
- `limit` (number, optional): Maximum messages to return (default: 50)
- `before` (string, optional): Fetch messages before this timestamp

**Headers**:
```typescript
{
  'x-beeper-token': string
}
```

**Response**:
```typescript
{
  data: {
    messages: BeeperMessage[]
    avatars: Record<string, string>
    chatInfo: Record<string, { isGroup: boolean }>
    hasMore: boolean
  }
}
```

**Example**:
```typescript
const response = await fetch(
  '/api/beeper/messages?accountIds=acc1,acc2&limit=50',
  {
    headers: { 'x-beeper-token': token }
  }
)
```

---

### Get Sent Messages

Fetch messages sent by the user.

**Endpoint**: `GET /api/beeper/user-messages`

**Query Parameters**:
- `accountIds` (string, required): Comma-separated list of account IDs
- `limit` (number, optional): Maximum messages to return (default: 50)

**Headers**:
```typescript
{
  'x-beeper-token': string
}
```

**Response**:
```typescript
{
  data: {
    messages: BeeperMessage[]
    avatars: Record<string, string>
    chatInfo: Record<string, { isGroup: boolean }>
  }
}
```

---

### Get Archived Messages

Fetch archived conversations.

**Endpoint**: `GET /api/beeper/archived`

**Query Parameters**:
- `accountIds` (string, required): Comma-separated list of account IDs

**Headers**:
```typescript
{
  'x-beeper-token': string
}
```

**Response**:
```typescript
{
  data: {
    messages: BeeperMessage[]
    avatars: Record<string, string>
    chatInfo: Record<string, { isGroup: boolean }>
  }
}
```

---

### Send Message

Send a message to a chat.

**Endpoint**: `POST /api/beeper/send`

**Headers**:
```typescript
{
  'Content-Type': 'application/json',
  'x-beeper-token': string
}
```

**Request Body**:
```typescript
{
  chatId: string    // Chat identifier
  text: string      // Message text
}
```

**Response**:
```typescript
{
  data: {
    success: boolean
    messageId?: string
  }
}
```

**Example**:
```typescript
await fetch('/api/beeper/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-beeper-token': token
  },
  body: JSON.stringify({
    chatId: 'chat-123',
    text: 'Hello!'
  })
})
```

---

### Archive Chat

Archive a conversation.

**Endpoint**: `POST /api/beeper/chats/[chatId]/archive`

**URL Parameters**:
- `chatId` (string): Chat identifier

**Headers**:
```typescript
{
  'Content-Type': 'application/json',
  'x-beeper-token': string
}
```

**Response**:
```typescript
{
  data: {
    success: boolean
  }
}
```

---

### Unarchive Chat

Unarchive a conversation.

**Endpoint**: `POST /api/beeper/chats/[chatId]/unarchive`

**URL Parameters**:
- `chatId` (string): Chat identifier

**Headers**:
```typescript
{
  'Content-Type': 'application/json',
  'x-beeper-token': string
}
```

**Response**:
```typescript
{
  data: {
    success: boolean
  }
}
```

---

### Get Accounts

Fetch all connected Beeper accounts.

**Endpoint**: `GET /api/beeper/accounts`

**Headers**:
```typescript
{
  'x-beeper-token': string
}
```

**Response**:
```typescript
{
  data: {
    accounts: BeeperAccount[]
  }
}
```

**BeeperAccount Type**:
```typescript
interface BeeperAccount {
  id: string
  service: string        // 'whatsapp', 'telegram', etc.
  displayName: string
  avatarUrl?: string
}
```

---

### Get Contacts

Fetch contact list for starting new conversations.

**Endpoint**: `GET /api/beeper/contacts`

**Query Parameters**:
- `accountIds` (string, required): Comma-separated list of account IDs

**Headers**:
```typescript
{
  'x-beeper-token': string
}
```

**Response**:
```typescript
{
  data: {
    contacts: Contact[]
  }
}
```

**Contact Type**:
```typescript
interface Contact {
  chatId: string
  accountId: string
  name: string
  avatarUrl?: string
  platform: string
  isGroup: boolean
}
```

---

### Get Chats

Fetch all chats for selected accounts.

**Endpoint**: `GET /api/beeper/chats`

**Query Parameters**:
- `accountIds` (string, required): Comma-separated list of account IDs

**Headers**:
```typescript
{
  'x-beeper-token': string
}
```

**Response**:
```typescript
{
  data: {
    chats: BeeperChat[]
  }
}
```

---

## AI API Routes

### Generate Draft Reply

Generate an AI-powered draft response to a message.

**Endpoint**: `POST /api/ai/draft`

**Headers**:
```typescript
{
  'Content-Type': 'application/json',
  'x-anthropic-key'?: string  // Required for Anthropic
}
```

**Request Body**:
```typescript
{
  originalMessage: string
  senderName: string
  provider: 'anthropic' | 'openai' | 'ollama'

  // Anthropic (uses header for API key)

  // OpenAI
  openaiApiKey?: string
  openaiModel?: string

  // Ollama
  ollamaModel?: string
  ollamaBaseUrl?: string

  // Optional customization
  toneSettings?: {
    briefDetailed: number      // 0-100
    formalCasual: number       // 0-100
  }

  writingStyle?: WritingStylePatterns
}
```

**Response**:
```typescript
{
  data: {
    suggestedReply: string
  }
}
```

**Example (Anthropic)**:
```typescript
await fetch('/api/ai/draft', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-anthropic-key': anthropicKey
  },
  body: JSON.stringify({
    originalMessage: 'Can we meet tomorrow?',
    senderName: 'John',
    provider: 'anthropic',
    toneSettings: {
      briefDetailed: 30,
      formalCasual: 70
    }
  })
})
```

**Example (OpenAI)**:
```typescript
await fetch('/api/ai/draft', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    originalMessage: 'Can we meet tomorrow?',
    senderName: 'John',
    provider: 'openai',
    openaiApiKey: 'sk-...',
    openaiModel: 'gpt-4'
  })
})
```

**Example (Ollama)**:
```typescript
await fetch('/api/ai/draft', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    originalMessage: 'Can we meet tomorrow?',
    senderName: 'John',
    provider: 'ollama',
    ollamaModel: 'llama2',
    ollamaBaseUrl: 'http://localhost:11434'
  })
})
```

---

### AI Chat Assistant

Have a conversation with AI about crafting responses.

**Endpoint**: `POST /api/ai/chat`

**Headers**:
```typescript
{
  'Content-Type': 'application/json',
  'x-anthropic-key'?: string  // Required for Anthropic
}
```

**Request Body**:
```typescript
{
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  messageContext?: string      // Original message context
  senderName?: string
  provider: 'anthropic' | 'openai' | 'ollama'

  // Provider-specific options (same as draft endpoint)
  openaiApiKey?: string
  openaiModel?: string
  ollamaModel?: string
  ollamaBaseUrl?: string
}
```

**Response**:
```typescript
{
  data: {
    reply: string
  }
}
```

**Example**:
```typescript
await fetch('/api/ai/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-anthropic-key': anthropicKey
  },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'How should I respond to this?' }
    ],
    messageContext: 'Can we meet tomorrow?',
    senderName: 'John',
    provider: 'anthropic'
  })
})
```

---

### Generate Conversation Summary

Generate a summary of a conversation (used for autopilot handoffs).

**Endpoint**: `POST /api/ai/conversation-summary`

**Headers**:
```typescript
{
  'Content-Type': 'application/json',
  'x-anthropic-key'?: string
}
```

**Request Body**:
```typescript
{
  messages: BeeperMessage[]
  agentGoal: string
  provider: 'anthropic' | 'openai' | 'ollama'

  // Provider-specific options
  openaiApiKey?: string
  openaiModel?: string
  ollamaModel?: string
  ollamaBaseUrl?: string
}
```

**Response**:
```typescript
{
  data: {
    summary: string
    keyPoints: string[]
    suggestedNextSteps: string[]
    goalStatus: 'achieved' | 'in-progress' | 'unclear'
  }
}
```

---

## Utility API Routes

### Proxy Avatar

Proxy avatar images to avoid CORS issues.

**Endpoint**: `GET /api/avatar`

**Query Parameters**:
- `url` (string, required): Avatar URL to proxy

**Response**: Image binary data

**Example**:
```typescript
<img src={`/api/avatar?url=${encodeURIComponent(avatarUrl)}`} />
```

---

### Proxy Media

Proxy media attachments.

**Endpoint**: `GET /api/media`

**Query Parameters**:
- `url` (string, required): Media URL to proxy

**Response**: Media binary data

---

### List Ollama Models

Get available Ollama models.

**Endpoint**: `GET /api/ollama/models`

**Query Parameters**:
- `baseUrl` (string, optional): Ollama base URL (default: http://localhost:11434)

**Response**:
```typescript
{
  data: {
    models: Array<{
      name: string
      size: number
      modified_at: string
    }>
  }
}
```

---

## Error Handling

### Error Response Format

```typescript
{
  error: string  // Human-readable error message
}
```

### Common Error Codes

**400 Bad Request**:
- Missing required parameters
- Invalid request format

**401 Unauthorized**:
- Missing or invalid Beeper token
- Missing or invalid AI API key

**404 Not Found**:
- Chat not found
- Resource not found

**500 Internal Server Error**:
- External API error
- Unexpected server error

**503 Service Unavailable**:
- Beeper API down
- AI provider unavailable

### Error Handling Example

```typescript
try {
  const response = await fetch('/api/beeper/messages', {
    headers: { 'x-beeper-token': token }
  })

  const result = await response.json()

  if (result.error) {
    console.error('API Error:', result.error)
    // Handle error
  } else {
    // Process result.data
  }
} catch (error) {
  console.error('Network Error:', error)
}
```

---

## Rate Limiting

### Beeper API

Rate limits are enforced by Beeper:
- Varies by endpoint
- Typically generous for personal use
- Check Beeper documentation for specifics

### AI Providers

**Anthropic**:
- Varies by plan
- Check Anthropic console for limits

**OpenAI**:
- Varies by plan and model
- Check OpenAI dashboard for limits

**Ollama**:
- No rate limits (self-hosted)
- Limited by local hardware

### Best Practices

1. **Batch Operations**: Use batch draft generation instead of individual requests
2. **Caching**: Cache avatar images and media
3. **Polling Intervals**: Don't poll too frequently (current: 10 seconds)
4. **Error Handling**: Implement exponential backoff on errors

---

## Type Definitions

### BeeperMessage

```typescript
interface BeeperMessage {
  id: string
  chatId: string
  accountId: string
  senderId: string
  senderName: string
  senderAvatarUrl?: string
  text: string
  timestamp: string  // ISO 8601
  isFromMe: boolean
  isRead: boolean
  chatName?: string
  platform?: string
  unreadCount?: number
  isGroup?: boolean
  attachments?: BeeperAttachment[]
}
```

### BeeperAttachment

```typescript
interface BeeperAttachment {
  type: 'unknown' | 'img' | 'video' | 'audio'
  duration?: number
  fileName?: string
  fileSize?: number
  isGif?: boolean
  isSticker?: boolean
  isVoiceNote?: boolean
  mimeType?: string
  posterImg?: string
  srcURL?: string
  size?: {
    height?: number
    width?: number
  }
}
```

### WritingStylePatterns

```typescript
interface WritingStylePatterns {
  sampleMessages: string[]
  commonPhrases: string[]
  frequentEmojis: string[]
  greetingPatterns: string[]
  signOffPatterns: string[]
  punctuationStyle: {
    usesMultipleExclamation: boolean
    usesEllipsis: boolean
    usesAllCaps: boolean
    endsWithPunctuation: boolean
  }
  capitalizationStyle: 'proper' | 'lowercase' | 'mixed'
  avgWordsPerMessage: number
  abbreviations: string[]
  languageQuirks: string[]
}
```

---

## Development & Testing

### Local Development

All API routes run on the Next.js development server:

```bash
npm run dev
# API available at http://localhost:3000/api/*
```

### Testing API Routes

Use tools like:
- Postman
- Insomnia
- curl
- Thunder Client (VS Code)

**Example curl**:
```bash
curl -X POST http://localhost:3000/api/ai/draft \
  -H "Content-Type: application/json" \
  -H "x-anthropic-key: your-key" \
  -d '{
    "originalMessage": "Hello",
    "senderName": "John",
    "provider": "anthropic"
  }'
```

### Mock Data

For testing without real Beeper/AI credentials, consider:
- Creating mock API routes in development
- Using mock data in components
- Environment-based conditional logic

---

## API Versioning

Currently: **v1** (implicit)

No versioning system in place. All routes are at `/api/*`.

Future versions may use:
- `/api/v2/*`
- Query parameter: `?version=2`
- Header: `X-API-Version: 2`

---

## Security Considerations

### API Keys

- Never expose API keys in client-side code
- Keys passed via headers or request body
- Stored in LocalStorage (client-side only)

### CORS

- Same-origin by default (Next.js API routes)
- Proxy external resources to avoid CORS issues

### Data Validation

- Validate all inputs on server-side
- Sanitize user-provided content
- Check authentication on every request

### Best Practices

1. Always use HTTPS in production
2. Implement request size limits
3. Add request logging for debugging
4. Monitor for suspicious activity
5. Rotate API keys regularly

---

## Support

For API-related issues:
1. Check this documentation
2. Review error messages
3. Check browser console for details
4. Open an issue on GitHub

For Beeper API issues, consult [Beeper documentation](https://beeper.com).
