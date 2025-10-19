# Unified Refactoring Plan: Hook-Driven Architecture + Code Consolidation

**Date:** 2025-10-20
**Status:** In Progress
**Branch:** `refactor/hook-driven-architecture`

---

## Progress Tracking

**Instructions**: After completing each phase, update this section with:
- ✅ or ❌ completion status
- Timestamp of completion
- Git commit hash for reference
- Any deviations or important notes

### Phase Status

| Phase | Status | Completed | Commit | Notes |
|-------|--------|-----------|--------|-------|
| Phase 1: Commit & Branch | ✅ Complete | 2025-10-20 | 219ef76 | Checkpoint created, pushed to master, branch created |
| Phase 2: Base Classes | ✅ Complete | 2025-10-20 | TBD | Created all 5 base classes and utilities, renamed ResponseFormatter to TextFormatter |
| Phase 3: Dedicated Sessions | ✅ Complete | 2025-10-20 | TBD | Telegram now uses claude-session, Slack already uses slack-* sessions |
| Phase 4: Hook-Only Architecture | ✅ Complete | 2025-10-20 | TBD | Added UserPromptSubmit hook, session filtering in hooks, direct Slack API calls |
| Phase 5: Shared Classes Refactor | ✅ Complete | 2025-10-20 | TBD | Webhooks extend BaseWebhookHandler, use AuthorizationService and TextFormatter |
| Phase 6: Testing & Validation | ✅ Complete | 2025-10-20 | TBD | All 12 files validated, shared services tested, validation report created |

---

## Overview

Transform Telegram and Slack to use consistent hook-driven architecture with dedicated sessions, while eliminating 60-75% code duplication through shared abstractions.

## Goals

1. **Consistent Architecture**: Both Telegram and Slack use hook-only approach (no polling)
2. **Session Isolation**: Dedicated sessions prevent notification spam from interactive use
3. **Code Reusability**: Shared base classes eliminate duplication
4. **Maintainability**: Cleaner, more modular codebase
5. **Better UX**: Immediate feedback with 3-state flow (Starting → Working → Completed)

---

## Session Naming Convention

```javascript
// Telegram - uses existing claude-session
const TELEGRAM_SESSION = 'claude-session';  // ✅ Matches fish functions

// Slack - creates per-thread sessions
const SLACK_SESSION_PREFIX = 'slack-';  // Creates: slack-{channelId}-{threadTs}
```

**Rationale:**
- `claude-session` - Existing default Claude session for Telegram
- `telegram-session` - Reserved for unified webhook server (ngrok/npm)
- `slack-{id}` - Per-thread isolation for concurrent Slack conversations

---

## Current State Analysis

### Problems Identified

1. **Slack uses polling (TmuxMonitor)**: Checks tmux every 2 seconds
2. **Telegram reuses user's session**: Can trigger notifications from interactive work
3. **Code duplication**: ~65% duplication between Slack/Telegram implementations
4. **Inconsistent architecture**: Slack uses callbacks, Telegram uses simple hooks
5. **Complex state management**: Slack has 3-state machine with callbacks

### Code Duplication Breakdown

| Pattern | Files | Duplication % |
|---------|-------|---------------|
| HTML escaping | 3 files | 100% |
| Authorization | 2 files | 85% |
| Bot identity caching | 2 files | 75% |
| Webhook setup | 2 files | 70% |
| Session persistence | 2 files | 60% |
| Tmux interaction | Multiple | 75% |

**Total duplication:** ~920 lines can be eliminated

---

## Phase 1: Commit Current State ✅

### Goal
Create checkpoint before major refactoring

### Actions
1. Commit all modified files:
   - `claude-hook-notify.js`
   - `src/channels/slack/slack.js`
   - `src/channels/slack/webhook.js`
   - `src/channels/telegram/telegram.js`
   - `src/channels/telegram/webhook.js`
   - `src/utils/slack-thread-manager.js`
   - `src/utils/tmux-monitor.js`
   - `src/utils/response-formatter.js` (new file)

2. Commit message:
   ```
   chore: checkpoint before hook-driven refactoring

   - Current state with Slack using TmuxMonitor polling
   - Telegram using dynamic session detection
   - Response formatter utility added
   - Before major architectural changes
   ```

3. Push to `origin/master`
4. Create branch `refactor/hook-driven-architecture`

### Estimated Time
2 minutes

---

## Phase 2: Create Shared Base Classes & Utilities 🏗️

### 2.1 Create `src/core/base-webhook-handler.js`

**Purpose:** Extract common webhook patterns

**Class Structure:**
```javascript
class BaseWebhookHandler {
    constructor(config, serviceName) {
        this.config = config;
        this.serviceName = serviceName;
        this.app = express();
        this._setupMiddleware();
        this._setupRoutes();
    }

    _setupMiddleware() {
        // JSON parsing
        this.app.use(express.json());
    }

    _setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', service: this.serviceName });
        });

        // Webhook endpoint (subclass defines path)
        this.app.post(this._getWebhookPath(), this._handleWebhook.bind(this));
    }

    // Abstract methods (must be implemented by subclasses)
    _getWebhookPath() {
        throw new Error('Must implement _getWebhookPath()');
    }

    async _handleWebhook(req, res) {
        throw new Error('Must implement _handleWebhook()');
    }

    start(port = 3000) {
        this.app.listen(port, () => {
            console.log(`${this.serviceName} webhook server started on port ${port}`);
        });
    }
}
```

**Benefits:**
- Eliminates ~150 lines of duplication
- Consistent webhook structure
- Easy to add new webhook handlers

---

### 2.2 Create `src/core/base-session-manager.js`

**Purpose:** Extract common session management patterns

**Class Structure:**
```javascript
class BaseSessionManager {
    constructor(serviceName) {
        this.serviceName = serviceName;
        this.logger = new Logger(serviceName);
        this.dataDir = path.join(__dirname, '../data');
        this.mappingFile = path.join(this.dataDir, `${serviceName}-mappings.json`);
        this.mappings = {};
        this.messageInfo = new Map(); // For hook access

        this._ensureDirectories();
        this._loadMappings();
    }

    _ensureDirectories() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    _loadMappings() {
        try {
            if (fs.existsSync(this.mappingFile)) {
                this.mappings = JSON.parse(fs.readFileSync(this.mappingFile, 'utf8'));
            } else {
                this.mappings = {};
                this._saveMappings();
            }
        } catch (error) {
            this.logger.error('Failed to load mappings:', error.message);
            this.mappings = {};
        }
    }

    _saveMappings() {
        try {
            fs.writeFileSync(this.mappingFile, JSON.stringify(this.mappings, null, 2));
        } catch (error) {
            this.logger.error('Failed to save mappings:', error.message);
        }
    }

    // Message info storage (for hooks to update messages)
    setMessageInfo(sessionName, messageInfo) {
        this.messageInfo.set(sessionName, messageInfo);
    }

    getMessageInfo(sessionName) {
        return this.messageInfo.get(sessionName);
    }

    // Cleanup methods
    cleanupStaleSessions() {
        // Implementation
    }
}
```

**Benefits:**
- Eliminates ~100 lines of duplication
- Consistent session storage
- Built-in message info tracking for hooks

---

### 2.3 Create `src/utils/authorization-service.js`

**Purpose:** Centralize authorization logic

**Implementation:**
```javascript
class AuthorizationService {
    /**
     * Check if user/channel is authorized
     * @param {string} userId - User ID
     * @param {string} channelId - Channel/Chat ID
     * @param {Object} config - Configuration with whitelist and channelId/chatId
     * @returns {boolean}
     */
    static isAuthorized(userId, channelId, config) {
        const whitelist = config.whitelist || [];

        // If whitelist exists, check it
        if (whitelist.length > 0) {
            return whitelist.includes(String(channelId)) ||
                   whitelist.includes(String(userId));
        }

        // No whitelist - check configured channel/chat
        const configuredId = config.channelId || config.chatId || config.groupId;
        if (!configuredId) {
            return true; // Open mode - allow all
        }

        return String(channelId) === String(configuredId);
    }
}

module.exports = AuthorizationService;
```

**Benefits:**
- Eliminates ~40 lines of duplication
- Consistent authorization logic
- Easy to extend with new auth methods

---

### 2.4 Enhance `src/utils/text-formatter.js`

**Purpose:** Consolidate all text formatting utilities

**Actions:**
1. Rename `response-formatter.js` → `text-formatter.js`
2. Move all `_escapeHtml()` methods here
3. Add platform-specific formatting helpers

**New Methods:**
```javascript
class TextFormatter {
    // Existing methods from ResponseFormatter
    static getResponsePreview(response, maxWords) { ... }
    static getQuestionPreview(question, maxChars) { ... }
    static getTruncationMessage(shown, total, location) { ... }
    static cleanUserQuestion(question) { ... }

    // Consolidated escaping (from 3 different files)
    static escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    static escapeMarkdown(text) {
        if (!text) return '';
        // Slack markdown escaping
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // Platform-specific formatters
    static formatResponseForSlack(text, useBlockquote = false) { ... }
    static formatResponseForTelegram(text) { ... }
}
```

**Benefits:**
- Eliminates ~50 lines of duplication
- Single source of truth for text formatting
- Platform-agnostic utilities

---

### 2.5 Create `src/core/tmux-session-helper.js`

**Purpose:** Extract common tmux operations

**Implementation:**
```javascript
class TmuxSessionHelper {
    constructor(logger) {
        this.logger = logger;
    }

    /**
     * Check if tmux session exists
     */
    sessionExists(sessionName) {
        try {
            execSync(`tmux has-session -t "${sessionName}" 2>/dev/null`, {
                stdio: 'pipe'
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Ensure session exists, create if it doesn't
     */
    ensureSession(sessionName, workingDir = process.cwd()) {
        if (this.sessionExists(sessionName)) {
            this.logger.info(`Session '${sessionName}' already exists`);
            return { created: false };
        }

        this.logger.info(`Creating session '${sessionName}'`);
        execSync(`tmux new-session -d -s "${sessionName}" -c "${workingDir}"`, {
            encoding: 'utf8',
            stdio: 'pipe'
        });

        return { created: true };
    }

    /**
     * Start Claude in a session
     */
    async startClaude(sessionName) {
        this.logger.info(`Starting Claude in session ${sessionName}`);
        execSync(`tmux send-keys -t "${sessionName}" 'claude --dangerously-skip-permissions' C-m`, {
            encoding: 'utf8',
            stdio: 'pipe'
        });

        // Wait for Claude to be ready
        return this.waitForReady(sessionName, 45000);
    }

    /**
     * Wait for Claude prompt box to appear
     */
    async waitForReady(sessionName, maxWaitMs = 45000) {
        const startTime = Date.now();
        const pollInterval = 500;
        const readyPattern = /────────────────────/;

        while (Date.now() - startTime < maxWaitMs) {
            const content = this.getContent(sessionName);

            if (readyPattern.test(content)) {
                this.logger.info(`Claude ready in session ${sessionName}`);
                await this._sleep(500); // Stability delay
                return true;
            }

            await this._sleep(pollInterval);
        }

        this.logger.warn(`Timeout waiting for Claude in ${sessionName}`);
        return false;
    }

    /**
     * Send command to session
     */
    async sendCommand(sessionName, command) {
        // Escape single quotes
        const escapedCommand = command.replace(/'/g, "'\\''");

        // Focus pane
        execSync(`tmux select-pane -t "${sessionName}"`, { stdio: 'pipe' });
        await this._sleep(300);

        // Send command text
        execSync(`tmux send-keys -t "${sessionName}" '${escapedCommand}'`, { stdio: 'pipe' });
        await this._sleep(200);

        // Send first Enter
        execSync(`tmux send-keys -t "${sessionName}" C-m`, { stdio: 'pipe' });
        await this._sleep(200);

        // Send second Enter (for multi-line mode)
        execSync(`tmux send-keys -t "${sessionName}" C-m`, { stdio: 'pipe' });

        this.logger.info(`Command sent to ${sessionName}`);
        return true;
    }

    /**
     * Get session content
     */
    getContent(sessionName, lines = 1000) {
        try {
            return execSync(`tmux capture-pane -t "${sessionName}" -p -S -${lines}`, {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore']
            });
        } catch (error) {
            this.logger.error(`Failed to get content: ${error.message}`);
            return '';
        }
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = TmuxSessionHelper;
```

**Benefits:**
- Eliminates ~200 lines of duplication
- Consistent tmux interaction across all channels
- Reliable command injection pattern

---

## Phase 3: Switch to Dedicated Sessions 🔄

### 3.1 Update Telegram to Use `claude-session`

#### File: `src/channels/telegram/telegram.js`

**Add constant:**
```javascript
const TELEGRAM_SESSION = 'claude-session';
```

**Add method:**
```javascript
_ensureTelegramSession() {
    const helper = new TmuxSessionHelper(this.logger);
    const result = helper.ensureSession(TELEGRAM_SESSION);

    if (result.created) {
        // Session was just created, start Claude
        helper.startClaude(TELEGRAM_SESSION);
    }
}
```

**Update constructor:**
```javascript
constructor(config = {}) {
    super('telegram', config);
    this.sessionName = TELEGRAM_SESSION;
    // ... other init
    this._ensureTelegramSession();
}
```

**Remove:**
- `_getCurrentTmuxSession()` method

**Update `_sendImpl()`:**
```javascript
async _sendImpl(notification) {
    // ... validation

    // Always use TELEGRAM_SESSION
    notification.metadata = {
        tmuxSession: TELEGRAM_SESSION,
        userQuestion: conversation.userQuestion,
        claudeResponse: conversation.claudeResponse
    };

    // ... rest of implementation
}
```

---

#### File: `src/channels/telegram/webhook.js`

**Update constant:**
```javascript
const TELEGRAM_SESSION = 'claude-session';
```

**Update `_processCommand()`:**
```javascript
async _processCommand(chatId, token, command) {
    const session = await this._findSessionByToken(token);
    // ... validation

    try {
        // Always inject to claude-session
        await this.injector.injectCommand(command, TELEGRAM_SESSION);

        await this._sendMessage(chatId,
            `✅ *Command sent successfully*\n\n` +
            `📝 *Command:* ${command}\n` +
            `🖥️ *Session:* ${TELEGRAM_SESSION}\n\n` +
            `Claude is now processing your request...`,
            { parse_mode: 'Markdown' });
    } catch (error) {
        // ... error handling
    }
}
```

---

### 3.2 Slack Already Uses Dedicated Sessions ✅

**No changes needed** - Slack already creates `slack-{channelId}-{threadTs}` sessions per thread.

---

## Phase 4: Switch to Hook-Only Architecture 🪝

### 4.1 Update `~/.claude/settings.json`

**Replace existing hooks with:**
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node /home/kai/Documents/dev/Claude-Code-Remote/claude-hook-notify.js working",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node /home/kai/Documents/dev/Claude-Code-Remote/claude-hook-notify.js completed",
            "timeout": 5
          }
        ]
      }
    ]
  },
  "statusLine": {
    "type": "command",
    "command": "npx -y ccusage statusline",
    "padding": 0
  },
  "alwaysThinkingEnabled": true
}
```

**Changes:**
- Remove `SubagentStop` hook
- Add `UserPromptSubmit` hook with "working" notification

**Hook Flow:**
1. User submits prompt → `UserPromptSubmit` fires → "working" state
2. Claude finishes → `Stop` fires → "completed" state

---

### 4.2 Update `claude-hook-notify.js`

**Add session filtering (after line 148):**
```javascript
async function sendHookNotification() {
    try {
        const notificationType = process.argv[2] || 'completed';
        console.log('='.repeat(80));
        console.log('🔔 HOOK FIRED');
        console.log(`📊 Type: ${notificationType}`);
        console.log(`📊 CWD: ${process.cwd()}`);

        // Get current tmux session
        const tmuxSession = getTmuxSession();
        console.log(`🖥️ Tmux session: ${tmuxSession}`);

        // === SESSION FILTERING ===

        // Handle Slack threads (slack-*)
        if (tmuxSession && tmuxSession.startsWith('slack-')) {
            console.log(`📱 SLACK SESSION DETECTED: ${tmuxSession}`);
            const result = await sendSlackThreadNotification(
                tmuxSession,
                notificationType,
                path.basename(process.cwd())
            );
            console.log(`✅ Slack notification: ${result ? 'SUCCESS' : 'FAILED'}`);
            return;
        }

        // Handle Telegram (claude-session)
        if (tmuxSession === 'claude-session') {
            console.log(`📱 TELEGRAM SESSION DETECTED: ${tmuxSession}`);
            // Continue to standard notification flow (Telegram channel)
        } else {
            // Skip all other sessions (user's interactive work)
            console.log(`⏭️ Skipping notification for session: ${tmuxSession}`);
            console.log(`   Only claude-session and slack-* trigger notifications`);
            return;
        }

        // Standard notification flow for Telegram
        const channels = [];
        // ... rest of existing code for Telegram/Desktop/Email
    }
}

function getTmuxSession() {
    try {
        const { execSync } = require('child_process');
        return execSync('tmux display-message -p "#S"', {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
    } catch (error) {
        return null;
    }
}
```

**Update `sendSlackThreadNotification()` to handle both states:**
```javascript
async function sendSlackThreadNotification(sessionName, notificationType, projectName) {
    try {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`💼 Slack Thread Notification Handler`);
        console.log(`📊 Session: ${sessionName}`);
        console.log(`📊 Type: ${notificationType}`); // "working" or "completed"
        console.log(`📊 Project: ${projectName}`);

        // Load thread manager
        const SlackThreadManager = require('./src/utils/slack-thread-manager');
        const threadManager = new SlackThreadManager();

        // Get thread info by session name
        const threadInfo = threadManager.getThreadInfoBySessionName(sessionName);
        if (!threadInfo) {
            console.error(`❌ No thread info found for session ${sessionName}`);
            return false;
        }

        console.log(`✓ Thread found: ${threadInfo.channelId}:${threadInfo.threadTs}`);

        // Get message info (botMessageTs, userMessageTs)
        const messageInfo = threadManager.getThreadMessageInfo(sessionName);
        if (!messageInfo) {
            console.error(`❌ No message info found for session ${sessionName}`);
            return false;
        }

        // Extract conversation from tmux
        const TmuxMonitor = require('./src/utils/tmux-monitor');
        const tmuxMonitor = new TmuxMonitor();
        const conversation = tmuxMonitor.getRecentConversation(sessionName, 5000);

        console.log(`✓ Conversation extracted (${conversation.claudeResponse?.length || 0} chars)`);

        // Load Slack channel for API calls
        const SlackChannel = require('./src/channels/slack/slack');
        const slackChannel = new SlackChannel({
            botToken: process.env.SLACK_BOT_TOKEN
        });

        // Update message based on notification type
        if (notificationType === 'working') {
            // === WORKING STATE ===
            const workingMessage =
                `:hourglass_flowing_sand: *Claude is working*\n\n` +
                `:computer: *Session:* \`${sessionName}\`\n` +
                `:memo: *Request:* ${conversation.userQuestion?.substring(0, 200) || 'Processing...'}\n\n` +
                `Processing your request...`;

            await slackChannel.updateMessage(
                threadInfo.channelId,
                messageInfo.botMessageTs,
                workingMessage
            );

            // Update reactions: eyes → hourglass
            await slackChannel.removeReaction(threadInfo.channelId, messageInfo.userMessageTs, 'eyes');
            await slackChannel.addReaction(threadInfo.channelId, messageInfo.userMessageTs, 'hourglass_flowing_sand');

            console.log(`✅ Updated to "working" state`);
        }

        if (notificationType === 'completed') {
            // === COMPLETED STATE ===
            const TextFormatter = require('./src/utils/text-formatter');
            const { preview, truncated, totalWords } =
                TextFormatter.getResponsePreview(conversation.claudeResponse, 100);

            let completedMessage = `:white_check_mark: *Task Completed*\n\n`;

            // Add user question
            if (conversation.userQuestion && conversation.userQuestion !== 'No user input') {
                const questionPreview = conversation.userQuestion.substring(0, 300);
                completedMessage += `📝 *Your Question:*\n> ${questionPreview}\n\n`;
            }

            // Add response preview
            if (conversation.claudeResponse && conversation.claudeResponse !== 'No Claude response') {
                completedMessage += `🤖 *Claude Response Preview:*\n\`\`\`\n${preview}\n\`\`\``;

                if (truncated) {
                    completedMessage += `\n\n_💡 Showing first 100 of ${totalWords} words. Full response in tmux._`;
                }
            }

            completedMessage += `\n\n:computer: _Session: \`${sessionName}\`_`;

            await slackChannel.updateMessage(
                threadInfo.channelId,
                messageInfo.botMessageTs,
                completedMessage
            );

            // Update reactions: hourglass → checkmark
            await slackChannel.removeReaction(threadInfo.channelId, messageInfo.userMessageTs, 'hourglass_flowing_sand');
            await slackChannel.addReaction(threadInfo.channelId, messageInfo.userMessageTs, 'white_check_mark');

            console.log(`✅ Updated to "completed" state`);
        }

        console.log(`${'='.repeat(60)}\n`);
        return true;

    } catch (error) {
        console.error(`❌ Slack notification error:`, error.message);
        console.error(error.stack);
        return false;
    }
}
```

---

### 4.3 Simplify Slack Webhook Handler

#### File: `src/channels/slack/webhook.js`

**Remove these entire methods:**
- `_handleClaudeResponse()` (lines 391-452)
- `_updateThreadState()` (lines 1017-1102)
- `_formatClaudeResponse()` (lines 454-498)

**Simplify constructor:**
```javascript
constructor(config = {}) {
    this.config = config;
    this.logger = new Logger('SlackWebhook');
    this.threadManager = new SlackThreadManager();
    this.app = express();
    this.apiBaseUrl = 'https://slack.com/api';
    this.botUserId = null;

    // Simple message tracking (for hook access)
    this.threadMessages = new Map();

    this._setupMiddleware();
    this._setupRoutes();
}
```

**Simplify `_processPrompt()`:**
```javascript
async _processPrompt(channelId, threadTs, messageTs, prompt) {
    try {
        this.logger.info(`📥 Processing prompt for channel ${channelId}, thread ${threadTs}`);

        const threadKey = `${channelId}:${threadTs}`;
        const promptPreview = prompt.substring(0, 100) + (prompt.length > 100 ? '...' : '');

        // Get or create tmux session
        const session = this.threadManager.getOrCreateSession(channelId, threadTs);
        this.logger.info(`Session: ${session.sessionName}, isNew: ${session.isNew}`);

        // Send initial "Starting" message
        const startingMessage =
            `:hourglass_flowing_sand: *Starting Claude session*\n\n` +
            `:computer: *Session:* \`${session.sessionName}\`\n` +
            `:memo: *Your Request:* ${promptPreview}\n\n` +
            `Setting up your Claude session...`;

        const botMessageTs = await this._sendMessage(channelId, startingMessage, threadTs);
        if (!botMessageTs) {
            throw new Error('Failed to send starting message');
        }

        // Store message info for hook access
        const messageInfo = {
            userMessageTs: messageTs,
            botMessageTs: botMessageTs,
            channelId: channelId,
            threadTs: threadTs,
            sessionName: session.sessionName,
            timestamp: Date.now()
        };

        this.threadMessages.set(threadKey, messageInfo);
        this.threadManager.setThreadMessageInfo(session.sessionName, messageInfo);

        // Add eyes reaction
        await this._addReaction(channelId, messageTs, 'eyes');

        if (session.isNew) {
            // === NEW SESSION ===

            // Get thread context
            let threadContext = '';
            try {
                const threadHistory = await this._getThreadConversation(channelId, threadTs);
                if (threadHistory) {
                    threadContext = threadHistory + '\n\n';
                }
            } catch (error) {
                this.logger.warn(`Failed to get thread context: ${error.message}`);
            }

            // Construct full prompt
            const fullPrompt = (threadContext + `User request: ${prompt}`)
                .replace(/\n/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            // Start Claude (hooks will handle state updates)
            await this.threadManager.startClaudeInSession(
                session.sessionName,
                `/bg-workflow ${fullPrompt}`
            );

            this.logger.info(`✅ Claude started - hooks will update message`);

        } else {
            // === CONTINUING CONVERSATION ===

            this.logger.info(`♻️ Continuing session: ${session.sessionName}`);

            // Get new user messages
            let newMessagesContext = '';
            try {
                const newMessages = await this._getNewUserMessagesForContinuation(channelId, threadTs);
                if (newMessages) {
                    newMessagesContext = newMessages + '\n\n';
                }
            } catch (error) {
                this.logger.warn(`Failed to get new messages: ${error.message}`);
            }

            // Construct prompt
            const fullPrompt = (newMessagesContext + `Current user request: ${prompt}`)
                .replace(/\n/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            // Send to existing session (hooks will handle state updates)
            await this.threadManager.sendToSession(
                session.sessionName,
                `/bg-workflow ${fullPrompt}`
            );

            this.logger.info(`✅ Command sent - hooks will update message`);
        }

    } catch (error) {
        this.logger.error(`❌ Failed to process prompt: ${error.message}`);
        await this._sendMessage(
            channelId,
            `:x: *Failed to process request*\n\nError: ${error.message}`,
            threadTs
        );
    }
}
```

**Result:** ~400 lines removed, much simpler logic

---

### 4.4 Simplify Slack Thread Manager

#### File: `src/utils/slack-thread-manager.js`

**Remove from constructor:**
```javascript
// DELETE these lines
this.monitors = new Map();
this.responseCallbacks = new Map();
this.monitoringStartTimes = new Map();
```

**Add to constructor:**
```javascript
// ADD this line
this.threadMessageInfo = new Map(); // For hook access to message timestamps
```

**Remove these entire methods:**
- `setResponseCallback()` (lines 449-456)
- `_startMonitoring()` (lines 461-496)
- `ensureMonitoring()` (lines 501-506)
- `_handleTaskCompleted()` (lines 510-540)
- `_handleWaitingForInput()` (lines 545-597)
- `_waitForBufferStabilization()` (lines 603-634)
- `_stopMonitoring()` (lines 660-669)

**Add these new methods:**
```javascript
/**
 * Store message info for hook access
 */
setThreadMessageInfo(sessionName, messageInfo) {
    this.threadMessageInfo.set(sessionName, messageInfo);
    this.logger.info(`Stored message info for session ${sessionName}`);
}

/**
 * Get message info for hooks
 */
getThreadMessageInfo(sessionName) {
    return this.threadMessageInfo.get(sessionName);
}
```

**Update `startClaudeInSession()` - remove monitoring call:**
```javascript
async startClaudeInSession(sessionName, command) {
    try {
        // ... existing implementation ...

        // DELETE these lines at the end:
        // this.logger.info(`👁️ Starting monitoring for session ${sessionName}`);
        // this._startMonitoring(sessionName);

        this.logger.info(`✅ Claude session ${sessionName} initialized`);
        return true;
    } catch (error) {
        // ... error handling
    }
}
```

**Update `removeSession()` to clean message info:**
```javascript
removeSession(channelId, threadTs) {
    const threadId = this._getThreadId(channelId, threadTs);

    if (this.mappings[threadId]) {
        const sessionName = this.mappings[threadId].sessionName;

        // Remove message info
        this.threadMessageInfo.delete(sessionName);

        delete this.mappings[threadId];
        this._saveMappings();
        this.logger.info(`Removed mapping for thread ${threadId}`);
    }
}
```

**Result:** ~300 lines removed

---

## Phase 5: Refactor to Use Shared Classes 🔨

### 5.1 Refactor Slack Webhook

#### File: `src/channels/slack/webhook.js`

**Extend BaseWebhookHandler:**
```javascript
const BaseWebhookHandler = require('../../core/base-webhook-handler');
const AuthorizationService = require('../../utils/authorization-service');

class SlackWebhookHandler extends BaseWebhookHandler {
    constructor(config = {}) {
        super(config, 'slack-webhook');
        this.threadManager = new SlackThreadManager();
        this.botUserId = null;
        this.threadMessages = new Map();
    }

    _getWebhookPath() {
        return '/webhook/slack';
    }

    async _handleWebhook(req, res) {
        // Implement Slack-specific webhook handling
        // ... existing logic
    }

    _isAuthorized(userId, channelId) {
        return AuthorizationService.isAuthorized(userId, channelId, this.config);
    }
}
```

---

### 5.2 Refactor Telegram Webhook

#### File: `src/channels/telegram/webhook.js`

**Extend BaseWebhookHandler:**
```javascript
const BaseWebhookHandler = require('../../core/base-webhook-handler');
const AuthorizationService = require('../../utils/authorization-service');

class TelegramWebhookHandler extends BaseWebhookHandler {
    constructor(config = {}) {
        super(config, 'telegram-webhook');
        this.sessionsDir = path.join(__dirname, '../../data/sessions');
        this.injector = new ControllerInjector();
        this.apiBaseUrl = 'https://api.telegram.org';
        this.botUsername = null;
    }

    _getWebhookPath() {
        return '/webhook/telegram';
    }

    async _handleWebhook(req, res) {
        // Implement Telegram-specific webhook handling
        // ... existing logic
    }

    _isAuthorized(userId, chatId) {
        return AuthorizationService.isAuthorized(userId, chatId, this.config);
    }
}
```

---

### 5.3 Refactor Slack Thread Manager

#### File: `src/utils/slack-thread-manager.js`

**Extend BaseSessionManager:**
```javascript
const BaseSessionManager = require('../core/base-session-manager');
const TmuxSessionHelper = require('../core/tmux-session-helper');

class SlackThreadManager extends BaseSessionManager {
    constructor() {
        super('slack-threads');
        this.tmuxHelper = new TmuxSessionHelper(this.logger);
    }

    // Use tmuxHelper for all tmux operations
    getOrCreateSession(channelId, threadTs) {
        // ... use this.tmuxHelper.ensureSession()
    }

    async startClaudeInSession(sessionName, command) {
        // ... use this.tmuxHelper.startClaude() and sendCommand()
    }

    async sendToSession(sessionName, command) {
        // ... use this.tmuxHelper.sendCommand()
    }
}
```

---

### 5.4 Update Channel Classes

#### File: `src/channels/slack/slack.js`

**Remove duplicated methods:**
```javascript
const TextFormatter = require('../../utils/text-formatter');

class SlackChannel extends NotificationChannel {
    // Remove _escapeSlackText() - use TextFormatter.escapeMarkdown()

    _generateSlackMessage(notification) {
        // Use TextFormatter.escapeMarkdown() instead of this._escapeSlackText()
    }
}
```

#### File: `src/channels/telegram/telegram.js`

**Remove duplicated methods:**
```javascript
const TextFormatter = require('../../utils/text-formatter');

class TelegramChannel extends NotificationChannel {
    // Remove _escapeHtml() - use TextFormatter.escapeHtml()

    async _generateTelegramMessage(notification, sessionId, token) {
        // Use TextFormatter.escapeHtml() instead of this._escapeHtml()
    }
}
```

---

## Phase 6: Testing & Validation ✅

### 6.1 Unit Testing Checklist

**Telegram Tests:**
- [ ] Webhook starts and creates `claude-session`
- [ ] Session persists across webhook restarts
- [ ] `/cmd TOKEN command` injects to `claude-session` only
- [ ] UserPromptSubmit hook fires → "Working" notification sent
- [ ] Stop hook fires → "Completed" notification sent
- [ ] Other tmux sessions don't trigger Telegram notifications
- [ ] Token validation works
- [ ] Expired tokens are rejected
- [ ] Conversation extraction from tmux works

**Slack Tests:**
- [ ] Webhook starts successfully
- [ ] New thread creates `slack-{channelId}-{threadTs}` session
- [ ] Initial "Starting..." message appears
- [ ] Eyes reaction (👀) added to user message
- [ ] UserPromptSubmit hook fires → Message edits to "Working..." with hourglass (⏳)
- [ ] Stop hook fires → Message edits to "Completed" with checkmark (✅)
- [ ] Continuing conversation in same thread reuses session
- [ ] Thread context is captured and sent to Claude
- [ ] Multiple concurrent threads work independently
- [ ] Session cleanup works

**Session Isolation Tests:**
- [ ] Interactive work in `claude-real` session → No notifications
- [ ] Work in custom session `my-project` → No notifications
- [ ] Only `claude-session` triggers Telegram notifications
- [ ] Only `slack-*` sessions trigger Slack thread updates

**Shared Code Tests:**
- [ ] AuthorizationService works for both platforms
- [ ] TextFormatter.escapeHtml() works correctly
- [ ] TmuxSessionHelper creates sessions
- [ ] TmuxSessionHelper waits for Claude ready
- [ ] TmuxSessionHelper sends commands reliably

---

### 6.2 Integration Testing Scenarios

**Scenario 1: Telegram End-to-End**
1. Start Telegram webhook
2. Send `/start` command → Verify welcome message
3. Wait for Claude task completion → Notification arrives
4. Send `/cmd TOKEN fix bug` → Verify injection to claude-session
5. Verify UserPromptSubmit → "Working" notification
6. Wait for completion → "Completed" notification
7. Verify response preview in notification

**Scenario 2: Slack End-to-End**
1. Start Slack webhook
2. Mention bot in new thread → Verify session creation
3. Verify "Starting..." message appears immediately
4. Verify UserPromptSubmit → Message updates to "Working..."
5. Wait for completion → Message updates to "Completed"
6. Verify reactions: 👀 → ⏳ → ✅
7. Reply in same thread → Verify continuation works

**Scenario 3: Concurrent Sessions**
1. Start both webhooks
2. Trigger Telegram command
3. Simultaneously mention bot in 3 different Slack threads
4. Verify all 4 sessions run independently
5. Verify correct notifications for each platform

**Scenario 4: Error Handling**
1. Kill Claude in active session
2. Send command → Verify error handling
3. Restart Claude → Verify recovery
4. Send invalid command → Verify error message

---

### 6.3 Performance Testing

**Metrics to Track:**
- [ ] Webhook response time (should be <500ms)
- [ ] Time to create new session (<3s)
- [ ] Time to send command to existing session (<1s)
- [ ] Hook execution time (<2s)
- [ ] Message update latency (<1s)
- [ ] Memory usage with 10 concurrent Slack threads
- [ ] CPU usage (should drop significantly without polling)

---

## Summary of Changes

### Code Metrics

| Component | Lines Removed | Lines Added | Net Change |
|-----------|---------------|-------------|------------|
| Base Classes (new) | 0 | +400 | +400 |
| Utilities (new/enhanced) | -100 | +150 | +50 |
| Slack Webhook | -400 | +50 | -350 |
| Slack Thread Manager | -300 | +30 | -270 |
| Telegram Channel | -50 | +80 | +30 |
| Telegram Webhook | -40 | +20 | -20 |
| Hook Notify | -30 | +100 | +70 |
| **TOTAL** | **-920** | **+830** | **-90 lines** |

### Architecture Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Code Duplication** | ~920 lines | ~325 lines | -65% |
| **Polling Overhead** | 2s intervals | None | -100% |
| **State Complexity** | 3-state machine + callbacks | Hook-driven events | -75% |
| **Session Isolation** | None | Full | +100% |
| **Notification Accuracy** | Delayed (SubagentStop) | Immediate (UserPromptSubmit) | +50% |

---

## Expected Benefits

### 1. **Consistency**
- Both platforms use same hook-driven approach
- Shared base classes ensure uniform behavior
- Easier to understand and maintain

### 2. **Performance**
- No polling (saves CPU cycles)
- Immediate feedback via UserPromptSubmit
- Lower memory usage

### 3. **Reliability**
- Session isolation prevents notification spam
- Hook-based architecture is event-driven (no timing issues)
- Simpler code = fewer bugs

### 4. **Maintainability**
- 65% less duplicated code
- Clear separation of concerns
- Easy to add new channels (extend base classes)

### 5. **Developer Experience**
- Clear flow: Starting → Working → Completed
- Predictable session naming
- Easy debugging (dedicated sessions)

---

## Rollback Plan

If issues arise during refactoring:

1. **Immediate:** Revert to `master` branch
2. **Partial:** Cherry-pick specific commits from refactoring branch
3. **Recovery:** Use git tags to mark known-good states

**Git Tags:**
- `pre-refactor` - Before any changes
- `phase2-complete` - After base classes added
- `phase3-complete` - After dedicated sessions
- `phase4-complete` - After hook-only architecture
- `phase5-complete` - After shared classes refactor

---

## Timeline Estimate

| Phase | Estimated Time | Complexity |
|-------|----------------|------------|
| Phase 1: Commit & Branch | 5 minutes | Low |
| Phase 2: Base Classes | 2 hours | Medium |
| Phase 3: Dedicated Sessions | 1 hour | Low |
| Phase 4: Hook-Only Architecture | 2 hours | High |
| Phase 5: Shared Classes Refactor | 3 hours | Medium |
| Phase 6: Testing | 2 hours | Medium |
| **TOTAL** | **~10 hours** | |

---

## Success Criteria

Refactoring is considered successful when:

1. ✅ All tests pass (Telegram + Slack)
2. ✅ No notifications from interactive sessions
3. ✅ Code duplication reduced by >60%
4. ✅ Hook-only architecture (no polling)
5. ✅ Message flow works: Starting → Working → Completed
6. ✅ Session isolation verified
7. ✅ Performance metrics met
8. ✅ Documentation updated

---

## Next Steps

1. Review and approve this plan
2. Commit current state
3. Create refactoring branch
4. Begin Phase 2 (base classes)
5. Iterate through phases with testing after each

---

## Questions & Clarifications

**Q: Why remove SubagentStop?**
A: UserPromptSubmit fires immediately when work starts (better UX). SubagentStop fires after work completes, which is confusing timing for "waiting" state.

**Q: Why `claude-session` instead of creating unique Telegram sessions?**
A: Telegram commands are sequential (token-based), not concurrent. One session is sufficient and matches existing convention.

**Q: What if hooks fail?**
A: Hooks have 5s timeout. If they fail, worst case is user doesn't see state updates. Session still works, just no visual feedback.

**Q: Can we add more channels later?**
A: Yes! Extend `BaseWebhookHandler` and implement `_handleWebhook()`. Follow the same pattern.

**Q: Impact on existing users?**
A: Session naming is preserved (`claude-session`, `slack-*`). Hooks are enhanced, not breaking. Should be transparent.

---

**Document Version:** 1.0
**Last Updated:** 2025-10-20
**Author:** Claude + User Collaboration
