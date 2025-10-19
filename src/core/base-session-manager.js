const fs = require('fs');
const path = require('path');
const Logger = require('./logger');

/**
 * Base class for session management
 * Provides common session storage and message info tracking
 */
class BaseSessionManager {
    constructor(serviceName) {
        this.serviceName = serviceName;
        this.logger = new Logger(serviceName);
        this.dataDir = path.join(__dirname, '../data');
        this.mappingFile = path.join(this.dataDir, `${serviceName}-mappings.json`);
        this.mappings = {};
        this.messageInfo = new Map(); // For hook access

        this._ensureDirectories();
        this._loadMappings();
    }

    /**
     * Ensure data directories exist
     * @private
     */
    _ensureDirectories() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
            this.logger.info(`Created data directory: ${this.dataDir}`);
        }
    }

    /**
     * Load mappings from disk
     * @private
     */
    _loadMappings() {
        try {
            if (fs.existsSync(this.mappingFile)) {
                const data = fs.readFileSync(this.mappingFile, 'utf8');
                this.mappings = JSON.parse(data);
                this.logger.info(`Loaded ${Object.keys(this.mappings).length} mappings from ${this.mappingFile}`);
            } else {
                this.mappings = {};
                this._saveMappings();
                this.logger.info(`Created new mappings file: ${this.mappingFile}`);
            }
        } catch (error) {
            this.logger.error(`Failed to load mappings: ${error.message}`);
            this.mappings = {};
        }
    }

    /**
     * Save mappings to disk
     * @private
     */
    _saveMappings() {
        try {
            fs.writeFileSync(this.mappingFile, JSON.stringify(this.mappings, null, 2));
        } catch (error) {
            this.logger.error(`Failed to save mappings: ${error.message}`);
        }
    }

    /**
     * Store message info for hook access
     * @param {string} sessionName - Session name
     * @param {Object} messageInfo - Message info object
     */
    setMessageInfo(sessionName, messageInfo) {
        this.messageInfo.set(sessionName, messageInfo);
        this.logger.info(`Stored message info for session ${sessionName}`);
    }

    /**
     * Get message info for hooks
     * @param {string} sessionName - Session name
     * @returns {Object|undefined} Message info object
     */
    getMessageInfo(sessionName) {
        return this.messageInfo.get(sessionName);
    }

    /**
     * Clear message info for a session
     * @param {string} sessionName - Session name
     */
    clearMessageInfo(sessionName) {
        this.messageInfo.delete(sessionName);
        this.logger.info(`Cleared message info for session ${sessionName}`);
    }

    /**
     * Cleanup stale sessions
     * Override in subclasses for specific cleanup logic
     * @param {number} maxAgeMs - Maximum age in milliseconds
     */
    cleanupStaleSessions(maxAgeMs = 24 * 60 * 60 * 1000) {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [key, mapping] of Object.entries(this.mappings)) {
            if (mapping.timestamp && (now - mapping.timestamp) > maxAgeMs) {
                delete this.mappings[key];
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            this._saveMappings();
            this.logger.info(`Cleaned up ${cleanedCount} stale sessions`);
        }

        return cleanedCount;
    }

    /**
     * Get all mappings
     * @returns {Object} All mappings
     */
    getAllMappings() {
        return { ...this.mappings };
    }

    /**
     * Get mapping by key
     * @param {string} key - Mapping key
     * @returns {Object|undefined} Mapping object
     */
    getMapping(key) {
        return this.mappings[key];
    }

    /**
     * Set mapping
     * @param {string} key - Mapping key
     * @param {Object} value - Mapping value
     */
    setMapping(key, value) {
        this.mappings[key] = {
            ...value,
            timestamp: Date.now()
        };
        this._saveMappings();
    }

    /**
     * Delete mapping
     * @param {string} key - Mapping key
     */
    deleteMapping(key) {
        if (this.mappings[key]) {
            delete this.mappings[key];
            this._saveMappings();
            return true;
        }
        return false;
    }
}

module.exports = BaseSessionManager;
