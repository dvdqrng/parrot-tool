# Configuration Guide

This guide covers all configuration options available in Parrot.

## Table of Contents

- [Getting Started](#getting-started)
- [Beeper Integration](#beeper-integration)
- [AI Provider Setup](#ai-provider-setup)
- [Writing Style & Tone](#writing-style--tone)
- [Autopilot Configuration](#autopilot-configuration)
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
4. (Optional) Configure AI integration
5. (Optional) Customize tone and writing style

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
7. Paste into Parrot Settings → Platforms

#### Method 2: From Network Requests

1. Open Beeper Desktop
2. Open Developer Tools → Network tab
3. Send a message or refresh
4. Look for requests to Beeper API
5. Check request headers for `Authorization: Bearer YOUR_TOKEN`
6. Copy the token after "Bearer "

### Selecting Accounts

Once your token is configured:

1. Go to Settings → Platforms
2. You'll see all connected accounts (WhatsApp, Telegram, etc.)
3. Check the platforms you want to display
4. Click "Save Settings"

The kanban board will now show messages from selected accounts.

### Token Security

- Tokens are stored in browser LocalStorage
- Never share your token publicly
- Tokens can be revoked from Beeper settings
- Consider using a dedicated Beeper account for testing

---

## AI Provider Setup

Parrot supports three AI providers:

### Anthropic (Claude)

**Recommended for**: Best quality responses, official support

**Setup**:
1. Get an API key from [Anthropic Console](https://console.anthropic.com)
2. Go to Settings → API Keys
3. Select "Anthropic" as provider
4. Enter your API key
5. Click "Save Settings"

**Models Used**:
- Draft generation: Claude 3 Sonnet
- Chat assistant: Claude 3 Sonnet
- Summaries: Claude 3 Haiku

**Pricing**:
- Pay-per-use
- See [Anthropic Pricing](https://anthropic.com/pricing)

### OpenAI (ChatGPT)

**Recommended for**: Familiar interface, good performance

**Setup**:
1. Get an API key from [OpenAI Platform](https://platform.openai.com)
2. Go to Settings → API Keys
3. Select "OpenAI" as provider
4. Enter your API key
5. (Optional) Specify model (default: gpt-4)
6. Click "Save Settings"

**Models**:
- Default: `gpt-4`
- Alternative: `gpt-3.5-turbo` (faster, cheaper)

**Pricing**:
- Pay-per-use
- See [OpenAI Pricing](https://openai.com/pricing)

### Ollama (Local)

**Recommended for**: Privacy, cost savings, offline use

**Setup**:
1. Install [Ollama](https://ollama.ai)
2. Pull a model: `ollama pull llama2`
3. Start Ollama service: `ollama serve`
4. Go to Settings → API Keys
5. Select "Ollama" as provider
6. Configure:
   - Base URL: `http://localhost:11434` (default)
   - Model: `llama2` or any installed model
7. Click "Save Settings"

**Recommended Models**:
- **llama2**: Good balance of speed/quality
- **mistral**: Faster, smaller
- **llama3**: Latest, best quality
- **codellama**: For technical content

**System Requirements**:
- Minimum 8GB RAM
- 16GB+ recommended
- SSD for better performance

---

## Writing Style & Tone

Customize how AI generates responses to match your personal style.

### Tone Settings

Go to Settings → Tone to adjust:

#### Brief ↔ Detailed (0-100)

Controls response length:
- **0 (Brief)**: Short, concise responses
- **50 (Balanced)**: Moderate length
- **100 (Detailed)**: Long, thorough responses

**Examples**:

Brief (0):
```
Sure, works for me!
```

Balanced (50):
```
That works for me! I'll see you then.
```

Detailed (100):
```
That works perfectly for me! I'll make sure to clear my schedule and be there on time. Looking forward to it!
```

#### Formal ↔ Casual (0-100)

Controls formality level:
- **0 (Formal)**: Professional, polished
- **50 (Balanced)**: Conversational but respectful
- **100 (Casual)**: Relaxed, informal

**Examples**:

Formal (0):
```
I would be happy to attend the meeting tomorrow.
```

Balanced (50):
```
I'm available for the meeting tomorrow!
```

Casual (100):
```
yeah totally free tomorrow! see u there
```

### Writing Style Analysis

For even more personalized responses, add sample messages.

**Steps**:
1. Go to Settings → Tone
2. Scroll to "Writing Style Patterns"
3. Click "Add Sample Message"
4. Paste messages you've actually written
5. Add 5-10 samples for best results
6. Click "Analyze Style"

**What Gets Analyzed**:
- Common phrases you use
- Emoji preferences
- Greeting patterns ("Hey!", "Hi there", etc.)
- Sign-offs ("Thanks", "Cheers", etc.)
- Punctuation style (exclamation marks, ellipsis, etc.)
- Capitalization (proper case, lowercase, mixed)
- Abbreviations ("lol", "brb", etc.)
- Language quirks

**Example Analysis**:
```json
{
  "commonPhrases": ["sounds good", "let me know", "no worries"],
  "frequentEmojis": ["😊", "👍", "😅"],
  "greetingPatterns": ["hey!", "hi there"],
  "signOffPatterns": ["thanks!", "cheers"],
  "punctuationStyle": {
    "usesMultipleExclamation": true,
    "usesEllipsis": false,
    "usesAllCaps": false
  },
  "capitalizationStyle": "lowercase",
  "abbreviations": ["u", "lol", "btw"]
}
```

The AI will then match your style in future drafts!

### Tips for Better Results

1. **Use Real Messages**: Copy from actual conversations
2. **Variety**: Include different contexts (casual, formal, questions, statements)
3. **Recent**: Use recent messages (your style may change over time)
4. **Authentic**: Don't clean up your messages - AI learns from natural writing
5. **Update Regularly**: Re-analyze as your style evolves

---

## Autopilot Configuration

Create autonomous agents that handle conversations for you.

### Creating an Agent

1. Go to Settings → Autopilot → Agents
2. Click "New Agent"
3. Fill out the form:

#### Basic Information

**Name**: Descriptive name (e.g., "Meeting Scheduler", "Customer Support")

**Description**: Brief explanation of what the agent does

**Goal**: Specific objective (e.g., "Schedule a meeting time", "Answer product questions")

**System Prompt**: Personality and instructions
```
Example:
You are a professional assistant helping to schedule meetings.
Be polite, efficient, and confirm all details before finalizing.
Ask clarifying questions if needed.
```

#### Behavior Settings

**Reply Delays**:
- Min: Minimum seconds before responding (default: 60)
- Max: Maximum seconds before responding (default: 300)
- Context-Aware: Respond faster in active conversations

**Activity Hours**:
- Enable: Only respond during certain hours
- Start/End: Time range (e.g., 9 AM - 10 PM)
- Timezone: Your local timezone

**Typing Indicators**:
- Enable: Simulate typing before sending
- Speed: Words per minute (default: 40)

**Read Receipts**:
- Enable: Mark messages as read
- Delay: Seconds before marking as read

**Multi-Message Responses**:
- Enable: Split long responses into multiple messages
- Delay: Seconds between messages

**Response Rate** (0-100):
- 100: Always respond
- 85: Occasionally "busy" (realistic)
- 50: Respond half the time

**Emoji-Only Responses**:
- Enable: Sometimes respond with just emoji
- Chance: Percentage of the time (e.g., 10%)

**Conversation Fatigue**:
- Enable: Reduce engagement in long conversations
- Trigger: Number of messages before fatigue kicks in
- Reduction: Percentage to reduce response rate per message

**Natural Closing**:
- Enable: Suggest ending conversation after idle period
- Idle Minutes: Time before suggesting close

#### Goal Completion Behavior

Choose what happens when the agent achieves its goal:

**Auto-Disable**: Stop responding automatically

**Maintenance**: Continue monitoring but reduce activity

**Handoff**: Generate summary and notify user

### Enabling Autopilot for a Chat

1. Click any message to open the message panel
2. Click the autopilot icon (sparkles)
3. Select an agent
4. Choose mode:

#### Manual Approval Mode

- Agent generates drafts
- You review before sending
- Full control
- Best for: Important conversations

#### Self-Driving Mode

- Agent sends messages automatically
- Set time limit (10/30/60 minutes or custom)
- Minimal oversight
- Best for: Routine conversations

5. Click "Enable Autopilot"

### Monitoring Autopilot

**Real-Time Status**:
- Autopilot column shows active chats
- Status badge indicates current state
- Activity indicators show recent actions

**Activity Log**:
- Go to Settings → Autopilot → Activity
- View all actions taken by agents
- Filter by chat, agent, or action type

**Handoff Notifications**:
- Appear in bottom-left when goal completed
- Shows summary and key points
- Suggested next steps
- Click to view details or dismiss

### Pausing/Stopping Autopilot

**Pause**:
1. Open message panel for autopilot chat
2. Click autopilot icon
3. Click "Pause"

Agent will stop until resumed.

**Stop**:
1. Open message panel
2. Click autopilot icon
3. Click "Disable Autopilot"

Configuration is saved and can be re-enabled later.

### Best Practices

1. **Start with Manual Approval**: Test agents before going self-driving
2. **Clear Goals**: Specific goals work better than vague ones
3. **Realistic Delays**: Don't respond too quickly (humans take time)
4. **Activity Hours**: Match your real schedule
5. **Monitor Regularly**: Check activity log for issues
6. **Update Prompts**: Refine based on actual performance

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
   - Autopilot configurations
   - Writing style patterns
   - AI chat history

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

**Clear AI Chat History**:
- Settings → Data → Clear AI Chat History
- Removes all per-thread AI conversations
- Cannot be undone

**Reset All Settings**:
- Settings → Data → Reset All Settings
- Removes everything from LocalStorage
- Like a fresh install

### Backup Recommendations

1. Export data regularly
2. Store exports in safe location
3. Test imports to verify backups
4. Consider version control for configs

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
   - `parrot-autopilot-*`

### Performance Tuning

**Message Polling Interval**:

Current: 10 seconds (hardcoded in `app/page.tsx:72`)

To change:
```typescript
// In app/page.tsx
setInterval(() => {
  refetch();
}, 10000); // Change to desired milliseconds
```

**Auto-Load More**:

Messages are paginated. Click "Load More" to fetch additional messages.

### Multi-Account Setup

You can use multiple Beeper accounts:
1. Log in to different Beeper account in desktop app
2. Get the new access token
3. Switch between tokens in Parrot

Or run multiple browser profiles with different configs.

### Dark Mode

Toggle dark mode with the sun/moon icon in bottom toolbar.

Theme preference is saved automatically.

### Keyboard Shortcuts

Currently no keyboard shortcuts implemented.

See Roadmap for future plans.

---

## Troubleshooting Configuration

### "No accounts found"

**Cause**: Invalid or expired Beeper token

**Solutions**:
1. Get fresh token from Beeper Desktop
2. Verify token is copied completely
3. Check Beeper Desktop is logged in
4. Try logging out and back in to Beeper

### AI draft generation fails

**Cause**: Invalid API key or provider issue

**Solutions**:
1. Verify API key is correct
2. Check API key has credits/active subscription
3. Try different provider
4. Check browser console for specific error

### Ollama not connecting

**Cause**: Ollama service not running or wrong URL

**Solutions**:
1. Run `ollama serve` in terminal
2. Verify URL: `http://localhost:11434`
3. Check firewall isn't blocking
4. Try pulling model again: `ollama pull llama2`

### Messages not updating

**Cause**: Beeper connection issue

**Solutions**:
1. Check Beeper Desktop is running
2. Verify internet connection
3. Click refresh button manually
4. Check browser console for errors

### Autopilot not sending

**Cause**: Configuration or timing issue

**Solutions**:
1. Check autopilot is in "Self-Driving" mode
2. Verify activity hours are current
3. Check scheduled actions in activity log
4. Ensure Beeper token is valid

---

## Configuration Files

All configuration is stored in browser LocalStorage as JSON:

### Settings Structure

```typescript
{
  selectedAccountIds: string[]
  beeperAccessToken?: string
  anthropicApiKey?: string
  openaiApiKey?: string
  aiProvider?: 'anthropic' | 'openai' | 'ollama'
  ollamaModel?: string
  ollamaBaseUrl?: string
  showArchivedColumn?: boolean
}
```

### Storage Keys

- `parrot-settings` - App settings
- `parrot-drafts` - Saved drafts
- `parrot-hidden-chats` - Hidden chat list
- `parrot-tone` - Tone settings
- `parrot-writing-style` - Writing patterns
- `parrot-autopilot-agents` - Agent definitions
- `parrot-autopilot-config-*` - Per-chat configs
- `parrot-autopilot-actions` - Scheduled actions
- `parrot-autopilot-activity` - Activity log
- `parrot-ai-chat-*` - AI chat history

---

## Support

For configuration help:
1. Check this guide
2. Review browser console for errors
3. Check API provider documentation
4. Open issue on GitHub with details

Include in bug reports:
- Browser version
- Error messages
- Steps to reproduce
- Screenshot if relevant
