# Slack Integration - Tmux Mode

The Slack integration for Claude Code Remote uses a **thread-based tmux session architecture** that provides persistent, isolated Claude sessions for each Slack conversation thread.

## Architecture Overview

### Key Concepts

1. **Thread-to-Tmux Mapping**: Each Slack thread (or DM conversation) is mapped to a unique tmux session
2. **Persistent Sessions**: Claude sessions remain active throughout the conversation
3. **Automatic Context**: Thread history is automatically included as context for new sessions
4. **Background Workflow**: First mention starts Claude with `/bg-workflow` command

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                     Slack Thread/DM                          │
│  @bot Implement user authentication                          │
│  @bot Add error handling                                     │
│  @bot status                                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Slack Webhook   │
                    │    Handler      │
                    └─────────────────┘
                              │
                              ▼
                  ┌──────────────────────┐
                  │ Thread Manager       │
                  │ - Maps thread to     │
                  │   tmux session       │
                  │ - Creates or finds   │
                  │   existing session   │
                  └──────────────────────┘
                              │
                              ▼
        ┌──────────────────────────────────────┐
        │                                      │
        │  NEW THREAD           EXISTING THREAD│
        ▼                                      ▼
┌────────────────┐                  ┌──────────────────┐
│ Create Tmux    │                  │ Inject message   │
│ Session        │                  │ to existing      │
│ Start Claude   │                  │ Claude session   │
│ with /bg-      │                  │                  │
│ workflow       │                  │                  │
└────────────────┘                  └──────────────────┘
        │                                      │
        └──────────────────┬───────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ Persistent Claude      │
              │ Session in Tmux        │
              │                        │
              │ - Isolated workspace   │
              │ - Continuous context   │
              │ - Locally attachable   │
              └────────────────────────┘
```

## Features

### 1. Persistent Conversations
- Each Slack thread maintains its own Claude session
- Context is preserved across multiple messages
- No need to repeat information

### 2. Automatic Background Workflow
- First mention automatically starts `/bg-workflow`
- Claude works in isolated tmux session
- Background execution with monitoring

### 3. Thread History Context
- Automatically captures and includes thread conversation history
- Claude understands the full context of the discussion
- Seamless continuation of multi-turn conversations

### 4. Local Access
- Attach to tmux sessions locally: `tmux attach -t <session-name>`
- View Claude's progress in real-time
- Debug or intervene manually when needed

### 5. Simple Commands
- `@bot <request>` - Start or continue conversation
- `@bot status` - Check session status
- `@bot cleanup` - Terminate session
- `@bot help` - Show help message

## Setup

### 1. Create Slack App

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name your app and select your workspace

### 2. Configure OAuth Scopes

Navigate to "OAuth & Permissions" and add these Bot Token Scopes:

**Required Scopes:**
- `app_mentions:read` - Receive @mentions in channels
- `im:history` - View direct messages
- `im:read` - View direct message info
- `chat:write` - Send messages
- `channels:history` - Read channel thread history
- `groups:history` - Read private channel thread history

### 3. Enable Event Subscriptions

1. Navigate to "Event Subscriptions"
2. Enable Events
3. Set Request URL to: `https://your-domain.com/webhook/slack`
4. Subscribe to Bot Events:
   - `app_mention` - Mentions in channels
   - `message.im` - Direct messages

### 4. Get Credentials

1. **Bot Token**: OAuth & Permissions → Bot User OAuth Token
   - Format: `xoxb-...`

2. **Signing Secret**: Basic Information → App Credentials → Signing Secret

### 5. Configure Environment

Add to your `.env` file:

```bash
# Enable Slack
SLACK_ENABLED=true

# Bot credentials
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret

# Optional: Default channel for simple notifications
SLACK_CHANNEL_ID=C1234567890

# Optional: Whitelist specific channels or users
SLACK_WHITELIST=C1234567890,U0987654321

# Optional: Custom webhook port (default: 3002)
SLACK_WEBHOOK_PORT=3002
```

### 6. Start the Webhook Server

```bash
# Start Slack webhook server
node start-slack-webhook.js

# Or use the unified webhook (recommended)
node start-unified-webhook.js
```

### 7. Install the App

1. Go to "Install App" in your Slack app settings
2. Click "Install to Workspace"
3. Authorize the requested permissions

## Usage Examples

### Basic Conversation in Thread

```
# User starts a thread
@ClaudeBot Implement user authentication with JWT tokens

# Claude creates tmux session and starts working
# Bot replies: ✅ Started new Claude session
#              💻 Session: slack-C1234-1234567890
#              📝 Task: Implement user authentication...

# User follows up in the same thread
@ClaudeBot Add refresh token support

# Claude continues in the same session
# Bot replies: 💬 Message sent to Claude
#              💻 Session: slack-C1234-1234567890
#              📝 Message: Add refresh token support...
```

### Check Status

```
@ClaudeBot status

# Bot replies:
# ✅ Active Claude Session
# 💻 Session: slack-C1234-1234567890
# 🕐 Created: 2025-01-18 10:30:00
# 🔍 Status: Running: claude
# To attach locally: tmux attach -t slack-C1234-1234567890
```

### Cleanup Session

```
@ClaudeBot cleanup

# Bot replies:
# ✅ Session cleaned up
# Terminated session: slack-C1234-1234567890
```

### Direct Messages (DM)

```
# Send DM to bot (no @ mention needed)
Implement user authentication with JWT tokens

# Bot creates session and replies
# Each DM conversation has its own isolated session
```

### Help

```
@ClaudeBot help

# Bot shows comprehensive help message
```

## Session Management

### Session Naming

Tmux sessions are named using the pattern:
```
slack-{sanitized-channel-id}-{sanitized-thread-ts}
```

Example: `slack-C1234567890-1705573200123`

### Session Lifecycle

1. **Creation**: When bot is first mentioned in a thread
   - New tmux session created
   - Claude started with `/bg-workflow` command
   - Thread history included as context

2. **Active**: While thread conversation continues
   - Messages are injected into the same Claude session
   - Context is maintained
   - Session persists until cleanup

3. **Cleanup**: When user runs `cleanup` command or manually kills tmux
   - Tmux session terminated
   - Mapping removed
   - Resources freed

### Local Access

Attach to any active session:

```bash
# List all tmux sessions
tmux list-sessions

# Attach to specific Slack session
tmux attach -t slack-C1234567890-1705573200123

# Detach without killing
# Press: Ctrl+B, then D
```

## Thread Mappings

Thread mappings are stored in:
```
src/data/slack-thread-mappings.json
```

Example mapping:
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

### Cleanup Stale Mappings

Stale mappings (where tmux session no longer exists) are automatically cleaned:
- On webhook server startup
- When attempting to access a non-existent session

Manual cleanup:
```javascript
const SlackThreadManager = require('./src/utils/slack-thread-manager');
const manager = new SlackThreadManager();
const cleaned = manager.cleanupStaleMappings();
console.log(`Cleaned ${cleaned} stale mappings`);
```

## Comparison with Telegram Approach

### Old Approach (Telegram-style)
- ❌ Token-based system
- ❌ Stateless command injection
- ❌ Requires notifications with tokens
- ❌ No persistent conversation context
- ❌ User needs to track tokens

### New Approach (Tmux-based)
- ✅ Thread-based persistent sessions
- ✅ Stateful conversation in tmux
- ✅ Direct interaction via @mentions
- ✅ Automatic context preservation
- ✅ Natural conversation flow
- ✅ Locally attachable for debugging

## Advanced Configuration

### Whitelist Configuration

**Allow specific channels only:**
```bash
SLACK_WHITELIST=C1234567890,C0987654321
```

**Allow specific users (enables DM access):**
```bash
SLACK_WHITELIST=U1234567890,U0987654321
```

**Combined (channels and users):**
```bash
SLACK_WHITELIST=C1234567890,U0987654321,C9999999999
```

**No restrictions (allow all):**
```bash
# Don't set SLACK_WHITELIST or SLACK_CHANNEL_ID
```

### Custom Working Directory

By default, tmux sessions are created in the current working directory. To customize:

```javascript
// Modify SlackThreadManager._ensureDirectories()
_generateSessionOptions(channelId, threadTs) {
    return {
        workingDir: '/custom/path/for/slack/sessions'
    };
}
```

## Troubleshooting

### Bot Not Responding

1. **Check webhook server is running:**
   ```bash
   curl http://localhost:3002/health
   ```

2. **Verify Slack event subscription:**
   - Go to Slack App → Event Subscriptions
   - Check Request URL shows verified ✓
   - Ensure events are subscribed

3. **Check logs:**
   ```bash
   # Webhook server logs
   tail -f logs/slack-webhook.log
   ```

### Session Not Found

1. **List active sessions:**
   ```bash
   tmux list-sessions | grep slack-
   ```

2. **Check mappings file:**
   ```bash
   cat src/data/slack-thread-mappings.json
   ```

3. **Try cleanup and restart:**
   ```
   @bot cleanup
   @bot <new request>
   ```

### Permissions Errors

1. **Verify OAuth scopes:**
   - Check all required scopes are added
   - Reinstall app after adding scopes

2. **Check signing secret:**
   - Verify `SLACK_SIGNING_SECRET` matches app credentials

### Thread History Not Loading

1. **Add history scopes:**
   ```
   channels:history
   groups:history
   ```

2. **Reinstall app:**
   - Slack App → Install App → Reinstall to Workspace

## Best Practices

1. **Use Threads**: Start threads for different tasks to isolate sessions
2. **Cleanup When Done**: Run `cleanup` to free resources after task completion
3. **Check Status**: Use `status` to verify Claude is still working
4. **Local Debugging**: Attach to tmux when needed to see detailed progress
5. **Monitor Resources**: Keep track of active sessions, cleanup old ones

## API Reference

### SlackThreadManager

```javascript
const SlackThreadManager = require('./src/utils/slack-thread-manager');
const manager = new SlackThreadManager();

// Get or create session for thread
const session = manager.getOrCreateSession(channelId, threadTs);
// Returns: { sessionName, isNew, workingDir }

// Get existing session
const existing = manager.getSession(channelId, threadTs);
// Returns: { sessionName, workingDir, createdAt } or null

// Send command to session
manager.sendToSession(sessionName, 'your message here');

// Start Claude in session
manager.startClaudeInSession(sessionName, '/bg-workflow task description');

// Remove session
manager.removeSession(channelId, threadTs);

// Cleanup stale mappings
const cleaned = manager.cleanupStaleMappings();

// List active sessions
const active = manager.listActiveSessions();
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

## Security Considerations

1. **Keep Signing Secret Safe**: Never commit to git
2. **Use Whitelist**: Restrict access to specific channels/users
3. **HTTPS Required**: Slack requires HTTPS for webhooks
4. **Validate Requests**: Signing secret validation is enabled by default
5. **Session Isolation**: Each thread has isolated tmux session

## Future Enhancements

Potential improvements for consideration:

- [ ] Session timeout/auto-cleanup after inactivity
- [ ] Session pause/resume functionality
- [ ] Rich formatting for Claude responses in Slack
- [ ] File upload support
- [ ] Multi-project support with project selection
- [ ] Session analytics and monitoring dashboard
- [ ] Slack slash commands for advanced features

## License

Same as parent project - Claude Code Remote
