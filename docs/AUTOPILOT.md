# Autopilot System Documentation

Complete guide to the Beeper Kanban Autopilot system - autonomous AI agents that handle conversations with human-like behavior.

## Table of Contents

- [Overview](#overview)
- [Core Concepts](#core-concepts)
- [Agent Configuration](#agent-configuration)
- [Human-Like Behavior](#human-like-behavior)
- [Operating Modes](#operating-modes)
- [Goal Completion](#goal-completion)
- [Activity Monitoring](#activity-monitoring)
- [Technical Architecture](#technical-architecture)
- [Best Practices](#best-practices)
- [Advanced Usage](#advanced-usage)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Autopilot system enables you to create autonomous AI agents that can:

- Handle conversations automatically
- Respond with human-like timing and behavior
- Work towards specific goals (scheduling, support, etc.)
- Generate handoff summaries when complete
- Simulate realistic human patterns (typing, delays, fatigue)

### Key Benefits

**Efficiency**: Handle routine conversations automatically

**Consistency**: Maintain quality across all interactions

**Scalability**: Manage multiple conversations simultaneously

**Privacy**: All processing happens through your chosen AI provider

**Control**: Manual approval or fully autonomous modes

---

## Core Concepts

### Agents

An **Agent** is a configured AI assistant with:
- **Goal**: Specific objective (e.g., "Schedule a meeting")
- **Personality**: System prompt defining behavior and tone
- **Behavior Settings**: Human-like characteristics (delays, hours, etc.)
- **Completion Behavior**: What to do when goal is achieved

You can create multiple agents for different purposes.

### Chat Configuration

Each conversation can have autopilot enabled with:
- Selected agent
- Operating mode (manual approval or self-driving)
- Status tracking
- Activity logging

### Scheduled Actions

Actions (messages, read receipts, typing) are scheduled with delays to simulate human behavior. The scheduler executes them at the right time.

### Activity Log

Every action taken by autopilot is logged for review:
- Messages sent
- Drafts generated
- Goal detections
- Mode changes
- Errors

### Handoff Summaries

When an agent completes its goal, it can generate a summary:
- Conversation overview
- Key points discussed
- Goal achievement status
- Suggested next steps

---

## Agent Configuration

### Creating an Agent

**Navigation**: Settings → Autopilot → Agents → New Agent

#### 1. Basic Information

**Name**:
- Descriptive and memorable
- Examples: "Meeting Scheduler", "Customer Support", "Sales Assistant"

**Description**:
- Brief explanation of purpose
- Visible in agent selection

**Goal**:
- Specific and measurable
- Examples:
  - "Schedule a meeting with a confirmed date and time"
  - "Answer product questions until customer is satisfied"
  - "Collect shipping address for order"

**System Prompt**:
- Defines personality and instructions
- Include tone, style, constraints
- Example:
  ```
  You are a professional meeting scheduler named Alex.
  Your goal is to find a mutually convenient meeting time.

  Guidelines:
  - Be polite and efficient
  - Suggest 2-3 time options
  - Confirm all details before finalizing
  - Ask clarifying questions if needed
  - Never commit to times outside business hours (9 AM - 6 PM)

  Respond concisely and maintain a friendly, professional tone.
  ```

#### 2. Behavior Settings

These settings control how the agent behaves to appear human-like.

##### Reply Delays

**Min Delay**: Minimum seconds before responding (default: 60)
**Max Delay**: Maximum seconds before responding (default: 300)

**Context-Aware Delays**: Respond faster in active conversations

Example timing:
- New conversation: 2-5 minutes
- Active back-and-forth: 30-60 seconds
- After long pause: 5-10 minutes

##### Activity Hours

**Enable**: Only respond during certain hours
**Start Hour**: Beginning of active period (e.g., 9 AM)
**End Hour**: End of active period (e.g., 10 PM)
**Timezone**: Your local timezone

Messages outside these hours are queued for the next active period.

##### Typing Indicators

**Enable**: Show "typing..." before sending
**Speed (WPM)**: Words per minute typing speed (default: 40)

Calculates realistic typing duration based on message length.

##### Read Receipts

**Enable**: Mark messages as read before responding
**Min Delay**: Minimum seconds to mark as read (default: 5)
**Max Delay**: Maximum seconds to mark as read (default: 30)

##### Multi-Message Responses

**Enable**: Split long responses into multiple messages
**Min Delay**: Seconds between messages (default: 3)
**Max Delay**: Seconds between messages (default: 10)

Makes conversations feel more natural.

##### Response Rate

**Value**: 0-100 (default: 85)

Percentage of time the agent responds. Lower values simulate being occasionally busy.

- 100: Always responds
- 85: Occasionally "busy" (realistic)
- 50: Responds half the time

##### Emoji-Only Responses

**Enable**: Sometimes respond with just an emoji
**Chance**: Percentage (default: 10)

For simple acknowledgments:
- "Thanks!" → "👍"
- "Sounds good" → "😊"

##### Conversation Fatigue

**Enable**: Reduce engagement in long conversations
**Trigger**: Number of messages before fatigue (default: 15)
**Reduction**: Percentage to reduce response rate (default: 5% per message)

Simulates natural conversation weariness.

##### Natural Closing

**Enable**: Suggest ending conversation after idle period
**Idle Minutes**: Time before suggesting close (default: 30)

Example: "Is there anything else I can help with?"

#### 3. Goal Completion Behavior

Choose what happens when the agent achieves its goal:

**Auto-Disable**:
- Stops responding immediately
- Best for: One-time tasks (scheduling, info collection)

**Maintenance**:
- Continues monitoring conversation
- Reduced activity level
- Best for: Ongoing support, relationship building

**Handoff**:
- Generates summary for human review
- Pauses until human takes over
- Best for: Complex sales, important decisions

### Editing Agents

1. Go to Settings → Autopilot → Agents
2. Click on agent name
3. Modify settings
4. Click "Save Changes"

Changes apply to future conversations. Active chats continue with old settings until restarted.

### Deleting Agents

1. Go to Settings → Autopilot → Agents
2. Click agent name
3. Click "Delete Agent"
4. Confirm deletion

Active chats using this agent will be disabled.

---

## Human-Like Behavior

### Why Human-Like Behavior Matters

Instant responses feel robotic. Natural delays and patterns make conversations feel genuine.

### Behavior Components

#### 1. Variable Response Times

**Implementation**:
- Random delay within min/max range
- Faster responses in active conversations
- Slower responses after breaks

**Example**:
```
User: "Are you free tomorrow?" (9:00 AM)
→ Read receipt: 9:00:15 AM (15 seconds)
→ Typing indicator: 9:01:30 AM (1 min 15 sec)
→ Response: 9:02:45 AM (2 min 45 sec total)
```

#### 2. Activity Hours

**Realistic Scheduling**:
- No responses at 3 AM (unless you actually work then)
- Queue messages for next active period
- Matches your real availability

**Example**:
```
Hours: 9 AM - 10 PM
Message received: 11 PM → Response at 9:05 AM next day
Message received: 3 PM → Response in 1-5 minutes
```

#### 3. Typing Indicators

**Calculation**:
```
typingDuration = (wordCount / wordsPerMinute) * 60 seconds
```

**Example**:
- Message: "That works for me!" (4 words)
- WPM: 40
- Typing duration: (4 / 40) * 60 = 6 seconds

#### 4. Read Receipts

**Pattern**:
1. Message received
2. Mark as read (after delay)
3. Start typing (after another delay)
4. Send response

Mimics real behavior of reading, thinking, then typing.

#### 5. Response Rate

**Implementation**:
- Random chance each time
- If "busy", don't respond or delay significantly

**Example** (85% response rate):
```
Message 1: Respond normally (within 85% probability)
Message 2: No response (within 15% probability)
Message 3: Respond normally
```

#### 6. Conversation Fatigue

**Pattern**:
```
Messages 1-15: Full engagement (85% response rate)
Message 16: 80% response rate (5% reduction)
Message 17: 75% response rate
Message 18: 70% response rate
...
```

Responses become slower and less frequent as conversation lengthens.

#### 7. Natural Closing

**Implementation**:
After idle period, agent suggests wrapping up:
```
"Is there anything else I can help with?"
"Let me know if you need anything else!"
"Feel free to reach out if you have more questions."
```

---

## Operating Modes

### Manual Approval Mode

**How it works**:
1. Agent receives message
2. Generates draft response
3. Draft appears in Drafts column
4. You review and approve
5. Click send when ready

**Best for**:
- Important conversations
- High-stakes situations
- Learning agent behavior
- Sensitive topics

**Workflow**:
```
New Message → Agent Generates Draft → You Review → You Send
```

### Self-Driving Mode

**How it works**:
1. Agent receives message
2. Generates response
3. Schedules send action
4. Executes at appropriate time
5. Continues until time expires or goal complete

**Time Limits**:
- 10 minutes
- 30 minutes
- 60 minutes
- Custom duration

**Best for**:
- Routine conversations
- High-volume responses
- Well-tested agents
- Non-critical chats

**Workflow**:
```
New Message → Agent Generates → Auto-Schedule → Auto-Send → Repeat
```

### Switching Modes

**During Active Autopilot**:
1. Open message panel
2. Click autopilot icon
3. Select new mode
4. Confirm change

Changes take effect immediately for future messages.

---

## Goal Completion

### Detecting Goal Achievement

Agents analyze conversation context to determine if goal is met.

**Example: Meeting Scheduler**
```
Goal: "Schedule a meeting with confirmed date and time"

Conversation:
User: "Can we meet next Tuesday?"
Agent: "I'm available at 2 PM or 4 PM. Which works?"
User: "2 PM works!"
Agent: "Great! Meeting scheduled for Tuesday at 2 PM."

→ GOAL ACHIEVED (date and time confirmed)
```

### Completion Behaviors

#### Auto-Disable

**Sequence**:
1. Goal detected as achieved
2. Agent stops responding
3. Chat moves to Sent column
4. Activity logged

**Use cases**:
- One-time scheduling
- Information collection
- Simple transactions

#### Maintenance Mode

**Sequence**:
1. Goal detected as achieved
2. Agent continues monitoring
3. Response rate reduced
4. Only responds to direct questions

**Use cases**:
- Customer support (after issue resolved)
- Relationship nurturing
- Follow-up opportunities

#### Handoff

**Sequence**:
1. Goal detected as achieved
2. Agent generates summary
3. Summary notification appears
4. Autopilot pauses
5. Awaits human review

**Summary includes**:
- Conversation overview
- Key points discussed
- Goal achievement confirmation
- Suggested next steps
- Relevant details extracted

**Use cases**:
- Sales conversations
- Complex decisions
- Important outcomes
- Need for human touch

### Handoff Summary Example

```
HANDOFF SUMMARY
Chat: John Smith (WhatsApp)
Agent: Meeting Scheduler
Generated: 2:45 PM

OVERVIEW:
Successfully scheduled a meeting for next Tuesday at 2 PM.

KEY POINTS:
• User requested meeting to discuss Q1 results
• Confirmed availability: Tuesday 2 PM
• Meeting location: Office conference room B
• User mentioned bringing financial reports

GOAL STATUS: ✓ ACHIEVED
Meeting scheduled with confirmed date, time, and location.

SUGGESTED NEXT STEPS:
1. Send calendar invite
2. Prepare Q1 results review
3. Reserve conference room B
4. Confirm attendees list

[View Full Conversation] [Dismiss]
```

---

## Activity Monitoring

### Activity Log

**Access**: Settings → Autopilot → Activity

**Entries include**:
- Timestamp
- Chat/Contact name
- Agent used
- Action type
- Message preview (if applicable)
- Outcome

**Action Types**:
- Draft Generated
- Message Sent
- Message Received
- Goal Detected
- Mode Changed
- Agent Changed
- Paused
- Resumed
- Handoff Triggered
- Time Expired
- Skipped (Busy)
- Emoji-Only Sent
- Conversation Closing
- Fatigue Reduced
- Error

**Example Log**:
```
2:30:15 PM | John Smith | Meeting Scheduler
└─ DRAFT GENERATED: "I'm available Tuesday at 2 PM or 4 PM..."

2:32:45 PM | John Smith | Meeting Scheduler
└─ MESSAGE SENT: "I'm available Tuesday at 2 PM or 4 PM..."

2:35:10 PM | John Smith | Meeting Scheduler
└─ MESSAGE RECEIVED: "2 PM works!"

2:37:30 PM | John Smith | Meeting Scheduler
└─ GOAL DETECTED: Meeting scheduled successfully

2:37:31 PM | John Smith | Meeting Scheduler
└─ HANDOFF TRIGGERED: Summary generated
```

### Real-Time Status

**Autopilot Column**:
Shows all chats with active autopilot

**Status Indicators**:
- 🟢 Active: Monitoring and responding
- 🟡 Paused: Temporarily stopped
- 🔵 Manual Approval: Draft pending review
- ✅ Goal Completed: Objective achieved
- ⏱️ Scheduled: Action queued
- ❌ Error: Issue occurred

**Activity Badges**:
- Recent activity indicator
- Message count
- Last action timestamp

### Notifications

**Handoff Notifications**:
- Appear in bottom-left corner
- Include summary preview
- Action buttons: View Details, Dismiss

**Error Notifications**:
- Toast message when error occurs
- Check activity log for details

---

## Technical Architecture

### System Components

```
┌─────────────────────────────────────────────┐
│          AutopilotContext (Global)          │
│  - Process new messages                     │
│  - Manage handoffs                          │
│  - Track config version                     │
└──────────────────┬──────────────────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌──────────────────┐  ┌──────────────────┐
│ AutopilotEngine  │  │ AutopilotScheduler│
│                  │  │                  │
│ - Message        │  │ - Execute        │
│   processing     │  │   scheduled      │
│ - Draft          │  │   actions        │
│   generation     │  │ - Timing         │
│ - Goal detection │  │   management     │
└──────────────────┘  └──────────────────┘
         │                   │
         └─────────┬─────────┘
                   ▼
         ┌──────────────────┐
         │  LocalStorage    │
         │  - Agents        │
         │  - Configs       │
         │  - Actions       │
         │  - Activity      │
         └──────────────────┘
```

### Data Flow

#### 1. New Message Processing

```
New Message Arrives
    ↓
AutopilotContext.processNewMessages()
    ↓
Check if autopilot enabled for chat
    ↓
Load ChatAutopilotConfig
    ↓
Load Agent configuration
    ↓
AutopilotEngine.processMessage()
    ↓
├─ Build AI prompt with:
│  - Agent's system prompt
│  - Agent's goal
│  - Conversation history
│  - Current message
│  - Tone settings
│  - Writing style
│
├─ Generate response via AI provider
│
├─ Apply human-like behavior:
│  - Calculate delays
│  - Check activity hours
│  - Apply response rate
│  - Check fatigue level
│
├─ Create draft or schedule action
│
├─ Detect goal completion
│
└─ Log activity
    ↓
If Manual Approval:
    → Create draft in Drafts column
    → Wait for user to send

If Self-Driving:
    → Schedule send action
    → AutopilotScheduler executes later
```

#### 2. Action Execution

```
AutopilotScheduler (runs continuously)
    ↓
Load pending scheduled actions
    ↓
For each action:
    ↓
    Check if scheduled time reached
    ↓
    If yes:
        ↓
        Execute action:
        - Send message (via /api/beeper/send)
        - Mark as read
        - Show typing indicator
        ↓
        Update action status: completed
        ↓
        Log activity
        ↓
        Check goal completion
        ↓
        If goal completed:
            ↓
            Execute completion behavior:
            - Auto-Disable: Stop responding
            - Maintenance: Reduce activity
            - Handoff: Generate summary
```

### Storage Schema

#### Agent Definition

```typescript
{
  id: "agent-123",
  name: "Meeting Scheduler",
  description: "Schedules meetings efficiently",
  goal: "Schedule a meeting with confirmed date and time",
  systemPrompt: "You are a professional...",
  behavior: {
    replyDelayMin: 60,
    replyDelayMax: 300,
    // ... other settings
  },
  goalCompletionBehavior: "handoff",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z"
}
```

#### Chat Autopilot Config

```typescript
{
  chatId: "chat-456",
  enabled: true,
  agentId: "agent-123",
  mode: "self-driving",
  status: "active",
  selfDrivingDurationMinutes: 30,
  selfDrivingStartedAt: "2024-01-01T12:00:00Z",
  selfDrivingExpiresAt: "2024-01-01T12:30:00Z",
  messagesHandled: 5,
  lastActivityAt: "2024-01-01T12:15:00Z",
  errorCount: 0,
  createdAt: "2024-01-01T12:00:00Z",
  updatedAt: "2024-01-01T12:15:00Z"
}
```

#### Scheduled Action

```typescript
{
  id: "action-789",
  chatId: "chat-456",
  agentId: "agent-123",
  type: "send-message",
  scheduledFor: "2024-01-01T12:05:00Z",
  messageText: "That works for me!",
  status: "pending",
  attempts: 0,
  createdAt: "2024-01-01T12:00:00Z"
}
```

---

## Best Practices

### Agent Design

**1. Clear, Specific Goals**
```
❌ Bad: "Help with customer questions"
✅ Good: "Answer product questions until customer confirms satisfaction"

❌ Bad: "Schedule things"
✅ Good: "Schedule a meeting with confirmed date, time, and location"
```

**2. Detailed System Prompts**
```
Include:
- Role and personality
- Specific instructions
- Constraints and boundaries
- Tone guidance
- Examples if helpful
```

**3. Realistic Behavior Settings**
```
Don't:
- Set delays too short (feels robotic)
- Respond 24/7 (unrealistic)
- Type too fast (200 WPM is suspicious)

Do:
- Match your real availability
- Use context-aware delays
- Enable conversation fatigue
```

### Testing

**1. Start with Manual Approval**
- Test agent responses
- Refine system prompt
- Adjust behavior settings
- Build confidence

**2. Short Self-Driving Tests**
- Start with 10-minute windows
- Monitor activity log closely
- Extend time as confidence grows

**3. Low-Stakes Conversations**
- Test on non-critical chats
- Use test accounts if possible
- Have backup plan ready

### Monitoring

**1. Regular Activity Review**
- Check daily for issues
- Look for patterns
- Refine prompts based on actual usage

**2. Goal Completion Analysis**
- Are goals being achieved?
- False positives/negatives?
- Adjust detection criteria

**3. User Feedback**
- Did recipients notice anything odd?
- Conversation flow natural?
- Desired outcomes achieved?

### Security & Privacy

**1. System Prompt Security**
```
Don't include:
- Sensitive information
- API keys or tokens
- Personal data
- Confidential business info

Do include:
- Generic guidelines
- Public information only
- Professional boundaries
```

**2. Data Handling**
```
Remember:
- Conversations sent to AI provider
- Activity logs stored locally
- Choose provider based on privacy needs
- Consider Ollama for sensitive conversations
```

**3. Access Control**
```
- Keep Beeper token secure
- Don't share agent configs publicly
- Review activity logs for anomalies
- Disable autopilot if compromised
```

---

## Advanced Usage

### Dynamic Goal Adjustment

Change agent goals mid-conversation:
1. Open message panel
2. Click autopilot icon
3. Select different agent
4. New goal takes effect immediately

### Multi-Agent Workflows

Use different agents for different stages:
1. **Initial Contact**: Greeting agent (warm, friendly)
2. **Information Gathering**: Detail-oriented agent
3. **Closing**: Professional summary agent

### Agent Templates

Create template agents for common scenarios:
- **Quick Responder**: Minimal delays, brief responses
- **Thoughtful Consultant**: Longer delays, detailed responses
- **Social Butterfly**: Emoji-heavy, very casual
- **Professional**: Formal tone, structured responses

### A/B Testing Agents

Compare agent performance:
1. Create two similar agents with variations
2. Use each in similar conversations
3. Review activity logs and outcomes
4. Keep the better performer

### Custom Behavior Profiles

Create behavior profiles for different contexts:
- **Morning Mode**: Slower, needs coffee references
- **Evening Mode**: Faster, ready to wrap up
- **Weekend Mode**: Very casual, slower responses

---

## Troubleshooting

### Agent Not Responding

**Check**:
1. Is autopilot enabled for the chat?
2. Is the agent status "Active"?
3. Are you within activity hours?
4. Check response rate setting
5. Review error log

**Common Causes**:
- Outside activity hours → Wait or adjust hours
- Reached conversation fatigue → Reset or adjust settings
- Response rate lottery → Normal, try again
- API error → Check AI provider status

### Draft Not Generating

**Check**:
1. AI provider configured correctly?
2. API key valid?
3. Network connection stable?
4. Check browser console for errors

**Common Causes**:
- Invalid API key → Update in settings
- Rate limit hit → Wait and retry
- Provider downtime → Switch provider temporarily

### Goal Not Being Detected

**Check**:
1. Review agent goal phrasing
2. Check if goal is achievable in context
3. Review conversation - was goal actually met?

**Solutions**:
- Make goal more specific
- Add explicit confirmation requirement
- Adjust agent prompt to confirm goal completion

### Unnatural Timing

**Symptoms**:
- Responses too fast or too slow
- Pattern feels robotic
- Recipients suspicious

**Solutions**:
- Increase delay range variability
- Enable context-aware delays
- Add conversation fatigue
- Adjust activity hours to match reality
- Enable emoji-only responses for variety

### Self-Driving Mode Not Working

**Check**:
1. Mode is set to "Self-Driving", not "Manual Approval"
2. Duration hasn't expired
3. No errors in activity log
4. Beeper token valid

**Common Causes**:
- Time expired → Re-enable with new duration
- Error occurred → Check log and fix issue
- Goal completed → Intended behavior

---

## Support

For autopilot-specific questions:
1. Review this documentation
2. Check activity log for details
3. Try with manual approval first
4. Open GitHub issue with:
   - Agent configuration
   - Activity log entries
   - Expected vs actual behavior

Remember: Autopilot is a powerful tool. Start small, test thoroughly, and scale gradually!
