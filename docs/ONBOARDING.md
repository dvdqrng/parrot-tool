# Beeper Kanban - First Time Setup Guide

Welcome to **Beeper Kanban**, a Kanban-style message management interface for Beeper. This guide will walk you through setting up the app for the first time.

---

## What is Beeper Kanban?

Beeper Kanban transforms how you handle conversations across multiple messaging platforms (WhatsApp, Telegram, Instagram, Discord, etc.) connected through Beeper. Key features include:

- **Kanban Board**: Organize messages across columns (Unread, Drafts, Sent, Archived)
- **CRM Integration**: Track contacts with activity stats and interaction history
- **Multi-Platform**: Works with any messaging service connected to Beeper

---

## Requirements

Before getting started, ensure you have:

| Requirement | Details |
|-------------|---------|
| **Beeper Desktop** | Must be running and logged in ([download](https://www.beeper.com/)) |
| **Node.js 18+** | For running the development server |

---

## Installation Options

### Option 1: Run from Source

1. **Clone the repository**:
```bash
git clone https://github.com/yourusername/beeper-kanban.git
cd beeper-kanban
```

2. **Install dependencies**:
```bash
npm install
```

3. **Start the app**:
```bash
npm run dev
```

4. **Open in browser**:
```
http://localhost:3000
```

---

## Required Setup: Beeper Connection

Beeper Kanban needs your Beeper access token to fetch and send messages.

### Getting Your Beeper Token

1. Open **Beeper Desktop** application
2. Open Developer Tools:
   - **macOS**: `Option + Command + I`
   - **Windows/Linux**: `Ctrl + Shift + I`
3. Go to **Application** tab → **Local Storage**
4. Look for `beeperAccessToken`, `token`, or `authToken`
5. Copy the entire token value

### Configure in Beeper Kanban

1. Open Beeper Kanban
2. Click **Settings** (gear icon) in the bottom toolbar
3. Go to **Platforms** section
4. Paste your Beeper access token
5. Click **Refresh** to load your accounts
6. Select which platforms to display
7. Click **Save Settings**

You should now see messages appearing in the "Unread" column.

---

## Basic Workflow

### Handling Messages

1. See a message in the **Unread** column
2. Click to open the **Message Panel**
3. Read the full conversation history
4. Type your response in the text area
5. Click **Send**

### Organizing Messages

- **Archive**: Right-click → Archive Chat (for completed conversations)
- **Hide**: Right-click → Hide Chat (for chats you don't want to see)
- **Unhide**: Settings → Hidden Chats → Unhide

### Using CRM Features

1. Click on a message to open the panel
2. Click the **profile icon** to view contact details
3. See activity stats (messages received, sent, response time)
4. Add notes and tags to contacts

---

## Settings Overview

| Section | Purpose |
|---------|---------|
| **Platforms** | Beeper token, account selection |
| **Hidden Chats** | Manage hidden conversations |
| **Data** | Export, import, reset |
| **Account** | User account settings |

---

## Troubleshooting

### Messages Not Loading

- Ensure Beeper Desktop is running
- Verify your access token is correct
- Click **Refresh** in Platforms settings
- Check that at least one platform is selected

### Messages Not Sending

- Verify Beeper Desktop is running
- Check your internet connection
- Verify your token is valid (try refreshing it)

---

## Data & Storage

All data is stored locally in your browser:
- Settings and preferences
- Drafts
- CRM contacts and profiles

**Backup**: Settings → Data → **Export All Data**

**Restore**: Settings → Data → **Import Data**

---

## Quick Reference

| Task | How To |
|------|--------|
| Get Beeper token | Beeper DevTools → LocalStorage |
| Select platforms | Settings → Platforms |
| Archive chat | Right-click → Archive |
| Hide chat | Right-click → Hide Chat |
| View CRM | Message Panel → Profile icon |
| Export data | Settings → Data → Export |
| Dark mode | Bottom toolbar → sun/moon icon |

---

## Next Steps

1. **Connect Beeper** - Get your token and configure platforms
2. **Explore the Board** - Click through messages, try archiving
3. **Set Up CRM** - View contact profiles, add notes
4. **Customize** - Hide unwanted chats, adjust settings

---

Happy messaging with Beeper Kanban!
