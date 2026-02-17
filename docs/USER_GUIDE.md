# User Guide

Complete guide to using Beeper Kanban effectively.

## Table of Contents

- [Getting Started](#getting-started)
- [Basic Workflow](#basic-workflow)
- [Managing Messages](#managing-messages)
- [Working with Drafts](#working-with-drafts)
- [CRM & Contacts](#crm--contacts)
- [Organizing Your Board](#organizing-your-board)
- [Keyboard & Mouse Tips](#keyboard--mouse-tips)
- [Tips & Tricks](#tips--tricks)
- [Common Workflows](#common-workflows)

---

## Getting Started

### First Time Setup

1. **Launch the App**
   - Web: Open in browser at `http://localhost:3000`

2. **Configure Beeper**
   - Click "Configure Platforms"
   - Add your Beeper access token (see [CONFIGURATION.md](CONFIGURATION.md))
   - Select which platforms to show (WhatsApp, Telegram, etc.)
   - Click "Save Settings"

3. **Start Using**
   - Messages will appear in the Unread column
   - Click refresh to load messages
   - Begin managing conversations!

### Understanding the Interface

```
┌─────────────────────────────────────────────────────────────┐
│                    Kanban Board                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Unread  │  │  Drafts  │  │   Sent   │  │ Archived │   │
│  │          │  │          │  │          │  │          │   │
│  │  [Card]  │  │  [Card]  │  │  [Card]  │  │  [Card]  │   │
│  │  [Card]  │  │  [Card]  │  │  [Card]  │  │  [Card]  │   │
│  │  [Card]  │  │          │  │          │  │          │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘

Bottom Bar: [+] [↻] [Archive] [☀/☾] [⚙]
           New Refresh Archive  Theme Settings
           Chat              Toggle
```

### Kanban Columns

**Unread**: New messages that need your attention

**Drafts**: Prepared responses awaiting your review/sending

**Sent**: Recently sent messages

**Archived** (optional): Archived conversations

---

## Basic Workflow

### The Standard Flow

1. **Message Arrives** → Appears in Unread column
2. **Create Draft** → Write your response
3. **Review & Edit** → Click draft to review/modify
4. **Send** → Click send button
5. **Complete** → Moves to Sent column

### Quick Response Flow

1. **Message Arrives** → Unread column
2. **Click Message** → Opens side panel
3. **Type Reply** → Use text area at bottom
4. **Send** → Click send button

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
- **Unread Badge**: Number of unread messages in chat

### Actions on Messages

**Right-click** or **three-dot menu** for actions:
- Archive Chat
- Hide Chat

### Loading More Messages

When viewing a conversation in the panel:
- Scroll to top of message history
- Click "Load More" button
- Loads older messages

### Refreshing Messages

Click the **refresh icon** (↻) in bottom bar to fetch latest messages.

**Auto-refresh**: Messages automatically refresh every 10 seconds in the background.

---

## Working with Drafts

### Creating Drafts

**From Message Panel**:
- Click message to open panel
- Type response in text area at bottom
- Click "Save as Draft" or just send directly

### Reviewing Drafts

1. Click draft card
2. Message panel opens
3. Review draft text
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

### Deleting Drafts

**From Card**:
- Right-click draft card
- Select "Delete Draft"

**From Panel**:
- Open draft
- Click delete icon
- Confirm deletion

---

## CRM & Contacts

### Contact Profiles

Beeper Kanban includes CRM functionality to track your contacts:

- **View Contact Profile**: Click the profile icon when viewing a conversation
- **Activity Stats**: See total messages, received, sent, and response time
- **Notes**: Add notes about the contact
- **Tags**: Organize contacts with custom tags

### Activity Tracking

The CRM tracks interaction stats automatically:
- **Total Messages**: All messages in conversation
- **Received**: Messages from the contact
- **Sent**: Your messages to them
- **Avg Response Time**: How quickly you typically respond (within 2-hour windows)

### Managing Contacts

- Contacts are automatically created from your conversations
- Edit contact details in the profile panel
- Merge duplicate contacts if needed
- Search and filter contacts

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
- Process messages regularly
- Archive conversations you don't need to respond to
- Hide personal/off-topic chats

---

## Keyboard & Mouse Tips

### Mouse Actions

**Left Click**: Open message/draft panel

**Right Click**: Open context menu
- Archive/Unarchive
- Hide Chat
- Delete Draft

**Drag & Drop**:
- Drag cards between columns (future feature)

### Navigation Tips

**Quick Review**:
- Click message
- Review in panel
- Press ESC to close
- Click next message

**Panel Management**:
- Panel stays open while clicking cards
- Click X or click outside to close

---

## Tips & Tricks

### Efficiency Tips

**1. Process in Batches**
```
Set aside time for message review
Process all messages at once
Archive completed conversations
```

**2. Use Archive Aggressively**
```
If conversation is done → Archive immediately
Keeps board clean and focused
```

**3. Hide Personal Chats**
```
Keep personal separate from work
Unhide when needed
```

### Quality Tips

**1. Always Review Before Sending**
- Double-check message content
- Verify tone matches context
- Add personal touches

**2. Use Manual Mode for Important Chats**
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

**2. Archive Aggressively**
```
If conversation is done → Archive immediately
Keeps board clean and focused
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
4. Process each conversation
5. Archive completed chats

### High-Volume Response

1. Review all messages quickly
2. Process most urgent first
3. Draft responses for each
4. Send all drafts
5. Archive completed

### Careful Important Response

1. Click message to open panel
2. Read full conversation history
3. Think about your response
4. Draft response carefully
5. Review carefully
6. Edit as needed
7. Send when perfect

### End-of-Day Cleanup

1. Review Sent column
2. Archive completed conversations
3. Review Drafts column
4. Send or delete stale drafts
5. Plan for tomorrow

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

### Feedback

We love feedback! Please share:
- Feature requests
- Bug reports
- Usability suggestions
- Documentation improvements

Open an issue on GitHub or contribute directly!

---

## Best Practices Summary

### Do's

✅ Review messages before sending
✅ Archive completed conversations regularly
✅ Keep your Unread column clean
✅ Process messages in batches when possible
✅ Update API keys if they expire
✅ Back up your data (Settings → Data → Export)

### Don'ts

❌ Let Unread column pile up indefinitely
❌ Share API keys or Beeper tokens
❌ Forget to archive completed chats
❌ Neglect to check for updates

---

## Next Steps

Now that you know the basics:

1. **Set up your workflow**: Start simple with manual processing
2. **Organize contacts**: Use the CRM to track important contacts
3. **Optimize your process**: Find what works for your use case
4. **Share feedback**: Help improve Beeper Kanban!

Happy messaging!
