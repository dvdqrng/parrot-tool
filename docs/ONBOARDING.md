# Parrot - First Time Setup Guide

Welcome to **Parrot**, a Kanban-style message management interface for Beeper with AI-powered features. This guide will walk you through setting up Parrot for the first time.

---

## What is Parrot?

Parrot transforms how you handle conversations across multiple messaging platforms (WhatsApp, Telegram, Instagram, Discord, etc.) connected through Beeper. Key features include:

- **Kanban Board**: Organize messages across columns (Unread, Drafts, Sent, Archived)
- **AI Draft Generation**: Generate contextual replies using Claude, ChatGPT, or local Ollama models
- **Per-Thread AI Assistant**: Get help crafting responses with a dedicated AI chat panel
- **Writing Style Analysis**: Train AI to match your personal communication style
- **Autopilot Agents**: Create autonomous AI agents to handle conversations

---

## Requirements

Before getting started, ensure you have:

| Requirement | Details |
|-------------|---------|
| **Beeper Desktop** | Must be running and logged in ([download](https://www.beeper.com/)) |

### Optional
- **API Keys** for AI providers (Anthropic, OpenAI)

---

## Download & Install

### Step 1: Download Parrot

Go to the [Parrot Releases page](https://github.com/yourusername/parrot/releases) and download the latest version for your operating system:

- **macOS**: Download the `.dmg` file
- **Windows**: Download the `.exe` installer
- **Linux**: Download the `.AppImage` or `.deb` file

### Step 2: Install

- **macOS**: Open the `.dmg` file and drag Parrot to your Applications folder
- **Windows**: Run the `.exe` installer and follow the prompts
- **Linux**: Run the `.AppImage` directly or install the `.deb` package

### Step 3: Launch Parrot

Open Parrot from your Applications folder (macOS), Start Menu (Windows), or application launcher (Linux).

---

## Required Setup: Beeper Connection

Parrot needs your Beeper access token to fetch and send messages.

### Getting Your Beeper Token

1. Open **Beeper Desktop** application
2. Open Developer Tools:
   - **macOS**: `Option + Command + I`
   - **Windows/Linux**: `Ctrl + Shift + I`
3. Go to **Application** tab → **Local Storage**
4. Look for `beeperAccessToken`, `token`, or `authToken`
5. Copy the entire token value

### Configure in Parrot

1. Open Parrot
2. Click **Settings** (gear icon) in the bottom toolbar
3. Go to **Platforms** section
4. Paste your Beeper access token
5. Click **Refresh** to load your accounts
6. Select which platforms to display
7. Click **Save Settings**

You should now see messages appearing in the "Unread" column.

---

## Optional: AI Configuration

Configure at least one AI provider to use draft generation features.

### Option 1: Anthropic Claude (Recommended)

1. Get an API key from [console.anthropic.com](https://console.anthropic.com/)
2. In Parrot: Settings → **API Keys**
3. Select "Anthropic" as provider
4. Paste your API key
5. Click **Test Key** → **Save Settings**

### Option 2: OpenAI ChatGPT

1. Get an API key from [platform.openai.com](https://platform.openai.com/)
2. In Parrot: Settings → **API Keys**
3. Select "OpenAI" as provider
4. Paste your API key
5. Click **Test Key** → **Save Settings**

---

## Basic Workflow

### Handling Messages

1. See a message in the **Unread** column
2. Click to open the **Message Panel**
3. Either:
   - **Write manually**: Type and click Send
   - **Generate AI draft**: Click "Generate Draft" → review → Send
4. Or drag to **Drafts** to review later

### Batch Operations

- **Generate All Drafts**: Create AI responses for all unread messages
- **Send All Drafts**: Send all prepared drafts at once

### AI Chat Assistant

1. Open any message in the Message Panel
2. Click the **chat bubble icon**
3. Ask for help: "Make this more professional"
4. Click **Use Draft** to apply suggestions

---

## Customizing AI Responses

### Tone Settings

Go to Settings → **Tone**:
- Adjust **Brief ↔ Detailed** slider
- Adjust **Formal ↔ Casual** slider

### Writing Style Training

1. Settings → **Tone** → scroll to "Writing Style Patterns"
2. Click **Add Sample Message**
3. Paste 5-10 messages you've written
4. Click **Analyze Style**

AI will learn your patterns (phrases, emojis, greetings, punctuation).

---

## Autopilot Agents (Advanced)

Create autonomous AI agents to handle conversations:

1. Settings → **Autopilot** → **Agents** → **New Agent**
2. Configure:
   - **Name**: e.g., "Support Assistant"
   - **Goal**: What the agent should accomplish
   - **System Prompt**: Personality and instructions
   - **Behavior**: Reply delays, activity hours
3. Enable on a chat:
   - Open message → click **sparkles icon**
   - Select agent → choose mode:
     - **Manual Approval**: Review before sending
     - **Self-Driving**: Fully autonomous
4. Monitor in Settings → **Autopilot** → **Activity**

---

## Settings Overview

| Section | Purpose |
|---------|---------|
| **Platforms** | Beeper token, account selection |
| **API Keys** | AI provider configuration |
| **Tone** | Response style, writing samples |
| **Autopilot** | Agents, activity log |
| **Hidden Chats** | Manage hidden conversations |
| **Contacts** | Contact details, interaction history |
| **Data** | Export, import, reset |

---

## Troubleshooting

### Messages Not Loading

- Ensure Beeper Desktop is running
- Verify your access token is correct
- Click **Refresh** in Platforms settings

### AI Draft Generation Failing

- Verify API key is correct and has credits
- Test with **Test Key** button
- Try a different AI provider

---

## Data & Storage

All data is stored locally:
- Settings, drafts, tone preferences
- AI chat history, autopilot configs

**Backup**: Settings → Data → **Export All Data**

**Restore**: Settings → Data → **Import Data**

---

## Quick Reference

| Task | How To |
|------|--------|
| Get Beeper token | Beeper DevTools → LocalStorage |
| Configure AI | Settings → API Keys |
| Generate draft | Click message → Generate Draft |
| AI chat help | Message Panel → chat bubble icon |
| Customize tone | Settings → Tone |
| Create agent | Settings → Autopilot → Agents → New |
| Export data | Settings → Data → Export |
| Dark mode | Bottom toolbar → sun/moon icon |

---

## Next Steps

1. **Connect Beeper** - Get your token and configure platforms
2. **Add AI** (optional) - Choose an AI provider for draft generation
3. **Try It** - Generate your first AI draft
4. **Customize** - Set your tone and add writing samples
5. **Explore** - Try Autopilot for routine conversations

---

Happy messaging with Parrot!
