# Slack Integration - Architecture Documentation

## Overview

Slack integration uses a **thread-based persistent sessions** architecture, where each Slack conversation thread maps to a dedicated Claude Code session that runs continuously throughout the conversation.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Key Components](#key-components)
3. [Message Flow](#message-flow)
4. [Data Storage](#data-storage)
5. [Session Management](#session-management)
6. [Security](#security)
7. [Setup Guide](#setup-guide)
8. [API Reference](#api-reference)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Architecture Type: Thread-Based Persistent Sessions

Each Slack thread (or DM conversation) is mapped to a unique tmux session running a dedicated Claude Code instance. This provides:

- **Persistent Context**: Conversations maintain state across multiple messages
- **Thread Isolation**: Each thread has its own isolated workspace
- **Natural Flow**: Users interact via familiar @mentions
- **Local Access**: Developers can attach to sessions for debugging

### Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                        Slack Workspace                         │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Channel: #engineering                                    │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │  Thread (ts: 1705573200.123456)                    │  │ │
│  │  │  ────────────────────────────────                  │  │ │
│  │  │  👤 User: @claude analyze this code                │  │ │
│  │  │  🤖 Bot: ✅ Started new Claude session            │  │ │
│  │  │  👤 User: @claude add error handling               │  │ │
│  │  │  🤖 Bot: 💬 Message sent to Claude                │  │ │
│  │  │  🤖 Bot: ✅ Claude Task Completed [Block Kit]     │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS Webhook
                              ▼
┌────────────────────────────────────────────────────────────────┐
│              Slack Webhook Handler (Port 3002)                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  • Signature verification (signing secret)               │ │
│  │  • Event routing (app_mention, message.im)              │ │
│  │  • Thread context extraction                            │ │
│  │  • Command parsing                                       │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────┬──────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────┐
│                  Slack Thread Manager                          │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Thread Mapping: C1234567890:1705573200.123456           │ │
│  │  {                                                        │ │
│  │    sessionName: "slack-C1234567890-1705573200123",       │ │
│  │    channelId: "C1234567890",                             │ │
│  │    threadTs: "1705573200.123456",                        │ │
│  │    workingDir: "/path/to/project",                       │ │
│  │    createdAt: "2025-01-18T10:30:00.000Z"                 │ │
│  │  }                                                        │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────┬──────────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            │                           │
            ▼                           ▼
    ┌──────────────┐          ┌──────────────────┐
    │  NEW THREAD  │          │ EXISTING THREAD  │
    └──────┬───────┘          └──────┬───────────┘
           │                         │
           ▼                         ▼
┌────────────────────┐    ┌──────────────────────┐
│ Create tmux session│    │ Find existing session│
│ slack-C123-456789  │    │ slack-C123-456789    │
│                    │    │                      │
│ Start Claude with  │    │ Inject message to    │
│ /bg-workflow       │    │ running Claude       │
│                    │    │                      │
│ Include thread     │    │ Preserve context     │
│ history as context │    │ automatically        │
└────────┬───────────┘    └──────┬───────────────┘
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │  Persistent tmux       │
        │  Claude Session        │
        │  ─────────────────     │
        │  • Continuous context  │
        │  • Locally attachable  │
        │  • Isolated workspace  │
        └────────────────────────┘
```

---

## Key Components

### 1. Slack Webhook Handler

**File:** `src/channels/slack/webhook.js`

**Responsibilities:**
- Receives webhook events from Slack
- Verifies request signatures using signing secret
- Handles `app_mention` and `message.im` events
- Adds emoji reactions for user feedback (👀 → ⏳)
- Manages periodic session cleanup

**Key Methods:**
```javascript
class SlackWebhookHandler {
  async handleAppMention(event)    // Process @bot mentions
  async handleDirectMessage(event) // Process DMs
  async _verifyRequest(req)        // Verify Slack signature
  async _addReaction(channel, ts, emoji)
  async _removeReaction(channel, ts, emoji)
}
```

### 2. Slack Thread Manager

**File:** `src/utils/slack-thread-manager.js`

**Responsibilities:**
- Maps Slack threads to tmux sessions
- Creates/finds sessions per thread
- Starts Claude with `/bg-workflow` command
- Includes thread history as context
- Handles session lifecycle and cleanup
- Auto-cleanup of idle sessions (default: 24h)

**Key Methods:**
```javascript
class SlackThreadManager {
  getOrCreateSession(channelId, threadTs)
  getSession(channelId, threadTs)
  sendToSession(sessionName, message)
  startClaudeInSession(sessionName, command)
  removeSession(channelId, threadTs)
  cleanupStaleMappings()
  cleanupIdleSessions(maxAgeHours)
  startPeriodicCleanup(intervalHours, maxAgeHours)
}
```

### 3. Slack Channel

**File:** `src/channels/slack/slack.js`

**Responsibilities:**
- Formats responses using Slack Block Kit
- Sends thread responses
- Smart code block detection
- Manages emoji reactions
- Updates messages

**Key Methods:**
```javascript
class SlackChannel {
  async sendToThread(channelId, threadTs, notification)
  async updateMessage(channelId, messageTs, text)
  async addReaction(channelId, messageTs, emoji)
  async removeReaction(channelId, messageTs, emoji)
  _formatResponseWithCodeBlocks(text)
}
```

---

## Message Flow

### Sequence 1: First Mention in Thread

```
1. User mentions @bot in Slack thread
   │
2. Slack → Webhook Handler (HTTPS POST)
   │
3. Webhook verifies signature, extracts:
   │  • Channel ID
   │  • Thread timestamp
   │  • User message
   │  • Thread history
   │
4. Thread Manager checks mapping
   │  → Not found: NEW thread
   │
5. Create tmux session:
   │  tmux new-session -d -s slack-C123-456789
   │
6. Start Claude in session:
   │  /bg-workflow <user message + thread context>
   │
7. Save thread mapping to JSON
   │
8. Reply to Slack thread:
   │  ✅ Started new Claude session
   │  💻 Session: slack-C123-456789
   │
9. Claude works in background...
   │
10. Stop hook fires → Send formatted response
```

### Sequence 2: Continuing Conversation

```
1. User mentions @bot in SAME thread
   │
2. Slack → Webhook Handler
   │
3. Thread Manager finds existing mapping
   │  → Session: slack-C123-456789
   │
4. Inject message to existing session:
   │  tmux send-keys -t slack-C123-456789 "<message>" C-m
   │
5. Claude processes in same session
   │  (Context already preserved)
   │
6. Reply to thread:
   │  💬 Message sent to Claude
   │
7. Stop hook fires → Send response
```

### Stop Hook Integration

When Claude completes a task, the Stop hook (`claude-hook-notify.js`) detects the `slack-` session prefix and:

1. Loads thread mapping from JSON
2. Extracts conversation from tmux using TmuxMonitor
3. Formats response with Block Kit
4. Sends to original Slack thread

**Hook Configuration:**
```json
{
  "hooks": {
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

---

## Data Storage

### Thread Mappings

**File:** `src/data/slack-thread-mappings.json`

```json
{
  "C1234567890:1705573200.123456": {
    "sessionName": "slack-C1234567890-1705573200123",
    "channelId": "C1234567890",
    "threadTs": "1705573200.123456",
    "workingDir": "/path/to/project",
    "createdAt": "2025-01-18T10:30:00.000Z"
  }
}
```

### Session Naming Convention

```
slack-{sanitized-channel-id}-{sanitized-thread-ts}

Example: slack-C1234567890-1705573200123
```

---

## Session Management

### Session Lifecycle

**1. Creation** (First mention in thread)
- New tmux session created
- Claude started with `/bg-workflow` command
- Thread history included as context
- Mapping saved to JSON

**2. Active** (Ongoing conversation)
- Messages injected into same Claude session
- Context maintained automatically
- Session persists until cleanup

**3. Cleanup** (Manual or automatic)
- Tmux session terminated
- Mapping removed from JSON
- Resources freed

### Automatic Cleanup

**Periodic Cleanup:**
```javascript
// In webhook handler startup
threadManager.startPeriodicCleanup(
  6,  // Check every 6 hours
  24  // Remove sessions older than 24 hours
);
```

**Stale Mapping Cleanup:**
- Runs on webhook server startup
- Removes mappings where tmux session no longer exists

### Manual Cleanup

**User Command:**
```
@bot cleanup
```

**Response:**
```
✅ Session cleaned up
Terminated session: slack-C123-456789
```

### Local Access

```bash
# List all Slack tmux sessions
tmux list-sessions | grep slack-

# Attach to specific session
tmux attach -t slack-C1234567890-1705573200123

# Detach without killing (Ctrl+B, then D)
```

---

## Security

### Authentication Layers

**1. Signing Secret Verification**
- All webhook requests verified using HMAC-SHA256
- Timestamp validation (5-minute window)
- Prevents replay attacks

**2. Bot Token Authorization**
- OAuth 2.0 bot token
- Scope-based permissions
- Token rotation supported

**3. Whitelist Control** (Optional)
```env
SLACK_WHITELIST=C1234567890,U0987654321
```
- Restrict to specific channels
- Restrict to specific users
- Deny by default if configured

**4. Session Isolation**
- Each thread has unique tmux session
- No cross-thread data leakage
- Local filesystem permissions

---

## Setup Guide

> **📖 Comprehensive Setup Guide Available**
>
> For detailed bot setup instructions including branding (S.C.A.R.L.E.T name and profile picture), see **[BOT_SETUP.md](./BOT_SETUP.md#slack-bot-setup)**.
>
> The guide below provides a quick reference. For first-time setup, we recommend following the detailed guide.

### 1. Create Slack App

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name your app: **S.C.A.R.L.E.T** (Smart Claude Assistant for Remote Execution & Live Tracking)
4. Select your workspace

### 2. Configure OAuth Scopes

Navigate to "OAuth & Permissions" and add these Bot Token Scopes:

**Required:**
- `app_mentions:read` - Receive @mentions in channels
- `im:history` - View direct messages
- `im:read` - View direct message info
- `chat:write` - Send messages
- `channels:history` - Read channel thread history
- `groups:history` - Read private channel thread history
- `reactions:write` - Add emoji reactions (for user feedback)

### 3. Enable Event Subscriptions

1. Navigate to "Event Subscriptions"
2. Enable Events
3. Set Request URL to: `https://your-domain.com/webhook/slack`
4. Subscribe to Bot Events:
   - `app_mention` - Mentions in channels
   - `message.im` - Direct messages

### 4. Get Credentials

**Bot Token:** OAuth & Permissions → Bot User OAuth Token
- Format: `xoxb-...`

**Signing Secret:** Basic Information → App Credentials → Signing Secret

### 5. Configure Environment

Add to `.env`:

```env
# Enable Slack
SLACK_ENABLED=true

# Bot credentials
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret

# Optional: Default channel for notifications
SLACK_CHANNEL_ID=C1234567890

# Optional: Whitelist specific channels or users
SLACK_WHITELIST=C1234567890,U0987654321

# Optional: Custom webhook port (default: 3002)
SLACK_WEBHOOK_PORT=3002
```

### 6. Configure Claude Hooks

**Method 1: Global Configuration**

Add to `~/.claude/settings.json`:
```json
{
  "hooks": {
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

**Method 2: Project-Specific**
```bash
export CLAUDE_HOOKS_CONFIG=<SCARLET_HEART_PATH>/claude-hooks.json
```

**⚠️ Important:** Replace `<SCARLET_HEART_PATH>` with your actual installation path (e.g., `/home/user/scarlet-heart`)

### 7. Start Webhook Server

**Option A: Unified Server (Recommended)**
```bash
npm run webhooks:unified
# All platforms on port 3001
```

**Option B: Slack-Only Server**
```bash
npm run slack
# Port 3002
```

### 8. Install App to Workspace

1. Go to "Install App" in Slack app settings
2. Click "Install to Workspace"
3. Authorize the requested permissions

---

## API Reference

### SlackThreadManager

```javascript
const SlackThreadManager = require('./src/utils/slack-thread-manager');
const manager = new SlackThreadManager();

// Get or create session for thread
const { sessionName, isNew, workingDir } =
  manager.getOrCreateSession(channelId, threadTs);

// Get existing session
const session = manager.getSession(channelId, threadTs);
// Returns: { sessionName, workingDir, createdAt } | null

// Send command to session
manager.sendToSession(sessionName, 'your command');

// Start Claude in session
manager.startClaudeInSession(sessionName, '/bg-workflow task');

// Remove session
manager.removeSession(channelId, threadTs);

// Cleanup stale mappings
const cleaned = manager.cleanupStaleMappings();

// Cleanup idle sessions
const removed = manager.cleanupIdleSessions(24); // hours

// Start periodic cleanup
manager.startPeriodicCleanup(6, 24); // check every 6h, max age 24h

// Stop periodic cleanup
manager.stopPeriodicCleanup();
```

### SlackChannel

```javascript
const SlackChannel = require('./src/channels/slack/slack');
const slack = new SlackChannel({
  botToken: 'xoxb-...',
  channelId: 'C123', // optional
  whitelist: ['C123', 'U456'] // optional
});

// Send to thread
await slack.sendToThread(channelId, threadTs, notification);

// Update message
await slack.updateMessage(channelId, messageTs, newText);

// Add reaction
await slack.addReaction(channelId, messageTs, 'eyes');

// Remove reaction
await slack.removeReaction(channelId, messageTs, 'eyes');
```

### SlackWebhookHandler

```javascript
const SlackWebhookHandler = require('./src/channels/slack/webhook');

const handler = new SlackWebhookHandler({
  botToken: 'xoxb-...',
  signingSecret: 'your-secret',
  channelId: 'C1234567890', // optional
  whitelist: ['C1234567890', 'U0987654321'], // optional
  port: 3002
});

handler.start(3002);
```

---

## Troubleshooting

### Bot Not Responding

**1. Check webhook server:**
```bash
curl http://localhost:3002/health
```

**2. Verify Slack event subscription:**
- Go to Slack App → Event Subscriptions
- Check Request URL shows verified ✓
- Ensure events are subscribed

**3. Check logs:**
```bash
# Webhook server logs
tail -f logs/slack-webhook.log
```

### Session Not Found

**1. List active sessions:**
```bash
tmux list-sessions | grep slack-
```

**2. Check mappings file:**
```bash
cat src/data/slack-thread-mappings.json
```

**3. Try cleanup and restart:**
```
@bot cleanup
@bot <new request>
```

### Permissions Errors

**1. Verify OAuth scopes:**
- Check all required scopes are added
- Reinstall app after adding scopes

**2. Check signing secret:**
- Verify `SLACK_SIGNING_SECRET` matches app credentials

### Thread History Not Loading

**1. Add history scopes:**
```
channels:history
groups:history
```

**2. Reinstall app:**
- Slack App → Install App → Reinstall to Workspace

### Reactions Not Appearing

**1. Add reactions scope:**
```
reactions:write
```

**2. Reinstall app:**
- Scopes require reinstallation to take effect

---

## Best Practices

### Development

1. **Use Threads**: Start threads for different tasks to isolate sessions
2. **Test with ngrok**: Use ngrok for local webhook testing
3. **Monitor Sessions**: Keep track of active tmux sessions
4. **Enable Debug Logging**: Use `LOG_LEVEL=debug` for troubleshooting

### Production

1. **Use Process Manager**: Run with PM2 for auto-restart
2. **Configure HTTPS**: Use reverse proxy (nginx/Caddy)
3. **Set up Monitoring**: Monitor webhook health and session count
4. **Regular Cleanup**: Let periodic cleanup run or schedule manual cleanup

### Team Usage

1. **Use Whitelist**: Restrict to authorized channels/users
2. **Document Commands**: Share bot capabilities with team
3. **Monitor Costs**: Track Claude Code usage
4. **Local Debugging**: Teach team to use `tmux attach` for debugging

---

## Performance Considerations

### Resource Usage

- **Memory**: ~50MB per tmux session (Claude process)
- **Disk**: ~1MB per session mapping file
- **CPU**: Low (event-driven, not polling)

### Scalability

**Single Server:**
- Up to ~100 concurrent sessions recommended
- Vertical scaling: More CPU/RAM

**Multi-Server (Advanced):**
- Requires shared session storage (Redis)
- Distributed tmux management
- Load balancer for webhooks

### Rate Limits

**Slack API:**
- Message posting: 1/second per channel
- Reactions: 1/second
- Thread history: 1/minute

**Recommendations:**
- Use reactions sparingly
- Batch thread history reads
- Implement retry logic with backoff

---

## Comparison with Other Platforms

### vs. Telegram

| Feature | Slack | Telegram |
|---------|-------|----------|
| **Architecture** | Thread-based | Token-based |
| **Session Model** | One per thread | Shared session |
| **Context** | Automatic | Manual |
| **Multi-user** | Isolated | Shared |
| **Use Case** | Team collaboration | Personal workflow |

### When to Use Slack

✅ **Best for:**
- Team collaboration
- Multiple parallel tasks
- Long-running interactive sessions
- Conversations requiring context preservation
- Workspace integration

❌ **Not ideal for:**
- Personal use (Telegram better)
- High-volume notifications (rate limits)
- Mobile-first workflows (Telegram better)

---

**Version:** 2.0
**Last Updated:** 2025-01-20
