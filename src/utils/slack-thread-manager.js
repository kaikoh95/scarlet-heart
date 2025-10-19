/**
 * Slack Thread Manager
 * Manages mappings between Slack threads and tmux sessions
 * Extends BaseSessionManager for common session management patterns
 */

const BaseSessionManager = require('../core/base-session-manager');
const TmuxSessionHelper = require('../core/tmux-session-helper');

class SlackThreadManager extends BaseSessionManager {
    constructor() {
        super('slack-threads');
        this.tmuxHelper = new TmuxSessionHelper(this.logger);
        // threadMessageInfo already provided by BaseSessionManager via this.messageInfo
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
            // Create new tmux session using TmuxSessionHelper
            this.tmuxHelper.ensureSession(sessionName, workingDir);

            // Store mapping
            this.setMapping(threadId, {
                sessionName,
                channelId,
                threadTs,
                workingDir
            });

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
     * Uses TmuxSessionHelper
     */
    _tmuxSessionExists(sessionName) {
        return this.tmuxHelper.sessionExists(sessionName);
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
     * Uses TmuxSessionHelper
     */
    async sendToSession(sessionName, command) {
        try {
            this.logger.info(`📤 Sending command to session ${sessionName}: ${command.substring(0, 50)}...`);
            await this.tmuxHelper.sendCommand(sessionName, command);
            this.logger.info(`✅ Command fully sent and executed in session ${sessionName}`);
            return true;
        } catch (error) {
            this.logger.error(`❌ Failed to send command to tmux: ${error.message}`);
            throw new Error(`Failed to send command to tmux: ${error.message}`);
        }
    }


    /**
     * Start Claude in tmux session with initial command
     */
    async startClaudeInSession(sessionName, command) {
        try {
            this.logger.info(`🚀 Starting Claude in tmux session ${sessionName}`);

            // Step 1: Start Claude using TmuxSessionHelper
            this.logger.info(`📋 Step 1/2: Launching Claude CLI...`);
            const isReady = await this.tmuxHelper.startClaude(sessionName);

            if (!isReady) {
                this.logger.warn('⚠️ Claude did not become ready within timeout, sending command anyway...');
            }

            // Step 2: Send the command using TmuxSessionHelper
            this.logger.info(`📤 Step 2/2: Sending command...`);
            await this.tmuxHelper.sendCommand(sessionName, command);

            this.logger.info(`✅ Claude session ${sessionName} fully initialized`);
            return true;
        } catch (error) {
            this.logger.error(`❌ Failed to start Claude in tmux: ${error.message}`);
            this.logger.error(`Stack: ${error.stack}`);
            throw new Error(`Failed to start Claude in tmux: ${error.message}`);
        }
    }


    /**
     * Remove session mapping (when tmux session is killed)
     */
    removeSession(channelId, threadTs) {
        const threadId = this._getThreadId(channelId, threadTs);

        if (this.mappings[threadId]) {
            delete this.mappings[threadId];
            this._saveMappings();
            this.logger.info(`Removed mapping for thread ${threadId}`);
        }
    }

    /**
     * Clean up stale mappings (sessions that no longer exist)
     */
    cleanupStaleMappings() {
        let cleaned = 0;

        for (const [threadId, mapping] of Object.entries(this.mappings)) {
            if (!this._tmuxSessionExists(mapping.sessionName)) {
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
     * Store message info for hook access
     * Uses inherited setMessageInfo from BaseSessionManager
     * @param {string} sessionName - Session name
     * @param {Object} messageInfo - Message info object with botMessageTs, userMessageTs, etc.
     */
    setThreadMessageInfo(sessionName, messageInfo) {
        this.setMessageInfo(sessionName, messageInfo);
    }

    /**
     * Get message info for hooks
     * Uses inherited getMessageInfo from BaseSessionManager
     * @param {string} sessionName - Session name
     * @returns {Object|undefined} Message info object
     */
    getThreadMessageInfo(sessionName) {
        return this.getMessageInfo(sessionName);
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
