#!/usr/bin/env node

/**
 * Claude Hook Notification Script
 * Called by Claude Code hooks to send Telegram notifications
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from the project directory
const projectDir = path.dirname(__filename);
const envPath = path.join(projectDir, '.env');

console.log('🔍 Hook script started from:', process.cwd());
console.log('📁 Script location:', __filename);
console.log('🔧 Looking for .env at:', envPath);

if (fs.existsSync(envPath)) {
    console.log('✅ .env file found, loading...');
    dotenv.config({ path: envPath });
} else {
    console.error('❌ .env file not found at:', envPath);
    console.log('📂 Available files in script directory:');
    try {
        const files = fs.readdirSync(projectDir);
        console.log(files.join(', '));
    } catch (error) {
        console.error('Cannot read directory:', error.message);
    }
    process.exit(1);
}

const TelegramChannel = require('./src/channels/telegram/telegram');
const SlackChannel = require('./src/channels/slack/slack');
const DesktopChannel = require('./src/channels/local/desktop');
const EmailChannel = require('./src/channels/email/smtp');
const SlackThreadManager = require('./src/utils/slack-thread-manager');

/**
 * Send notification to a specific Slack thread
 * Used when Claude finishes a task in a Slack-initiated tmux session
 */
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
        if (notificationType === 'init') {
            // === INIT STATE ===
            const initMessage =
                `:eyes: *Claude Initialising*\n\n` +
                `:file_folder: *Project:* ${projectName}\n` +
                `:computer: *Session:* \`${sessionName}\`\n` +
                `:memo: *Request:* ${conversation.userQuestion?.substring(0, 200) || 'Waiting for task...'}\n\n` +
                `Setting up Claude session...`;

            await slackChannel.updateMessage(
                threadInfo.channelId,
                messageInfo.botMessageTs,
                initMessage
            );

            // Ensure only eyes emoji (remove others, add eyes)
            // The webhook already adds eyes, but we ensure clean state
            await slackChannel.removeReaction(threadInfo.channelId, messageInfo.userMessageTs, 'hourglass_flowing_sand');
            await slackChannel.removeReaction(threadInfo.channelId, messageInfo.userMessageTs, 'white_check_mark');
            await slackChannel.addReaction(threadInfo.channelId, messageInfo.userMessageTs, 'eyes');

            console.log(`✅ Updated to "init" state`);
        }

        if (notificationType === 'working') {
            // === WORKING STATE ===
            const workingMessage =
                `:hourglass_flowing_sand: *Claude is working*\n\n` +
                `:file_folder: *Project:* ${projectName}\n` +
                `:computer: *Session:* \`${sessionName}\`\n` +
                `:memo: *Request:* ${conversation.userQuestion?.substring(0, 200) || 'Processing...'}\n\n` +
                `Processing your request...`;

            await slackChannel.updateMessage(
                threadInfo.channelId,
                messageInfo.botMessageTs,
                workingMessage
            );

            // Ensure only hourglass emoji (remove all others first)
            await slackChannel.removeReaction(threadInfo.channelId, messageInfo.userMessageTs, 'eyes');
            await slackChannel.removeReaction(threadInfo.channelId, messageInfo.userMessageTs, 'white_check_mark');
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
                    completedMessage += `\n\n_💡 Showing last 100 of ${totalWords} words. Full response in tmux._`;
                }
            }

            completedMessage += `\n\n:file_folder: _Project: ${projectName}_\n`;
            completedMessage += `:computer: _Session: \`${sessionName}\`_`;

            await slackChannel.updateMessage(
                threadInfo.channelId,
                messageInfo.botMessageTs,
                completedMessage
            );

            // Ensure only checkmark emoji (remove all others first)
            await slackChannel.removeReaction(threadInfo.channelId, messageInfo.userMessageTs, 'eyes');
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

/**
 * Get current tmux session name
 * @returns {string|null} Session name or null if not in tmux
 */
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
            console.log('='.repeat(80));
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
            console.log('='.repeat(80));
            return;
        }

        // Standard notification flow for Telegram
        const channels = [];
        const results = [];
        
        // Configure Desktop channel (always enabled for sound)
        const desktopChannel = new DesktopChannel({
            completedSound: 'Glass',
            waitingSound: 'Tink'
        });
        channels.push({ name: 'Desktop', channel: desktopChannel });
        
        // Configure Telegram channel if enabled
        if (process.env.TELEGRAM_ENABLED === 'true' && process.env.TELEGRAM_BOT_TOKEN) {
            const telegramConfig = {
                botToken: process.env.TELEGRAM_BOT_TOKEN,
                chatId: process.env.TELEGRAM_CHAT_ID,
                groupId: process.env.TELEGRAM_GROUP_ID,
                forceIPv4: process.env.TELEGRAM_FORCE_IPV4 === 'true'
            };

            if (telegramConfig.botToken && (telegramConfig.chatId || telegramConfig.groupId)) {
                const telegramChannel = new TelegramChannel(telegramConfig);
                channels.push({ name: 'Telegram', channel: telegramChannel });
            }
        }

        // Configure Slack channel if enabled
        if (process.env.SLACK_ENABLED === 'true' && process.env.SLACK_BOT_TOKEN) {
            const slackConfig = {
                botToken: process.env.SLACK_BOT_TOKEN,
                channelId: process.env.SLACK_CHANNEL_ID,
                signingSecret: process.env.SLACK_SIGNING_SECRET
            };

            if (slackConfig.botToken && slackConfig.channelId) {
                const slackChannel = new SlackChannel(slackConfig);
                channels.push({ name: 'Slack', channel: slackChannel });
            }
        }

        // Configure Email channel if enabled
        if (process.env.EMAIL_ENABLED === 'true' && process.env.SMTP_USER) {
            const emailConfig = {
                smtp: {
                    host: process.env.SMTP_HOST,
                    port: parseInt(process.env.SMTP_PORT),
                    secure: process.env.SMTP_SECURE === 'true',
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                },
                from: process.env.EMAIL_FROM,
                fromName: process.env.EMAIL_FROM_NAME,
                to: process.env.EMAIL_TO
            };
            
            if (emailConfig.smtp.host && emailConfig.smtp.auth.user && emailConfig.to) {
                const emailChannel = new EmailChannel(emailConfig);
                channels.push({ name: 'Email', channel: emailChannel });
            }
        }
        
        // Get current working directory and tmux session
        const currentDir = process.cwd();
        const projectName = path.basename(currentDir);

        // This code is now handled by session filtering above
        // All Slack sessions are handled by sendSlackThreadNotification
        // Only claude-session reaches here for Telegram notifications

        // Create notification
        let title, message;
        if (notificationType === 'init') {
            title = 'Claude Waiting for Input';
            message = 'Claude is ready and waiting for your command';
        } else if (notificationType === 'completed') {
            title = 'Claude Task Completed';
            message = 'Claude has completed a task';
        } else if (notificationType === 'working') {
            title = 'Claude Processing';
            message = 'Claude is processing your command';
        } else {
            title = 'Claude Notification';
            message = 'Claude notification';
        }

        const notification = {
            type: notificationType,
            title: title,
            message: message,
            project: projectName
            // Don't set metadata here - let TelegramChannel extract real conversation content
        };
        
        console.log(`📱 Sending ${notificationType} notification for project: ${projectName}`);
        console.log(`🖥️ Tmux session: claude-session`);
        
        // Send notifications to all configured channels
        for (const { name, channel } of channels) {
            try {
                console.log(`📤 Sending to ${name}...`);
                const result = await channel.send(notification);
                results.push({ name, success: result });
                
                if (result) {
                    console.log(`✅ ${name} notification sent successfully!`);
                } else {
                    console.log(`❌ Failed to send ${name} notification`);
                }
            } catch (error) {
                console.error(`❌ ${name} notification error:`, error.message);
                results.push({ name, success: false, error: error.message });
            }
        }
        
        // Report overall results
        const successful = results.filter(r => r.success).length;
        const total = results.length;
        
        if (successful > 0) {
            console.log(`\n✅ Successfully sent notifications via ${successful}/${total} channels`);
            if (results.some(r => r.name === 'Telegram' && r.success)) {
                console.log('📋 You can now send new commands via Telegram');
            }
            if (results.some(r => r.name === 'Slack' && r.success)) {
                console.log('📋 You can now send new commands via Slack');
            }
        } else {
            console.log('\n❌ All notification channels failed');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Hook notification error:', error.message);
        process.exit(1);
    }
}

// Show usage if no arguments
if (process.argv.length < 2) {
    console.log('Usage: node claude-hook-notify.js [completed|waiting]');
    process.exit(1);
}

sendHookNotification();