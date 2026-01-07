# User Guide

Complete guide to using Parrot effectively.

## Table of Contents

- [Getting Started](#getting-started)
- [Basic Workflow](#basic-workflow)
- [Managing Messages](#managing-messages)
- [Working with Drafts](#working-with-drafts)
- [Using AI Features](#using-ai-features)
- [Organizing Your Board](#organizing-your-board)
- [Keyboard & Mouse Tips](#keyboard--mouse-tips)
- [Tips & Tricks](#tips--tricks)
- [Common Workflows](#common-workflows)

---

## Getting Started

### First Time Setup

1. **Launch the App**
   - Web: Open in browser at `http://localhost:3000`
   - Desktop: Launch Electron app

2. **Configure Beeper**
   - Click "Configure Platforms"
   - Add your Beeper access token (see [CONFIGURATION.md](CONFIGURATION.md))
   - Select which platforms to show (WhatsApp, Telegram, etc.)
   - Click "Save Settings"

3. **Set Up AI (Optional)**
   - Go to Settings → API Keys
   - Choose provider (Anthropic, OpenAI, or Ollama)
   - Add your API key
   - Save settings

4. **Start Using**
   - Messages will appear in the Unread column
   - Click refresh to load messages
   - Begin managing conversations!

### Understanding the Interface

```
┌─────────────────────────────────────────────────────────────┐
│                    Kanban Board                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Unread  │  │Autopilot │  │  Drafts  │  │   Sent   │   │
│  │          │  │          │  │          │  │          │   │
│  │  [Card]  │  │  [Card]  │  │  [Card]  │  │  [Card]  │   │
│  │  [Card]  │  │          │  │  [Card]  │  │  [Card]  │   │
│  │  [Card]  │  │          │  │          │  │          │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘

Bottom Bar: [+] [↻] [Archive] [☀/☾] [⚙]
           New Refresh Archive  Theme Settings
           Chat              Toggle
```

### Kanban Columns

**Unread**: New messages that need your attention

**Autopilot**: Conversations being handled by autonomous agents

**Drafts**: Prepared responses awaiting your review/sending

**Sent**: Recently sent messages

**Archived** (optional): Archived conversations

---

## Basic Workflow

### The Standard Flow

1. **Message Arrives** → Appears in Unread column
2. **Generate Draft** → Drag to Drafts or use "Generate All"
3. **Review & Edit** → Click draft to review/modify
4. **Send** → Click send button
5. **Complete** → Moves to Sent column

### Quick Response Flow

1. **Message Arrives** → Unread column
2. **Click Message** → Opens side panel
3. **Type Reply** → Use text area at bottom
4. **Send** → Click send button

### Batch Processing Flow

1. **Multiple Messages** → All in Unread column
2. **Generate All Drafts** → Click "Generate All Drafts" button
3. **Review Each** → Click through drafts to review
4. **Send All** → Click "Send All Drafts" button

---

## Managing Messages

### Viewing Message Details

**Click any card** to open the message panel on the right side.

**Panel shows**:
- Full conversation history
- Contact/chat name
- Platform indicator
- Message timestamps
- Attachments (if any)

### Message Cards

Each card displays:
- **Avatar**: Contact or group photo
- **Name**: Contact or chat name
- **Preview**: Message snippet
- **Timestamp**: When message was received
- **Platform Icon**: WhatsApp, Telegram, etc.
- **Unread Badge**: Number of unread messages in chat (if grouped)

### Actions on Messages

**Right-click** or **three-dot menu** for actions:
- Generate Draft
- Archive Chat
- Hide Chat
- Mark as Read (future)
- Pin (future)

### Filtering Messages

Currently messages are filtered by:
- Selected platforms (in settings)
- Hidden chats (removed from view)
- Archive status

**Future**: Search and advanced filtering coming soon.

### Loading More Messages

- Scroll to bottom of Unread column
- Click "Load More" button
- Loads next batch of messages

### Refreshing Messages

Click the **refresh icon** (↻) in bottom bar to fetch latest messages.

**Auto-refresh**: Messages automatically refresh every 10 seconds in the background.

---

## Working with Drafts

### Creating Drafts

**Method 1: Drag & Drop**
- Drag message card from Unread
- Drop in Drafts column
- AI generates draft automatically

**Method 2: Batch Generation**
- Click "Generate All Drafts" in Unread column header
- AI generates drafts for all unread messages
- Progress bar shows generation status

**Method 3: Manual Draft**
- Click message to open panel
- Type response in text area
- Click "Save as Draft"

### Reviewing Drafts

1. Click draft card
2. Message panel opens
3. Review AI-generated text
4. Edit if needed
5. Click "Send" when ready

### Editing Drafts

In the message panel:
- Click in text area
- Edit the draft text
- Changes save automatically
- Click "Send" when satisfied

### Sending Drafts

**Single Draft**:
- Click draft card
- Review in panel
- Click "Send" button

**All Drafts**:
- Click "Send All Drafts" in Drafts column header
- Confirms before sending
- Sends all prepared drafts

### Deleting Drafts

**From Card**:
- Right-click draft card
- Select "Delete Draft"

**From Panel**:
- Open draft
- Click delete icon
- Confirm deletion

---

## Using AI Features

### AI Draft Generation

**How it works**:
1. AI reads the incoming message
2. Considers your tone settings
3. Matches your writing style
4. Generates appropriate response
5. Creates draft for your review

**Customizing Output**:
- Settings → Tone → Adjust sliders
- Brief ↔ Detailed: Response length
- Formal ↔ Casual: Tone style
- Add sample messages for style matching

### AI Chat Assistant

**Opening AI Chat**:
1. Click any message card
2. Message panel opens
3. Click chat icon (💬) in top-right
4. AI chat panel slides out

**Using AI Chat**:
- Ask questions about how to respond
- Request rewrites in different tones
- Brainstorm ideas
- Get advice on conversation

**Example Prompts**:
```
"How should I politely decline this?"
"Make this sound more professional"
"What are some good follow-up questions?"
"Rewrite this to be more casual"
```

**Using Generated Text**:
- AI provides response
- Click "Use Draft" button
- Text inserted into message input
- Edit as needed
- Send when ready

**Chat History**:
- Saved per conversation thread
- Persists between sessions
- Clear in Settings → Data

### Writing Style Training

**Setting Up Your Style**:

1. Go to Settings → Tone
2. Scroll to "Writing Style Patterns"
3. Click "Add Sample Message"
4. Paste 5-10 real messages you've written
5. Click "Analyze Style"

**What Gets Learned**:
- Your common phrases
- Emoji preferences
- How you greet/sign off
- Punctuation patterns
- Capitalization style
- Abbreviations you use

**Result**: Future drafts will sound more like you!

### AI Providers

**Anthropic (Claude)**:
- Best quality
- Great for nuanced responses
- Recommended default

**OpenAI (ChatGPT)**:
- Familiar interface
- Good performance
- Wide model selection

**Ollama (Local)**:
- Complete privacy
- No API costs
- Works offline
- Requires local setup

Configure in Settings → API Keys.

---

## Organizing Your Board

### Archive Management

**Archiving a Chat**:
- Right-click message card
- Select "Archive Chat"
- Removes from Unread/Sent
- Accessible in Archived column (if enabled)

**Viewing Archived**:
- Click Archive icon (📦) in bottom bar
- Archived column appears
- Shows all archived chats

**Unarchiving**:
- Right-click archived card
- Select "Unarchive"
- Returns to normal flow

### Hidden Chats

**Hiding a Chat**:
- Right-click message card
- Select "Hide Chat"
- Removes from all columns
- Persists until unhidden

**Managing Hidden Chats**:
- Go to Settings → Hidden Chats
- View all hidden conversations
- Click "Unhide" to restore

**Use Cases**:
- Personal chats that don't need work responses
- Muted group chats
- Low-priority conversations

### Organizing Strategy

**Recommended Flow**:
```
Unread → [Review] → Archive or Draft
Drafts → [Review] → Send
Sent → [Auto-archive after time]
```

**Keep Unread Clean**:
- Generate drafts regularly
- Archive conversations you don't need to respond to
- Hide personal/off-topic chats

**Batch Process**:
- Set aside time for message review
- Generate all drafts at once
- Review and send in batch
- Archive completed conversations

---

## Keyboard & Mouse Tips

### Mouse Actions

**Left Click**: Open message/draft panel

**Right Click**: Open context menu
- Generate Draft
- Archive/Unarchive
- Hide Chat
- Delete Draft

**Drag & Drop**:
- Drag from Unread → Drafts (generates draft)
- Drag between columns (future feature)

### Navigation Tips

**Quick Review**:
- Click message
- Review in panel
- Press ESC to close
- Click next message

**Rapid Drafting**:
- Click "Generate All Drafts"
- Wait for completion
- Click through drafts
- Send approved ones

**Panel Management**:
- Panel stays open while clicking cards
- Click X or click outside to close
- AI chat panel toggles independently

---

## Tips & Tricks

### Efficiency Tips

**1. Use Batch Operations**
```
Instead of: Generate → Review → Send (repeat)
Do: Generate All → Review All → Send All
```

**2. Customize AI Tone Per Context**
```
Before important messages:
- Go to Settings → Tone
- Adjust sliders for that context
- Generate draft
- Reset sliders after
```

**3. Create Draft Templates**
```
- Save common responses as drafts
- Modify for specific recipient
- Send
```

**4. Use AI Chat for Difficult Responses**
```
- Open AI chat
- Describe situation
- Ask for multiple options
- Pick best one
```

### Quality Tips

**1. Always Review AI Drafts**
- AI is good but not perfect
- Check for accuracy
- Verify tone matches context
- Add personal touches

**2. Train Your Writing Style**
- Better training = better drafts
- Update samples periodically
- Include variety of contexts

**3. Use Manual Mode for Important Chats**
- High-stakes conversations
- Complex negotiations
- Sensitive topics
- Personal relationships

### Workflow Tips

**1. Set Regular Check Times**
```
Example schedule:
- 9 AM: Review overnight messages
- 12 PM: Mid-day check
- 4 PM: End-of-day cleanup
- 7 PM: Final check
```

**2. Use Autopilot for Routine**
```
Routine chats → Autopilot
Important chats → Manual review
```

**3. Archive Aggressively**
```
If conversation is done → Archive immediately
Keeps board clean and focused
```

### Time-Saving Tips

**1. Keyboard + Mouse Combo**
```
- Right-click → Generate Draft
- Click next message while draft generates
- Return to review when ready
```

**2. Use Auto-Refresh**
```
- Messages load automatically
- No need to manually refresh
- Stay in flow state
```

**3. Pre-Configure Settings**
```
Set up once:
- Tone preferences
- Writing style
- Platform selection
- Hidden chats

Then forget about settings and just work.
```

---

## Common Workflows

### Morning Message Triage

1. Open app
2. Review Unread column
3. Quick categorize:
   - Archive: No response needed
   - Draft: Need to respond
   - Hide: Off-topic/personal
4. Generate all drafts
5. Review and send throughout day

### High-Volume Response

1. Enable autopilot for routine chats
2. Set to Manual Approval mode
3. Let AI generate drafts
4. Review in batches
5. Send approved drafts
6. Archive completed

### Careful Important Response

1. Click message to open panel
2. Read full conversation history
3. Open AI chat assistant
4. Discuss with AI:
   - "What are key points to address?"
   - "How should I phrase this professionally?"
   - "What questions should I ask?"
5. Draft response manually or use AI suggestion
6. Review carefully
7. Edit as needed
8. Send when perfect

### End-of-Day Cleanup

1. Review Sent column
2. Archive completed conversations
3. Review Drafts column
4. Send or delete stale drafts
5. Check Autopilot activity log
6. Address any issues
7. Plan for tomorrow

### Customer Support Flow

1. Create "Support" autopilot agent
2. Enable for support chats
3. Set to Manual Approval
4. Agent generates initial responses
5. You review and approve
6. Agent handles follow-ups
7. You step in for complex issues

### Sales/Business Development

1. Create specialized agents:
   - "First Contact" (warm, friendly)
   - "Discovery" (question-focused)
   - "Closer" (professional, direct)
2. Switch agents as conversation progresses
3. Use handoff summaries between stages
4. Manual approval for all final decisions

### Personal + Work Mixed

1. Hide personal chats from board
2. Focus on work conversations
3. Unhide personal when off work
4. Or: Use separate browser profiles
5. Keep contexts separated

---

## Troubleshooting

### Messages Not Loading

**Check**:
- Beeper Desktop is running
- Access token is valid
- Platforms are selected in settings
- Internet connection is working

**Solution**:
- Click refresh button
- Check Settings → Platforms
- Verify token in Beeper Desktop
- Check browser console for errors

### Drafts Not Generating

**Check**:
- AI provider is configured
- API key is valid
- Provider has credits/access

**Solution**:
- Settings → API Keys
- Verify provider selection
- Check API key
- Try different provider

### Panel Not Opening

**Check**:
- Browser window size (too small?)
- Click directly on card (not empty space)
- JavaScript errors in console

**Solution**:
- Resize window larger
- Reload page
- Check browser console
- Try different browser

### Sent Messages Not Appearing

**Wait**: Messages may take 10+ seconds to appear (polling interval)

**Check**:
- Message actually sent? (check Beeper Desktop)
- Beeper token valid?
- Network connection?

**Solution**:
- Click refresh
- Check Beeper Desktop
- Verify token

---

## Getting Help

### Resources

- **README.md**: Project overview and quick start
- **CONFIGURATION.md**: Detailed setup instructions
- **API.md**: API documentation for developers
- **AUTOPILOT.md**: Complete autopilot guide
- **ARCHITECTURE.md**: Technical architecture
- **DEVELOPMENT.md**: Contributing guide

### Support Channels

1. Check documentation first
2. Search GitHub issues
3. Open new issue with:
   - Clear description
   - Steps to reproduce
   - Screenshots if helpful
   - Browser/OS info
4. Join Discord (if available)

### Feedback

We love feedback! Please share:
- Feature requests
- Bug reports
- Usability suggestions
- Documentation improvements
- Success stories

Open an issue on GitHub or contribute directly!

---

## Best Practices Summary

### Do's

✅ Review AI-generated drafts before sending
✅ Train your writing style for better results
✅ Use autopilot for routine conversations
✅ Archive completed conversations regularly
✅ Keep your Unread column clean
✅ Batch process when possible
✅ Test autopilot with Manual Approval first
✅ Monitor activity logs
✅ Update API keys if they expire
✅ Back up your data (Settings → Data → Export)

### Don'ts

❌ Send AI drafts blindly without review
❌ Use autopilot for high-stakes conversations without testing
❌ Ignore activity log errors
❌ Let Unread column pile up indefinitely
❌ Share API keys or Beeper tokens
❌ Forget to archive completed chats
❌ Skip writing style training (makes drafts generic)
❌ Use same agent for all conversation types
❌ Enable self-driving mode without testing first
❌ Neglect to check for updates

---

## Next Steps

Now that you know the basics:

1. **Set up your first workflow**: Start simple with manual drafting
2. **Train your writing style**: Add sample messages for personalization
3. **Try autopilot**: Create an agent for routine tasks
4. **Optimize your process**: Find what works for your use case
5. **Share feedback**: Help improve Parrot!

Happy messaging! 🎉
