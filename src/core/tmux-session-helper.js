const { execSync } = require('child_process');

/**
 * Tmux Session Helper
 * Provides common tmux operations for session management
 * Eliminates duplication between Slack and Telegram implementations
 */
class TmuxSessionHelper {
    constructor(logger) {
        this.logger = logger;
    }

    /**
     * Check if tmux session exists
     * @param {string} sessionName - Session name to check
     * @returns {boolean} True if session exists
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
     * @param {string} sessionName - Session name
     * @param {string} workingDir - Working directory for the session (default: current directory)
     * @returns {Object} { created: boolean } - Whether the session was newly created
     */
    ensureSession(sessionName, workingDir = process.cwd()) {
        if (this.sessionExists(sessionName)) {
            this.logger.info(`Session '${sessionName}' already exists`);
            return { created: false };
        }

        this.logger.info(`Creating session '${sessionName}' in ${workingDir}`);
        try {
            execSync(`tmux new-session -d -s "${sessionName}" -c "${workingDir}"`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });
            this.logger.info(`✅ Session '${sessionName}' created`);
            return { created: true };
        } catch (error) {
            this.logger.error(`Failed to create session '${sessionName}': ${error.message}`);
            throw error;
        }
    }

    /**
     * Start Claude in a session
     * @param {string} sessionName - Session name
     * @param {number} maxWaitMs - Maximum wait time for Claude to be ready (default: 45000)
     * @returns {Promise<boolean>} True if Claude started successfully
     */
    async startClaude(sessionName, maxWaitMs = 45000) {
        this.logger.info(`Starting Claude in session ${sessionName}`);

        try {
            execSync(`tmux send-keys -t "${sessionName}" 'claude --dangerously-skip-permissions' C-m`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });

            // Wait for Claude to be ready
            return await this.waitForReady(sessionName, maxWaitMs);
        } catch (error) {
            this.logger.error(`Failed to start Claude: ${error.message}`);
            throw error;
        }
    }

    /**
     * Wait for Claude prompt box to appear
     * @param {string} sessionName - Session name
     * @param {number} maxWaitMs - Maximum wait time in milliseconds (default: 45000)
     * @returns {Promise<boolean>} True if Claude is ready
     */
    async waitForReady(sessionName, maxWaitMs = 45000) {
        const startTime = Date.now();
        const pollInterval = 500;
        const readyPattern = /────────────────────/; // Claude's prompt box separator

        this.logger.info(`Waiting for Claude to be ready in session ${sessionName}...`);

        while (Date.now() - startTime < maxWaitMs) {
            const content = this.getContent(sessionName);

            if (readyPattern.test(content)) {
                this.logger.info(`✅ Claude ready in session ${sessionName}`);
                await this._sleep(500); // Stability delay
                return true;
            }

            await this._sleep(pollInterval);
        }

        this.logger.warn(`⚠️ Timeout waiting for Claude in ${sessionName} (${maxWaitMs}ms)`);
        return false;
    }

    /**
     * Send command to session
     * Uses the reliable double-enter method for Claude Code's multi-line input
     * @param {string} sessionName - Session name
     * @param {string} command - Command to send
     * @returns {Promise<boolean>} True if command was sent successfully
     */
    async sendCommand(sessionName, command) {
        try {
            // Escape single quotes for shell
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

            this.logger.info(`✅ Command sent to ${sessionName}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to send command to ${sessionName}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get session content
     * @param {string} sessionName - Session name
     * @param {number} lines - Number of lines to capture (default: 1000)
     * @returns {string} Session content
     */
    getContent(sessionName, lines = 1000) {
        try {
            return execSync(`tmux capture-pane -t "${sessionName}" -p -S -${lines}`, {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore']
            });
        } catch (error) {
            this.logger.error(`Failed to get content from ${sessionName}: ${error.message}`);
            return '';
        }
    }

    /**
     * Kill a tmux session
     * @param {string} sessionName - Session name
     * @returns {boolean} True if session was killed
     */
    killSession(sessionName) {
        try {
            if (!this.sessionExists(sessionName)) {
                this.logger.warn(`Session '${sessionName}' does not exist`);
                return false;
            }

            execSync(`tmux kill-session -t "${sessionName}"`, { stdio: 'pipe' });
            this.logger.info(`✅ Session '${sessionName}' killed`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to kill session '${sessionName}': ${error.message}`);
            return false;
        }
    }

    /**
     * List all tmux sessions
     * @returns {Array<string>} Array of session names
     */
    listSessions() {
        try {
            const output = execSync('tmux list-sessions -F "#{session_name}"', {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore']
            });
            return output.trim().split('\n').filter(name => name.length > 0);
        } catch (error) {
            // No sessions exist
            return [];
        }
    }

    /**
     * Get current tmux session name
     * @returns {string|null} Current session name or null if not in tmux
     */
    getCurrentSession() {
        try {
            return execSync('tmux display-message -p "#S"', {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore']
            }).trim();
        } catch (error) {
            return null;
        }
    }

    /**
     * Sleep helper
     * @private
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = TmuxSessionHelper;
