/**
 * Trace Capture Utility
 * Tracks user input timestamps for smart execution trace capture
 */

const path = require('path');
const FileSystemUtils = require('./file-system-utils');
const JsonDataStore = require('./json-data-store');

class TraceCapture {
    constructor() {
        this.dataDir = path.join(__dirname, '../data');
        this.timestampFile = path.join(this.dataDir, 'user-input-timestamps.json');
        FileSystemUtils.ensureDirectory(this.dataDir);
    }

    /**
     * Load timestamp data
     */
    _loadTimestamps() {
        return JsonDataStore.loadObject(this.timestampFile);
    }

    /**
     * Save timestamp data
     */
    _saveTimestamps(data) {
        JsonDataStore.save(this.timestampFile, data);
    }

    /**
     * Record user input timestamp for a session
     * @param {string} sessionName - The tmux session name
     * @param {number} timestamp - Unix timestamp in milliseconds
     */
    recordUserInput(sessionName, timestamp = Date.now()) {
        const timestamps = this._loadTimestamps();
        
        if (!timestamps[sessionName]) {
            timestamps[sessionName] = {
                inputs: []
            };
        }
        
        timestamps[sessionName].inputs.push({
            timestamp: timestamp,
            date: new Date(timestamp).toISOString()
        });
        
        // Keep only last 10 inputs per session to avoid growing too large
        if (timestamps[sessionName].inputs.length > 10) {
            timestamps[sessionName].inputs = timestamps[sessionName].inputs.slice(-10);
        }

        this._saveTimestamps(timestamps);
    }
}

module.exports = TraceCapture;