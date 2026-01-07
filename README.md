# Parrot

A powerful Kanban-style message management interface for Beeper, featuring AI-assisted draft generation and autonomous conversation handling through intelligent autopilot agents.

## Overview

Parrot transforms your messaging workflow by providing a visual kanban board interface for managing conversations across all your messaging platforms connected through Beeper. With AI assistance and autopilot capabilities, you can efficiently handle high volumes of messages while maintaining personal, context-aware responses.

### Key Features

- **Kanban Board Interface**: Organize messages across multiple columns (Unread, Autopilot, Drafts, Sent, Archived)
- **AI Draft Generation**: Automatically generate contextual replies using Anthropic Claude, OpenAI, or local Ollama models
- **Autopilot Agents**: Create autonomous agents that handle conversations with human-like behavior
- **Per-Thread AI Assistant**: Get help crafting perfect responses with a dedicated AI chat panel for each conversation
- **Writing Style Analysis**: Train the AI to match your personal writing style and tone
- **Multi-Platform Support**: Manage messages from WhatsApp, Telegram, Instagram, Discord, and more through Beeper
- **Batch Operations**: Generate drafts or send messages to multiple conversations at once
- **Archive Management**: Keep your inbox clean with archive/unarchive functionality
- **Human-Like Behavior**: Autopilot agents simulate realistic typing speeds, response delays, and conversation patterns
- **Electron Desktop App**: Run as a native desktop application

## Screenshots

![Kanban Board](docs/images/kanban-board.png)
*Kanban board showing messages organized by status*

![AI Chat Panel](docs/images/ai-chat-panel.png)
*Per-thread AI assistant helping craft responses*

![Autopilot Configuration](docs/images/autopilot-config.png)
*Configure autonomous agents with custom goals and behavior*

## Tech Stack

- **Framework**: Next.js 16 (React 19.2.1)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: Radix UI
- **Animations**: Framer Motion
- **Messaging**: Beeper Desktop API (@beeper/desktop-api)
- **AI Integration**:
  - Anthropic SDK (@anthropic-ai/sdk)
  - OpenAI SDK
  - Local Ollama support
- **Desktop**: Electron
- **Drag & Drop**: @dnd-kit

## Quick Start

### Prerequisites

- Node.js 20 or higher
- npm or yarn
- Beeper account and access token
- (Optional) Anthropic, OpenAI, or Ollama API keys for AI features

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/parrot.git
cd parrot
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:3000`

### Running as Desktop App

1. In one terminal, start the Next.js dev server:
```bash
npm run dev
```

2. In another terminal, start the Electron app:
```bash
npm run electron
```

## Configuration

### Initial Setup

1. **Configure Platforms**:
   - Go to Settings > Platforms
   - Add your Beeper access token
   - Select which messaging platforms to display

2. **Set Up AI Integration** (Optional):
   - Go to Settings > API Keys
   - Choose your AI provider (Anthropic, OpenAI, or Ollama)
   - Add your API keys or configure Ollama endpoint

3. **Customize Tone** (Optional):
   - Go to Settings > Tone
   - Adjust formality and detail level
   - Add sample messages to train writing style

### Getting Your Beeper Access Token

1. Open Beeper Desktop application
2. Open Developer Tools (View > Toggle Developer Tools)
3. Go to Application > Local Storage
4. Find your access token under the appropriate key
5. Copy and paste into Parrot settings

For detailed configuration instructions, see [CONFIGURATION.md](docs/CONFIGURATION.md).

## Usage

### Basic Workflow

1. **View Unread Messages**: All new messages appear in the "Unread" column
2. **Generate Draft**:
   - Drag a message from Unread to Drafts, or
   - Click "Generate All Drafts" to batch generate
3. **Review & Edit**: Click any draft to review and edit in the message panel
4. **Send**: Click send to deliver your message

### Autopilot Mode

Create autonomous agents that handle conversations for you:

1. **Create an Agent**:
   - Go to Settings > Autopilot > Agents
   - Click "New Agent"
   - Define the agent's goal, personality, and behavior settings

2. **Enable Autopilot for a Chat**:
   - Open any message in the message panel
   - Click the autopilot icon
   - Select an agent and choose mode:
     - **Manual Approval**: Review drafts before sending
     - **Self-Driving**: Agent sends messages autonomously for a set duration

3. **Monitor Activity**:
   - View real-time autopilot status in the Autopilot column
   - Check activity logs in Settings > Autopilot > Activity
   - Receive handoff summaries when agents complete their goals

### AI Chat Assistant

Each conversation has a dedicated AI assistant:

1. Open any message in the message panel
2. Click the chat icon to open AI assistant
3. Ask questions, request rewrites, or brainstorm responses
4. Click "Use Draft" to insert AI-generated text

## Architecture

### Project Structure

```
parrot/
├── app/                      # Next.js app directory
│   ├── api/                  # API routes
│   │   ├── ai/               # AI integration endpoints
│   │   ├── beeper/           # Beeper API integration
│   │   ├── media/            # Media handling
│   │   └── ollama/           # Ollama integration
│   ├── settings/             # Settings pages
│   │   ├── api-keys/         # API key management
│   │   ├── autopilot/        # Autopilot configuration
│   │   ├── platforms/        # Platform selection
│   │   └── tone/             # Writing style settings
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Main kanban board
├── components/               # React components
│   ├── autopilot/            # Autopilot-related components
│   ├── kanban/               # Kanban board components
│   ├── message-input/        # Message input components
│   └── ui/                   # Reusable UI components
├── contexts/                 # React contexts
│   ├── autopilot-context.tsx # Autopilot state management
│   └── settings-context.tsx  # App settings
├── hooks/                    # Custom React hooks
├── lib/                      # Utility libraries
│   ├── storage.ts            # LocalStorage utilities
│   ├── types.ts              # TypeScript type definitions
│   └── ollama.ts             # Ollama integration
├── electron.js               # Electron main process
├── docs/                     # Documentation
└── public/                   # Static assets
```

For detailed architecture documentation, see [ARCHITECTURE.md](docs/ARCHITECTURE.md).

## API Documentation

### Beeper API Routes

- `GET /api/beeper/messages` - Fetch unread messages
- `GET /api/beeper/user-messages` - Fetch sent messages
- `GET /api/beeper/archived` - Fetch archived messages
- `POST /api/beeper/send` - Send a message
- `POST /api/beeper/chats/[chatId]/archive` - Archive a chat
- `POST /api/beeper/chats/[chatId]/unarchive` - Unarchive a chat
- `GET /api/beeper/accounts` - Get connected accounts
- `GET /api/beeper/contacts` - Get contacts list

### AI API Routes

- `POST /api/ai/draft` - Generate a draft reply
- `POST /api/ai/chat` - AI chat assistant
- `POST /api/ai/conversation-summary` - Generate conversation summary

For complete API documentation, see [API.md](docs/API.md).

## Development

### Building for Production

```bash
npm run build
npm run start
```

### Linting

```bash
npm run lint
```

### Type Checking

```bash
npx tsc --noEmit
```

For detailed development guidelines, see [DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Features In-Depth

### Autopilot Agents

Autopilot agents are autonomous assistants that can handle conversations on your behalf with remarkably human-like behavior:

**Goal-Oriented**: Define specific goals like "Schedule a meeting" or "Answer product questions"

**Customizable Behavior**:
- Reply delays with context awareness
- Activity hours (only respond during certain times)
- Typing indicators and read receipts
- Multi-message responses
- Response rate (simulate being busy)
- Emoji-only responses
- Conversation fatigue (reduce engagement in long conversations)
- Natural conversation closing

**Modes**:
- **Manual Approval**: Review and approve each draft before sending
- **Self-Driving**: Fully autonomous for a set time period (10/30/60 minutes or custom)

**Goal Completion Behaviors**:
- **Auto-Disable**: Stop when goal is achieved
- **Maintenance**: Continue monitoring the conversation
- **Handoff**: Generate a summary for human review

### Writing Style Analysis

The app can learn your personal writing style:

1. Add sample messages you've written
2. The AI analyzes:
   - Common phrases and expressions
   - Emoji usage patterns
   - Greeting and sign-off styles
   - Punctuation preferences
   - Capitalization style
   - Language quirks and abbreviations

3. Future drafts match your style automatically

### Batch Operations

Handle multiple conversations efficiently:

- **Generate All Drafts**: Create AI-generated replies for all unread messages
- **Send All Drafts**: Send all prepared drafts with one click
- Progress tracking and cancellation support

## Data Storage

All data is stored locally in your browser's LocalStorage:

- App settings and API keys
- Drafts and message history
- Autopilot configurations
- Writing style patterns
- AI chat history (per thread)

No data is sent to external servers except:
- Beeper API for message operations
- Selected AI provider (Anthropic/OpenAI/Ollama) for draft generation

## Security

- API keys are stored in browser LocalStorage
- All API calls are made through secure HTTPS
- Beeper access token is required for message operations
- Optional: Use local Ollama for complete data privacy

## Troubleshooting

### Common Issues

**Messages not loading**:
- Verify your Beeper access token is valid
- Check that you've selected at least one platform
- Ensure Beeper Desktop is running

**AI draft generation failing**:
- Verify your API key is correct
- Check that you've selected the correct AI provider
- For Ollama, ensure the service is running and accessible

**Electron app not starting**:
- Make sure the Next.js dev server is running first
- Check that port 3000 is not in use

For more troubleshooting tips, see [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](docs/CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Roadmap

- [ ] Mobile responsive design
- [ ] Real-time message updates via WebSocket
- [ ] Message search and filtering
- [ ] Custom keyboard shortcuts
- [ ] Export conversation transcripts
- [ ] Multi-language support
- [ ] Voice message support
- [ ] Media attachment handling improvements
- [ ] Advanced analytics dashboard
- [ ] Team collaboration features

## License

[MIT License](LICENSE)

## Acknowledgments

- Built with [Next.js](https://nextjs.org)
- UI components from [Radix UI](https://radix-ui.com)
- Icons from [Lucide](https://lucide.dev)
- Messaging integration via [Beeper](https://beeper.com)
- AI powered by [Anthropic](https://anthropic.com), [OpenAI](https://openai.com), and [Ollama](https://ollama.ai)

## Support

For questions, issues, or feature requests, please open an issue on GitHub.

## Authors

David Quiring

---

Made with love for efficient communication
