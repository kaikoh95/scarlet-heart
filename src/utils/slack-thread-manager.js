/**
 * Slack Thread Manager
 * Manages mappings between Slack threads and tmux sessions
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Logger = require('../core/logger');
const TmuxMonitor = require('./tmux-monitor');

class SlackThreadManager {
    constructor() {
        this.logger = new Logger('SlackThreadManager');
        this.dataDir = path.join(__dirname, '../data');
        this.mappingFile = path.join(this.dataDir, 'slack-thread-mappings.json');
        this.monitors = new Map(); // Map of sessionName -> TmuxMonitor instance
        this.responseCallbacks = new Map(); // Map of sessionName -> callback data
        this.monitoringStartTimes = new Map(); // Map of sessionName -> timestamp when monitoring started
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

    /**
     * Generate a unique tmux session name for a Slack thread
     * Format: slack-{sanitized_channel_id}-{sanitized_thread_ts}
     */
    _generateSessionName(channelId, threadTs) {
        // Sanitize IDs to be tmux-safe (alphanumeric and hyphens only)
        const sanitizedChannel = channelId.replace(/[^a-zA-Z0-9]/g, '');
        const sanitizedThread = threadTs.replace(/[^a-zA-Z0-9]/g, '');

        // Truncate if too long (tmux session names should be reasonable length)
        const maxLength = 50;
        const sessionName = `slack-${sanitizedChannel}-${sanitizedThread}`;

        return sessionName.substring(0, maxLength);
    }

    /**
     * Get thread ID (unique identifier for a thread)
     * Format: {channel_id}:{thread_ts}
     */
    _getThreadId(channelId, threadTs) {
        return `${channelId}:${threadTs}`;
    }

    /**
     * Get or create tmux session for a Slack thread
     * Returns: { sessionName, isNew, workingDir }
     */
    getOrCreateSession(channelId, threadTs) {
        const threadId = this._getThreadId(channelId, threadTs);
        this.logger.info(`🔍 Looking up session for thread: ${threadId}`);
        this.logger.info(`   Channel: ${channelId}, ThreadTS: ${threadTs}`);

        // Check if mapping exists
        if (this.mappings[threadId]) {
            const sessionName = this.mappings[threadId].sessionName;
            this.logger.info(`   Found mapping: ${sessionName}`);

            // Verify tmux session still exists
            if (this._tmuxSessionExists(sessionName)) {
                this.logger.info(`✅ Reusing existing tmux session: ${sessionName}`);
                return {
                    sessionName,
                    isNew: false,
                    workingDir: this.mappings[threadId].workingDir || process.cwd()
                };
            } else {
                this.logger.warn(`⚠️ Mapped tmux session ${sessionName} no longer exists, will create new one`);
                delete this.mappings[threadId];
                this._saveMappings();
            }
        } else {
            this.logger.info(`   No existing mapping found for thread ${threadId}`);
        }

        // Create new tmux session
        const sessionName = this._generateSessionName(channelId, threadTs);
        const workingDir = process.cwd();
        this.logger.info(`🆕 Creating new tmux session: ${sessionName}`);

        try {
            // Create new tmux session in detached mode
            execSync(`tmux new-session -d -s "${sessionName}" -c "${workingDir}"`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });

            // Store mapping
            this.mappings[threadId] = {
                sessionName,
                channelId,
                threadTs,
                workingDir,
                createdAt: new Date().toISOString()
            };
            this._saveMappings();

            this.logger.info(`✅ Created new tmux session: ${sessionName} for thread: ${threadId}`);
            return {
                sessionName,
                isNew: true,
                workingDir
            };
        } catch (error) {
            this.logger.error(`❌ Failed to create tmux session: ${error.message}`);
            throw new Error(`Failed to create tmux session: ${error.message}`);
        }
    }

    /**
     * Check if a tmux session exists
     */
    _tmuxSessionExists(sessionName) {
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
     * Get existing session for a thread (if it exists)
     */
    getSession(channelId, threadTs) {
        const threadId = this._getThreadId(channelId, threadTs);

        if (!this.mappings[threadId]) {
            return null;
        }

        const sessionName = this.mappings[threadId].sessionName;

        // Verify session still exists
        if (!this._tmuxSessionExists(sessionName)) {
            this.logger.warn(`Session ${sessionName} no longer exists`);
            delete this.mappings[threadId];
            this._saveMappings();
            return null;
        }

        return {
            sessionName,
            workingDir: this.mappings[threadId].workingDir || process.cwd(),
            createdAt: this.mappings[threadId].createdAt
        };
    }

    /**
     * Send command to tmux session
     * This is used for continuing an existing Claude conversation
     */
    async sendToSession(sessionName, command) {
        try {
            this.logger.info(`📤 Sending command to session ${sessionName}: ${command.substring(0, 50)}...`);

            // Ensure the pane is focused
            this._focusPane(sessionName);

            // Wait a moment for pane to be ready
            await this._sleep(300);

            // Escape single quotes in command
            const escapedCommand = command.replace(/'/g, "'\\''");

            // Step 1: Send the command text (without Enter)
            execSync(`tmux send-keys -t "${sessionName}" '${escapedCommand}'`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });
            this.logger.info(`✓ Sent command text: ${command.substring(0, 80)}...`);

            // Wait a brief moment for the text to be sent
            await this._sleep(200);

            // Step 2: Send first Enter to execute
            execSync(`tmux send-keys -t "${sessionName}" C-m`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });
            this.logger.info(`✓ Sent first Enter key (C-m) to execute command`);

            // Wait another brief moment
            await this._sleep(200);

            // Step 3: Send second Enter to ensure execution (in case multi-line mode was triggered)
            execSync(`tmux send-keys -t "${sessionName}" C-m`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });
            this.logger.info(`✓ Sent second Enter key to ensure execution`);

            this.logger.info(`✅ Command fully sent and executed in session ${sessionName}`);
            return true;
        } catch (error) {
            this.logger.error(`❌ Failed to send command to tmux: ${error.message}`);
            throw new Error(`Failed to send command to tmux: ${error.message}`);
        }
    }

    /**
     * Send text to tmux session without Enter
     */
    _sendText(sessionName, text) {
        try {
            // Escape single quotes in text
            const escapedText = text.replace(/'/g, "'\\''");

            // Send text to tmux session WITHOUT Enter
            execSync(`tmux send-keys -t "${sessionName}" '${escapedText}'`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });

            this.logger.info(`Sent text to tmux session ${sessionName}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to send text to tmux: ${error.message}`);
            throw new Error(`Failed to send text to tmux: ${error.message}`);
        }
    }

    /**
     * Send ENTER key to tmux session (for confirmation/execution)
     */
    _sendEnter(sessionName) {
        try {
            execSync(`tmux send-keys -t "${sessionName}" Enter`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });

            this.logger.info(`Sent ENTER to tmux session ${sessionName}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to send ENTER to tmux: ${error.message}`);
            throw new Error(`Failed to send ENTER to tmux: ${error.message}`);
        }
    }

    /**
     * Sleep for specified milliseconds
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Ensure tmux pane has focus
     */
    _focusPane(sessionName) {
        try {
            execSync(`tmux select-pane -t "${sessionName}"`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });
            this.logger.info(`Focused tmux pane ${sessionName}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to focus tmux pane: ${error.message}`);
            return false;
        }
    }

    /**
     * Get current tmux pane content
     */
    _getTmuxContent(sessionName) {
        try {
            const content = execSync(`tmux capture-pane -t "${sessionName}" -p`, {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore']
            });
            return content;
        } catch (error) {
            this.logger.error(`Failed to get tmux content: ${error.message}`);
            return '';
        }
    }

    /**
     * Wait for Claude to be ready (waiting for input)
     * Returns true when Claude is ready, false on timeout
     */
    async _waitForClaudeReady(sessionName, maxWaitMs = 45000) {
        const startTime = Date.now();
        const pollInterval = 500; // Poll every 500ms

        // Simple and reliable pattern: look for the horizontal line separator followed by prompt
        // This is what Telegram/TmuxMonitor uses: ────────────────────
        const readyPattern = /────────────────────/;

        this.logger.info(`⏳ Waiting for Claude to be ready in session ${sessionName}...`);

        while (Date.now() - startTime < maxWaitMs) {
            const content = this._getTmuxContent(sessionName);

            // Check if we see the command prompt box (horizontal line separator)
            if (readyPattern.test(content)) {
                this.logger.info(`✓ Claude is ready in session ${sessionName} (detected prompt box)`);
                // Wait a bit more to ensure stability
                await this._sleep(500);
                return true;
            }

            // Log progress every 5 seconds
            const elapsed = Date.now() - startTime;
            if (elapsed % 5000 < pollInterval) {
                const lastLines = content.split('\n').slice(-2).join(' | ');
                this.logger.debug(`  Still waiting (${Math.round(elapsed/1000)}s): ${lastLines.substring(0, 100)}`);
            }

            // Wait before next poll
            await this._sleep(pollInterval);
        }

        this.logger.warn(`⚠️ Timeout waiting for Claude to be ready in session ${sessionName} (${maxWaitMs}ms)`);
        const lastContent = this._getTmuxContent(sessionName);
        const lastLines = lastContent.split('\n').slice(-5).join('\n');
        this.logger.warn(`Last output:\n${lastLines}`);
        return false;
    }

    /**
     * Start Claude in tmux session with initial command
     */
    async startClaudeInSession(sessionName, command) {
        try {
            this.logger.info(`🚀 Starting Claude in tmux session ${sessionName}`);

            // Ensure the pane exists and is focused
            if (!this._focusPane(sessionName)) {
                throw new Error(`Failed to focus tmux pane ${sessionName}`);
            }

            // Step 1: Launch Claude with --dangerously-skip-permissions
            this.logger.info(`📋 Step 1/3: Launching Claude CLI...`);
            execSync(`tmux send-keys -t "${sessionName}" 'claude --dangerously-skip-permissions' C-m`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });

            // Step 2: Wait for Claude to be ready (polling with 45s timeout)
            this.logger.info(`⏳ Step 2/3: Waiting for Claude to initialize...`);
            const isReady = await this._waitForClaudeReady(sessionName, 45000);

            if (!isReady) {
                this.logger.warn('⚠️ Claude did not become ready within timeout, sending command anyway...');
                // Get last few lines for debugging
                const content = this._getTmuxContent(sessionName);
                const lastLines = content.split('\n').slice(-5).join('\n');
                this.logger.warn(`Last output:\n${lastLines}`);
            }

            // Ensure focus is still on the pane
            this._focusPane(sessionName);

            // Wait a moment before sending command
            await this._sleep(500);

            // Step 3: Send the /bg-workflow command with C-m (Enter key)
            // Note: The command should NOT contain newlines (caller must replace them)
            this.logger.info(`📤 Step 3/3: Sending /bg-workflow command and executing...`);
            const escapedCommand = command.replace(/'/g, "'\\''");

            // Send the command
            execSync(`tmux send-keys -t "${sessionName}" '${escapedCommand}'`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });
            this.logger.info(`✓ Sent command text: ${command.substring(0, 80)}...`);

            // Wait a brief moment for the text to be sent
            await this._sleep(200);

            // Now send Enter to execute
            execSync(`tmux send-keys -t "${sessionName}" C-m`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });
            this.logger.info(`✓ Sent Enter key (C-m) to execute command`);

            // Wait another brief moment
            await this._sleep(200);

            // Send another Enter to ensure execution (in case multi-line mode was triggered)
            execSync(`tmux send-keys -t "${sessionName}" C-m`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });
            this.logger.info(`✓ Sent second Enter key to ensure execution`);

            // Wait a moment for command to be processed
            await this._sleep(1000);

            // Start monitoring the session for Claude responses
            this.logger.info(`👁️ Starting monitoring for session ${sessionName}`);
            this._startMonitoring(sessionName);

            this.logger.info(`✅ Claude session ${sessionName} fully initialized and monitoring started`);
            return true;
        } catch (error) {
            this.logger.error(`❌ Failed to start Claude in tmux: ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw new Error(`Failed to start Claude in tmux: ${error.message}`);
        }
    }

    /**
     * Set a callback to be called when Claude finishes responding in a session
     * @param {string} sessionName - The tmux session name
     * @param {Function} callback - The callback function
     * @param {Object} options - Options for the callback
     * @param {boolean} options.isNewSession - Whether this is a new session (ignores initial waiting events)
     */
    setResponseCallback(sessionName, callback, options = {}) {
        this.responseCallbacks.set(sessionName, {
            callback,
            isNewSession: options.isNewSession || false,
            state: 'starting' // Initialize state for tracking transitions
        });
        this.logger.info(`Response callback set for session ${sessionName}, isNewSession: ${options.isNewSession}, state: starting`);
    }

    /**
     * Start monitoring a tmux session for Claude responses
     */
    _startMonitoring(sessionName) {
        // Check if already monitoring
        if (this.monitors.has(sessionName)) {
            this.logger.warn(`Already monitoring session ${sessionName}`);
            return;
        }

        try {
            // Record the monitoring start time (for grace period calculation)
            this.monitoringStartTimes.set(sessionName, Date.now());
            this.logger.info(`📍 Recording monitoring start time for session ${sessionName}`);

            // Create monitor for this session
            const monitor = new TmuxMonitor(sessionName);

            // Listen for task completion
            monitor.on('taskCompleted', (data) => {
                this._handleTaskCompleted(sessionName, data);
            });

            // Listen for waiting state
            monitor.on('waitingForInput', (data) => {
                this._handleWaitingForInput(sessionName, data);
            });

            // Start monitoring
            monitor.start();

            // Store monitor instance
            this.monitors.set(sessionName, monitor);

            this.logger.info(`✅ Started monitoring session ${sessionName}`);
        } catch (error) {
            this.logger.error(`Failed to start monitoring ${sessionName}: ${error.message}`);
        }
    }

    /**
     * Ensure monitoring is active for a session (start if not already monitoring)
     */
    ensureMonitoring(sessionName) {
        if (!this.monitors.has(sessionName)) {
            this.logger.info(`Monitoring not active for ${sessionName}, starting now`);
            this._startMonitoring(sessionName);
        }
    }

    /**
     * Handle task completion event from monitor
     */
    _handleTaskCompleted(sessionName, data) {
        this.logger.info(`Task completed in session ${sessionName}`);

        // Get the response callback for this session
        const callbackData = this.responseCallbacks.get(sessionName);
        if (!callbackData) {
            this.logger.warn(`No response callback found for session ${sessionName}`);
            return;
        }

        // Extract the conversation
        const monitor = this.monitors.get(sessionName);
        if (!monitor) {
            this.logger.warn(`No monitor found for session ${sessionName}`);
            return;
        }

        const conversation = monitor.getRecentConversation(sessionName, 3000);
        const fullTrace = monitor.getFullExecutionTrace(sessionName, 1000);

        // Call the callback with the response data
        callbackData.callback({
            type: 'taskCompleted',
            sessionName: sessionName,
            userQuestion: conversation.userQuestion || 'No user input',
            claudeResponse: conversation.claudeResponse || 'No Claude response',
            fullTrace: fullTrace,
            timestamp: data.timestamp
        });
    }

    /**
     * Handle waiting for input event from monitor
     */
    async _handleWaitingForInput(sessionName, data) {
        this.logger.info(`⏳ Claude waiting for input detected in session ${sessionName}`);

        // Get the response callback for this session
        const callbackData = this.responseCallbacks.get(sessionName);
        if (!callbackData) {
            this.logger.debug(`No callback data found for session ${sessionName}`);
            return;
        }

        // Check current state to determine action
        const state = callbackData.state || 'unknown';

        if (state === 'starting') {
            // Transition from starting → working
            this.logger.info(`📤 Sending 'waiting for input' for starting → working transition`);
            callbackData.callback({
                type: 'waitingForInput',
                sessionName: sessionName,
                userQuestion: '',
                claudeResponse: '',
                timestamp: data.timestamp
            });
            // Update state
            callbackData.state = 'working';
            return;
        }

        if (state === 'working') {
            // Claude finished - wait for buffer to stabilize, then extract
            this.logger.info(`⏸️  Detected completion - waiting for tmux buffer to stabilize...`);

            // Poll tmux buffer until content stops changing
            await this._waitForBufferStabilization(sessionName, 10000); // 10s max wait

            // Extract conversation with fresh monitor
            const TmuxMonitor = require('./tmux-monitor');
            const freshMonitor = new TmuxMonitor();
            const conversation = freshMonitor.getRecentConversation(sessionName, 5000);

            this.logger.info(`📊 Extracted after stabilization: question=${conversation.userQuestion?.length || 0} chars, response=${conversation.claudeResponse?.length || 0} chars`);

            // Send taskCompleted event
            callbackData.callback({
                type: 'taskCompleted',
                sessionName: sessionName,
                userQuestion: conversation.userQuestion || 'No user input',
                claudeResponse: conversation.claudeResponse || 'No response captured',
                timestamp: data.timestamp
            });
            callbackData.state = 'completed';
        }
    }

    /**
     * Wait for tmux buffer content to stabilize (stop changing)
     * Returns when content hasn't changed for 2 consecutive checks
     */
    async _waitForBufferStabilization(sessionName, maxWaitMs = 10000) {
        const startTime = Date.now();
        const checkInterval = 1000; // Check every 1 second
        let lastContent = '';
        let stableCount = 0;
        const requiredStableChecks = 2; // Need 2 stable checks

        this.logger.info(`⏳ Waiting for buffer to stabilize (max ${maxWaitMs}ms)...`);

        while (Date.now() - startTime < maxWaitMs) {
            const content = this._getTmuxContent(sessionName);

            if (content === lastContent) {
                stableCount++;
                this.logger.debug(`  Buffer stable (${stableCount}/${requiredStableChecks})`);

                if (stableCount >= requiredStableChecks) {
                    this.logger.info(`✓ Buffer stabilized after ${Date.now() - startTime}ms`);
                    return true;
                }
            } else {
                stableCount = 0;
                this.logger.debug(`  Buffer still changing (${content.length} chars)`);
            }

            lastContent = content;
            await this._sleep(checkInterval);
        }

        this.logger.warn(`⚠️ Buffer did not stabilize within ${maxWaitMs}ms, proceeding anyway`);
        return false;
    }

    /**
     * Remove session mapping (when tmux session is killed)
     */
    removeSession(channelId, threadTs) {
        const threadId = this._getThreadId(channelId, threadTs);

        if (this.mappings[threadId]) {
            const sessionName = this.mappings[threadId].sessionName;

            // Stop and remove monitor
            this._stopMonitoring(sessionName);

            // Remove callback
            this.responseCallbacks.delete(sessionName);

            delete this.mappings[threadId];
            this._saveMappings();
            this.logger.info(`Removed mapping for thread ${threadId}`);
        }
    }

    /**
     * Stop monitoring a tmux session
     */
    _stopMonitoring(sessionName) {
        const monitor = this.monitors.get(sessionName);
        if (monitor) {
            monitor.stop();
            monitor.removeAllListeners();
            this.monitors.delete(sessionName);
            this.monitoringStartTimes.delete(sessionName); // Clean up start time tracking
            this.logger.info(`Stopped monitoring session ${sessionName}`);
        }
    }

    /**
     * Clean up stale mappings (sessions that no longer exist)
     */
    cleanupStaleMappings() {
        let cleaned = 0;

        for (const [threadId, mapping] of Object.entries(this.mappings)) {
            if (!this._tmuxSessionExists(mapping.sessionName)) {
                // Stop monitoring and remove callbacks
                this._stopMonitoring(mapping.sessionName);
                this.responseCallbacks.delete(mapping.sessionName);

                delete this.mappings[threadId];
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this._saveMappings();
            this.logger.info(`Cleaned up ${cleaned} stale mapping(s)`);
        }

        return cleaned;
    }

    /**
     * Clean up idle sessions older than specified age
     * @param {number} maxAgeHours - Maximum age in hours (default: 24)
     * @returns {number} Number of sessions cleaned up
     */
    cleanupIdleSessions(maxAgeHours = 24) {
        const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
        const now = Date.now();
        let cleaned = 0;

        this.logger.info(`🧹 Starting idle session cleanup (max age: ${maxAgeHours}h)`);

        for (const [threadId, mapping] of Object.entries(this.mappings)) {
            const createdAt = new Date(mapping.createdAt).getTime();
            const age = now - createdAt;

            if (age > maxAgeMs) {
                const ageHours = Math.round(age / (60 * 60 * 1000));
                this.logger.info(`   Cleaning up idle session: ${mapping.sessionName} (age: ${ageHours}h)`);

                // Try to kill the tmux session
                try {
                    if (this._tmuxSessionExists(mapping.sessionName)) {
                        const { execSync } = require('child_process');
                        execSync(`tmux kill-session -t "${mapping.sessionName}"`, {
                            stdio: 'pipe'
                        });
                        this.logger.info(`   ✓ Killed tmux session: ${mapping.sessionName}`);
                    }
                } catch (error) {
                    this.logger.warn(`   Failed to kill session ${mapping.sessionName}: ${error.message}`);
                }

                // Stop monitoring and remove callbacks
                this._stopMonitoring(mapping.sessionName);
                this.responseCallbacks.delete(mapping.sessionName);

                // Remove mapping
                delete this.mappings[threadId];
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this._saveMappings();
            this.logger.info(`✅ Cleaned up ${cleaned} idle session(s)`);
        } else {
            this.logger.info(`✅ No idle sessions to clean up`);
        }

        return cleaned;
    }

    /**
     * Start periodic cleanup of idle sessions
     * @param {number} intervalHours - Cleanup interval in hours (default: 6)
     * @param {number} maxAgeHours - Maximum session age in hours (default: 24)
     */
    startPeriodicCleanup(intervalHours = 6, maxAgeHours = 24) {
        // Clear any existing interval
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        const intervalMs = intervalHours * 60 * 60 * 1000;

        this.logger.info(`🔄 Starting periodic cleanup: every ${intervalHours}h, max age ${maxAgeHours}h`);

        // Run immediately on start
        this.cleanupIdleSessions(maxAgeHours);

        // Then run periodically
        this.cleanupInterval = setInterval(() => {
            this.logger.info(`⏰ Periodic cleanup triggered`);
            this.cleanupIdleSessions(maxAgeHours);
        }, intervalMs);

        return this.cleanupInterval;
    }

    /**
     * Stop periodic cleanup
     */
    stopPeriodicCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            this.logger.info(`🛑 Stopped periodic cleanup`);
        }
    }

    /**
     * List all active thread sessions
     */
    listActiveSessions() {
        const active = [];

        for (const [threadId, mapping] of Object.entries(this.mappings)) {
            if (this._tmuxSessionExists(mapping.sessionName)) {
                active.push({
                    threadId,
                    ...mapping
                });
            }
        }

        return active;
    }

    /**
     * Get thread information by session name (reverse lookup)
     * Used by hook notification system to find the Slack thread to notify
     * @param {string} sessionName - The tmux session name (e.g., "slack-C1234-1234567890")
     * @returns {Object|null} - { channelId, threadTs, createdAt, workingDir } or null if not found
     */
    getThreadInfoBySessionName(sessionName) {
        // Search through mappings to find matching session
        for (const [threadId, mapping] of Object.entries(this.mappings)) {
            if (mapping.sessionName === sessionName) {
                return {
                    channelId: mapping.channelId,
                    threadTs: mapping.threadTs,
                    createdAt: mapping.createdAt,
                    workingDir: mapping.workingDir || process.cwd(),
                    threadId: threadId
                };
            }
        }

        // If not found in mappings, try to parse from session name
        // Session name format: slack-{sanitizedChannelId}-{sanitizedThreadTs}
        if (sessionName.startsWith('slack-')) {
            const parts = sessionName.substring(6).split('-'); // Remove 'slack-' prefix
            if (parts.length >= 2) {
                // This is a best-effort reconstruction
                // The actual channel ID and thread TS may have been sanitized
                this.logger.warn(`Session ${sessionName} not found in mappings, attempting to parse from name`);
                return {
                    channelId: parts[0], // This may not be the exact original channel ID
                    threadTs: parts.slice(1).join('-'), // Reconstruct thread TS
                    createdAt: null,
                    workingDir: process.cwd(),
                    threadId: null,
                    isParsed: true // Flag to indicate this was parsed, not from mapping
                };
            }
        }

        this.logger.warn(`No thread info found for session ${sessionName}`);
        return null;
    }

    /**
     * Get session mapping by session name (reverse lookup)
     * @param {string} sessionName - The tmux session name
     * @returns {Object|null} - Full session mapping or null if not found
     */
    getSessionByName(sessionName) {
        for (const [threadId, mapping] of Object.entries(this.mappings)) {
            if (mapping.sessionName === sessionName) {
                return {
                    threadId,
                    ...mapping
                };
            }
        }
        return null;
    }

    /**
     * Check if a session name is a Slack session
     * @param {string} sessionName - The tmux session name
     * @returns {boolean}
     */
    isSlackSession(sessionName) {
        return sessionName && sessionName.startsWith('slack-');
    }
}

module.exports = SlackThreadManager;
