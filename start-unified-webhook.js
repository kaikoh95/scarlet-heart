#!/usr/bin/env node

/**
 * Unified Webhook Server
 * Handles all webhook platforms (Telegram, Slack, LINE) on a single port
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const Logger = require('./src/core/logger');

// Load environment variables
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const logger = new Logger('Unified-Webhook-Server');

// Configuration
const config = {
    port: process.env.WEBHOOK_PORT || process.env.UNIFIED_WEBHOOK_PORT || 3001,
    telegram: {
        enabled: process.env.TELEGRAM_ENABLED === 'true',
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID,
        groupId: process.env.TELEGRAM_GROUP_ID,
        whitelist: process.env.TELEGRAM_WHITELIST ? process.env.TELEGRAM_WHITELIST.split(',').map(id => id.trim()) : []
    },
    slack: {
        enabled: process.env.SLACK_ENABLED === 'true',
        botToken: process.env.SLACK_BOT_TOKEN,
        channelId: process.env.SLACK_CHANNEL_ID,
        signingSecret: process.env.SLACK_SIGNING_SECRET,
        whitelist: process.env.SLACK_WHITELIST ? process.env.SLACK_WHITELIST.split(',').map(id => id.trim()) : []
    },
    line: {
        enabled: process.env.LINE_ENABLED === 'true',
        channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
        channelSecret: process.env.LINE_CHANNEL_SECRET,
        userId: process.env.LINE_USER_ID,
        groupId: process.env.LINE_GROUP_ID,
        whitelist: process.env.LINE_WHITELIST ? process.env.LINE_WHITELIST.split(',').map(id => id.trim()) : []
    }
};

// Create Express app
const app = express();

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    const status = {
        status: 'ok',
        service: 'unified-webhook-server',
        platforms: {
            telegram: config.telegram.enabled,
            slack: config.slack.enabled,
            line: config.line.enabled
        },
        timestamp: new Date().toISOString()
    };
    res.json(status);
});

// Platform handlers
const handlers = [];

// Setup Telegram webhook
if (config.telegram.enabled && config.telegram.botToken) {
    try {
        const TelegramWebhookHandler = require('./src/channels/telegram/webhook');
        const telegramHandler = new TelegramWebhookHandler(config.telegram);

        // Mount Telegram routes on the main app
        app.post('/webhook/telegram', (req, res) => {
            telegramHandler._handleWebhook(req, res);
        });

        handlers.push('Telegram');
        logger.info('✅ Telegram webhook handler initialized');
    } catch (error) {
        logger.error('Failed to initialize Telegram handler:', error.message);
    }
} else if (config.telegram.enabled) {
    logger.warn('Telegram enabled but TELEGRAM_BOT_TOKEN not configured');
}

// Setup Slack webhook
if (config.slack.enabled && config.slack.botToken) {
    try {
        const SlackWebhookHandler = require('./src/channels/slack/webhook');
        const slackHandler = new SlackWebhookHandler(config.slack);

        // Mount Slack routes on the main app
        app.post('/webhook/slack', (req, res) => {
            slackHandler._handleWebhook(req, res);
        });

        handlers.push('Slack');
        logger.info('✅ Slack webhook handler initialized');
    } catch (error) {
        logger.error('Failed to initialize Slack handler:', error.message);
    }
} else if (config.slack.enabled) {
    logger.warn('Slack enabled but SLACK_BOT_TOKEN not configured');
}

// Setup LINE webhook
if (config.line.enabled && config.line.channelAccessToken) {
    try {
        const LineWebhookHandler = require('./src/channels/line/webhook');
        const lineHandler = new LineWebhookHandler(config.line);

        // Mount LINE routes on the main app
        app.post('/webhook/line', (req, res) => {
            lineHandler._handleWebhook(req, res);
        });

        handlers.push('LINE');
        logger.info('✅ LINE webhook handler initialized');
    } catch (error) {
        logger.error('Failed to initialize LINE handler:', error.message);
    }
} else if (config.line.enabled) {
    logger.warn('LINE enabled but LINE_CHANNEL_ACCESS_TOKEN not configured');
}

// Validate at least one platform is configured
if (handlers.length === 0) {
    logger.error('No platforms configured! Please enable and configure at least one platform:');
    logger.error('  - TELEGRAM_ENABLED=true with TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID');
    logger.error('  - SLACK_ENABLED=true with SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET');
    logger.error('  - LINE_ENABLED=true with LINE_CHANNEL_ACCESS_TOKEN');
    process.exit(1);
}

// Start server
async function start() {
    logger.info('🚀 Starting Unified Webhook Server...');
    logger.info('');
    logger.info('Configuration:');
    logger.info(`  Port: ${config.port}`);
    logger.info(`  Enabled Platforms: ${handlers.join(', ')}`);
    logger.info('');

    if (config.telegram.enabled) {
        logger.info('📱 Telegram Configuration:');
        logger.info(`  Chat ID: ${config.telegram.chatId || 'Not set'}`);
        logger.info(`  Group ID: ${config.telegram.groupId || 'Not set'}`);
        logger.info(`  Whitelist: ${config.telegram.whitelist.length > 0 ? config.telegram.whitelist.join(', ') : 'None'}`);
        logger.info('');
    }

    if (config.slack.enabled) {
        logger.info('💼 Slack Configuration:');
        logger.info(`  Channel ID: ${config.slack.channelId}`);
        logger.info(`  Signing Secret: ${config.slack.signingSecret ? 'Configured' : 'Not configured'}`);
        logger.info(`  Whitelist: ${config.slack.whitelist.length > 0 ? config.slack.whitelist.join(', ') : 'None'}`);
        logger.info('');
    }

    if (config.line.enabled) {
        logger.info('💬 LINE Configuration:');
        logger.info(`  User ID: ${config.line.userId || 'Not set'}`);
        logger.info(`  Group ID: ${config.line.groupId || 'Not set'}`);
        logger.info(`  Whitelist: ${config.line.whitelist.length > 0 ? config.line.whitelist.join(', ') : 'None'}`);
        logger.info('');
    }

    logger.info('Webhook Endpoints:');
    if (config.telegram.enabled) {
        logger.info(`  📱 Telegram: http://localhost:${config.port}/webhook/telegram`);
    }
    if (config.slack.enabled) {
        logger.info(`  💼 Slack: http://localhost:${config.port}/webhook/slack`);
    }
    if (config.line.enabled) {
        logger.info(`  💬 LINE: http://localhost:${config.port}/webhook/line`);
    }
    logger.info(`  🏥 Health: http://localhost:${config.port}/health`);
    logger.info('');

    logger.info('Setup Instructions:');
    logger.info('  1. Expose this server using ngrok or a public domain:');
    logger.info(`     ngrok http ${config.port}`);
    logger.info('');
    logger.info('  2. Configure webhook URLs in your platforms:');
    if (config.telegram.enabled) {
        logger.info('     Telegram: https://your-domain.com/webhook/telegram');
    }
    if (config.slack.enabled) {
        logger.info('     Slack: https://your-domain.com/webhook/slack');
    }
    if (config.line.enabled) {
        logger.info('     LINE: https://your-domain.com/webhook/line');
    }
    logger.info('');

    app.listen(config.port, () => {
        logger.info(`✅ Unified webhook server running on port ${config.port}`);
        logger.info('');
    });
}

start();

// Handle graceful shutdown
process.on('SIGINT', () => {
    logger.info('Shutting down unified webhook server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Shutting down unified webhook server...');
    process.exit(0);
});
