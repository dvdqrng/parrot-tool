# Configuration Guide

This guide covers all configuration options available in Beeper Kanban.

## Table of Contents

- [Getting Started](#getting-started)
- [Beeper Integration](#beeper-integration)
- [Platform Selection](#platform-selection)
- [Hidden Chats](#hidden-chats)
- [Data Management](#data-management)
- [Advanced Settings](#advanced-settings)

---

## Getting Started

### First Launch

On first launch, you'll see a welcome screen prompting you to configure your platforms. Follow these steps:

1. Click "Configure Platforms"
2. Add your Beeper access token
3. Select which messaging accounts to display
4. Start using the app!

---

## Beeper Integration

### Getting Your Access Token

Your Beeper access token is required to fetch and send messages.

#### Method 1: From Beeper Desktop

1. Open Beeper Desktop application
2. Open Developer Tools:
   - **macOS**: `Option + Command + I`
   - **Windows/Linux**: `Ctrl + Shift + I`
   - Or: View → Toggle Developer Tools
3. Click the "Application" or "Storage" tab
4. Navigate to "Local Storage"
5. Look for keys like:
   - `beeperAccessToken`
   - `token`
   - `authToken`
6. Copy the token value
7. Paste into Beeper Kanban Settings → Platforms

#### Method 2: From Network Requests

1. Open Beeper Desktop
2. Open Developer Tools → Network tab
3. Send a message or refresh
4. Look for requests to Beeper API
5. Check request headers for `Authorization: Bearer YOUR_TOKEN`
6. Copy the token after "Bearer "

### Token Security

- Tokens are stored in browser LocalStorage
- Never share your token publicly
- Tokens can be revoked from Beeper settings
- Consider using a dedicated Beeper account for testing

---

## Platform Selection

### Selecting Accounts

Once your token is configured:

1. Go to Settings → Platforms
2. You'll see all connected accounts (WhatsApp, Telegram, etc.)
3. Check the platforms you want to display
4. Click "Save Settings"

The kanban board will now show messages from selected accounts.

### Platform-Specific Notes

**WhatsApp**: Full messaging support
**Telegram**: Full messaging support
**Signal**: Full messaging support
**iMessage**: Full messaging support (requires Beeper bridge)
**Facebook Messenger**: Full messaging support
**Instagram**: Full messaging support
**Discord**: Full messaging support
**Slack**: Full messaging support

---

## Hidden Chats

Keep your board clean by hiding conversations you don't need to see.

### Hiding a Chat

**Method 1: From Kanban Board**
1. Right-click a message card
2. Select "Hide Chat"

**Method 2: From Message Panel**
1. Open a message
2. Click the three-dot menu
3. Select "Hide Chat"

### Managing Hidden Chats

1. Go to Settings → Hidden Chats
2. View all hidden conversations
3. Click "Unhide" to restore a chat

### Use Cases

- Personal conversations that don't need responses
- Muted group chats
- Archived but recurring conversations
- Test/spam chats

Hidden chats are stored locally and persist across sessions.

---

## Data Management

### Exporting Data

1. Go to Settings → Data
2. Click "Export All Data"
3. Downloads JSON file containing:
   - App settings
   - Drafts
   - CRM contacts and profiles
   - Hidden chats

### Importing Data

1. Go to Settings → Data
2. Click "Import Data"
3. Select previously exported JSON file
4. Confirm import

**Warning**: Importing overwrites existing data.

### Clearing Data

**Clear Drafts**:
- Settings → Data → Clear All Drafts
- Removes all saved drafts
- Cannot be undone

**Reset All Settings**:
- Settings → Data → Reset All Settings
- Removes everything from LocalStorage
- Like a fresh install

### Backup Recommendations

1. Export data regularly
2. Store exports in safe location
3. Test imports to verify backups

---

## Advanced Settings

### Browser Storage

Data is stored in browser LocalStorage:
- Limit: ~5-10MB depending on browser
- Location: Browser-specific
- Persistence: Until cleared or expired

**View Storage**:
1. Open browser DevTools (F12)
2. Go to Application → Local Storage
3. Find keys like:
   - `parrot-settings`
   - `parrot-drafts`
   - `parrot-crm-contacts`

### Performance Tuning

**Message Polling Interval**:

Current: 10 seconds

The app automatically fetches new messages every 10 seconds.

### Multi-Account Setup

You can use multiple Beeper accounts:
1. Log in to different Beeper account in desktop app
2. Get the new access token
3. Switch between tokens in Beeper Kanban

Or run multiple browser profiles with different configs.

### Dark Mode

Toggle dark mode with the sun/moon icon in bottom toolbar.

Theme preference is saved automatically.

---

## Troubleshooting Configuration

### "No accounts found"

**Cause**: Invalid or expired Beeper token

**Solutions**:
1. Get fresh token from Beeper Desktop
2. Verify token is copied completely
3. Check Beeper Desktop is logged in
4. Try logging out and back in to Beeper

### Messages not updating

**Cause**: Beeper connection issue

**Solutions**:
1. Check Beeper Desktop is running
2. Verify internet connection
3. Click refresh button manually
4. Check browser console for errors

---

## Configuration Files

All configuration is stored in browser LocalStorage as JSON:

### Settings Structure

```typescript
{
  selectedAccountIds: string[]
  beeperAccessToken?: string
  showArchivedColumn?: boolean
}
```

### Storage Keys

- `parrot-settings` - App settings
- `parrot-drafts` - Saved drafts
- `parrot-hidden-chats` - Hidden chat list
- `parrot-crm-contacts` - CRM contact profiles
- `parrot-crm-chat-mappings` - Chat to contact mappings
- `parrot-messages` - Cached messages
- `parrot-accounts` - Cached accounts
- `parrot-avatars` - Cached avatars
- `parrot-user-info` - Current user info

---

## Support

For configuration help:
1. Check this guide
2. Review browser console for errors
3. Open issue on GitHub with details

Include in bug reports:
- Browser version
- Error messages
- Steps to reproduce
- Screenshot if relevant
