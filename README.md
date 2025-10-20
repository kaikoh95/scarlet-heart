# Claude Code Remote

Control [Claude Code](https://claude.ai/code) remotely via multiple messaging platforms. Start tasks locally, receive notifications when Claude completes them, and send new commands by simply replying to messages.

**Supported Platforms:**
- 📧 **Email** - Traditional SMTP/IMAP integration with execution trace
- 📱 **Telegram** - Interactive bot with smart buttons
- 💼 **Slack** - Workspace integration with app mentions ✅ **NEW**
- 💬 **LINE** - Rich messaging with token-based commands
- 🖥️ **Desktop** - Sound alerts and system notifications

<div align="center">
  
  ### 🎥 Watch Demo Video
  
  <a href="https://youtu.be/_yrNlDYOJhw">
    <img src="./assets/CCRemote_demo.png" alt="Claude Code Remote Demo" width="100%">
    <br>
    <img src="https://img.shields.io/badge/▶-Watch%20on%20YouTube-red?style=for-the-badge&logo=youtube" alt="Watch on YouTube">
  </a>
  
</div>

> 🐦 Follow [@Jiaxi_Cui](https://x.com/Jiaxi_Cui) for updates and AI development insights

## ✨ Features

- **📧 Multiple Messaging Platforms**: 
  - Email notifications with full execution trace and reply-to-send commands ![](./assets/email_demo.png)
  - Telegram Bot with interactive buttons and slash commands ![](./assets/telegram_demo.png)
  - LINE messaging with token-based commands
  - Desktop notifications with sound alerts
- **🔄 Two-way Control**: Reply to messages or emails to send new commands
- **📱 Remote Access**: Control Claude from anywhere
- **🔒 Secure**: ID-based whitelist verification for all platforms
- **👥 Group Support**: Use in LINE groups or Telegram groups for team collaboration
- **🤖 Smart Commands**: Intuitive command formats for each platform
- **📋 Multi-line Support**: Send complex commands with formatting
- **⚡ Smart Monitoring**: Intelligent detection of Claude responses with historical tracking
- **🔄 tmux Integration**: Seamless command injection into active tmux sessions
- **📊 Execution Trace**: Full terminal output capture in email notifications

## 📅 Changelog

### August 2025
- **2025-08-02**: Add full execution trace to email notifications ([#14](https://github.com/JessyTsui/Claude-Code-Remote/pull/14) by [@vaclisinc](https://github.com/vaclisinc))
- **2025-08-01**: Enhanced Multi-Channel Notification System ([#1](https://github.com/JessyTsui/Claude-Code-Remote/pull/1) by [@laihenyi](https://github.com/laihenyi) [@JessyTsui](https://github.com/JessyTsui))
  - ✅ **Telegram Integration Completed** - Interactive buttons, real-time commands, smart personal/group chat handling
  - ✅ **Multi-Channel Notifications** - Simultaneous delivery to Desktop, Telegram, Email, LINE
  - ✅ **Smart Sound Alerts** - Always-on audio feedback with customizable sounds
  - ✅ **Intelligent Session Management** - Auto-detection, real conversation content, 24-hour tokens
- **2025-08-01**: Fix #9 #12: Add configuration to disable subagent notifications ([#10](https://github.com/JessyTsui/Claude-Code-Remote/pull/10) by [@vaclisinc](https://github.com/vaclisinc))
- **2025-08-01**: Implement terminal-style UI for email notifications ([#8](https://github.com/JessyTsui/Claude-Code-Remote/pull/8) by [@vaclisinc](https://github.com/vaclisinc))
- **2025-08-01**: Fix working directory issue - enable claude-remote to run from any directory ([#7](https://github.com/JessyTsui/Claude-Code-Remote/pull/7) by [@vaclisinc](https://github.com/vaclisinc))

### July 2025
- **2025-07-31**: Fix self-reply loop issue when using same email for send/receive ([#4](https://github.com/JessyTsui/Claude-Code-Remote/pull/4) by [@vaclisinc](https://github.com/vaclisinc))
- **2025-07-28**: Remove hardcoded values and implement environment-based configuration ([#2](https://github.com/JessyTsui/Claude-Code-Remote/pull/2) by [@kevinsslin](https://github.com/kevinsslin))

## 📋 TODO List

### Notification Channels
- ~~**📱 Telegram Integration**~~ ✅ **COMPLETED** - Bot integration with interactive buttons and real-time commands
- ~~**💼 Slack Integration**~~ ✅ **COMPLETED** - Workspace integration with app mentions and command support
- **💬 Discord Integration** - Bot integration for messaging platforms

### Developer Tools
- **🤖 AI Tools Support** - Integration with Gemini CLI, Cursor, and other AI development tools
- **🔀 Git Automation** - Auto-commit functionality, PR creation, branch management

### Usage Analytics
- **💰 Cost Tracking** - Token usage monitoring and estimated costs
- **⚡ Performance Metrics** - Execution time tracking and resource usage analysis
- **📧 Scheduled Reports** - Daily/weekly usage summaries delivered via email

### Native Apps
- **📱 Mobile Apps** - iOS and Android applications for remote Claude control
- **🖥️ Desktop Apps** - macOS and Windows native clients with system integration

## 🚀 Quick Start

### 1. Prerequisites

**System Requirements:**
- Node.js >= 14.0.0
- **tmux** (required for command injection)
- Active tmux session with Claude Code running

### 2. Install

```bash
git clone https://github.com/JessyTsui/Claude-Code-Remote.git
cd Claude-Code-Remote
npm install
```

### 3. Choose Your Platform

#### Option A: Configure Email (Recommended for Beginners)

```bash
# Copy example config
cp .env.example .env

# Edit with your email credentials
nano .env
```

**Required email settings:**
```env
EMAIL_ENABLED=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
IMAP_USER=your-email@gmail.com  
IMAP_PASS=your-app-password
EMAIL_TO=your-notification-email@gmail.com
ALLOWED_SENDERS=your-notification-email@gmail.com
SESSION_MAP_PATH=/your/path/to/Claude-Code-Remote/src/data/session-map.json
```

📌 **Gmail users**: Use [App Passwords](https://myaccount.google.com/security), not your regular password.

#### Option B: Configure Telegram ✅ **NEW**

**Quick Setup:**
```bash
chmod +x setup-telegram.sh
./setup-telegram.sh
```

**Manual Setup:**
1. Create bot via [@BotFather](https://t.me/BotFather)
2. Get your Chat ID from bot API
3. Configure webhook URL (use ngrok for local testing)

**Required Telegram settings:**
```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your-bot-token-here
TELEGRAM_CHAT_ID=your-chat-id-here
TELEGRAM_WEBHOOK_URL=https://your-ngrok-url.app
SESSION_MAP_PATH=/your/path/to/Claude-Code-Remote/src/data/session-map.json
```

**Optional Telegram settings:**
```env
# Force IPv4 connections to Telegram API (default: false)
# Enable this if you experience connectivity issues with IPv6
TELEGRAM_FORCE_IPV4=true
```

**Network Configuration Notes:**
- **IPv4 vs IPv6**: Some network environments may have unstable IPv6 connectivity to Telegram's API servers
- **When to use `TELEGRAM_FORCE_IPV4=true`**:
  - Connection timeouts or failures when sending messages
  - Inconsistent webhook delivery
  - Network environments that don't properly support IPv6
- **Default behavior**: Uses system default (usually IPv6 when available, fallback to IPv4)
- **Performance impact**: Minimal - only affects initial connection establishment

#### Option C: Configure Slack ✅ **NEW**

**Quick Setup:**
```bash
chmod +x setup-slack.sh
./setup-slack.sh
```

**Manual Setup:**
1. Create Slack App at [api.slack.com/apps](https://api.slack.com/apps)
2. Add Bot Token Scopes:
   - `app_mentions:read` (receive mentions)
   - `chat:write` (send messages)
   - `channels:history` (read thread conversations in public channels)
   - `groups:history` (read thread conversations in private channels)
3. Install app to workspace and get Bot User OAuth Token
4. Configure Event Subscriptions with your webhook URL
5. Subscribe to `app_mention` bot event

**Required Slack settings:**
```env
SLACK_ENABLED=true
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SESSION_MAP_PATH=/your/path/to/Claude-Code-Remote/src/data/session-map.json
```

**Optional Slack settings:**
```env
# Default channel for notifications (optional - see Channel Behavior below)
SLACK_CHANNEL_ID=C1234567890

# Whitelist specific channels or users (comma-separated)
# If not set, bot responds to mentions in any channel
SLACK_WHITELIST=C1234567890,U0987654321

# Custom webhook port (default: 3002, or use unified server on 3001)
SLACK_WEBHOOK_PORT=3002
```

**Smart Channel Notifications:**
The bot intelligently determines where to send notifications:

1. **Session Memory** (Recommended): When you send a command, the bot remembers which channel you used and sends future notifications there
   - No SLACK_CHANNEL_ID needed!
   - Just mention the bot in any channel: `@bot /cmd TOKEN123 your command`
   - Future notifications for that task go to the same channel

2. **Default Channel**: Set SLACK_CHANNEL_ID for a fallback notification channel
   - Useful for first-time notifications before any command is sent
   - Acts as the default if no session channel is saved

3. **Whitelist Control**: Use SLACK_WHITELIST to restrict which channels/users can interact
   - If not set, bot works in any channel it's added to

**How it works:**
```
1. Claude completes a task → Creates session with token ABC123
2. You mention bot anywhere: @bot /cmd ABC123 analyze this
3. Bot saves that channel to the session
4. Next notification for ABC123 → Goes to that same channel
```

No configuration needed - just start using the bot in any channel! 🎉

**Thread Support:**
- When you mention the bot in a Slack thread, it automatically captures the entire thread conversation
- The thread context is passed to Claude along with your command
- Perfect for continuing discussions or asking follow-up questions with full context

#### Option D: Configure LINE

**Required LINE settings:**
```env
LINE_ENABLED=true
LINE_CHANNEL_ACCESS_TOKEN=your-token
LINE_CHANNEL_SECRET=your-secret
LINE_USER_ID=your-user-id
```

### 4. Configure Claude Code Hooks

Create hooks configuration file:

**Method 1: Global Configuration (Recommended)**
```bash
# Add to ~/.claude/settings.json
{
  "hooks": {
    "SubagentStop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node /your/path/to/Claude-Code-Remote/claude-hook-notify.js init",
        "timeout": 5
      }]
    }],
    "UserPromptSubmit": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node /your/path/to/Claude-Code-Remote/claude-hook-notify.js working",
        "timeout": 5
      }]
    }],
    "Stop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node /your/path/to/Claude-Code-Remote/claude-hook-notify.js completed",
        "timeout": 5
      }]
    }]
  }
}
```

**Method 2: Project-Specific Configuration**
```bash
# Set environment variable
export CLAUDE_HOOKS_CONFIG=/your/path/to/Claude-Code-Remote/claude-hooks.json
```

### 5. Start tmux Session with Claude Code

**IMPORTANT**: Claude Code Remote requires Claude to run in a tmux session for command injection to work.

```bash
# Start a new tmux session
tmux new-session -d -s claude-session

# Attach to the session
tmux attach-session -t claude-session

# Inside tmux, start Claude Code with hooks enabled
claude-code --config /path/to/your/claude/settings.json

# Detach from tmux (Ctrl+B, then D) to leave Claude running in background
```

> **Note**: Make sure your `~/.claude/settings.json` or project-specific config includes the hooks configuration from Step 4.

### 6. Start Services

#### Option A: Unified Webhook Server (Recommended) ⭐

All webhook platforms on a **single port** - perfect for easier ngrok setup!

```bash
# Start unified server (handles Telegram, Slack, LINE on one port)
npm run webhooks:unified
# or
node start-unified-webhook.js

# Then expose with ngrok (single tunnel for all platforms!)
ngrok http 3001
```

**Benefits:**
- ✅ Single port for all webhook platforms
- ✅ One ngrok tunnel handles everything
- ✅ Simpler deployment and configuration
- ✅ All platforms share the same public URL with different paths:
  - `https://your-domain.com/webhook/telegram`
  - `https://your-domain.com/webhook/slack`
  - `https://your-domain.com/webhook/line`

**Configuration:**
```env
# Set in .env (optional, defaults to 3001)
UNIFIED_WEBHOOK_PORT=3001
```

#### Option B: Multiple Webhook Servers

Run each platform on separate ports for more control:

```bash
# Automatically starts all enabled platforms (separate processes)
npm run webhooks
# or
node start-all-webhooks.js
```

**Individual Services:**

**For Email:**
```bash
npm run daemon:start
# or
node claude-remote.js daemon start
```

**For Telegram:**
```bash
npm run telegram  # Port 3001
# or
node start-telegram-webhook.js
```

**For Slack:**
```bash
npm run slack  # Port 3002
# or
node start-slack-webhook.js
```

**For LINE:**
```bash
npm run line  # Port 3000
# or
node start-line-webhook.js
```

> **Note:** With separate servers, you'll need multiple ngrok tunnels or a reverse proxy.

### 7. Test Your Setup

**Quick Test:**
```bash
# Test all notification channels
node claude-hook-notify.js completed
# Should receive notifications via all enabled platforms
```

**Full Test:**
1. Start Claude in tmux session with hooks enabled
2. Run any command in Claude
3. Check for notifications (email/Telegram/LINE)
4. Reply with new command to test two-way control

## 🎮 How It Works

1. **Use Claude normally** in tmux session
2. **Get notifications** when Claude completes tasks via:
   - 🔊 **Sound alert** (Desktop)
   - 📧 **Email notification with execution trace** (if enabled)
   - 📱 **Telegram message with buttons** (if enabled)
   - 💼 **Slack message with rich formatting** (if enabled)
   - 💬 **LINE message** (if enabled)
3. **Reply with commands** using any platform
4. **Commands execute automatically** in Claude

### Platform Command Formats

**Email:**
```
Simply reply to notification email with your command
No special formatting required
```

**Telegram:**
```
Click smart button to get format:
📝 Personal Chat: /cmd TOKEN123 your command here
👥 Group Chat: @bot_name /cmd TOKEN123 your command here
```

**Slack:** ✅ **NEW**
```
Mention the bot in any channel:
@bot_name /cmd TOKEN123 your command here
or
@bot_name TOKEN123 your command here
```

**LINE:**
```
Reply to notification with: Your command here
(Token automatically extracted from conversation context)
```

### Advanced Configuration

**Email Notification Options**

1. **Subagent Activities in Email**

   By default, email notifications only show the execution trace. You can optionally enable a separate subagent activities summary section:

   ```json
   // In your config/config.json
   {
     "showSubagentActivitiesInEmail": true  // Default: false
   }
   ```

   When enabled, emails will include:
   - **Subagent Activities Summary**: A structured list of all subagent activities
   - **Full Execution Trace**: The complete terminal output

   Since the execution trace already contains all information, this feature is disabled by default to keep emails concise.

2. **Execution Trace Display**

   You can control whether to include the execution trace in email notifications:

   ```json
   // In your email channel configuration
   {
     "email": {
       "config": {
         "includeExecutionTrace": false  // Default: true
       }
     }
   }
   ```

   - When `true` (default): Shows a scrollable execution trace section in emails
   - When `false`: Removes the execution trace section entirely from emails

   This is useful if you find the execution trace too verbose or if your email client has issues with scrollable content.

## 💡 Use Cases

- **Remote Code Reviews**: Start reviews at office, continue from home via any platform
- **Long-running Tasks**: Monitor progress and guide next steps remotely
- **Multi-location Development**: Control Claude from anywhere without VPN
- **Team Collaboration**: Share Telegram groups for team notifications
- **Mobile Development**: Send commands from phone via Telegram

## 🔧 Commands

### Testing & Diagnostics
```bash
# Test all notification channels
node claude-hook-notify.js completed

# Test specific platforms
node test-telegram-notification.js
node test-real-notification.js
node test-injection.js

# System diagnostics
node claude-remote.js diagnose
node claude-remote.js status
node claude-remote.js test
```

### Service Management
```bash
# Recommended: Start unified webhook server (all platforms on one port)
npm run webhooks:unified

# Alternative: Start all platforms separately
npm run webhooks

# Individual services
npm run telegram         # Telegram webhook (port 3001)
npm run slack           # Slack webhook (port 3002)
npm run line            # LINE webhook (port 3000)
npm run daemon:start    # Email daemon

# Stop services
npm run daemon:stop     # Stop email daemon
# Note: Use Ctrl+C to stop webhook servers
```

## 🔍 Troubleshooting

### Common Issues

**Not receiving notifications from Claude?**
1. Check hooks configuration in tmux session:
   ```bash
   echo $CLAUDE_HOOKS_CONFIG
   ```
2. Verify Claude is running with hooks enabled
3. Test notification manually:
   ```bash
   node claude-hook-notify.js completed
   ```

**Telegram bot not responding?** ✅ **NEW**
```bash
# Test bot connectivity
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -H "Content-Type: application/json" \
  -d "{\"chat_id\": $TELEGRAM_CHAT_ID, \"text\": \"Test\"}"

# Check webhook status
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

**Commands not executing in Claude?**
```bash
# Check tmux session exists
tmux list-sessions

# Verify injection mode
grep INJECTION_MODE .env  # Should be 'tmux'

# Test injection
node test-injection.js
```

**Not receiving emails?**
- Run `node claude-remote.js test` to test email setup
- Check spam folder
- Verify SMTP settings in `.env`
- For Gmail: ensure you're using App Password

### Debug Mode
```bash
# Enable detailed logging
LOG_LEVEL=debug npm run webhooks
DEBUG=true node claude-hook-notify.js completed
```

## 🛡️ Security

### Multi-Platform Authentication
- ✅ **Email**: Sender whitelist via `ALLOWED_SENDERS` environment variable
- ✅ **Telegram**: Bot token and chat ID verification
- ✅ **Slack**: Bot token, signing secret, and channel/user whitelist
- ✅ **LINE**: Channel secret and access token validation
- ✅ **Session Tokens**: 8-character alphanumeric tokens for command verification

### Session Security
- ✅ **Session Isolation**: Each token controls only its specific tmux session
- ✅ **Auto Expiration**: Sessions timeout automatically after 24 hours
- ✅ **Token-based Commands**: All platforms require valid session tokens
- ✅ **Minimal Data Storage**: Session files contain only necessary information

## 🤝 Contributing

Found a bug or have a feature request? 

- 🐛 **Issues**: [GitHub Issues](https://github.com/JessyTsui/Claude-Code-Remote/issues)
- 🐦 **Updates**: Follow [@Jiaxi_Cui](https://x.com/Jiaxi_Cui) on Twitter
- 💬 **Discussions**: Share your use cases and improvements

## 📄 License

MIT License - Feel free to use and modify!

---

**🚀 Make Claude Code truly remote and accessible from anywhere!**

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=JessyTsui/Claude-Code-Remote&type=Date)](https://star-history.com/#JessyTsui/Claude-Code-Remote&Date)

⭐ **Star this repo** if it helps you code more efficiently!

> 💡 **Tip**: Enable multiple notification channels for redundancy - never miss a Claude completion again!
