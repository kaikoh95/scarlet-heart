/**
 * Slack Webhook Handler
 * Handles incoming Slack app_mention events with tmux-based Claude sessions
 */

const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const Logger = require('../../core/logger');
const SlackThreadManager = require('../../utils/slack-thread-manager');

class SlackWebhookHandler {
    constructor(config = {}) {
        this.config = config;
        this.logger = new Logger('SlackWebhook');
        this.threadManager = new SlackThreadManager();
        this.app = express();
        this.apiBaseUrl = 'https://slack.com/api';
        this.botUserId = null; // Cache for bot user ID

        this._setupMiddleware();
        this._setupRoutes();
    }

    _setupMiddleware() {
        // Parse JSON for all requests
        this.app.use(express.json());

        // Verify Slack requests
        this.app.use('/webhook/slack', this._verifySlackRequest.bind(this));
    }

    _verifySlackRequest(req, res, next) {
        // For URL verification challenge, skip signature verification
        if (req.body && req.body.type === 'url_verification') {
            return next();
        }

        // Verify signing secret if configured
        if (this.config.signingSecret) {
            const signature = req.headers['x-slack-signature'];
            const timestamp = req.headers['x-slack-request-timestamp'];
            const body = JSON.stringify(req.body);

            // Check timestamp to prevent replay attacks (within 5 minutes)
            const time = Math.floor(new Date().getTime() / 1000);
            if (Math.abs(time - timestamp) > 300) {
                this.logger.warn('Request timestamp too old');
                return res.status(400).send('Invalid timestamp');
            }

            // Verify signature
            const sigBasestring = `v0:${timestamp}:${body}`;
            const mySignature = 'v0=' + crypto
                .createHmac('sha256', this.config.signingSecret)
                .update(sigBasestring)
                .digest('hex');

            if (!crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature))) {
                this.logger.warn('Invalid request signature');
                return res.status(400).send('Invalid signature');
            }
        }

        next();
    }

    _setupRoutes() {
        // Slack webhook endpoint
        this.app.post('/webhook/slack', this._handleWebhook.bind(this));

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', service: 'slack-webhook' });
        });
    }

    async _handleWebhook(req, res) {
        try {
            const payload = req.body;

            // Handle URL verification challenge
            if (payload.type === 'url_verification') {
                this.logger.info('Received URL verification challenge');
                return res.json({ challenge: payload.challenge });
            }

            // Handle event callbacks
            if (payload.type === 'event_callback') {
                // Respond immediately to avoid timeout
                res.status(200).send('OK');

                // Process event asynchronously
                await this._handleEvent(payload.event);
                return;
            }

            res.status(200).send('OK');
        } catch (error) {
            this.logger.error('Webhook handling error:', error.message);
            res.status(500).send('Internal Server Error');
        }
    }

    async _handleEvent(event) {
        // Handle app_mention events
        if (event.type === 'app_mention') {
            await this._handleAppMention(event);
        }
        // Handle direct messages
        if (event.type === 'message' && event.channel_type === 'im') {
            await this._handleDirectMessage(event);
        }
    }

    async _handleAppMention(event) {
        const channelId = event.channel;
        const userId = event.user;
        const messageText = event.text?.trim();
        const threadTs = event.thread_ts || event.ts; // Thread timestamp (use message ts if not in thread)
        const messageTs = event.ts;

        if (!messageText) return;

        // Check if user/channel is authorized
        if (!this._isAuthorized(userId, channelId)) {
            this.logger.warn(`Unauthorized user/channel: ${userId}/${channelId}`);
            await this._sendMessage(channelId, ':warning: You are not authorized to use this bot.', threadTs);
            return;
        }

        // Remove bot mention from text
        const botUserId = await this._getBotUserId();
        const cleanText = messageText.replace(new RegExp(`<@${botUserId}>`, 'g'), '').trim();

        // Handle help command
        if (cleanText === 'help' || cleanText === '/help') {
            await this._sendHelpMessage(channelId, threadTs);
            return;
        }

        // Handle cleanup command
        if (cleanText === 'cleanup' || cleanText === '/cleanup') {
            await this._handleCleanup(channelId, threadTs);
            return;
        }

        // Handle status command
        if (cleanText === 'status' || cleanText === '/status') {
            await this._handleStatus(channelId, threadTs);
            return;
        }

        // Process the command/prompt
        await this._processPrompt(channelId, threadTs, messageTs, cleanText);
    }

    async _handleDirectMessage(event) {
        const channelId = event.channel;
        const userId = event.user;
        const messageText = event.text?.trim();

        // Ignore bot messages and message changes
        if (event.bot_id || event.subtype === 'message_changed' || event.subtype === 'bot_message') {
            return;
        }

        if (!messageText) return;

        // Check if user is authorized
        if (!this._isAuthorized(userId, channelId)) {
            this.logger.warn(`Unauthorized user: ${userId}`);
            await this._sendMessage(channelId, ':warning: You are not authorized to use this bot.');
            return;
        }

        this.logger.info(`Received DM from user ${userId}: ${messageText}`);

        // Handle help command
        if (messageText === 'help' || messageText === '/help') {
            await this._sendDMHelpMessage(channelId);
            return;
        }

        // For DMs, treat the channel itself as a "thread" (each DM conversation is isolated)
        const threadTs = event.ts;

        // Process the command/prompt
        await this._processPrompt(channelId, threadTs, event.ts, messageText);
    }

    async _processPrompt(channelId, threadTs, messageTs, prompt) {
        try {
            this.logger.info(`📥 Processing prompt for channel ${channelId}, thread ${threadTs}`);
            this.logger.info(`   Message TS: ${messageTs}, Thread TS: ${threadTs}`);

            // Add acknowledgment reaction immediately
            await this._addReaction(channelId, messageTs, 'eyes');

            // Get or create tmux session for this thread
            const session = this.threadManager.getOrCreateSession(channelId, threadTs);
            this.logger.info(`   Session: ${session.sessionName}, isNew: ${session.isNew}`);

            if (session.isNew) {
                // New thread - start Claude with /bg-workflow
                this.logger.info(`🆕 Starting new Claude session for thread ${threadTs}`);

                // Set up response callback for this session
                // Mark this session as "in startup" to ignore initial waiting events
                this.threadManager.setResponseCallback(session.sessionName, async (responseData) => {
                    await this._handleClaudeResponse(channelId, threadTs, responseData);
                }, { isNewSession: true });

                // Get thread conversation history (always fetch to include all context)
                let threadContext = '';
                try {
                    const threadHistory = await this._getThreadConversation(channelId, threadTs);
                    if (threadHistory) {
                        threadContext = threadHistory + '\n\n';
                        this.logger.info(`✓ Captured thread context (${threadHistory.length} chars)`);
                    }
                } catch (contextError) {
                    this.logger.warn(`⚠️ Failed to get thread context: ${contextError.message}`);
                    // Continue without thread context
                }

                // Construct the full prompt for /bg-workflow
                // Replace newlines with spaces to avoid triggering multi-line input mode
                const fullPrompt = (threadContext + `User request: ${prompt}`)
                    .replace(/\n/g, ' ')  // Replace newlines with spaces
                    .replace(/\s+/g, ' ')  // Collapse multiple spaces
                    .trim();
                this.logger.info(`📝 Full prompt length: ${fullPrompt.length} chars`);

                try {
                    // Start Claude in the tmux session with /bg-workflow
                    await this.threadManager.startClaudeInSession(session.sessionName, `/bg-workflow ${fullPrompt}`);

                    // Replace eyes with hourglass to show processing
                    await this._removeReaction(channelId, messageTs, 'eyes');
                    await this._addReaction(channelId, messageTs, 'hourglass_flowing_sand');

                    // Send confirmation
                    await this._sendMessage(
                        channelId,
                        `:white_check_mark: *Started new Claude session*\n\n` +
                        `:computer: *Session:* \`${session.sessionName}\`\n` +
                        `:memo: *Task:* ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}\n\n` +
                        `Claude is now working on your request in the background...`,
                        threadTs
                    );
                } catch (startError) {
                    this.logger.error(`❌ Failed to start Claude session: ${startError.message}`);
                    await this._sendMessage(
                        channelId,
                        `:x: *Failed to start Claude session*\n\n` +
                        `Error: ${startError.message}\n\n` +
                        `Please check that tmux is installed and the session was created properly.`,
                        threadTs
                    );
                    throw startError;
                }
            } else {
                // Existing thread - continue the conversation in the existing Claude session
                this.logger.info(`♻️ Continuing existing Claude session: ${session.sessionName}`);

                // Ensure monitoring is active (in case the bot restarted)
                this.threadManager.ensureMonitoring(session.sessionName);

                // Ensure response callback is set (in case the bot restarted)
                this.threadManager.setResponseCallback(session.sessionName, async (responseData) => {
                    await this._handleClaudeResponse(channelId, threadTs, responseData);
                }, { isNewSession: false });

                // Get ONLY new user messages since the last bot response
                // This avoids sending Claude messages it has already seen
                let newMessagesContext = '';
                try {
                    const newMessages = await this._getNewUserMessagesForContinuation(channelId, threadTs);
                    if (newMessages) {
                        newMessagesContext = newMessages + '\n\n';
                        this.logger.info(`✓ Captured ${newMessages.split('User:').length - 1} new user message(s) for continuation`);
                    } else {
                        // If no new messages found (shouldn't happen normally), use current prompt only
                        this.logger.info(`ℹ️ No new messages context, using current prompt only`);
                    }
                } catch (contextError) {
                    this.logger.warn(`⚠️ Failed to get new messages: ${contextError.message}`);
                    // Continue with just the prompt if context fetch fails
                }

                // Construct the full prompt for /bg-workflow continuation
                // Always prepend /bg-workflow to continue the bg-workflow session
                // Replace newlines with spaces to avoid triggering multi-line input mode
                const fullPrompt = (newMessagesContext + `Current user request: ${prompt}`)
                    .replace(/\n/g, ' ')  // Replace newlines with spaces
                    .replace(/\s+/g, ' ')  // Collapse multiple spaces
                    .trim();
                this.logger.info(`📝 Full continuation prompt length: ${fullPrompt.length} chars`);

                try {
                    // Send to the existing bg-workflow session with /bg-workflow prefix
                    await this.threadManager.sendToSession(session.sessionName, `/bg-workflow ${fullPrompt}`);

                    // Replace eyes with hourglass to show processing
                    await this._removeReaction(channelId, messageTs, 'eyes');
                    await this._addReaction(channelId, messageTs, 'hourglass_flowing_sand');

                    // Send confirmation
                    await this._sendMessage(
                        channelId,
                        `:speech_balloon: *Message sent to Claude*\n\n` +
                        `:computer: *Session:* \`${session.sessionName}\`\n` +
                        `:memo: *Message:* ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}\n\n` +
                        `Continuing the conversation...`,
                        threadTs
                    );
                } catch (sendError) {
                    this.logger.error(`❌ Failed to send to existing session: ${sendError.message}`);
                    await this._sendMessage(
                        channelId,
                        `:x: *Failed to send message to Claude*\n\n` +
                        `Error: ${sendError.message}\n\n` +
                        `Session: \`${session.sessionName}\`\n\n` +
                        `The session may have been terminated. Try starting a new thread.`,
                        threadTs
                    );
                    throw sendError;
                }
            }

            this.logger.info(`✅ Processed prompt - Channel: ${channelId}, Thread: ${threadTs}, Session: ${session.sessionName}`);

        } catch (error) {
            this.logger.error(`❌ Prompt processing failed: ${error.message}`);
            this.logger.error(`Stack trace: ${error.stack}`);

            try {
                await this._sendMessage(
                    channelId,
                    `:x: *Failed to process your request*\n\n` +
                    `Error: ${error.message}\n\n` +
                    `Session: \`${session?.sessionName || 'unknown'}\`\n\n` +
                    `Please try again or check the logs.`,
                    threadTs
                );
            } catch (msgError) {
                this.logger.error(`Failed to send error message to Slack: ${msgError.message}`);
            }
        }
    }

    async _handleClaudeResponse(channelId, threadTs, responseData) {
        try {
            this.logger.info(`Handling Claude response for channel ${channelId}, thread ${threadTs}`);

            if (responseData.type === 'taskCompleted') {
                // Format and send the response
                const responseMessage = this._formatClaudeResponse(responseData);
                await this._sendMessage(channelId, responseMessage, threadTs);

                this.logger.info(`Sent Claude response to Slack thread ${threadTs}`);
            } else if (responseData.type === 'waitingForInput') {
                // Claude is waiting for input
                await this._sendMessage(
                    channelId,
                    `:hourglass_flowing_sand: *Claude is waiting for input*\n\n` +
                    `${responseData.claudeResponse}`,
                    threadTs
                );
            }
        } catch (error) {
            this.logger.error('Failed to handle Claude response:', error.message);
            await this._sendMessage(
                channelId,
                `:x: *Failed to send Claude response:* ${error.message}`,
                threadTs
            );
        }
    }

    _formatClaudeResponse(responseData) {
        const { claudeResponse, userQuestion, sessionName } = responseData;

        // Build the response message
        let message = `:robot_face: *Claude Response*\n\n`;

        // Add user question if available
        if (userQuestion) {
            message += `📝 *Your Question:*\n${userQuestion.substring(0, 200)}`;
            if (userQuestion.length > 200) {
                message += '...';
            }
            message += '\n\n';
        }

        // Add the response with code block formatting (like telegram)
        if (claudeResponse && claudeResponse.length > 0) {
            const fullResponse = claudeResponse;
            const words = fullResponse.split(/\s+/);

            let preview;
            if (words.length > 100) {
                // Get last 100 words
                preview = words.slice(-100).join(' ');
            } else {
                preview = fullResponse;
            }

            // Format as code block (using Slack's ``` formatting)
            message += `🤖 *Claude Response Preview (last 100 words):*\n`;
            message += `\`\`\`\n${preview}\n\`\`\``;

            if (words.length > 100) {
                message += `\n_(...showing last 100 of ${words.length} words, full response in tmux session)_`;
            }
        } else {
            message += '_No response captured_';
        }

        message += `\n\n:computer: _Session: \`${sessionName}\`_`;

        return message;
    }

    async _handleCleanup(channelId, threadTs) {
        const session = this.threadManager.getSession(channelId, threadTs);

        if (!session) {
            await this._sendMessage(
                channelId,
                ':information_source: No active Claude session found for this thread.',
                threadTs
            );
            return;
        }

        try {
            // Kill the tmux session
            const { execSync } = require('child_process');
            execSync(`tmux kill-session -t "${session.sessionName}"`, { stdio: 'pipe' });

            // Remove mapping
            this.threadManager.removeSession(channelId, threadTs);

            await this._sendMessage(
                channelId,
                `:white_check_mark: *Session cleaned up*\n\nTerminated session: \`${session.sessionName}\``,
                threadTs
            );
        } catch (error) {
            this.logger.error('Cleanup failed:', error.message);
            await this._sendMessage(
                channelId,
                `:x: *Cleanup failed:* ${error.message}`,
                threadTs
            );
        }
    }

    async _handleStatus(channelId, threadTs) {
        const session = this.threadManager.getSession(channelId, threadTs);

        if (!session) {
            await this._sendMessage(
                channelId,
                ':information_source: No active Claude session found for this thread.\n\n' +
                'Mention me with your request to start a new session.',
                threadTs
            );
            return;
        }

        // Get tmux session info
        const { execSync } = require('child_process');
        let sessionInfo = 'Session is active';

        try {
            const paneInfo = execSync(
                `tmux list-panes -t "${session.sessionName}" -F "#{pane_current_command}"`,
                { encoding: 'utf8', stdio: 'pipe' }
            ).trim();

            sessionInfo = `Running: \`${paneInfo}\``;
        } catch (error) {
            sessionInfo = 'Unable to get session details';
        }

        await this._sendMessage(
            channelId,
            `:white_check_mark: *Active Claude Session*\n\n` +
            `:computer: *Session:* \`${session.sessionName}\`\n` +
            `:clock1: *Created:* ${new Date(session.createdAt).toLocaleString()}\n` +
            `:mag: *Status:* ${sessionInfo}\n\n` +
            `To attach to this session locally:\n\`\`\`tmux attach -t ${session.sessionName}\`\`\``,
            threadTs
        );
    }

    async _sendHelpMessage(channelId, threadTs = null) {
        const botUserId = await this._getBotUserId();
        const botMention = botUserId ? `<@${botUserId}>` : '@bot_name';

        const message = `:book: *Claude Code Remote Bot - Tmux Mode*\n\n` +
            `*Commands:*\n` +
            `• \`${botMention} <your request>\` - Start new task or continue conversation\n` +
            `• \`${botMention} status\` - Check active session status\n` +
            `• \`${botMention} cleanup\` - Terminate session for this thread\n` +
            `• \`${botMention} help\` - Show this help\n\n` +
            `*How it works:*\n` +
            `Each Slack thread gets its own persistent Claude session in tmux.\n` +
            `- First mention creates a new session and starts Claude with \`/bg-workflow\`\n` +
            `- Subsequent mentions in the same thread continue the conversation\n` +
            `- Thread history is automatically included for context\n\n` +
            `*Example:*\n` +
            `\`${botMention} Implement user authentication with JWT tokens\`\n\n` +
            `*Tips:*\n` +
            `• Start a thread to isolate different tasks\n` +
            `• Use \`status\` to check if Claude is still working\n` +
            `• Use \`cleanup\` when you're done to free resources\n` +
            `• Attach locally with \`tmux attach -t <session-name>\``;

        await this._sendMessage(channelId, message, threadTs);
    }

    async _sendDMHelpMessage(channelId) {
        const message = `:book: *Claude Code Remote Bot - Tmux Mode*\n\n` +
            `*Commands:*\n` +
            `• \`<your request>\` - Start new task or continue conversation\n` +
            `• \`status\` - Check active session status\n` +
            `• \`cleanup\` - Terminate session for this DM\n` +
            `• \`help\` - Show this help\n\n` +
            `*How it works:*\n` +
            `Each DM conversation gets its own persistent Claude session in tmux.\n` +
            `- First message creates a new session and starts Claude with \`/bg-workflow\`\n` +
            `- Subsequent messages continue the conversation\n\n` +
            `*Example:*\n` +
            `\`Implement user authentication with JWT tokens\`\n\n` +
            `*Tips:*\n` +
            `• Use \`status\` to check if Claude is still working\n` +
            `• Use \`cleanup\` when you're done to free resources\n` +
            `• Attach locally with \`tmux attach -t <session-name>\``;

        await this._sendMessage(channelId, message);
    }

    _isAuthorized(userId, channelId) {
        // Check whitelist first
        const whitelist = this.config.whitelist || [];

        // If user or channel is in whitelist, authorize
        if (whitelist.length > 0) {
            if (whitelist.includes(String(channelId)) || whitelist.includes(String(userId))) {
                return true;
            }
            // Whitelist exists but user/channel not in it
            return false;
        }

        // No whitelist - check configured channel
        const configuredChannelId = this.config.channelId;
        if (!configuredChannelId) {
            // No restrictions - allow all channels and DMs (open mode)
            return true;
        }

        // Check if matches configured channel
        // Note: DMs won't match channel ID, so they'll be blocked unless in whitelist
        if (String(channelId) === String(configuredChannelId)) {
            return true;
        }

        return false;
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

    async _getThreadConversation(channelId, threadTs) {
        try {
            const response = await axios.get(
                `${this.apiBaseUrl}/conversations.replies`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.botToken}`,
                        'Content-Type': 'application/json'
                    },
                    params: {
                        channel: channelId,
                        ts: threadTs,
                        inclusive: true // Include the parent message
                    }
                }
            );

            if (!response.data.ok) {
                this.logger.error('Failed to fetch thread:', response.data.error);
                return null;
            }

            const messages = response.data.messages || [];
            if (messages.length === 0) {
                return null;
            }

            // Format the thread conversation
            const formattedThread = await this._formatThreadMessages(messages);
            this.logger.info(`Captured thread with ${messages.length} messages`);

            return formattedThread;
        } catch (error) {
            this.logger.error('Failed to fetch thread conversation:', error.response?.data || error.message);
            return null;
        }
    }

    async _formatThreadMessages(messages) {
        const botUserId = await this._getBotUserId();
        const formattedMessages = [];

        for (const msg of messages) {
            // Skip if no text
            if (!msg.text) continue;

            // Determine sender
            const isBot = msg.user === botUserId || msg.bot_id;
            const sender = isBot ? 'Assistant' : 'User';

            // Clean up the message text (remove bot mentions, format links, etc.)
            let text = msg.text;

            // Remove bot mentions
            text = text.replace(new RegExp(`<@${botUserId}>`, 'g'), '').trim();

            // Format Slack links (convert <URL|text> to just text or URL)
            text = text.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '$2 ($1)');
            text = text.replace(/<(https?:\/\/[^>]+)>/g, '$1');

            // Format user mentions
            text = text.replace(/<@([A-Z0-9]+)>/g, '@user_$1');

            formattedMessages.push(`${sender}: ${text}`);
        }

        // Join messages with newlines
        const threadContext = formattedMessages.join('\n\n');

        return `[Thread Conversation Context]\n${threadContext}\n[End of Thread Context]`;
    }

    /**
     * Get only NEW user messages for continuing a conversation
     * Returns user messages that came after the most recent bot response
     * This avoids sending Claude messages it has already seen
     */
    async _getNewUserMessagesForContinuation(channelId, threadTs) {
        try {
            const response = await axios.get(
                `${this.apiBaseUrl}/conversations.replies`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.botToken}`,
                        'Content-Type': 'application/json'
                    },
                    params: {
                        channel: channelId,
                        ts: threadTs,
                        inclusive: true // Include the parent message
                    }
                }
            );

            if (!response.data.ok) {
                this.logger.error('Failed to fetch thread:', response.data.error);
                return null;
            }

            const messages = response.data.messages || [];
            if (messages.length === 0) {
                return null;
            }

            const botUserId = await this._getBotUserId();

            // Find the most recent bot message timestamp
            let mostRecentBotMessageTs = null;
            for (let i = messages.length - 1; i >= 0; i--) {
                const msg = messages[i];
                const isBot = msg.user === botUserId || msg.bot_id;
                if (isBot) {
                    mostRecentBotMessageTs = msg.ts;
                    this.logger.info(`📍 Found most recent bot message at ts: ${mostRecentBotMessageTs}`);
                    break;
                }
            }

            // If no bot message found, this shouldn't happen in continuation flow,
            // but return null to fallback to the full context
            if (!mostRecentBotMessageTs) {
                this.logger.warn('⚠️ No bot message found in thread for continuation');
                return null;
            }

            // Collect only USER messages that came AFTER the most recent bot message
            const newUserMessages = [];
            for (const msg of messages) {
                // Skip if no text
                if (!msg.text) continue;

                // Skip if message timestamp is before or equal to bot's last message
                if (parseFloat(msg.ts) <= parseFloat(mostRecentBotMessageTs)) {
                    continue;
                }

                // Check if this is a bot message (skip bot messages)
                const isBot = msg.user === botUserId || msg.bot_id;
                if (isBot) {
                    continue; // Skip bot messages
                }

                // This is a user message that came after the bot's last response
                // Clean up the message text
                let text = msg.text;

                // Remove bot mentions
                text = text.replace(new RegExp(`<@${botUserId}>`, 'g'), '').trim();

                // Format Slack links
                text = text.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '$2 ($1)');
                text = text.replace(/<(https?:\/\/[^>]+)>/g, '$1');

                // Format user mentions
                text = text.replace(/<@([A-Z0-9]+)>/g, '@user_$1');

                newUserMessages.push(`User: ${text}`);
            }

            if (newUserMessages.length === 0) {
                this.logger.info('📭 No new user messages found since last bot response');
                return null;
            }

            this.logger.info(`✅ Found ${newUserMessages.length} new user message(s) for continuation`);

            // Format for Claude
            const context = newUserMessages.join('\n\n');
            return `[New messages since last response]\n${context}\n[End of new messages]`;

        } catch (error) {
            this.logger.error('Failed to fetch new user messages:', error.response?.data || error.message);
            return null;
        }
    }

    async _sendMessage(channelId, text, threadTs = null) {
        try {
            const payload = {
                channel: channelId,
                text: text,
                mrkdwn: true
            };

            // If threadTs provided, reply in thread
            if (threadTs) {
                payload.thread_ts = threadTs;
            }

            const response = await axios.post(
                `${this.apiBaseUrl}/chat.postMessage`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.botToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.data.ok) {
                this.logger.error('Failed to send message:', response.data.error);
            }
        } catch (error) {
            this.logger.error('Failed to send message:', error.response?.data || error.message);
        }
    }

    /**
     * Add emoji reaction to a message
     * @param {string} channelId - Channel ID
     * @param {string} messageTs - Message timestamp
     * @param {string} emoji - Emoji name (without colons, e.g., 'thumbsup', 'eyes', 'white_check_mark')
     */
    async _addReaction(channelId, messageTs, emoji) {
        try {
            const response = await axios.post(
                `${this.apiBaseUrl}/reactions.add`,
                {
                    channel: channelId,
                    timestamp: messageTs,
                    name: emoji
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.botToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.data.ok && response.data.error !== 'already_reacted') {
                this.logger.warn(`Failed to add reaction ${emoji}:`, response.data.error);
            }
        } catch (error) {
            // Don't fail the main flow if reactions fail
            this.logger.debug('Failed to add reaction:', error.response?.data?.error || error.message);
        }
    }

    /**
     * Remove emoji reaction from a message
     * @param {string} channelId - Channel ID
     * @param {string} messageTs - Message timestamp
     * @param {string} emoji - Emoji name (without colons)
     */
    async _removeReaction(channelId, messageTs, emoji) {
        try {
            const response = await axios.post(
                `${this.apiBaseUrl}/reactions.remove`,
                {
                    channel: channelId,
                    timestamp: messageTs,
                    name: emoji
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.botToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.data.ok && response.data.error !== 'no_reaction') {
                this.logger.warn(`Failed to remove reaction ${emoji}:`, response.data.error);
            }
        } catch (error) {
            // Don't fail the main flow if reactions fail
            this.logger.debug('Failed to remove reaction:', error.response?.data?.error || error.message);
        }
    }

    start(port = 3000) {
        this.app.listen(port, () => {
            this.logger.info(`Slack webhook server started on port ${port}`);
            this.logger.info(`Thread-based tmux sessions enabled`);
            this.logger.info(`Each Slack thread will get its own persistent Claude session`);

            // Clean up stale mappings on startup
            const cleaned = this.threadManager.cleanupStaleMappings();
            if (cleaned > 0) {
                this.logger.info(`Cleaned up ${cleaned} stale thread mapping(s) on startup`);
            }

            // Start periodic cleanup of idle sessions
            // Check every 6 hours, remove sessions older than 24 hours
            this.threadManager.startPeriodicCleanup(6, 24);
            this.logger.info(`Periodic session cleanup enabled: check every 6h, max age 24h`);
        });
    }
}

module.exports = SlackWebhookHandler;
