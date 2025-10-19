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
        console.log(`${'='.repeat(60)}`);
        console.log(`📊 Session: ${sessionName}`);
        console.log(`📊 Type: ${notificationType}`);
        console.log(`📊 Project: ${projectName}`);

        // Load Slack thread manager to get thread info
        const threadManager = new SlackThreadManager();
        console.log(`✓ SlackThreadManager loaded`);

        const threadInfo = threadManager.getThreadInfoBySessionName(sessionName);

        if (!threadInfo) {
            console.error(`❌ No thread info found for session ${sessionName}`);
            console.error(`💡 This might happen if:`);
            console.error(`   - Session mapping was cleared`);
            console.error(`   - Session name doesn't match pattern`);
            console.error(`   - Bot was restarted and mappings lost`);
            return false;
        }

        console.log(`✓ Thread info found:`);
        console.log(`  Channel ID: ${threadInfo.channelId}`);
        console.log(`  Thread TS: ${threadInfo.threadTs}`);
        console.log(`  Created: ${threadInfo.createdAt || 'unknown'}`);

        // Get conversation content from tmux
        console.log(`📖 Extracting conversation from tmux session...`);
        const TmuxMonitor = require('./src/utils/tmux-monitor');
        const tmuxMonitor = new TmuxMonitor();

        // Extract with more lines to capture full response (like Telegram)
        const conversation = tmuxMonitor.getRecentConversation(sessionName, 5000);

        console.log(`✓ Conversation extracted:`);
        console.log(`  User question length: ${conversation.userQuestion?.length || 0} chars`);
        console.log(`  Claude response length: ${conversation.claudeResponse?.length || 0} chars`);

        if (conversation.claudeResponse) {
            console.log(`  Response preview: ${conversation.claudeResponse.substring(0, 150)}...`);
        } else {
            console.error(`  ❌ NO RESPONSE CAPTURED!`);
        }

        if (conversation.userQuestion) {
            console.log(`  User question preview: ${conversation.userQuestion.substring(0, 100)}...`);
        }

        if (conversation.claudeResponse) {
            console.log(`  Claude response preview: ${conversation.claudeResponse.substring(0, 100)}...`);
        } else {
            console.warn(`⚠️ No Claude response captured from tmux!`);
        }

        // Get the response callback from the thread manager
        // This will trigger the webhook's _handleClaudeResponse which updates the message
        const callbackData = threadManager.responseCallbacks.get(sessionName);

        if (callbackData && callbackData.callback) {
            console.log(`✓ Found response callback for session`);
            console.log(`📤 Triggering webhook state update via callback...`);

            // Call the webhook's callback which will update the thread state
            await callbackData.callback({
                type: notificationType === 'completed' ? 'taskCompleted' : 'waitingForInput',
                sessionName: sessionName,
                userQuestion: conversation.userQuestion || 'No user input captured',
                claudeResponse: conversation.claudeResponse || 'No response',
                timestamp: new Date().toISOString()
            });

            console.log(`✅ Slack thread state updated via webhook!`);
            console.log(`   Channel: ${threadInfo.channelId}`);
            console.log(`   Thread: ${threadInfo.threadTs}`);
            console.log(`${'='.repeat(60)}\n`);
            return true;
        } else {
            console.error(`❌ No response callback found for session ${sessionName}`);
            console.error(`💡 The webhook handler may not be running or callback wasn't registered`);
            console.log(`${'='.repeat(60)}\n`);
            return false;
        }
    } catch (error) {
        console.error(`\n❌ Slack thread notification error:`, error.message);
        console.error(`Stack trace:`, error.stack);
        console.error(`💡 Common issues:`);
        console.error(`   - Webhook handler not running`);
        console.error(`   - Callback not registered for session`);
        console.error(`   - Invalid thread data`);
        console.log(`${'='.repeat(60)}\n`);
        return false;
    }
}

async function sendHookNotification() {
    try {
        const notificationType = process.argv[2] || 'completed';
        console.log('='.repeat(80));
        console.log('🔔 STOP HOOK FIRED');
        console.log(`📊 Type: ${notificationType}`);
        console.log(`📊 CWD: ${process.cwd()}`);
        
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
        
        // Try to get current tmux session
        let tmuxSession = process.env.TMUX_SESSION || 'claude-real';
        try {
            const { execSync } = require('child_process');
            const sessionOutput = execSync('tmux display-message -p "#S"', {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore']
            }).trim();
            if (sessionOutput) {
                tmuxSession = sessionOutput;
            }
        } catch (error) {
            // Not in tmux or tmux not available, use default
        }

        // Check if this is a Slack session and handle it specially
        if (tmuxSession && tmuxSession.startsWith('slack-')) {
            console.log(`\n${'='.repeat(80)}`);
            console.log(`📱 SLACK SESSION DETECTED`);
            console.log(`📊 Session: ${tmuxSession}`);
            console.log(`📊 Type: ${notificationType}`);
            console.log(`📊 Project: ${projectName}`);
            console.log(`${'='.repeat(80)}\n`);

            const result = await sendSlackThreadNotification(tmuxSession, notificationType, projectName);
            console.log(`\n📋 Slack notification result: ${result ? 'SUCCESS' : 'FAILED'}\n`);
            return; // Skip other channels for Slack sessions
        }
        
        // Create notification
        const notification = {
            type: notificationType,
            title: `Claude ${notificationType === 'completed' ? 'Task Completed' : 'Waiting for Input'}`,
            message: `Claude has ${notificationType === 'completed' ? 'completed a task' : 'is waiting for input'}`,
            project: projectName
            // Don't set metadata here - let TelegramChannel extract real conversation content
        };
        
        console.log(`📱 Sending ${notificationType} notification for project: ${projectName}`);
        console.log(`🖥️ Tmux session: ${tmuxSession}`);
        
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