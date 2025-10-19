/**
 * Telegram Notification Channel
 * Sends notifications via Telegram Bot API with command support
 */

const NotificationChannel = require('../base/channel');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const TmuxMonitor = require('../../utils/tmux-monitor');
const { execSync } = require('child_process');

class TelegramChannel extends NotificationChannel {
    constructor(config = {}) {
        super('telegram', config);
        this.sessionsDir = path.join(__dirname, '../../data/sessions');
        this.tmuxMonitor = new TmuxMonitor();
        this.apiBaseUrl = 'https://api.telegram.org';
        this.botUsername = null; // Cache for bot username
        
        this._ensureDirectories();
        this._validateConfig();
    }

    _ensureDirectories() {
        if (!fs.existsSync(this.sessionsDir)) {
            fs.mkdirSync(this.sessionsDir, { recursive: true });
        }
    }

    _validateConfig() {
        if (!this.config.botToken) {
            this.logger.warn('Telegram Bot Token not found');
            return false;
        }
        if (!this.config.chatId && !this.config.groupId) {
            this.logger.warn('Telegram Chat ID or Group ID must be configured');
            return false;
        }
        return true;
    }

    /**
     * Generate network options for axios requests
     * @returns {Object} Network options object
     */
    _getNetworkOptions() {
        const options = {};
        if (this.config.forceIPv4) {
            const http = require('http');
            const https = require('https');
            options.httpAgent = new http.Agent({ family: 4 });
            options.httpsAgent = new https.Agent({ family: 4 });
        }
        return options;
    }

    _generateToken() {
        // Generate short Token (uppercase letters + numbers, 8 digits)
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let token = '';
        for (let i = 0; i < 8; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return token;
    }

    _getCurrentTmuxSession() {
        try {
            // Try to get current tmux session
            const tmuxSession = execSync('tmux display-message -p "#S"', { 
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore']
            }).trim();
            
            return tmuxSession || null;
        } catch (error) {
            // Not in a tmux session or tmux not available
            return null;
        }
    }

    async _getBotUsername() {
        if (this.botUsername) {
            return this.botUsername;
        }

        try {
            const response = await axios.get(
                `${this.apiBaseUrl}/bot${this.config.botToken}/getMe`,
                this._getNetworkOptions()
            );
            
            if (response.data.ok && response.data.result.username) {
                this.botUsername = response.data.result.username;
                return this.botUsername;
            }
        } catch (error) {
            this.logger.error('Failed to get bot username:', error.message);
        }
        
        // Fallback to configured username or default
        return this.config.botUsername || 'claude_remote_bot';
    }

    async _sendImpl(notification) {
        if (!this._validateConfig()) {
            throw new Error('Telegram channel not properly configured');
        }

        // Get current tmux session and conversation content
        const tmuxSession = this._getCurrentTmuxSession();

        // Skip Slack-related sessions (they're handled via Slack webhook)
        if (tmuxSession && tmuxSession.startsWith('slack-')) {
            this.logger.info(`Skipping Telegram notification for Slack session: ${tmuxSession}`);
            return true; // Return success without sending
        }

        // Generate session ID and Token
        const sessionId = uuidv4();
        const token = this._generateToken();

        if (tmuxSession && !notification.metadata) {
            // Increase line limit to capture long responses (1000 words ~ 2000-3000 lines)
            const conversation = this.tmuxMonitor.getRecentConversation(tmuxSession, 3000);

            // Debug logging
            this.logger.debug(`Extracted conversation:`);
            this.logger.debug(`  User Question: ${conversation.userQuestion?.substring(0, 100)}...`);
            this.logger.debug(`  Claude Response length: ${conversation.claudeResponse?.length || 0} chars`);
            this.logger.debug(`  Claude Response preview: ${conversation.claudeResponse?.substring(0, 200)}...`);

            notification.metadata = {
                userQuestion: conversation.userQuestion || notification.message,
                claudeResponse: conversation.claudeResponse || notification.message,
                tmuxSession: tmuxSession
            };
        }
        
        // Create session record
        await this._createSession(sessionId, notification, token);

        // Generate Telegram message
        const messageText = await this._generateTelegramMessage(notification, sessionId, token);

        // Determine recipient (chat or group)
        const chatId = this.config.groupId || this.config.chatId;

        const requestData = {
            chat_id: chatId,
            text: messageText,
            parse_mode: 'HTML'
        };

        try {
            const response = await axios.post(
                `${this.apiBaseUrl}/bot${this.config.botToken}/sendMessage`,
                requestData,
                this._getNetworkOptions()
            );

            this.logger.info(`Telegram message sent successfully, Session: ${sessionId}`);
            return true;
        } catch (error) {
            this.logger.error('Failed to send Telegram message:', error.response?.data || error.message);
            // Clean up failed session
            await this._removeSession(sessionId);
            return false;
        }
    }

    async _generateTelegramMessage(notification, sessionId, token) {
        const type = notification.type;
        const emoji = type === 'completed' ? '✅' : '⏳';
        const status = type === 'completed' ? 'Task Completed' : 'Waiting for Input';

        // Build beautiful formatted message using HTML
        let messageText = '';

        // Header without box
        messageText += `${emoji} <b>Claude ${status}</b>\n\n`;

        // Project section
        messageText += `📁 <b>Project</b>\n`;
        messageText += `<blockquote><code>${this._escapeHtml(notification.project)}</code></blockquote>\n`;

        // Token section
        messageText += `🔑 <b>Token</b>\n`;
        messageText += `<blockquote><code>${token}</code></blockquote>\n`;

        // User question section
        if (notification.metadata?.userQuestion && notification.metadata.userQuestion.trim()) {
            const userQuestion = notification.metadata.userQuestion.trim();
            const questionPreview = userQuestion.length > 300
                ? userQuestion.substring(0, 300) + '...'
                : userQuestion;

            messageText += `📝 <b>Your Request</b>\n`;
            messageText += `<blockquote>${this._escapeHtml(questionPreview)}</blockquote>\n`;
        }

        // Claude response section
        if (notification.metadata?.claudeResponse && notification.metadata.claudeResponse.trim()) {
            const fullResponse = notification.metadata.claudeResponse.trim();
            const words = fullResponse.split(/\s+/);

            // Show last 100 words as preview
            let displayResponse = fullResponse;
            let truncated = false;

            if (words.length > 100) {
                displayResponse = words.slice(-100).join(' ');
                truncated = true;
            }

            // Format response
            const formattedResponse = this._formatResponseForHtml(displayResponse);
            messageText += `🤖 <b>Claude's Response</b>\n`;
            messageText += `<blockquote>${formattedResponse}`;
            if (truncated) {
                messageText += `\n\n<i>💡 Last 100 of ${words.length} words · Full in tmux</i>`;
            }
            messageText += `</blockquote>\n`;
        }

        // Session details section
        messageText += `📊 <b>Session Details</b>\n`;
        messageText += `<blockquote>`;
        if (notification.metadata?.tmuxSession) {
            messageText += `💻 <code>${this._escapeHtml(notification.metadata.tmuxSession)}</code>\n`;
            messageText += `🔗 <code>tmux attach -t ${this._escapeHtml(notification.metadata.tmuxSession)}</code>\n`;
        }
        const timestamp = new Date().toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        messageText += `🕐 ${timestamp}`;
        messageText += `</blockquote>\n`;

        // Command help section
        const botUsername = await this._getBotUsername();
        messageText += `💬 <b>Send Command</b>\n`;

        // Direct message command (separate blockquote)
        messageText += `<blockquote><code>/cmd ${token}</code></blockquote>\n`;

        // Group command (separate blockquote)
        messageText += `<blockquote><i>Group: <code>@${botUsername} /cmd ${token}</code></i></blockquote>`;

        return messageText;
    }

    /**
     * Format response with smart code block detection for HTML
     * @private
     */
    _formatResponseForHtml(text) {
        // Split into lines for analysis
        const lines = text.split('\n');

        // Detect if this looks like code
        const codeIndicators = lines.filter(line =>
            line.match(/^\s{2,}/) ||                    // Indented lines
            line.match(/^[{}\[\];()=]/) ||              // Code structure characters
            line.match(/function |const |let |var /) ||  // JavaScript keywords
            line.match(/def |class |import |from /) ||   // Python keywords
            line.match(/public |private |protected /) || // Java/TypeScript keywords
            line.match(/\$\w+|->|=>|::|<-/)             // Various language operators
        );

        // If >30% of lines look like code, wrap in code block
        if (codeIndicators.length > lines.length * 0.3 && lines.length > 3) {
            // Detect language for display (informational only)
            const language = this._detectLanguage(text);
            const langLabel = language ? ` (${language})` : '';

            // Use HTML pre tag for code blocks
            return `<pre><code>${this._escapeHtml(text)}</code></pre>`;
        }

        // Check for multiple paragraphs or mixed content
        const paragraphs = text.split(/\n\s*\n/);
        if (paragraphs.length > 1) {
            // Format as paragraphs with proper escaping
            return paragraphs
                .map(p => this._escapeHtml(p.trim()))
                .filter(p => p.length > 0)
                .join('\n\n');
        }

        // Return as plain text with HTML escaping
        return this._escapeHtml(text);
    }

    /**
     * Detect programming language from code content
     * @private
     */
    _detectLanguage(code) {
        // JavaScript/TypeScript
        if (code.match(/\b(const|let|var|function|=>|async|await)\b/)) {
            if (code.match(/\b(interface|type|enum|implements|extends)\b/)) {
                return 'typescript';
            }
            return 'javascript';
        }

        // Python
        if (code.match(/\b(def|class|import|from|self|__init__|print)\b/)) {
            return 'python';
        }

        // Bash/Shell
        if (code.match(/^(#!\/bin\/bash|#!\/bin\/sh|export|source|\\$\\{)/m)) {
            return 'bash';
        }

        // JSON
        if (code.match(/^\s*[{\[]/m) && code.match(/["\w]+\s*:\s*["\w\[{]/)) {
            return 'json';
        }

        // HTML
        if (code.match(/<\/?[a-z][\s\S]*>/i)) {
            return 'html';
        }

        // CSS
        if (code.match(/[\w-]+\s*\{[^}]*\}/)) {
            return 'css';
        }

        // Go
        if (code.match(/\b(func|package|import|type|struct|interface)\b/)) {
            return 'go';
        }

        // Rust
        if (code.match(/\b(fn|let|mut|impl|trait|struct|enum)\b/)) {
            return 'rust';
        }

        // Java
        if (code.match(/\b(public|private|protected|class|static|void)\b/)) {
            return 'java';
        }

        // Default to no language hint (generic code block)
        return '';
    }

    /**
     * Escape special HTML characters for Telegram
     * @private
     */
    _escapeHtml(text) {
        if (!text) return '';

        return text
            .replace(/&/g, '&amp;')   // Must be first!
            .replace(/</g, '&lt;')    // Less than
            .replace(/>/g, '&gt;');   // Greater than
    }

    async _createSession(sessionId, notification, token) {
        const session = {
            id: sessionId,
            token: token,
            type: 'telegram',
            created: new Date().toISOString(),
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Expires after 24 hours
            createdAt: Math.floor(Date.now() / 1000),
            expiresAt: Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000),
            tmuxSession: notification.metadata?.tmuxSession || 'default',
            project: notification.project,
            notification: notification
        };

        const sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
        fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
        
        this.logger.debug(`Session created: ${sessionId}`);
    }

    async _removeSession(sessionId) {
        const sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
        if (fs.existsSync(sessionFile)) {
            fs.unlinkSync(sessionFile);
            this.logger.debug(`Session removed: ${sessionId}`);
        }
    }

    supportsRelay() {
        return true;
    }

    validateConfig() {
        return this._validateConfig();
    }
}

module.exports = TelegramChannel;
