/**
 * Subagent Activity Tracker
 * Tracks subagent activities for including in completion emails
 */

const path = require('path');
const FileSystemUtils = require('./file-system-utils');
const JsonDataStore = require('./json-data-store');
const StringUtils = require('./string-utils');

class SubagentTracker {
    constructor() {
        this.dataDir = path.join(__dirname, '../data');
        this.trackingFile = path.join(this.dataDir, 'subagent-activities.json');
        FileSystemUtils.ensureDirectory(this.dataDir);
    }

    /**
     * Load existing activities
     */
    _loadActivities() {
        return JsonDataStore.loadObject(this.trackingFile);
    }

    /**
     * Save activities to file
     */
    _saveActivities(activities) {
        JsonDataStore.save(this.trackingFile, activities);
    }

    /**
     * Add a subagent activity
     */
    addActivity(sessionId, activity) {
        const activities = this._loadActivities();
        
        if (!activities[sessionId]) {
            activities[sessionId] = {
                startTime: new Date().toISOString(),
                activities: []
            };
        }

        activities[sessionId].activities.push({
            timestamp: new Date().toISOString(),
            type: activity.type || 'subagent',
            description: activity.description || 'Subagent activity',
            details: activity.details || {}
        });

        this._saveActivities(activities);
    }

    /**
     * Clear activities for a session
     */
    clearActivities(sessionId) {
        const activities = this._loadActivities();
        delete activities[sessionId];
        this._saveActivities(activities);
    }

    /**
     * Format activities for email
     */
    formatActivitiesForEmail(sessionId) {
        const allActivities = this._loadActivities();
        const sessionData = allActivities[sessionId] || null;
        if (!sessionData || sessionData.activities.length === 0) {
            return '';
        }

        const activities = sessionData.activities;
        const grouped = {};

        // Group activities by type
        activities.forEach(activity => {
            const type = activity.type;
            if (!grouped[type]) {
                grouped[type] = [];
            }
            grouped[type].push(activity);
        });

        // Format as HTML
        let html = `
            <!-- Subagent Activities -->
            <div style="margin: 20px 0; padding: 15px; background-color: #1f1f1f; border: 1px solid #444; border-radius: 4px;">
                <div style="color: #ff9800; margin-bottom: 10px; font-weight: bold;">📊 Subagent Activities Summary</div>
                <div style="color: #ccc; font-size: 13px; line-height: 1.6;">`;
        
        for (const [type, items] of Object.entries(grouped)) {
            html += `<div style="margin-bottom: 10px;">`;
            html += `<div style="color: #00bcd4; font-weight: bold;">${type} (${items.length} activities)</div>`;
            html += `<ul style="margin: 5px 0 0 20px; padding: 0;">`;
            items.forEach((item, index) => {
                const time = new Date(item.timestamp).toLocaleTimeString();
                html += `<li style="color: #ccc; margin: 8px 0; list-style-type: none;">`;
                html += `<div style="background-color: #262626; padding: 10px; border-left: 3px solid #00bcd4; margin: 5px 0;">`;
                html += `<div><span style="color: #999;">[${time}]</span> <strong style="color: #fff;">${StringUtils.escapeHtml(item.description || 'Subagent task')}</strong></div>`;

                if (item.details) {
                    // Show the question if available
                    if (item.details.userQuestion && item.details.userQuestion !== item.description) {
                        html += `<div style="color: #00ff00; margin-top: 5px; font-size: 12px;">→ Question: ${StringUtils.escapeHtml(item.details.userQuestion)}</div>`;
                    }

                    // Show the response
                    if (item.details.claudeResponse) {
                        const response = item.details.claudeResponse;
                        // Check if this is just initialization text
                        if (response.includes('Initializing...') || response.includes('Concocting...')) {
                            html += `<div style="color: #ff9800; margin-top: 5px; font-size: 12px; font-style: italic;">⏳ Subagent was processing... (full output available in tmux session)</div>`;
                        } else {
                            html += `<div style="color: #ccc; margin-top: 5px; margin-left: 20px; font-size: 12px; white-space: pre-wrap; max-height: 200px; overflow-y: auto; background-color: #1a1a1a; padding: 8px; border-radius: 4px;">`;
                            html += StringUtils.escapeHtml(response);
                            html += `</div>`;
                        }
                    }
                }
                html += `</div>`;
                html += `</li>`;
            });
            html += `</ul>`;
            html += `</div>`;
        }

        html += `
                </div>
            </div>`;

        // Also format as plain text for text email
        let text = '\n📊 Subagent Activities Summary\n\n';
        
        for (const [type, items] of Object.entries(grouped)) {
            text += `${type} (${items.length} activities)\n`;
            items.forEach((item, index) => {
                const time = new Date(item.timestamp).toLocaleTimeString();
                text += `  ${index + 1}. [${time}] ${item.description}\n`;
                if (item.details && item.details.claudeResponse) {
                    text += `     ${item.details.claudeResponse}\n`;
                }
            });
            text += '\n';
        }

        // Return HTML for email (the email sender will use it appropriately)
        return html;
    }
}

module.exports = SubagentTracker;