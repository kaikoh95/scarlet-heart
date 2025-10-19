/**
 * Centralized authorization service
 * Handles user/channel authorization across all platforms
 */
class AuthorizationService {
    /**
     * Check if user/channel is authorized
     *
     * Authorization logic:
     * 1. If whitelist exists, check if userId or channelId is in whitelist
     * 2. If no whitelist, check if channelId matches configured channel
     * 3. If no configured channel, allow all (open mode)
     *
     * @param {string} userId - User ID
     * @param {string} channelId - Channel/Chat ID
     * @param {Object} config - Configuration object
     * @param {Array<string>} [config.whitelist] - Whitelist of allowed IDs
     * @param {string} [config.channelId] - Configured channel ID (Slack)
     * @param {string} [config.chatId] - Configured chat ID (Telegram)
     * @param {string} [config.groupId] - Configured group ID (Telegram)
     * @returns {boolean} True if authorized
     */
    static isAuthorized(userId, channelId, config) {
        // Ensure IDs are strings for comparison
        const userIdStr = String(userId);
        const channelIdStr = String(channelId);

        // Check whitelist if it exists
        const whitelist = config.whitelist || [];
        if (whitelist.length > 0) {
            const whitelistStrs = whitelist.map(id => String(id));
            return whitelistStrs.includes(channelIdStr) || whitelistStrs.includes(userIdStr);
        }

        // Check configured channel/chat/group
        const configuredId = config.channelId || config.chatId || config.groupId;
        if (!configuredId) {
            // No whitelist and no configured ID - open mode
            return true;
        }

        // Check if channel matches configured ID
        return channelIdStr === String(configuredId);
    }

    /**
     * Get authorization reason (for logging/debugging)
     * @param {string} userId - User ID
     * @param {string} channelId - Channel/Chat ID
     * @param {Object} config - Configuration object
     * @returns {string} Reason for authorization decision
     */
    static getAuthorizationReason(userId, channelId, config) {
        const userIdStr = String(userId);
        const channelIdStr = String(channelId);
        const whitelist = config.whitelist || [];
        const configuredId = config.channelId || config.chatId || config.groupId;

        if (whitelist.length > 0) {
            const whitelistStrs = whitelist.map(id => String(id));
            if (whitelistStrs.includes(channelIdStr)) {
                return `Channel ${channelIdStr} is in whitelist`;
            }
            if (whitelistStrs.includes(userIdStr)) {
                return `User ${userIdStr} is in whitelist`;
            }
            return `Channel ${channelIdStr} and user ${userIdStr} not in whitelist`;
        }

        if (!configuredId) {
            return 'Open mode - no whitelist or configured ID';
        }

        if (channelIdStr === String(configuredId)) {
            return `Channel ${channelIdStr} matches configured ID`;
        }

        return `Channel ${channelIdStr} does not match configured ID ${configuredId}`;
    }
}

module.exports = AuthorizationService;
