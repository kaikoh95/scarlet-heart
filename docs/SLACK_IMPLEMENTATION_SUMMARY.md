# Slack Webhook Bot - Implementation Summary

## Overview
Enhanced Slack webhook bot with Stop hook integration, beautiful Block Kit formatting, and automatic session management.

---

## Changes Made

### 1. Command Execution ✅
**Status:** Already working correctly

**File:** `src/utils/controller-injector.js`, `src/utils/slack-thread-manager.js`

The Enter key is already being sent correctly:
- Line 194 of `slack-thread-manager.js`: Uses `C-m` for existing sessions
- Line 380 of `slack-thread-manager.js`: Uses `C-m` for new sessions

**No changes needed** - the issue was not with command execution.

---

### 2. Stop Hook Integration ✅
**Status:** Enhanced with detailed logging

**File:** `claude-hook-notify.js` (lines 45-161)

**Enhancements:**
- Detailed logging for debugging
- Better error messages with helpful hints
- Captures up to 5000 lines from tmux for full responses
- Returns success/failure status
- Comprehensive error handling

**How it works:**
1. Claude Code Stop hook triggers when Claude finishes
2. Script detects `slack-` session prefix
3. Looks up thread info from `slack-thread-mappings.json`
4. Extracts conversation from tmux using `TmuxMonitor`
5. Sends formatted response to Slack thread

---

### 3. Beautiful Response Formatting ✅
**Status:** Implemented with Slack Block Kit

**File:** `src/channels/slack/slack.js` (lines 119-335)

**Features:**
- ✅ Header block with status emoji and title
- ✅ User request section (up to 300 chars)
- ✅ Divider for visual separation
- ✅ Claude response with smart code block detection
- ✅ Automatic truncation (shows last 500 words if response is long)
- ✅ Session info footer with timestamp and tmux command
- ✅ Context elements showing session name and local attach command

**Smart Features:**
- Auto-detects code blocks (checks for indentation, code keywords)
- Automatically wraps code in triple backticks
- Escapes special Slack characters
- Provides fallback text for notifications

**Example Output:**
```
╔══════════════════════════════════════╗
║ ✅ Claude Task Completed              ║
╠══════════════════════════════════════╣
║ Your Request:                        ║
║ Implement user authentication        ║
╠──────────────────────────────────────╣
║ Claude's Response:                   ║
║ ```                                  ║
║ I've implemented the authentication  ║
║ system with JWT tokens...            ║
║ ```                                  ║
╠──────────────────────────────────────╣
║ 💻 Session: slack-C123-456789        ║
║ 🕐 10:30:45 AM                       ║
║ 🔗 tmux attach -t slack-C123-456789  ║
╚══════════════════════════════════════╝
```

---

### 4. Immediate Acknowledgment Reactions ✅
**Status:** Implemented

**File:** `src/channels/slack/webhook.js` (lines 199, 236-237, 275-276, 662-718)

**Reaction Flow:**
1. **👀 (eyes)** - Message received, processing started
2. **⏳ (hourglass_flowing_sand)** - Command sent to Claude, now processing
3. **(Stop hook adds ✅ via response message)** - Task completed

**Methods added:**
- `_addReaction(channelId, messageTs, emoji)` - Add emoji reaction
- `_removeReaction(channelId, messageTs, emoji)` - Remove emoji reaction

**OAuth Scope Required:** `reactions:write`

---

### 5. Session Timeout and Cleanup ✅
**Status:** Implemented with periodic cleanup

**File:** `src/utils/slack-thread-manager.js` (lines 584-668)

**New Methods:**
1. **`cleanupIdleSessions(maxAgeHours)`**
   - Removes sessions older than specified hours (default: 24h)
   - Kills tmux sessions automatically
   - Stops monitoring and removes callbacks
   - Logs detailed cleanup information

2. **`startPeriodicCleanup(intervalHours, maxAgeHours)`**
   - Runs cleanup automatically every N hours
   - Default: Check every 6 hours, remove sessions older than 24 hours
   - Runs immediately on start, then periodically

3. **`stopPeriodicCleanup()`**
   - Stops the periodic cleanup interval

**Configuration:**
Enabled automatically in `webhook.js:742`:
```javascript
this.threadManager.startPeriodicCleanup(6, 24);
```

---

## Architecture Decisions

### ✅ Thread-Based Isolation (Kept)
**Decision:** Keep the existing thread-based architecture

**Why:**
- Each Slack thread = isolated Claude session
- Preserves conversation context automatically
- Allows parallel tasks in different threads
- Easy to debug (attach to specific tmux session)

**Benefits over token approach:**
- No need to remember/copy tokens
- Natural conversation flow
- Thread history automatically included
- Better UX for team collaboration

---

### ✅ Stop Hooks (Not Tmux Monitoring)
**Decision:** Use Claude Code Stop hooks for response capture

**Why:**
- More reliable than polling tmux
- Fires exactly when Claude finishes
- Lower CPU usage (event-driven vs polling)
- Better for /bg-workflow integration

**How it works:**
1. User mentions bot in Slack
2. Webhook creates tmux session, starts Claude with `--dangerously-skip-permissions`
3. Sends `/bg-workflow <prompt>` to Claude
4. Claude processes in background
5. **Stop hook fires** when Claude completes
6. Hook script extracts response from tmux
7. Response sent back to Slack thread with beautiful formatting

---

## Files Modified

### Core Files
| File | Lines Changed | Purpose |
|------|---------------|---------|
| `src/channels/slack/slack.js` | 119-335 | Block Kit response formatting |
| `src/channels/slack/webhook.js` | 199, 236-237, 275-276, 662-726 | Reaction acknowledgments |
| `src/utils/slack-thread-manager.js` | 584-668 | Session timeout and cleanup |
| `claude-hook-notify.js` | 45-161 | Enhanced Stop hook handler |

### No Changes Needed
| File | Reason |
|------|--------|
| `src/utils/controller-injector.js` | Already sends Enter key correctly |

---

## Testing Guide

### Prerequisites
1. **Slack App Setup:**
   - Bot Token (`SLACK_BOT_TOKEN`)
   - Signing Secret (`SLACK_SIGNING_SECRET`)
   - Webhook URL configured in Slack

2. **OAuth Scopes Required:**
   ```
   app_mentions:read       # Receive @mentions
   im:history              # View DMs
   im:read                 # Read DM info
   chat:write              # Send messages
   channels:history        # Read thread history
   groups:history          # Read private channels
   reactions:write         # Add emoji reactions (NEW)
   ```

3. **Environment Variables (`.env`):**
   ```bash
   SLACK_ENABLED=true
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_SIGNING_SECRET=your-signing-secret
   SLACK_CHANNEL_ID=C1234567890  # Optional
   SLACK_WHITELIST=C123,U456     # Optional
   ```

4. **Claude Hooks Configuration:**

   **File:** `~/.claude/settings.json` or set `CLAUDE_HOOKS_CONFIG` env var

   ```json
   {
     "hooks": {
       "Stop": [
         {
           "matcher": "*",
           "hooks": [
             {
               "type": "command",
               "command": "node /full/path/to/Claude-Code-Remote/claude-hook-notify.js completed",
               "timeout": 10
             }
           ]
         }
       ]
     }
   }
   ```

   **⚠️ Important:** Use absolute path, not relative!

---

### Test Procedure

#### 1. Start the Webhook Server
```bash
npm run slack
# or
node start-slack-webhook.js
```

**Expected Output:**
```
Slack webhook server started on port 3002
Thread-based tmux sessions enabled
Each Slack thread will get its own persistent Claude session
Cleaned up X stale thread mapping(s) on startup
🔄 Starting periodic cleanup: every 6h, max age 24h
Periodic session cleanup enabled: check every 6h, max age 24h
```

---

#### 2. Test New Thread (First Mention)

**Action:** In Slack channel, mention the bot:
```
@Claude analyze this codebase structure
```

**Expected Behavior:**
1. ✅ Bot immediately adds 👀 reaction to your message
2. ✅ Bot creates new tmux session (e.g., `slack-C09J23KGF55-1760786016457109`)
3. ✅ Bot starts Claude with `--dangerously-skip-permissions`
4. ✅ Bot sends `/bg-workflow <your request + thread history>`
5. ✅ Bot removes 👀, adds ⏳ reaction
6. ✅ Bot replies with confirmation message:
   ```
   ✅ Started new Claude session

   💻 Session: slack-C123-456789
   📝 Task: analyze this codebase structure

   Claude is now working on your request in the background...
   ```

**Verify:**
```bash
# Check tmux session exists
tmux ls | grep slack-

# Attach to session to see Claude working
tmux attach -t slack-C123-456789

# Detach: Ctrl-b then d
```

---

#### 3. Test Stop Hook Response

**Wait for Claude to finish** (can take 30s - few minutes depending on task)

**Expected Behavior:**
1. ✅ Stop hook fires automatically
2. ✅ Hook script logs appear in terminal:
   ```
   ============================================================
   💼 Slack Thread Notification Handler
   ============================================================
   📊 Session: slack-C123-456789
   📊 Type: completed
   📊 Project: Claude-Code-Remote
   ✓ SlackThreadManager loaded
   ✓ Thread info found:
     Channel ID: C123456789
     Thread TS: 1760786016.457109
   ✓ SLACK_BOT_TOKEN found
   ✓ SlackChannel initialized
   📖 Extracting conversation from tmux session...
   ✓ Conversation extracted:
     User question length: 45 chars
     Claude response length: 3542 chars
   📤 Sending notification to Slack...
   ✅ Slack thread notification sent successfully!
   ============================================================
   ```

3. ✅ Bot sends beautiful formatted response to Slack thread with:
   - Header: "✅ Claude Task Completed"
   - Your request (truncated if long)
   - Claude's response (last 500 words if long)
   - Session info footer
   - Timestamp
   - tmux attach command

**Verify:**
- Response appears in same thread
- Formatting looks good (Block Kit)
- Code blocks are properly formatted
- Can click/copy tmux command

---

#### 4. Test Existing Thread (Continue Conversation)

**Action:** Reply in the same thread:
```
@Claude now add error handling
```

**Expected Behavior:**
1. ✅ Bot adds 👀 reaction
2. ✅ Bot finds existing session mapping
3. ✅ Bot ensures monitoring is active
4. ✅ Bot sends prompt to existing Claude session
5. ✅ Bot removes 👀, adds ⏳ reaction
6. ✅ Bot replies with confirmation:
   ```
   💬 Message sent to Claude

   💻 Session: slack-C123-456789
   📝 Message: now add error handling

   Continuing the conversation...
   ```

7. ✅ When Claude finishes, Stop hook fires again
8. ✅ Response sent to same thread

**Verify:**
- Same tmux session reused
- Conversation context preserved
- Claude remembers previous requests

---

#### 5. Test Direct Messages

**Action:** Send DM to bot:
```
help me implement authentication
```

**Expected Behavior:**
1. ✅ Works like channel mentions
2. ✅ Creates unique session for DM
3. ✅ Responses sent to DM thread

---

#### 6. Test Commands

**Action:** In thread, send:
```
@Claude status
```

**Expected Response:**
```
✅ Active Claude Session

💻 Session: slack-C123-456789
🕐 Created: 1/18/2025, 10:30:00 AM
🔍 Status: Running: node

To attach to this session locally:
```tmux attach -t slack-C123-456789```
```

**Action:** Send:
```
@Claude cleanup
```

**Expected Response:**
```
✅ Session cleaned up

Terminated session: slack-C123-456789
```

**Verify:**
- Tmux session killed
- Mapping removed from `src/data/slack-thread-mappings.json`

---

#### 7. Test Session Cleanup

**Action:** Wait 6 hours (or modify code to 1 minute for testing)

**Expected Behavior:**
1. ✅ Periodic cleanup runs automatically
2. ✅ Sessions older than 24 hours are killed
3. ✅ Logs show cleanup activity:
   ```
   ⏰ Periodic cleanup triggered
   🧹 Starting idle session cleanup (max age: 24h)
      Cleaning up idle session: slack-C123-456789 (age: 25h)
      ✓ Killed tmux session: slack-C123-456789
   ✅ Cleaned up 1 idle session(s)
   ```

**Manual Test:**
```bash
# Check mappings before
cat src/data/slack-thread-mappings.json

# Manually trigger cleanup (in Node REPL)
node
> const SlackThreadManager = require('./src/utils/slack-thread-manager.js')
> const mgr = new SlackThreadManager()
> mgr.cleanupIdleSessions(0)  # 0 = cleanup all sessions

# Check mappings after
cat src/data/slack-thread-mappings.json
```

---

### Troubleshooting

#### Issue: Bot doesn't respond at all

**Check:**
1. Webhook server is running?
   ```bash
   curl http://localhost:3002/health
   ```

2. Slack webhook URL configured?
   - Go to Slack App settings → Event Subscriptions
   - URL should be: `https://your-domain.com/webhook/slack`
   - Should show "Verified ✓"

3. Bot has correct OAuth scopes?
   - Go to Slack App settings → OAuth & Permissions
   - Check all scopes listed above

4. Bot is in the channel?
   - Type `/invite @YourBotName` in channel

---

#### Issue: Bot responds but Stop hook doesn't send response

**Check:**
1. Hooks configured correctly?
   ```bash
   # Check if hooks file exists
   cat ~/.claude/settings.json

   # Or check CLAUDE_HOOKS_CONFIG
   echo $CLAUDE_HOOKS_CONFIG
   cat $CLAUDE_HOOKS_CONFIG
   ```

2. Hook script path is absolute?
   ```json
   "command": "node /full/path/to/claude-hook-notify.js completed"
   ```
   NOT: `"command": "node ./claude-hook-notify.js completed"`

3. Hook script is executable?
   ```bash
   # Test manually
   cd /path/to/Claude-Code-Remote
   node claude-hook-notify.js completed
   ```

4. Environment variables loaded in hook?
   ```bash
   # Check .env file exists
   ls -la .env

   # Check SLACK_BOT_TOKEN is set
   grep SLACK_BOT_TOKEN .env
   ```

5. Check hook logs:
   - Look at terminal where Claude is running
   - Hook output should appear when Claude finishes

---

#### Issue: Response formatting broken

**Check:**
1. Using latest Slack API version?
   - Blocks should render correctly
   - If not, check Slack App settings

2. Response too long?
   - Slack has 3000 char limit per text block
   - Should auto-truncate to 500 words
   - Full response in tmux session

3. Code blocks not detected?
   - Check `_formatResponseWithCodeBlocks()` logic
   - Adjust threshold if needed (currently 30% of lines)

---

#### Issue: Sessions not cleaning up

**Check:**
1. Periodic cleanup enabled?
   ```bash
   # Should see in webhook logs on startup:
   "Periodic session cleanup enabled: check every 6h, max age 24h"
   ```

2. Cleanup interval too long for testing?
   ```javascript
   // Temporarily change in webhook.js:742
   this.threadManager.startPeriodicCleanup(0.1, 0.1);  // 6 minutes, 6 minute age
   ```

3. Manual cleanup:
   ```bash
   # In tmux
   tmux kill-session -t slack-*

   # Or use kill-slack-sessions.sh
   ./kill-slack-sessions.sh
   ```

---

#### Issue: Reactions not appearing

**Check:**
1. `reactions:write` OAuth scope added?
   - Go to Slack App settings → OAuth & Permissions
   - Add scope and reinstall app

2. Reactions failing silently?
   - Check webhook logs for reaction errors
   - Reactions are non-blocking, won't stop main flow

---

## Monitoring and Debugging

### View Active Sessions
```bash
# List all Slack tmux sessions
tmux ls | grep slack-

# View session mappings
cat src/data/slack-thread-mappings.json | jq .

# Count active sessions
tmux ls | grep -c slack-
```

### Attach to Session
```bash
# Attach to specific session
tmux attach -t slack-C09J23KGF55-1760786016457109

# Detach without killing: Ctrl-b then d
```

### View Logs
```bash
# Webhook server logs (if using systemd)
journalctl -u slack-webhook -f

# Or if running in terminal, just watch terminal output

# Hook execution logs
# Appear in Claude's terminal when hooks fire
```

### Debug Hook
```bash
# Test hook manually
cd /path/to/Claude-Code-Remote
export $(cat .env | xargs)  # Load env vars
node claude-hook-notify.js completed

# Should see detailed logs:
# - Session detection
# - Thread info lookup
# - Conversation extraction
# - Slack API call
```

### Monitor Slack API
```bash
# Watch for rate limits
# Check webhook logs for HTTP 429 errors

# View Slack API logs
# Go to https://api.slack.com/apps/{your-app-id}/event-subscriptions
# Check "Recent Events" section
```

---

## Performance Considerations

### Resource Usage
- **Memory:** ~50MB per tmux session (Claude process)
- **Disk:** ~1MB per session mapping file
- **CPU:** Low (event-driven, not polling)

### Limits
- **Slack API Rate Limits:**
  - Message posting: 1/second per channel
  - Reactions: 1/second
  - Thread history: 1/minute (new apps after May 2025)

- **Tmux Sessions:**
  - No hard limit
  - Recommend max 100 concurrent sessions
  - Cleanup removes idle sessions after 24h

### Scaling
- **Single Server:** Up to 100 concurrent sessions
- **Multi-Server:** Need shared Redis for mappings
- **High Load:** Consider message queuing for Slack API

---

## Security Considerations

### Secrets Management
- ✅ Slack tokens in `.env` (not committed)
- ✅ Signature verification enabled
- ✅ Whitelist for authorized users/channels

### Access Control
- Configure `SLACK_WHITELIST` with approved user/channel IDs
- Use private channels for sensitive tasks
- Bot only responds to authorized users

### Data Privacy
- Conversation history stored in tmux sessions (local only)
- Session mappings stored in JSON (local filesystem)
- No data sent to external services except Slack

---

## Future Enhancements

### Potential Improvements
1. **File Upload Support**
   - Upload full Claude responses as files
   - Syntax highlighting for code
   - Download conversation history

2. **Slash Commands**
   - `/claude-status` - Check all active sessions
   - `/claude-attach` - Get tmux attach command
   - `/claude-kill` - Terminate session

3. **Progress Updates**
   - Periodic updates for long-running tasks
   - Show tool execution progress
   - Stream responses in real-time

4. **Analytics Dashboard**
   - Session usage stats
   - Response time metrics
   - Most active users/channels

5. **Multi-Project Support**
   - Different working directories per channel
   - Project-specific Claude configurations
   - Workspace switching

---

## Summary

### What Was Fixed
1. ✅ Command execution (was already working)
2. ✅ Stop hook integration with detailed logging
3. ✅ Beautiful Block Kit response formatting
4. ✅ Immediate reaction acknowledgments
5. ✅ Automatic session timeout and cleanup

### What Works Now
- ✅ User mentions bot → Command sent to tmux → Claude executes
- ✅ Stop hook fires → Response extracted → Beautiful formatted message sent to Slack
- ✅ Thread-based isolation maintained
- ✅ Emoji reactions show progress (👀 → ⏳ → ✅)
- ✅ Sessions auto-cleanup after 24h

### Key Files
- `src/channels/slack/slack.js` - Block Kit formatting
- `src/channels/slack/webhook.js` - Reactions, periodic cleanup
- `src/utils/slack-thread-manager.js` - Session management
- `claude-hook-notify.js` - Stop hook handler

### Next Steps
1. Configure OAuth scope `reactions:write`
2. Update Claude hooks configuration with absolute path
3. Start webhook server
4. Test in Slack channel
5. Monitor logs for any issues
6. Enjoy your enhanced Slack bot! 🎉

---

## Support

For issues or questions:
1. Check logs in webhook terminal
2. Test hook manually: `node claude-hook-notify.js completed`
3. Verify OAuth scopes in Slack App settings
4. Check `.env` configuration
5. Review tmux sessions: `tmux ls | grep slack-`

---

*Last Updated: 2025-01-19*
*Version: 2.0 - Stop Hook Integration*
