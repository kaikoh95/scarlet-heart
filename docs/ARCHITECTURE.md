# Claude Code Remote - Architecture Overview

## Introduction

Claude Code Remote is a multi-channel notification and control system that enables remote interaction with Claude Code sessions through various messaging platforms. The system uses Claude Code's hook system to capture events and tmux for command injection.

**📚 Platform-Specific Documentation:**
- **[Slack Architecture](./SLACK_ARCHITECTURE.md)** - Thread-based persistent sessions
- **[Telegram Architecture](./TELEGRAM_ARCHITECTURE.md)** - Token-based stateless commands

---

## System Overview

### Key Capabilities

- **Multi-Channel Notifications**: Desktop, Email, Telegram, Slack, LINE
- **Two-Way Communication**: Receive notifications and send commands
- **Persistent Sessions**: Long-running Claude sessions across multiple interactions
- **Context Preservation**: Maintain conversation context in different ways per platform
- **Beautiful Formatting**: Platform-specific rich message formatting

### Architecture Principles

1. **Event-Driven**: Triggered by Claude Code hooks (SubagentStop, UserPromptSubmit, Stop)
2. **Platform-Specific Design**: Each platform optimized for its unique capabilities
3. **Shared Utilities**: Common code for file operations, JSON storage, string formatting
4. **Session Isolation**: Each conversation/thread has isolated Claude session (Slack) or shared session (Telegram)
5. **Secure by Default**: Token/signature verification on all channels

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Claude Code Instance                        │
│                    (Running in tmux session)                     │
└────────────┬────────────────────────────────────┬────────────────┘
             │                                    │
             │ Claude Code Hooks                  │ Command Injection
             │                                    │
             ▼                                    ▼
┌────────────────────────────┐      ┌────────────────────────────┐
│   claude-hook-notify.js    │      │   Command Injector         │
│   ────────────────────     │      │   ─────────────────        │
│   • SubagentStop           │      │   • tmux send-keys         │
│   • UserPromptSubmit       │      │   • Session verification   │
│   • Stop (completed)       │      │   • Input sanitization     │
└────────────┬───────────────┘      └────────────┬───────────────┘
             │                                    │
             │ Notification Event                 │ Platform Commands
             │                                    │
             ▼                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Multi-Channel Dispatcher                      │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐      │
│  │ Desktop  │  Email   │ Telegram │  Slack   │   LINE   │      │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘      │
└──────┬───────────┬────────────┬────────────┬────────────┬──────┘
       │           │            │            │            │
       ▼           ▼            ▼            ▼            ▼
   ┌──────┐   ┌───────┐   ┌─────────┐  ┌────────┐  ┌──────┐
   │Sound │   │ SMTP  │   │Telegram │  │ Slack  │  │ LINE │
   │Alert │   │/IMAP  │   │   Bot   │  │  Bot   │  │ Bot  │
   └──────┘   └───────┘   └─────────┘  └────────┘  └──────┘
```

### Component Layers

**Layer 1: Claude Code Integration**
- Hook listener (`claude-hook-notify.js`)
- Event detection and classification
- Session identification

**Layer 2: Notification Core**
- Multi-channel dispatcher
- Notification formatting
- Session management

**Layer 3: Platform Channels**
- Platform-specific implementations
- Message formatting (Block Kit, HTML, Markdown)
- Webhook handlers for two-way communication

**Layer 4: Data Storage**
- Session mappings (JSON files)
- Token management
- Thread/conversation tracking

---

## Platform Comparison

### Slack vs Telegram

| Feature | Slack | Telegram |
|---------|-------|----------|
| **Architecture** | Thread-based persistent sessions | Token-based shared session |
| **Session Model** | One tmux session per thread | Single shared `claude-session` |
| **Context Preservation** | Automatic (same tmux session) | Manual (via tokens) |
| **Command Format** | `@bot <command>` | `/cmd TOKEN <command>` |
| **Multi-user Support** | Isolated per thread | Shared session |
| **Session Lifecycle** | Per thread (auto-cleanup 24h) | Per notification (24h tokens) |
| **Thread History** | Included automatically | Not included |
| **Local Access** | `tmux attach -t slack-C123-456` | `tmux attach -t claude-session` |
| **Message Format** | Slack Block Kit | HTML (Telegram format) |
| **Code Highlighting** | Markdown code blocks | HTML `<pre><code>` |
| **Preview Length** | 500 words | 100 words |
| **Reactions** | ✅ Emoji reactions (👀 ⏳ ✅) | ❌ Not supported |
| **Message Updates** | ✅ Supported (chat.update) | ❌ Not supported |

### When to Use Each Platform

**Use Slack When:**
- ✅ Working in teams (thread isolation)
- ✅ Need conversation context preservation
- ✅ Multiple parallel tasks
- ✅ Collaborative code reviews
- ✅ Long-running interactive sessions

**Use Telegram When:**
- ✅ Personal development workflow
- ✅ Quick command/response pattern
- ✅ Mobile-first access
- ✅ Simple notification system
- ✅ Don't need persistent context

---

## Shared Components

### Utility Classes

**FileSystemUtils** (`src/utils/file-system-utils.js`)
```javascript
class FileSystemUtils {
  static ensureDirectory(dirPath, recursive = true)
  static ensureParentDirectory(filePath)
  static exists(filePath)
  static deleteIfExists(filePath)
  static deleteDirectoryIfExists(dirPath, recursive = true)
}
```

**JsonDataStore** (`src/utils/json-data-store.js`)
```javascript
class JsonDataStore {
  static load(filePath, defaultValue = {}, options = {})
  static save(filePath, data, options = {})
  static update(filePath, updateFn, defaultValue = {})
  static loadArray(filePath, options = {})
  static loadObject(filePath, options = {})
}
```

**StringUtils** (`src/utils/string-utils.js`)
```javascript
class StringUtils {
  static escapeHtml(text)
  static truncate(text, maxLength, suffix = '...')
  static capitalize(text)
  static toTitleCase(text)
  static stripHtml(html)
  static normalizeWhitespace(text)
  static isBlank(text)
}
```

### TmuxMonitor

**File:** `src/utils/tmux-monitor.js`

Extracts conversation history from tmux sessions:

```javascript
class TmuxMonitor {
  getRecentConversation(sessionName, lineLimit = 3000) {
    // Returns: { userQuestion, claudeResponse }
  }
}
```

**Detection Strategy:**
1. Captures last N lines from tmux pane
2. Finds user input by looking for prompt patterns
3. Extracts Claude's response after user input
4. Handles multi-line responses and code blocks

### TextFormatter

**File:** `src/utils/text-formatter.js`

Provides cross-platform text formatting:

```javascript
class TextFormatter {
  static escapeHtml(text)
  static escapeMarkdown(text)
  static getQuestionPreview(question, maxChars)
  static getResponsePreview(response, maxWords)
  static getTruncationMessage(shown, total, location)
}
```

---

## Configuration

### Path Configuration

Throughout the documentation, you'll see `<SCARLET_HEART_PATH>` as a placeholder. Replace this with your actual installation path:

**Examples:**
- Linux/macOS: `/home/username/scarlet-heart`
- Windows: `C:\Users\username\scarlet-heart`

**Finding your path:**
```bash
# Navigate to your Claude Code Remote directory
cd scarlet-heart
pwd  # Prints current directory path
```

### Environment Variables

**Slack Configuration:**
```env
SLACK_ENABLED=true
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_SIGNING_SECRET=your-secret
SLACK_CHANNEL_ID=C123          # Optional default channel
SLACK_WHITELIST=C123,U456      # Optional whitelist
SLACK_WEBHOOK_PORT=3002        # Optional custom port
```

**Telegram Configuration:**
```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your-token
TELEGRAM_CHAT_ID=your-chat-id
TELEGRAM_GROUP_ID=your-group-id  # For group chats
TELEGRAM_WEBHOOK_URL=https://your-domain.com
TELEGRAM_FORCE_IPV4=false      # Force IPv4 if needed
```

**Shared Configuration:**
```env
SESSION_MAP_PATH=<SCARLET_HEART_PATH>/src/data/session-map.json
UNIFIED_WEBHOOK_PORT=3001      # Unified server port
LOG_LEVEL=info                 # debug | info | warn | error
```

### Claude Hooks Configuration

**Location Options:**
1. Global: `~/.claude/settings.json`
2. Project: Set `CLAUDE_HOOKS_CONFIG` environment variable

**Configuration Example:**
```json
{
  "hooks": {
    "SubagentStop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node <SCARLET_HEART_PATH>/claude-hook-notify.js init",
        "timeout": 5
      }]
    }],
    "UserPromptSubmit": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node <SCARLET_HEART_PATH>/claude-hook-notify.js working",
        "timeout": 5
      }]
    }],
    "Stop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node <SCARLET_HEART_PATH>/claude-hook-notify.js completed",
        "timeout": 10
      }]
    }]
  }
}
```

**⚠️ Important:** Replace `<SCARLET_HEART_PATH>` with your actual installation path!

---

## Deployment Options

### Development Setup

**Unified Webhook Server (Recommended):**
```bash
npm run webhooks:unified
# All platforms on port 3001
```

**Expose with ngrok:**
```bash
ngrok http 3001
# Use the HTTPS URL for webhook configuration
```

### Production Setup

**Using PM2:**
```bash
pm2 start start-unified-webhook.js --name claude-webhooks
pm2 save
pm2 startup
```

**Using systemd:**
```ini
[Unit]
Description=Claude Code Remote Webhooks
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=<SCARLET_HEART_PATH>
ExecStart=/usr/bin/node <SCARLET_HEART_PATH>/start-unified-webhook.js
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## File Structure

```
scarlet-heart/
├── src/
│   ├── channels/
│   │   ├── base/
│   │   │   └── channel.js           # Base notification channel
│   │   ├── slack/
│   │   │   ├── slack.js             # Slack channel implementation
│   │   │   └── webhook.js           # Slack webhook handler
│   │   ├── telegram/
│   │   │   ├── telegram.js          # Telegram channel implementation
│   │   │   └── webhook.js           # Telegram webhook handler
│   │   ├── email/
│   │   │   └── smtp.js              # Email channel implementation
│   │   ├── line/
│   │   │   ├── line.js
│   │   │   └── webhook.js
│   │   └── local/
│   │       └── desktop.js           # Desktop notifications
│   ├── utils/
│   │   ├── file-system-utils.js     # File operations utility
│   │   ├── json-data-store.js       # JSON storage utility
│   │   ├── string-utils.js          # String manipulation utility
│   │   ├── slack-thread-manager.js  # Slack session management
│   │   ├── subagent-tracker.js      # Subagent tracking
│   │   ├── text-formatter.js        # Text formatting
│   │   ├── tmux-monitor.js          # Tmux conversation extraction
│   │   └── trace-capture.js         # Execution trace
│   ├── data/
│   │   ├── sessions/                # Telegram session files
│   │   └── slack-thread-mappings.json # Slack thread mappings
│   └── core/
│       └── tmux-session-helper.js   # Tmux utilities
├── docs/
│   ├── ARCHITECTURE.md              # This file (overview)
│   ├── SLACK_ARCHITECTURE.md        # Slack-specific architecture
│   └── TELEGRAM_ARCHITECTURE.md     # Telegram-specific architecture
├── claude-hook-notify.js            # Hook entry point
├── start-unified-webhook.js         # Unified webhook server
├── start-slack-webhook.js           # Slack-only server
├── start-telegram-webhook.js        # Telegram-only server
└── .env                             # Configuration
```

---

## Security Overview

### Platform-Specific Security

**Slack:**
- HMAC-SHA256 signature verification
- OAuth 2.0 bot token
- Optional channel/user whitelist
- Session isolation per thread

**Telegram:**
- Bot token authentication
- Chat ID verification
- 8-character random tokens with 24h expiration
- Session file local storage

### General Security Practices

**Data Storage:**
- ✅ Secrets in environment variables (`.env`)
- ✅ No credentials in code or git
- ✅ Session data in local JSON files
- ✅ Automatic cleanup of old sessions

**Network Security:**
- ✅ HTTPS for all webhook communication
- ✅ Signature/token verification
- ✅ Request validation

**Input Sanitization:**
- ✅ Command injection prevention
- ✅ Escape special characters
- ✅ Validate token format

---

## Getting Started

### Quick Start Guide

1. **Create Your Bot**: Follow **[BOT_SETUP.md](./BOT_SETUP.md)** to create S.C.A.R.L.E.T bot
   - Telegram: Use @BotFather to create bot with branding
   - Slack: Create app with proper scopes and branding
2. **Choose Your Platform**: Slack for teams, Telegram for personal use
3. **Read Platform Docs**: See [SLACK_ARCHITECTURE.md](./SLACK_ARCHITECTURE.md) or [TELEGRAM_ARCHITECTURE.md](./TELEGRAM_ARCHITECTURE.md)
4. **Configure Environment**: Set up `.env` file with bot credentials
5. **Configure Hooks**: Set up Claude Code hooks
6. **Start Webhook Server**: Run unified server or platform-specific
7. **Test Integration**: Send a test notification

### Next Steps

- **Bot Setup**: Follow [BOT_SETUP.md](./BOT_SETUP.md) to create S.C.A.R.L.E.T bot with proper branding
- **Slack Users**: Read [SLACK_ARCHITECTURE.md](./SLACK_ARCHITECTURE.md) for detailed architecture
- **Telegram Users**: Read [TELEGRAM_ARCHITECTURE.md](./TELEGRAM_ARCHITECTURE.md) for detailed architecture
- **Advanced**: Explore deployment options and scaling strategies

---

## Support and Troubleshooting

### Platform-Specific Issues

- **Slack**: See [SLACK_ARCHITECTURE.md - Troubleshooting](./SLACK_ARCHITECTURE.md#troubleshooting)
- **Telegram**: See [TELEGRAM_ARCHITECTURE.md - Troubleshooting](./TELEGRAM_ARCHITECTURE.md#troubleshooting)

### General Issues

**Hooks not firing?**
```bash
# Check hooks configuration
cat ~/.claude/settings.json
# or
echo $CLAUDE_HOOKS_CONFIG

# Test manually
node <SCARLET_HEART_PATH>/claude-hook-notify.js completed
```

**Commands not executing?**
```bash
# Check tmux session
tmux list-sessions

# Test injection
tmux send-keys -t <session-name> "echo test" C-m
```

---

## Contributing

Found a bug or have a feature request?

- 🐛 **Issues**: [GitHub Issues](https://github.com/JessyTsui/scarlet-heart/issues)
- 💬 **Discussions**: Share your use cases and improvements
- 📖 **Documentation**: Help improve these docs

---

**Version:** 2.0
**Last Updated:** 2025-01-20
**Maintainers:** Claude Code Remote Contributors

**📚 Detailed Platform Documentation:**
- **[Slack Architecture](./SLACK_ARCHITECTURE.md)** - Complete Slack integration guide
- **[Telegram Architecture](./TELEGRAM_ARCHITECTURE.md)** - Complete Telegram integration guide
