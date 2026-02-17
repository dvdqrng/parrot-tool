# Beeper Kanban Documentation

Welcome to the Beeper Kanban documentation. This guide covers all aspects of the application.

## What is Beeper Kanban?

Beeper Kanban is a productivity tool that transforms your Beeper messages into a visual Kanban board, helping you manage conversations across all your messaging platforms in one unified view.

## Key Features

- **Unified Inbox**: View messages from all connected platforms (iMessage, WhatsApp, Telegram, Signal, etc.)
- **Kanban Board**: Organize conversations as cards in customizable columns
- **CRM Integration**: Track contacts with activity stats and interaction history
- **Multi-Platform Support**: Works with any messaging service connected to Beeper
- **Dark Mode**: Full dark theme support
- **Real-time Updates**: Automatic polling for new messages

## Documentation Index

### For Users

**[User Guide](USER_GUIDE.md)** - Complete guide to using Beeper Kanban
- Getting started
- Basic workflows
- Managing messages
- Keyboard shortcuts and tips

**[Configuration Guide](CONFIGURATION.md)** - Detailed setup and configuration
- Beeper integration setup
- Platform selection
- Data management

**[Troubleshooting Guide](TROUBLESHOOTING.md)** - Common issues and solutions
- Installation issues
- Connection problems
- Message loading issues
- Performance optimization

### For Developers

**[Development Guide](DEVELOPMENT.md)** - Everything for contributing developers
- Development setup
- Code structure and patterns
- Adding new features
- Testing guidelines

**[Architecture Documentation](ARCHITECTURE.md)** - Technical architecture
- System overview
- Component architecture
- Data flow and unified data pipeline
- State management

**[API Documentation](API.md)** - Complete API reference
- Unified Beeper data endpoint
- Chat operations
- Send message API
- Type definitions

**[Contributing Guide](CONTRIBUTING.md)** - How to contribute
- Code of conduct
- Bug reporting
- Pull request process
- Coding guidelines

### Getting Started

**[Onboarding Guide](ONBOARDING.md)** - First-time setup
- Step-by-step installation
- Beeper Desktop setup
- Initial configuration

## Quick Start

1. Install Beeper Desktop and enable the API in Settings → Developers
2. Copy your access token from Beeper Desktop
3. Run the application: `npm run dev`
4. Enter your Beeper access token when prompted
5. Your messages will appear on the Kanban board

## Requirements

- Node.js 18+
- Beeper Desktop running with API enabled
- Beeper access token

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI**: React, Tailwind CSS, shadcn/ui
- **State**: React Context (BeeperDataProvider)
- **Auth**: Supabase
- **API Client**: Beeper SDK (@nicostrebel/beeper-api-client)

## Document Overview

| Document | Purpose | Audience |
|----------|---------|----------|
| [USER_GUIDE.md](USER_GUIDE.md) | How to use the app | End users |
| [CONFIGURATION.md](CONFIGURATION.md) | Setup and settings | Users/Admins |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Problem solving | All users |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Development guide | Developers |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Technical details | Developers |
| [API.md](API.md) | API reference | Developers |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guide | Contributors |
| [ONBOARDING.md](ONBOARDING.md) | First-time setup | New users |

---

**Last Updated**: 2025-02-08

**App Version**: 0.1.4
