# Bot Setup Guide - Telegram & Slack

This guide walks you through setting up **S.C.A.R.L.E.T** (Smart Claude Assistant for Remote Execution & Live Tracking) bots for both Telegram and Slack platforms.

## Bot Branding

**Bot Name:** S.C.A.R.L.E.T
**Bot Image:** `assets/scarletheart.png`
**Description:** Smart Claude Assistant for Remote Execution & Live Tracking

---

## Table of Contents

- [Telegram Bot Setup](#telegram-bot-setup)
- [Slack Bot Setup](#slack-bot-setup)
- [Quick Setup Scripts](#quick-setup-scripts)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

---

## Telegram Bot Setup

### Step 1: Create Bot with BotFather

1. **Open Telegram** and search for [@BotFather](https://t.me/BotFather)

2. **Start a conversation** with BotFather

3. **Create new bot:**
   ```
   /newbot
   ```

4. **Set bot name:**
   ```
   S.C.A.R.L.E.T
   ```

   *Note: BotFather may require a unique display name. Try variations like:*
   - `S.C.A.R.L.E.T - Claude Remote`
   - `S.C.A.R.L.E.T Bot`
   - `SCARLET Assistant`

5. **Set bot username:**
   ```
   scarlet_claude_bot
   ```

   *Note: Username must end with 'bot' and be unique. Try variations if taken:*
   - `scarlet_claude_remote_bot`
   - `your_scarlet_bot`
   - `scarlet_ai_bot`

6. **Save the bot token** provided by BotFather
   ```
   Example: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   ```

### Step 2: Set Bot Profile Picture

1. **Send command to BotFather:**
   ```
   /setuserpic
   ```

2. **Select your bot** from the list

3. **Upload the profile picture:**
   - Navigate to `<SCARLET_HEART_PATH>/assets/scarletheart.png`
   - Send the image file to BotFather

4. **Confirm** - BotFather will set the profile picture

### Step 3: Set Bot Description

1. **Set description (shown in bot profile):**
   ```
   /setdescription
   ```

   Select your bot, then send:
   ```
   Smart Claude Assistant for Remote Execution & Live Tracking

   Control your Claude Code sessions remotely through Telegram. Receive notifications when tasks complete and send new commands on the go.
   ```

2. **Set about text (shown in bot info):**
   ```
   /setabouttext
   ```

   Select your bot, then send:
   ```
   S.C.A.R.L.E.T - Your remote Claude Code companion
   ```

### Step 4: Configure Bot Commands

1. **Set command list:**
   ```
   /setcommands
   ```

2. **Select your bot**, then send:
   ```
   cmd - Execute command in Claude session (usage: /cmd TOKEN <command>)
   help - Show help and usage information
   ```

### Step 5: Get Your Chat ID

**Method 1: Using your bot**
1. Start a chat with your bot
2. Send any message (e.g., "Hello")
3. Visit in browser: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Find `"chat":{"id":123456789}` in the JSON response
5. Save your chat ID

**Method 2: Using IDBot**
1. Message [@myidbot](https://t.me/myidbot)
2. Send `/getid`
3. Save your chat ID

**Method 3: Using GetIDs Bot**
1. Message [@getidsbot](https://t.me/getidsbot)
2. Send `/start`
3. Save your chat ID

### Step 6: Configure Environment

Add to `<SCARLET_HEART_PATH>/.env`:

```env
# Enable Telegram
TELEGRAM_ENABLED=true

# Bot credentials
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789

# Optional: Group ID for group notifications
# TELEGRAM_GROUP_ID=-1001234567890

# Webhook URL (for production/ngrok)
TELEGRAM_WEBHOOK_URL=https://your-domain.com

# Optional: Force IPv4 (enable if connection issues)
# TELEGRAM_FORCE_IPV4=true
```

### Step 7: Set Webhook (For Production/Testing)

**For local testing with ngrok:**
```bash
# Start ngrok
ngrok http 3001

# Copy the HTTPS URL and set webhook
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-ngrok-url.ngrok.io/webhook/telegram"}'
```

**For production:**
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-domain.com/webhook/telegram"}'
```

**Verify webhook:**
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

---

## Slack Bot Setup

### Step 1: Create Slack App

1. **Go to** [Slack API Apps](https://api.slack.com/apps)

2. **Click** "Create New App"

3. **Select** "From scratch"

4. **Enter app details:**
   - **App Name:** `S.C.A.R.L.E.T`
   - **Workspace:** Select your workspace
   - Click "Create App"

### Step 2: Set Bot Display Information

1. **Navigate to** "Basic Information"

2. **Scroll to** "Display Information"

3. **Set App Icon:**
   - Click "Add App Icon"
   - Upload `<SCARLET_HEART_PATH>/assets/scarletheart.png`
   - Recommended: 512x512px or larger

4. **Set Short Description:**
   ```
   Smart Claude Assistant for Remote Execution & Live Tracking
   ```

5. **Set Long Description:**
   ```
   S.C.A.R.L.E.T (Smart Claude Assistant for Remote Execution & Live Tracking) enables remote control of your Claude Code sessions through Slack. Each thread gets its own persistent Claude session, maintaining context across conversations.

   Features:
   • Thread-based persistent sessions
   • Real-time task completion notifications
   • Beautiful formatted responses with syntax highlighting
   • Local session access for debugging
   • Automatic context preservation
   ```

6. **Set Background Color:**
   ```
   #DC143C
   ```
   *(Crimson red to match S.C.A.R.L.E.T theme)*

7. **Click** "Save Changes"

### Step 3: Configure OAuth Scopes

1. **Navigate to** "OAuth & Permissions"

2. **Scroll to** "Scopes" → "Bot Token Scopes"

3. **Add these scopes:**

   **Required Scopes:**
   - `app_mentions:read` - Listen for messages that mention your bot
   - `chat:write` - Send messages as your bot
   - `channels:history` - View messages and content in public channels
   - `groups:history` - View messages and content in private channels
   - `im:history` - View messages in DMs with the bot
   - `im:read` - View basic information about DMs
   - `reactions:write` - Add emoji reactions to messages

   **Why each scope is needed:**
   - `app_mentions:read` - Receive @mentions in channels
   - `chat:write` - Send responses and notifications
   - `channels:history` - Read thread history for context
   - `groups:history` - Support private channels
   - `im:history` - Support direct messages
   - `im:read` - Access DM metadata
   - `reactions:write` - User feedback (👀 → ⏳ → ✅)

### Step 4: Enable Event Subscriptions

1. **Navigate to** "Event Subscriptions"

2. **Toggle** "Enable Events" to **On**

3. **Set Request URL:**
   ```
   https://your-domain.com/webhook/slack
   ```

   *For local testing with ngrok:*
   ```
   https://your-ngrok-url.ngrok.io/webhook/slack
   ```

   **⚠️ Important:** Start your webhook server first! Slack will verify the URL immediately.

4. **Subscribe to bot events:**
   - Click "Subscribe to bot events"
   - Add these events:
     - `app_mention` - Mentions in channels
     - `message.im` - Direct messages

5. **Click** "Save Changes"

### Step 5: Install App to Workspace

1. **Navigate to** "Install App"

2. **Click** "Install to Workspace"

3. **Review permissions** and click "Allow"

4. **Copy the Bot User OAuth Token**
   - Format: `xoxb-...`
   - Save this token securely

### Step 6: Get Signing Secret

1. **Navigate to** "Basic Information"

2. **Scroll to** "App Credentials"

3. **Copy** the "Signing Secret"
   - This is used to verify webhook requests

### Step 7: Configure Environment

Add to `<SCARLET_HEART_PATH>/.env`:

```env
# Enable Slack
SLACK_ENABLED=true

# Bot credentials
SLACK_BOT_TOKEN=xoxb-your-bot-user-oauth-token
SLACK_SIGNING_SECRET=your-signing-secret

# Optional: Default channel for notifications
# SLACK_CHANNEL_ID=C1234567890

# Optional: Whitelist specific channels or users
# SLACK_WHITELIST=C1234567890,U0987654321

# Optional: Custom webhook port (default: 3002)
# SLACK_WEBHOOK_PORT=3002
```

### Step 8: Add Bot to Channels

For the bot to respond in channels, you must invite it:

1. **In any channel**, type:
   ```
   /invite @S.C.A.R.L.E.T
   ```

2. **Verify** the bot appears in the channel member list

3. **Test** by mentioning the bot:
   ```
   @S.C.A.R.L.E.T help
   ```

---

## Quick Setup Scripts

### Automated Telegram Setup

```bash
cd <SCARLET_HEART_PATH>
chmod +x setup-telegram.sh
./setup-telegram.sh
```

The script will:
1. Guide you through bot creation
2. Help you get chat ID
3. Configure `.env` file
4. Set up webhook (if using ngrok)
5. Test the connection

### Automated Slack Setup

```bash
cd <SCARLET_HEART_PATH>
chmod +x setup-slack.sh
./setup-slack.sh
```

The script will:
1. Guide you through app creation
2. List required OAuth scopes
3. Configure `.env` file
4. Start webhook server
5. Test the connection

---

## Verification

### Verify Telegram Bot

1. **Check bot info:**
   ```bash
   curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe"
   ```

2. **Expected response:**
   ```json
   {
     "ok": true,
     "result": {
       "id": 123456789,
       "is_bot": true,
       "first_name": "S.C.A.R.L.E.T",
       "username": "scarlet_claude_bot"
     }
   }
   ```

3. **Test message sending:**
   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/sendMessage" \
     -H "Content-Type: application/json" \
     -d '{"chat_id":"<YOUR_CHAT_ID>","text":"Hello from S.C.A.R.L.E.T!"}'
   ```

4. **Verify webhook:**
   ```bash
   curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
   ```

### Verify Slack Bot

1. **Check bot permissions:**
   - Go to Slack App → "OAuth & Permissions"
   - Verify all required scopes are listed

2. **Check event subscriptions:**
   - Go to "Event Subscriptions"
   - Verify URL shows "Verified ✓"
   - Check both events are subscribed

3. **Test in Slack:**
   ```
   @S.C.A.R.L.E.T help
   ```

4. **Check webhook server:**
   ```bash
   curl http://localhost:3002/health
   ```

---

## Start Webhook Servers

### Unified Server (Recommended)

Starts both Telegram and Slack on a single port:

```bash
cd <SCARLET_HEART_PATH>
npm run webhooks:unified

# Server runs on port 3001
# Telegram: http://localhost:3001/webhook/telegram
# Slack: http://localhost:3001/webhook/slack
```

### Individual Servers

**Telegram only:**
```bash
npm run telegram
# Port 3001
```

**Slack only:**
```bash
npm run slack
# Port 3002
```

---

## Troubleshooting

### Telegram Issues

**Bot doesn't respond to messages**

1. **Check webhook is set:**
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
   ```

2. **Webhook should show:**
   ```json
   {
     "url": "https://your-domain.com/webhook/telegram",
     "has_custom_certificate": false,
     "pending_update_count": 0
   }
   ```

3. **If webhook is not set:**
   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://your-domain.com/webhook/telegram"
   ```

**Connection timeout errors**

Try enabling IPv4 mode:
```env
TELEGRAM_FORCE_IPV4=true
```

**Bot token invalid**

1. Verify token format: `123456789:ABC...`
2. Get new token from @BotFather: `/token`
3. Regenerate if compromised: `/revoke`

### Slack Issues

**Event URL not verifying**

1. **Start webhook server first:**
   ```bash
   npm run slack
   ```

2. **Check server is running:**
   ```bash
   curl http://localhost:3002/health
   ```

3. **For ngrok:**
   ```bash
   ngrok http 3002
   # Use the HTTPS URL in Slack settings
   ```

4. **Check Slack logs:**
   - Go to "Event Subscriptions"
   - Click "Retry" under Request URL
   - View error details

**Bot not responding to @mentions**

1. **Verify bot is in channel:**
   ```
   /invite @S.C.A.R.L.E.T
   ```

2. **Check Event Subscriptions:**
   - Ensure `app_mention` is subscribed
   - URL should show "Verified ✓"

3. **Check webhook server logs:**
   ```bash
   tail -f logs/slack-webhook.log
   ```

**Missing permissions**

1. **Review required scopes in Step 3**
2. **Add missing scopes in "OAuth & Permissions"**
3. **Reinstall app to workspace**
4. **Test again**

### General Issues

**Webhook server won't start**

1. **Check port is not in use:**
   ```bash
   lsof -i :3001  # or 3002 for Slack-only
   ```

2. **Kill conflicting process:**
   ```bash
   kill -9 <PID>
   ```

3. **Try different port:**
   ```env
   UNIFIED_WEBHOOK_PORT=3003
   ```

**Bot image not showing**

1. **Verify image exists:**
   ```bash
   ls -lh <SCARLET_HEART_PATH>/assets/scarletheart.png
   ```

2. **Check file size:**
   - Telegram: Max 10MB
   - Slack: Recommended 512x512px

3. **Re-upload if corrupted**

---

## Next Steps

After completing bot setup:

1. **Configure Claude Hooks** - See [ARCHITECTURE.md - Configuration](./ARCHITECTURE.md#claude-hooks-configuration)
2. **Test Integration** - See platform-specific guides:
   - [Telegram Architecture](./TELEGRAM_ARCHITECTURE.md)
   - [Slack Architecture](./SLACK_ARCHITECTURE.md)
3. **Production Deployment** - See [ARCHITECTURE.md - Deployment](./ARCHITECTURE.md#deployment-options)

---

## Security Best Practices

### Protect Your Tokens

1. **Never commit tokens to git:**
   ```bash
   # Ensure .env is in .gitignore
   echo ".env" >> .gitignore
   ```

2. **Use environment variables:**
   - Development: `.env` file
   - Production: System environment or secrets manager

3. **Rotate tokens regularly:**
   - Telegram: Use @BotFather `/revoke` and `/token`
   - Slack: Regenerate in "App Credentials"

### Restrict Access

**Telegram:**
- Use specific chat ID (not group unless intended)
- Don't share bot username publicly
- Monitor unauthorized usage

**Slack:**
- Use `SLACK_WHITELIST` for channel/user restrictions
- Install only to trusted workspaces
- Review permissions regularly

### Monitor Usage

1. **Check webhook logs:**
   ```bash
   tail -f logs/*.log
   ```

2. **Monitor API rate limits:**
   - Telegram: ~30 messages/second
   - Slack: 1 message/second per channel

3. **Set up alerts for errors**

---

## Reference

**Official Documentation:**
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Slack API](https://api.slack.com/)
- [BotFather Commands](https://core.telegram.org/bots#6-botfather)

**Claude Code Remote Docs:**
- [Architecture Overview](./ARCHITECTURE.md)
- [Slack Architecture](./SLACK_ARCHITECTURE.md)
- [Telegram Architecture](./TELEGRAM_ARCHITECTURE.md)

---

**Version:** 2.0
**Last Updated:** 2025-01-20
**Bot Name:** S.C.A.R.L.E.T
**Bot Image:** `assets/scarletheart.png`
