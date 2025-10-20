#!/usr/bin/env node

/**
 * Slack Webhook Server
 * Starts the Slack webhook server for receiving app mentions
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const Logger = require('./src/core/logger');
const SlackWebhookHandler = require('./src/channels/slack/webhook');

// Load environment variables
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const logger = new Logger('Slack-Webhook-Server');

// Load configuration
const config = {
    botToken: process.env.SLACK_BOT_TOKEN,
    channelId: process.env.SLACK_CHANNEL_ID,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    whitelist: process.env.SLACK_WHITELIST ? process.env.SLACK_WHITELIST.split(',').map(id => id.trim()) : [],
    port: process.env.SLACK_WEBHOOK_PORT || 3002
};

// Validate configuration
if (!config.botToken) {
    logger.error('SLACK_BOT_TOKEN must be set in .env file');
    process.exit(1);
}

// SLACK_CHANNEL_ID is optional if whitelist is configured
if (!config.channelId && config.whitelist.length === 0) {
    logger.error('Either SLACK_CHANNEL_ID or SLACK_WHITELIST must be set in .env file');
    process.exit(1);
}

// Create and start webhook handler
const webhookHandler = new SlackWebhookHandler(config);

async function start() {
    logger.info('Starting Slack webhook server...');
    logger.info(`Configuration:`);
    logger.info(`- Port: ${config.port}`);
    logger.info(`- Channel ID: ${config.channelId || 'Not set (using whitelist)'}`);
    logger.info(`- Signing Secret: ${config.signingSecret ? 'Configured' : 'Not configured (signature verification disabled)'}`);
    logger.info(`- Whitelist: ${config.whitelist.length > 0 ? config.whitelist.join(', ') : 'None (using configured channel)'}`);

    logger.info('');
    logger.info('Important Setup Instructions:');
    logger.info('1. Go to https://api.slack.com/apps and select your app');
    logger.info('2. Navigate to "OAuth & Permissions" and add required scopes (see below)');
    logger.info('3. Navigate to "Event Subscriptions" and enable events');
    logger.info('4. Set the Request URL to: https://your-domain.com/webhook/slack');
    logger.info('5. Subscribe to bot events: "app_mention" and "message.im"');
    logger.info('6. Save changes and reinstall the app to your workspace');
    logger.info('');
    logger.info('Required OAuth Scopes:');
    logger.info('- app_mentions:read (to receive mentions in channels)');
    logger.info('- im:history (to view direct messages)');
    logger.info('- im:read (to read direct message info)');
    logger.info('- chat:write (to send messages)');
    logger.info('');
    logger.info('Features:');
    logger.info('- Receive commands via @mentions in channels');
    logger.info('- Receive commands via direct messages (no @mention needed)');
    logger.info('');

    webhookHandler.start(config.port);
}

start();

// Handle graceful shutdown
process.on('SIGINT', () => {
    logger.info('Shutting down Slack webhook server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Shutting down Slack webhook server...');
    process.exit(0);
});
