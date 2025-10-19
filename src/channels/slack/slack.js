/**
 * Slack Notification Channel
 * Sends simple notifications via Slack Bot API
 *
 * Note: This is a simplified notification sender for the tmux-based Slack bot.
 * For interactive Claude sessions, use the Slack webhook with thread-based tmux sessions.
 */

const NotificationChannel = require('../base/channel');
const axios = require('axios');

class SlackChannel extends NotificationChannel {
    constructor(config = {}) {
        super('slack', config);
        this.apiBaseUrl = 'https://slack.com/api';
        this.botUserId = null; // Cache for bot user ID

        this._validateConfig();
    }

    _validateConfig() {
        if (!this.config.botToken) {
            this.logger.warn('Slack Bot Token not found');
            return false;
        }
        return true;
    }

    async _getBotUserId() {
        if (this.botUserId) {
            return this.botUserId;
        }

        try {
            const response = await axios.get(
                `${this.apiBaseUrl}/auth.test`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.botToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.ok && response.data.user_id) {
                this.botUserId = response.data.user_id;
                return this.botUserId;
            }
        } catch (error) {
            this.logger.error('Failed to get bot user ID:', error.message);
        }

        return null;
    }

    async _sendImpl(notification) {
        if (!this._validateConfig()) {
            throw new Error('Slack channel not properly configured');
        }

        // Check if this is a thread notification
        if (notification.metadata?.slackThreadTs) {
            // For webhook-managed threads, skip notification system entirely
            // The webhook handler manages all messages for interactive sessions
            this.logger.info(`⏭️ Skipping notification for webhook-managed thread ${notification.metadata.slackThreadTs}`);
            return true; // Return success to avoid errors
        }

        // Determine recipient channel
        const channelId = notification.metadata?.slackChannelId || this.config.channelId;

        if (!channelId) {
            this.logger.warn('No Slack channel ID available for notification');
            return false;
        }

        // Generate simple notification message
        const messageBlocks = await this._generateSlackMessage(notification);

        const requestData = {
            channel: channelId,
            blocks: messageBlocks,
            text: `Claude Task ${notification.type === 'completed' ? 'Completed' : 'Update'}` // Fallback text
        };

        try {
            const response = await axios.post(
                `${this.apiBaseUrl}/chat.postMessage`,
                requestData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.botToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.ok) {
                this.logger.info(`Slack notification sent successfully`);
                return true;
            } else {
                this.logger.error('Failed to send Slack notification:', response.data.error);
                return false;
            }
        } catch (error) {
            this.logger.error('Failed to send Slack notification:', error.response?.data || error.message);
            return false;
        }
    }

    /**
     * Send notification to a specific Slack thread
     * @param {string} channelId - Slack channel ID
     * @param {string} threadTs - Thread timestamp
     * @param {Object} notification - Notification object
     * @returns {Promise<boolean>}
     */
    async sendToThread(channelId, threadTs, notification) {
        try {
            this.logger.info(`Sending notification to Slack thread ${threadTs} in channel ${channelId}, type: ${notification.type}`);

            if (!channelId || !threadTs) {
                this.logger.error('Missing channelId or threadTs for thread notification');
                return false;
            }

            // Skip "waiting" notifications for webhook-managed sessions
            // The webhook handler already sends placeholder messages
            if (notification.type !== 'completed' && notification.type !== 'error') {
                this.logger.info(`⏭️ Skipping non-completed notification (webhook handler manages placeholders)`);
                return true; // Return success to avoid errors
            }

            // Generate beautiful Block Kit formatted message
            const blocks = await this._generateThreadResponseBlocks(notification);
            const fallbackText = this._generateFallbackText(notification);

            const requestData = {
                channel: channelId,
                thread_ts: threadTs,  // This makes it reply in the thread
                blocks: blocks,
                text: fallbackText, // Fallback for notifications
                unfurl_links: false,
                unfurl_media: false
            };

            const response = await axios.post(
                `${this.apiBaseUrl}/chat.postMessage`,
                requestData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.botToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.ok) {
                this.logger.info(`Slack thread notification sent successfully`);
                return true;
            } else {
                this.logger.error('Failed to send Slack thread notification:', response.data.error);
                return false;
            }
        } catch (error) {
            this.logger.error('Failed to send Slack thread notification:', error.response?.data || error.message);
            return false;
        }
    }

    /**
     * Generate beautiful Block Kit formatted blocks for thread responses
     * @private
     */
    async _generateThreadResponseBlocks(notification) {
        const type = notification.type;
        const emoji = type === 'completed' ? ':white_check_mark:' : ':hourglass_flowing_sand:';
        const status = type === 'completed' ? 'Task Completed' : 'Waiting for Input';

        const blocks = [];

        // Header block with status
        blocks.push({
            type: 'header',
            text: {
                type: 'plain_text',
                text: `${emoji} Claude ${status}`,
                emoji: true
            }
        });

        // User question section (if available)
        if (notification.metadata?.userQuestion && notification.metadata.userQuestion.trim()) {
            const userQuestion = notification.metadata.userQuestion.trim();
            const questionPreview = userQuestion.length > 300 ?
                userQuestion.substring(0, 300) + '...' :
                userQuestion;

            blocks.push({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Your Request:*\n${this._escapeSlackText(questionPreview)}`
                }
            });
        }

        // Divider
        if (notification.metadata?.claudeResponse) {
            blocks.push({ type: 'divider' });
        }

        // Claude response section (if available)
        if (notification.metadata?.claudeResponse && notification.metadata.claudeResponse.trim()) {
            const fullResponse = notification.metadata.claudeResponse.trim();

            // Smart response formatting
            const formattedResponse = this._formatResponseWithCodeBlocks(fullResponse);

            // If response is too long, show last 500 words
            const words = fullResponse.split(/\s+/);
            let displayResponse = formattedResponse;
            let truncated = false;

            if (words.length > 500) {
                const lastWords = words.slice(-500);
                displayResponse = this._formatResponseWithCodeBlocks(lastWords.join(' '));
                truncated = true;
            }

            blocks.push({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Claude's Response:*\n${displayResponse}`
                }
            });

            // Add truncation notice
            if (truncated) {
                blocks.push({
                    type: 'context',
                    elements: [{
                        type: 'mrkdwn',
                        text: `:information_source: _Showing last 500 of ${words.length} words. Full response in tmux session._`
                    }]
                });
            }
        }

        // Session info footer
        blocks.push({ type: 'divider' });

        const contextElements = [];

        if (notification.metadata?.tmuxSession) {
            contextElements.push({
                type: 'mrkdwn',
                text: `:computer: *Session:* \`${notification.metadata.tmuxSession}\``
            });
        }

        const timestamp = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        contextElements.push({
            type: 'mrkdwn',
            text: `:clock1: ${timestamp}`
        });

        if (notification.metadata?.tmuxSession) {
            contextElements.push({
                type: 'mrkdwn',
                text: `:link: \`tmux attach -t ${notification.metadata.tmuxSession}\``
            });
        }

        blocks.push({
            type: 'context',
            elements: contextElements
        });

        return blocks;
    }

    /**
     * Format response text with proper code block detection
     * @private
     */
    _formatResponseWithCodeBlocks(text) {
        // Don't double-wrap if already has code blocks
        if (text.includes('```')) {
            return text;
        }

        // Check if response looks like code (has multiple lines with indentation or special chars)
        const lines = text.split('\n');
        const codeIndicators = lines.filter(line =>
            line.match(/^\s{2,}/) || // Indented
            line.match(/^[{}\[\];()=]/) || // Code structure chars
            line.match(/function |const |let |var |class |import |export /) // Keywords
        );

        // If more than 30% of lines look like code, wrap in code block
        if (codeIndicators.length > lines.length * 0.3 && lines.length > 3) {
            return '```\n' + text + '\n```';
        }

        // Otherwise return as-is (will be formatted as markdown)
        return text;
    }

    /**
     * Escape special Slack markdown characters
     * @private
     */
    _escapeSlackText(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /**
     * Generate fallback text for notifications
     * @private
     */
    _generateFallbackText(notification) {
        const type = notification.type;
        const status = type === 'completed' ? 'completed' : 'waiting for input';
        let text = `Claude ${status}`;

        if (notification.metadata?.userQuestion) {
            text += `: ${notification.metadata.userQuestion.substring(0, 100)}`;
        }

        return text;
    }

    async _generateSlackMessage(notification) {
        const type = notification.type;
        const emoji = type === 'completed' ? ':white_check_mark:' : ':information_source:';
        const status = type === 'completed' ? 'Completed' : 'Update';

        const blocks = [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: `${emoji} Claude Task ${status}`,
                    emoji: true
                }
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Project:* ${notification.project}\n*Message:* ${notification.message}`
                }
            }
        ];

        // Add metadata if available
        if (notification.metadata) {
            const metadataFields = [];

            if (notification.metadata.userQuestion) {
                metadataFields.push({
                    type: 'mrkdwn',
                    text: `*Question:*\n${notification.metadata.userQuestion.substring(0, 150)}...`
                });
            }

            if (notification.metadata.tmuxSession) {
                metadataFields.push({
                    type: 'mrkdwn',
                    text: `*Tmux Session:*\n\`${notification.metadata.tmuxSession}\``
                });
            }

            if (metadataFields.length > 0) {
                blocks.push({
                    type: 'section',
                    fields: metadataFields
                });
            }
        }

        // Add interactive hint
        const botUserId = await this._getBotUserId();
        const botMention = botUserId ? `<@${botUserId}>` : '@bot';

        blocks.push(
            {
                type: 'divider'
            },
            {
                type: 'context',
                elements: [
                    {
                        type: 'mrkdwn',
                        text: `💡 _Mention ${botMention} in a thread to start an interactive Claude session_`
                    }
                ]
            }
        );

        return blocks;
    }

    supportsRelay() {
        return true;
    }

    validateConfig() {
        return this._validateConfig();
    }
}

module.exports = SlackChannel;
