/**
 * String Utilities
 * Shared utilities for string manipulation and formatting
 */
class StringUtils {
    /**
     * HTML entity map for escaping
     */
    static HTML_ENTITIES = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };

    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    static escapeHtml(text) {
        if (!text) return '';
        return text.replace(/[&<>"']/g, char => this.HTML_ENTITIES[char]);
    }

    /**
     * Truncate text to a maximum length
     * @param {string} text - Text to truncate
     * @param {number} maxLength - Maximum length
     * @param {string} suffix - Suffix to add if truncated (default: '...')
     * @returns {string} - Truncated text
     */
    static truncate(text, maxLength, suffix = '...') {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength - suffix.length) + suffix;
    }

    /**
     * Capitalize first letter of a string
     * @param {string} text - Text to capitalize
     * @returns {string} - Capitalized text
     */
    static capitalize(text) {
        if (!text) return '';
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    /**
     * Convert text to title case
     * @param {string} text - Text to convert
     * @returns {string} - Title case text
     */
    static toTitleCase(text) {
        if (!text) return '';
        return text.replace(/\w\S*/g, (word) => {
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        });
    }

    /**
     * Strip HTML tags from text
     * @param {string} html - HTML text
     * @returns {string} - Plain text
     */
    static stripHtml(html) {
        if (!html) return '';
        return html.replace(/<[^>]*>/g, '');
    }

    /**
     * Normalize whitespace (remove extra spaces, newlines)
     * @param {string} text - Text to normalize
     * @returns {string} - Normalized text
     */
    static normalizeWhitespace(text) {
        if (!text) return '';
        return text.replace(/\s+/g, ' ').trim();
    }

    /**
     * Check if a string is empty or only whitespace
     * @param {string} text - Text to check
     * @returns {boolean} - True if empty or whitespace
     */
    static isBlank(text) {
        return !text || text.trim().length === 0;
    }
}

module.exports = StringUtils;
