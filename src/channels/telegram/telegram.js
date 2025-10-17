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

        // Generate session ID and Token
        const sessionId = uuidv4();
        const token = this._generateToken();
        
        // Get current tmux session and conversation content
        const tmuxSession = this._getCurrentTmuxSession();
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
            parse_mode: 'Markdown'
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
        const status = type === 'completed' ? 'Completed' : 'Waiting for Input';

        let messageText = `${emoji} *Claude Task ${status}*\n`;
        messageText += `*Project:* ${notification.project}\n`;
        messageText += `*Session Token:*\n\`\`\`\n${token}\n\`\`\`\n`;

        if (notification.metadata) {
            if (notification.metadata.userQuestion) {
                messageText += `📝 *Your Question:*\n${notification.metadata.userQuestion.substring(0, 200)}`;
                if (notification.metadata.userQuestion.length > 200) {
                    messageText += '...';
                }
                messageText += '\n\n';
            }

            if (notification.metadata.claudeResponse) {
                // Get last 100 words as preview
                const fullResponse = notification.metadata.claudeResponse;
                const words = fullResponse.split(/\s+/);

                let preview;
                if (words.length > 100) {
                    // Get last 100 words
                    preview = words.slice(-100).join(' ');
                } else {
                    preview = fullResponse;
                }

                // Format as blockquote (using Markdown)
                messageText += `🤖 *Claude Response Preview (last 100 words):*\n`;
                messageText += `\`\`\`\n${preview}\n\`\`\``;

                if (words.length > 100) {
                    messageText += `\n_(...showing last 100 of ${words.length} words, full response in tmux session)_`;
                }

                messageText += '\n\n';
            }
        }

        messageText += `💬 *To send a new command:*\n`;
        messageText += `\`\`\`\n/cmd ${token}\n\`\`\`\n\n`;

        // Get bot username and add group chat format
        const botUsername = await this._getBotUsername();
        messageText += `👥 *For group chats:*\n`;
        messageText += `\`\`\`\n@${botUsername} /cmd ${token}\n\`\`\``;

        return messageText;
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
