# Telegram Integration - Architecture Documentation

## Overview

Telegram integration uses a **token-based stateless commands** architecture with a dedicated persistent Claude Code session. All users share a single `claude-session` and commands are identified by unique 8-character tokens.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Key Components](#key-components)
3. [Message Flow](#message-flow)
4. [Data Storage](#data-storage)
5. [Session Management](#session-management)
6. [Security](#security)
7. [Setup Guide](#setup-guide)
8. [Message Formatting](#message-formatting)
9. [API Reference](#api-reference)
10. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Architecture Type: Token-Based Stateless Commands

Telegram uses a shared persistent session (`claude-session`) where all users send commands using unique tokens. This provides:

- **Simplified Session Management**: Single shared Claude session
- **Token-Based Commands**: Each notification generates a unique token
- **24-Hour Token Validity**: Tokens expire automatically
- **Mobile-First Experience**: Optimized for mobile devices
- **Beautiful Formatting**: HTML-based rich formatting

### Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                      Telegram Chat/Group                       │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Chat with Bot                                            │ │
│  │  ──────────────                                           │ │
│  │  🤖 Bot: ✅ Claude Task Completed                        │ │
│  │         📁 Project: MyProject                            │ │
│  │         🔑 Token: AB12CD34                               │ │
│  │         🤖 Claude's Response: [formatted]                │ │
│  │         💬 Send Command: /cmd AB12CD34 <command>         │ │
│  │                                                           │ │
│  │  👤 User: /cmd AB12CD34 analyze this code                │ │
│  │  🤖 Bot: ✅ Command received!                            │ │
│  │         Executing in session: claude-session             │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS Webhook
                              ▼
┌────────────────────────────────────────────────────────────────┐
│             Telegram Webhook Handler (Port 3001)               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  • Message/command routing                               │ │
│  │  • Token extraction from /cmd                            │ │
│  │  • Session verification                                  │ │
│  │  • Group vs personal chat detection                      │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────┬──────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────┐
│                   Session Token Manager                        │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Session File: <uuid>.json                               │ │
│  │  {                                                        │ │
│  │    id: "uuid-v4",                                        │ │
│  │    token: "AB12CD34",                                    │ │
│  │    type: "telegram",                                     │ │
│  │    created: "2025-01-18T10:30:00.000Z",                 │ │
│  │    expires: "2025-01-19T10:30:00.000Z",  // 24h         │ │
│  │    tmuxSession: "claude-session",                        │ │
│  │    project: "MyProject",                                 │ │
│  │    notification: {...}                                   │ │
│  │  }                                                        │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────┬──────────────────────────────────────┘
                          │
                          │ Validate Token
                          ▼
┌────────────────────────────────────────────────────────────────┐
│              Dedicated Telegram Session                        │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  tmux session: claude-session                            │ │
│  │  ──────────────────────────────                          │ │
│  │  • Shared by all Telegram users                          │ │
│  │  • Persistent Claude Code instance                       │ │
│  │  • Auto-created on first notification                    │ │
│  │  • Commands injected via tmux send-keys                  │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. Telegram Webhook Handler

**File:** `src/channels/telegram/webhook.js`

**Responsibilities:**
- Receives webhook updates from Telegram Bot API
- Routes messages and commands
- Handles `/cmd` command parsing
- Detects personal chat vs group chat
- Manages bot mentions in groups

**Key Methods:**
```javascript
class TelegramWebhookHandler {
  async handleUpdate(update)       // Process Telegram updates
  async handleMessage(message)     // Process text messages
  async handleCommand(message)     // Process /cmd commands
  extractToken(text)                // Extract token from command
  isGroupChat(chat)                 // Check if group chat
}
```

### 2. Telegram Channel

**File:** `src/channels/telegram/telegram.js`

**Responsibilities:**
- Generates unique 8-character tokens (uppercase + numbers)
- Creates session records for each notification
- Formats messages using HTML (Telegram's format)
- Smart code detection and language highlighting
- Maintains dedicated `claude-session` tmux session

**Key Methods:**
```javascript
class TelegramChannel {
  async send(notification)
  _generateToken()                  // Generate 8-char token
  _generateTelegramMessage(notification, sessionId, token)
  _formatResponseForHtml(text)      // Smart code detection
  _detectLanguage(code)             // Language detection
  _escapeHtml(text)                 // HTML escaping
  _ensureTelegramSession()          // Ensure claude-session exists
}
```

### 3. Token-Based Session Manager

**Responsibilities:**
- Stores session metadata in JSON files
- Maps tokens to tmux sessions
- Validates token expiration (24 hours)
- Auto-cleanup of expired sessions

**Storage Location:** `src/data/sessions/`

---

## Message Flow

### Sequence 1: Task Completion Notification

```
1. Claude completes task (Stop hook fires)
   │
2. Hook extracts conversation from tmux
   │  • User question
   │  • Claude response
   │
3. Generate unique token: AB12CD34
   │
4. Create session file:
   │  src/data/sessions/<uuid>.json
   │  {
   │    token: "AB12CD34",
   │    tmuxSession: "claude-session",
   │    expires: <24h from now>
   │  }
   │
5. Format Telegram message (HTML):
   │  ✅ Claude Task Completed
   │  🔑 Token: AB12CD34
   │  🤖 Response: [formatted with code blocks]
   │  💬 Send Command: /cmd AB12CD34 <command>
   │
6. Send to Telegram via Bot API
```

### Sequence 2: User Sends Command

```
1. User types: /cmd AB12CD34 analyze this code
   │
2. Telegram → Webhook Handler
   │
3. Extract:
   │  • Token: AB12CD34
   │  • Command: analyze this code
   │  • Chat type: personal/group
   │
4. Validate token:
   │  • Load session file
   │  • Check expiration
   │  • Verify token matches
   │
5. Get tmux session from mapping:
   │  Session: claude-session
   │
6. Inject command to Claude:
   │  tmux send-keys -t claude-session "analyze this code" C-m
   │
7. Reply to user:
   │  ✅ Command received!
   │  Executing in session: claude-session
   │
8. Claude processes command...
   │
9. Stop hook fires → New notification with new token
```

### Stop Hook Integration

When Claude completes a task, the Stop hook (`claude-hook-notify.js`) detects the `claude-session` and:

1. Generates a unique 8-character token
2. Creates session file with token mapping
3. Extracts conversation from tmux using TmuxMonitor
4. Formats message with HTML
5. Sends to configured Telegram chat/group

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

### Session Files

**Location:** `src/data/sessions/<uuid>.json`

**Structure:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "token": "AB12CD34",
  "type": "telegram",
  "created": "2025-01-18T10:30:00.000Z",
  "expires": "2025-01-19T10:30:00.000Z",
  "createdAt": 1705573800,
  "expiresAt": 1705660200,
  "tmuxSession": "claude-session",
  "project": "MyProject",
  "notification": {
    "type": "completed",
    "message": "Task completed",
    "metadata": {
      "userQuestion": "analyze this",
      "claudeResponse": "I've analyzed...",
      "tmuxSession": "claude-session"
    }
  }
}
```

### Token Format

- **Length**: 8 characters
- **Character Set**: Uppercase letters (A-Z) + Numbers (0-9)
- **Examples**: `AB12CD34`, `XY789ZAB`, `QW456RST`
- **Uniqueness**: High probability (36^8 = 2.8 trillion combinations)

---

## Session Management

### Dedicated Session

**Session Name:** `claude-session`

**Characteristics:**
- Shared by all Telegram users
- Auto-created on first notification
- Persistent across notifications
- Single Claude Code instance

**Creation:**
```javascript
// Automatically created by TelegramChannel constructor
_ensureTelegramSession() {
  const result = tmuxHelper.ensureSession('claude-session');
  if (result.created) {
    tmuxHelper.startClaude('claude-session');
  }
}
```

### Token Lifecycle

**1. Generation** (On task completion)
- Unique 8-character token created
- Session file saved to disk

**2. Validation** (On command)
- Token extracted from `/cmd` command
- Session file loaded
- Expiration checked (24 hours)

**3. Expiration**
- Automatic after 24 hours
- Session files can be cleaned up
- New notifications generate new tokens

### Local Access

```bash
# Attach to Telegram session
tmux attach -t claude-session

# Detach without killing (Ctrl+B, then D)

# Check if session exists
tmux has-session -t claude-session
```

---

## Security

### Authentication Layers

**1. Bot Token Authentication**
- Secret bot token for API access
- HTTPS-only communication
- Never exposed to users

**2. Chat ID Verification**
- Only configured chat/group receives notifications
- Webhook validates sender

**3. Token-Based Authorization**
- 8-character random tokens
- 24-hour expiration
- One-time use recommended

**4. Session File Security**
- Stored locally with filesystem permissions
- No sensitive data in tokens
- Auto-cleanup of expired sessions

### Network Configuration

**Force IPv4 Option:**
```env
TELEGRAM_FORCE_IPV4=true
```

**When to use:**
- Connection timeouts or failures
- Inconsistent webhook delivery
- Network environments without proper IPv6 support

---

## Setup Guide

> **📖 Comprehensive Setup Guide Available**
>
> For detailed bot setup instructions including branding (S.C.A.R.L.E.T name and profile picture), see **[BOT_SETUP.md](./BOT_SETUP.md#telegram-bot-setup)**.
>
> The guide below provides a quick reference. For first-time setup, we recommend following the detailed guide.

### 1. Create Telegram Bot

**Using BotFather:**
1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot`
3. Set name: **S.C.A.R.L.E.T** (Smart Claude Assistant for Remote Execution & Live Tracking)
4. Set username ending in 'bot' (e.g., `scarlet_claude_bot`)
5. Save the bot token (format: `123456:ABC-DEF1234...`)

**Quick Setup Script:**
```bash
chmod +x setup-telegram.sh
./setup-telegram.sh
```

### 2. Get Your Chat ID

**Method 1: Using Bot API**
1. Start a chat with your bot
2. Send any message
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Find `"chat":{"id":...}` in the JSON response

**Method 2: Using IDBot**
1. Message [@myidbot](https://t.me/myidbot) on Telegram
2. Send `/getid`
3. Save your chat ID

### 3. Configure Webhook URL

**For local testing (using ngrok):**
```bash
# Start ngrok
ngrok http 3001

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)

# Set webhook
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=https://abc123.ngrok.io/webhook/telegram"
```

**For production:**
```bash
# Set your production URL
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=https://your-domain.com/webhook/telegram"
```

### 4. Configure Environment

Add to `.env`:

```env
# Enable Telegram
TELEGRAM_ENABLED=true

# Bot credentials
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_CHAT_ID=123456789

# Optional: Group ID for group notifications
TELEGRAM_GROUP_ID=-1001234567890

# Webhook URL
TELEGRAM_WEBHOOK_URL=https://your-domain.com

# Optional: Force IPv4 (default: false)
TELEGRAM_FORCE_IPV4=false
```

### 5. Configure Claude Hooks

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

### 6. Start Webhook Server

**Option A: Unified Server (Recommended)**
```bash
npm run webhooks:unified
# All platforms on port 3001
```

**Option B: Telegram-Only Server**
```bash
npm run telegram
# Port 3001
```

### 7. Test Setup

```bash
# Test notification manually
node claude-hook-notify.js completed

# You should receive a Telegram message with:
# - Task completion notification
# - 8-character token
# - Command format example
```

---

## Message Formatting

### HTML Format

Telegram uses HTML for rich formatting. Our implementation includes:

- **Blockquotes** for sections
- **Code blocks** with `<pre><code>`
- **Bold** with `<b>`
- **Inline code** with `<code>`
- **Italic** with `<i>`

### Example Formatted Message

```html
✅ <b>Claude Task Completed</b>

📁 <b>Project</b>
<blockquote><code>MyProject</code></blockquote>

🔑 <b>Token</b>
<blockquote><code>AB12CD34</code></blockquote>

📝 <b>Your Request</b>
<blockquote>analyze the authentication system</blockquote>

🤖 <b>Claude's Response</b>
<blockquote><pre><code>function authenticate(user) {
  // Code with syntax highlighting
  return jwt.sign(user);
}</code></pre>

I've analyzed the authentication system...

<i>💡 Showing last 100 of 250 words</i>
<i>Full response in tmux session</i></blockquote>

📊 <b>Session Details</b>
<blockquote>💻 <code>claude-session</code>
🔗 <code>tmux attach -t claude-session</code>
🕐 Jan 19, 02:45:30 PM</blockquote>

💬 <b>Send Command</b>
<blockquote><code>/cmd AB12CD34</code></blockquote>
<blockquote><i>Group: <code>@mybot /cmd AB12CD34</code></i></blockquote>
```

### Smart Code Detection

**Detection Criteria:**
- Lines with 2+ space indentation
- Code structure characters: `{}[]();=`
- Programming keywords: `function`, `const`, `let`, `var`, `class`, `def`, etc.
- Code operators: `->`, `=>`, `::`, `<-`

**Threshold:** If >30% of lines look like code, wrap in `<pre><code>` block

### Language Detection

**Supported Languages:**
- JavaScript / TypeScript
- Python
- Bash / Shell
- JSON
- HTML
- CSS
- Go
- Rust
- Java

**Detection Method:**
```javascript
_detectLanguage(code) {
  // JavaScript/TypeScript
  if (code.match(/\b(const|let|var|function|=>|async)\b/)) {
    return 'javascript';
  }

  // Python
  if (code.match(/\b(def|class|import|from|self)\b/)) {
    return 'python';
  }

  // ... more languages
}
```

### Preview Length

- **Default**: Last 100 words
- **Truncation Notice**: Shows word count if truncated
- **Full Response**: Available in tmux session

---

## API Reference

### TelegramChannel

```javascript
const TelegramChannel = require('./src/channels/telegram/telegram');

const telegram = new TelegramChannel({
  botToken: 'your-token',
  chatId: 'your-chat-id',
  groupId: 'your-group-id',  // Optional
  forceIPv4: false           // Optional
});

// Send notification (creates token automatically)
await telegram.send(notification);
```

### Token Generation

```javascript
// Generate 8-character token
_generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
```

### Session Validation

```javascript
// Validate token from command
async validateToken(token) {
  // Find session file with matching token
  const sessionFiles = fs.readdirSync('src/data/sessions/');

  for (const file of sessionFiles) {
    const session = JSON.parse(fs.readFileSync(`src/data/sessions/${file}`));

    if (session.token === token) {
      // Check expiration
      if (Date.now() < session.expiresAt * 1000) {
        return session;
      }
    }
  }

  return null;
}
```

---

## Troubleshooting

### Bot Not Receiving Messages

**1. Check webhook status:**
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

**Expected response:**
```json
{
  "ok": true,
  "result": {
    "url": "https://your-domain.com/webhook/telegram",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "last_error_date": 0
  }
}
```

**2. Test bot API:**
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/sendMessage" \
  -H "Content-Type: application/json" \
  -d "{\"chat_id\": \"<YOUR_CHAT_ID>\", \"text\": \"Test\"}"
```

**3. Check webhook server logs:**
```bash
# If using unified server
tail -f logs/unified-webhook.log

# If using Telegram-only server
tail -f logs/telegram-webhook.log
```

### Token Not Working

**1. Check session files exist:**
```bash
ls -la src/data/sessions/
```

**2. Verify token not expired:**
```bash
# Find session file
cat src/data/sessions/<uuid>.json | grep expires

# Check expiration timestamp
# If expiresAt < current timestamp, token is expired
```

**3. Request new notification:**
- Complete a new task in Claude
- New notification will have fresh token

### IPv6 Connection Issues

**Symptoms:**
- Timeout errors when sending messages
- Inconsistent webhook delivery
- Connection failures

**Solution:**
```env
TELEGRAM_FORCE_IPV4=true
```

This forces all Telegram API connections to use IPv4.

### Commands Not Executing

**1. Verify tmux session exists:**
```bash
tmux has-session -t claude-session
echo $?  # Should print 0
```

**2. Test injection manually:**
```bash
tmux send-keys -t claude-session "echo test" C-m
```

**3. Check Claude is running:**
```bash
tmux attach -t claude-session
# Ctrl+B, D to detach
```

### Group Chat Issues

**In groups, bot needs to be mentioned:**
```
# Correct
@mybotname /cmd AB12CD34 analyze code

# Incorrect (won't work in groups)
/cmd AB12CD34 analyze code
```

**Privacy Mode:**
- Telegram bots in groups have privacy mode enabled by default
- Bot only sees messages that mention it
- Disable privacy mode in BotFather if needed (not recommended)

---

## Best Practices

### Development

1. **Use ngrok for Testing**: Easy HTTPS tunnel for local development
2. **Test Token Expiration**: Verify 24-hour expiration works correctly
3. **Monitor Session Files**: Clean up old sessions regularly
4. **Enable Debug Logging**: Use `LOG_LEVEL=debug` for troubleshooting

### Production

1. **Use Process Manager**: Run with PM2 for auto-restart
2. **Configure HTTPS**: Use reverse proxy or direct HTTPS
3. **Monitor Webhook Health**: Check `/getWebhookInfo` regularly
4. **Set up Log Rotation**: Prevent disk space issues

### Security

1. **Protect Bot Token**: Never commit to git, use `.env`
2. **Restrict Chat IDs**: Only configure authorized chats
3. **Regular Cleanup**: Remove expired session files
4. **Monitor Usage**: Watch for unauthorized access attempts

### User Experience

1. **Clear Instructions**: Include command format in every notification
2. **Token Visibility**: Make tokens easy to copy (use code format)
3. **Error Messages**: Provide helpful feedback for invalid tokens
4. **Response Times**: Keep Claude tasks reasonably scoped

---

## Performance Considerations

### Resource Usage

- **Memory**: ~50MB for single shared Claude session
- **Disk**: ~1KB per session file
- **CPU**: Low (event-driven)

### Scalability

**Advantages:**
- Single session = lower resource usage
- Unlimited concurrent users
- Simple scaling (vertical)

**Limitations:**
- No conversation context preservation
- Commands execute sequentially
- Shared session state

### Rate Limits

**Telegram API:**
- Message sending: ~30 messages/second
- Bot API calls: No strict limit (fair use)

**Recommendations:**
- Batch notifications if possible
- Implement retry logic
- Monitor API errors

---

## Comparison with Other Platforms

### vs. Slack

| Feature | Telegram | Slack |
|---------|----------|-------|
| **Architecture** | Token-based | Thread-based |
| **Session Model** | Shared session | One per thread |
| **Context** | Manual | Automatic |
| **Multi-user** | Shared | Isolated |
| **Use Case** | Personal workflow | Team collaboration |

### When to Use Telegram

✅ **Best for:**
- Personal development workflow
- Mobile-first access
- Quick command/response pattern
- Simple notification system
- Individual developers

❌ **Not ideal for:**
- Team collaboration (Slack better)
- Context-heavy conversations
- Parallel task execution
- Code reviews requiring discussion

---

**Version:** 2.0
**Last Updated:** 2025-01-20
