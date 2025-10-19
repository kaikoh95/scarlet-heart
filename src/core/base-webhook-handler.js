const express = require('express');

/**
 * Base class for webhook handlers
 * Provides common webhook infrastructure for all channels
 */
class BaseWebhookHandler {
    constructor(config, serviceName) {
        this.config = config;
        this.serviceName = serviceName;
        this.app = express();
        this._setupMiddleware();
        this._setupRoutes();
    }

    /**
     * Setup Express middleware
     * @private
     */
    _setupMiddleware() {
        // JSON parsing
        this.app.use(express.json());

        // URL-encoded parsing (for some webhooks)
        this.app.use(express.urlencoded({ extended: true }));
    }

    /**
     * Setup common routes
     * @private
     */
    _setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                service: this.serviceName,
                timestamp: new Date().toISOString()
            });
        });

        // Webhook endpoint (subclass defines path)
        const webhookPath = this._getWebhookPath();
        this.app.post(webhookPath, this._handleWebhook.bind(this));

        console.log(`📍 Webhook endpoint registered: POST ${webhookPath}`);
    }

    /**
     * Get webhook path - must be implemented by subclasses
     * @returns {string} The webhook path (e.g., '/webhook/slack')
     * @abstract
     */
    _getWebhookPath() {
        throw new Error('Must implement _getWebhookPath()');
    }

    /**
     * Handle webhook request - must be implemented by subclasses
     * @param {express.Request} req - Express request object
     * @param {express.Response} res - Express response object
     * @abstract
     */
    async _handleWebhook(req, res) {
        throw new Error('Must implement _handleWebhook()');
    }

    /**
     * Start the webhook server
     * @param {number} port - Port to listen on (default: 3000)
     */
    start(port = 3000) {
        this.app.listen(port, () => {
            console.log(`✅ ${this.serviceName} webhook server started on port ${port}`);
            console.log(`🔗 Webhook URL: http://localhost:${port}${this._getWebhookPath()}`);
        });
    }

    /**
     * Get the Express app instance (for testing or advanced usage)
     * @returns {express.Application}
     */
    getApp() {
        return this.app;
    }
}

module.exports = BaseWebhookHandler;
