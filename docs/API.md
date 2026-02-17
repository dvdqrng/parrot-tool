# API Documentation

This document describes all API endpoints available in the Beeper Kanban application.

## Table of Contents

- [Authentication](#authentication)
- [Unified Data Endpoint](#unified-data-endpoint)
- [Chat Operations](#chat-operations)
- [Utility API Routes](#utility-api-routes)
- [Error Handling](#error-handling)
- [Type Definitions](#type-definitions)

## Authentication

### Headers

All Beeper API routes require authentication via headers:

```typescript
headers: {
  'Content-Type': 'application/json',
  'x-beeper-token': 'your-beeper-access-token'
}
```

## Response Format

All API routes return responses in the following format:

```typescript
// Success
{
  data: T // Response data
}

// or for the unified endpoint
{
  accounts: [],
  messages: [],
  // ...other slices
}

// Error
{
  error: string // Error message
}
```

## Unified Data Endpoint

The primary endpoint for fetching all Beeper data. This replaces the previous separate endpoints for messages, accounts, and archived messages.

### Get Beeper Data

Fetch accounts, messages, archived messages, and other data in a single request.

**Endpoint**: `GET /api/beeper/data`

**Query Parameters**:
- `slices` (string, required): Comma-separated list of data slices to fetch
  - `accounts` - Connected Beeper accounts
  - `chats` - Unread and sent messages
  - `archived` - Archived messages
  - `userInfo` - Current user information
- `accountIds` (string, optional): Comma-separated list of account IDs to filter by
- `hiddenChatIds` (string, optional): Comma-separated list of chat IDs to exclude

**Headers**:
```typescript
{
  'x-beeper-token': string
}
```

**Response**:
```typescript
{
  accounts?: BeeperAccount[]
  messages?: BeeperMessage[]
  archivedMessages?: BeeperMessage[]
  userInfo?: BeeperUserInfo
  chatInfo?: Record<string, { isGroup: boolean; title?: string }>
  avatars?: Record<string, string>
  _meta: {
    fetchedAt: string  // ISO timestamp
  }
}
```

**Example**:
```typescript
const response = await fetch(
  '/api/beeper/data?slices=accounts,chats,archived&accountIds=acc1,acc2',
  {
    headers: { 'x-beeper-token': token }
  }
)
```

---

## Chat Operations

### Get Chat Messages

Fetch messages for a specific chat with pagination.

**Endpoint**: `GET /api/beeper/chats`

**Query Parameters**:
- `chatId` (string, required): Chat identifier
- `limit` (number, optional): Maximum messages to return (default: 20)
- `cursor` (string, optional): Pagination cursor for loading more messages

**Headers**:
```typescript
{
  'x-beeper-token': string
}
```

**Response**:
```typescript
{
  data: BeeperMessage[]
  nextCursor: string | null  // Cursor for next page, null if no more
}
```

**Example**:
```typescript
const response = await fetch(
  '/api/beeper/chats?chatId=chat-123&limit=50',
  {
    headers: { 'x-beeper-token': token }
  }
)
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

### Get Contacts

Fetch contact list for starting new conversations.

**Endpoint**: `GET /api/beeper/contacts`

**Query Parameters**:
- `accountIds` (string, optional): Comma-separated list of account IDs
- `search` (string, optional): Search filter for contact names
- `limit` (number, optional): Maximum contacts to return (default: 600)

**Headers**:
```typescript
{
  'x-beeper-token': string
}
```

**Response**:
```typescript
{
  data: Contact[]
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
  lastMessageAt?: string
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

### Proxy Attachments

Proxy message attachments.

**Endpoint**: `GET /api/attachments`

**Query Parameters**:
- `url` (string, required): Attachment URL to proxy

**Response**: Attachment binary data

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
- Token: "Beeper access token is required"

**404 Not Found**:
- Chat not found
- Resource not found

**500 Internal Server Error**:
- External API error
- Unexpected server error

**503 Service Unavailable**:
- Beeper API down
- Cannot connect to Beeper Desktop

### Error Handling Example

```typescript
try {
  const response = await fetch('/api/beeper/data?slices=chats', {
    headers: { 'x-beeper-token': token }
  })

  const result = await response.json()

  if (result.error) {
    console.error('API Error:', result.error)
    // Handle error
  } else {
    // Process data
    const { messages, accounts } = result
  }
} catch (error) {
  console.error('Network Error:', error)
}
```

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
  isArchived?: boolean
  attachments?: BeeperAttachment[]
}
```

### BeeperAccount

```typescript
interface BeeperAccount {
  id: string
  service: string        // 'whatsapp', 'telegram', etc.
  displayName: string
  avatarUrl?: string
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

### BeeperUserInfo

```typescript
interface BeeperUserInfo {
  userId: string
  displayName?: string
  avatarUrl?: string
}
```

---

## Rate Limiting

### Beeper API

Rate limits are enforced by Beeper:
- Varies by endpoint
- Typically generous for personal use
- Check Beeper documentation for specifics

### Best Practices

1. **Use Unified Endpoint**: Fetch multiple slices in one request
2. **Caching**: The server caches data with TTL (30s for chats, 5min for accounts)
3. **Polling Intervals**: Don't poll too frequently (current: 10 seconds)
4. **Error Handling**: Implement exponential backoff on errors

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
curl -X GET "http://localhost:3000/api/beeper/data?slices=accounts,chats" \
  -H "x-beeper-token: your-token"
```

---

## Security Considerations

### API Keys

- Never expose tokens in client-side code
- Tokens passed via headers
- Stored in LocalStorage (client-side only)

### CORS

- Same-origin by default (Next.js API routes)
- Proxy external resources to avoid CORS issues

### Best Practices

1. Always use HTTPS in production
2. Add request logging for debugging
3. Monitor for suspicious activity

---

## Support

For API-related issues:
1. Check this documentation
2. Review error messages
3. Check browser console for details
4. Open an issue on GitHub

For Beeper API issues, consult [Beeper documentation](https://beeper.com).
