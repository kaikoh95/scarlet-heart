/**
 * Text Formatter Utility
 * Shared utilities for formatting and escaping text across different channels
 * Consolidates all text formatting logic from Slack, Telegram, and Email channels
 */

class TextFormatter {
    /**
     * Get preview of Claude response (last N words)
     * @param {string} fullResponse - The full Claude response
     * @param {number} wordLimit - Maximum number of words to show (default: 100)
     * @returns {Object} { preview, truncated, totalWords }
     */
    static getResponsePreview(fullResponse, wordLimit = 100) {
        if (!fullResponse || !fullResponse.trim()) {
            return { preview: '', truncated: false, totalWords: 0 };
        }

        const trimmed = fullResponse.trim();
        const words = trimmed.split(/\s+/);
        const totalWords = words.length;

        let preview = trimmed;
        let truncated = false;

        if (totalWords > wordLimit) {
            // Take LAST N words (like Telegram)
            preview = words.slice(-wordLimit).join(' ');
            truncated = true;
        }

        return { preview, truncated, totalWords };
    }

    /**
     * Get preview of user question (first N chars)
     * @param {string} question - The user question
     * @param {number} charLimit - Maximum number of characters (default: 300)
     * @returns {Object} { preview, truncated }
     */
    static getQuestionPreview(question, charLimit = 300) {
        if (!question || !question.trim()) {
            return { preview: '', truncated: false };
        }

        const trimmed = question.trim();
        let preview = trimmed;
        let truncated = false;

        if (trimmed.length > charLimit) {
            preview = trimmed.substring(0, charLimit);
            truncated = true;
        }

        return { preview, truncated };
    }

    /**
     * Clean user question from slash command expansion
     * Extracts actual user input from Claude Code slash command metadata
     * @param {string} rawQuestion - Raw user question with possible slash command expansion
     * @returns {string} Cleaned user question
     */
    static cleanUserQuestion(rawQuestion) {
        if (!rawQuestion) {
            return '';
        }

        let cleaned = rawQuestion;

        // Extract from slash command expansion patterns
        // Format: "> /command is running… [Thread Conversation Context] User: actual_question [End of Thread Context] User request: actual_question"

        // Try to extract from "User request: X" pattern
        const userRequestMatch = cleaned.match(/User request:\s*(.+?)(?:\s*⎿|$)/);
        if (userRequestMatch) {
            cleaned = userRequestMatch[1].trim();
        } else {
            // Try to extract from "[Thread Conversation Context] User: X [End of Thread]" pattern
            const userMatch = cleaned.match(/\[Thread Conversation Context\]\s*User:\s*(.+?)\s*\[End of Thread/);
            if (userMatch) {
                cleaned = userMatch[1].trim();
            } else if (cleaned.includes('is running…')) {
                // Fallback: split on "User request:" if it's a slash command expansion
                const parts = cleaned.split('User request:');
                if (parts.length > 1) {
                    cleaned = parts[parts.length - 1].trim();
                }
            }
        }

        return cleaned;
    }

    /**
     * Format truncation message
     * @param {number} wordsShown - Number of words shown in preview
     * @param {number} totalWords - Total number of words
     * @param {string} location - Where full content can be found (e.g., "tmux session")
     * @returns {string} Formatted truncation message
     */
    static getTruncationMessage(wordsShown, totalWords, location = 'tmux session') {
        return `Last ${wordsShown} of ${totalWords} words · Full in ${location}`;
    }

    /**
     * Escape HTML special characters
     * Used by Telegram and Email channels
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    static escapeHtml(text) {
        if (!text) return '';

        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Escape Slack markdown special characters
     * Used by Slack channel
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    static escapeMarkdown(text) {
        if (!text) return '';

        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /**
     * Format response for HTML (Telegram)
     * Preserves code blocks and formatting while escaping HTML
     * @param {string} text - Text to format
     * @returns {string} Formatted text
     */
    static formatResponseForHtml(text) {
        if (!text) return '';

        // Split by code blocks (```)
        const parts = text.split(/```/);

        return parts.map((part, index) => {
            // Even indices are regular text, odd indices are code blocks
            if (index % 2 === 0) {
                // Regular text - escape HTML and preserve line breaks
                return this.escapeHtml(part).replace(/\n/g, '\n');
            } else {
                // Code block - wrap in <code> and preserve formatting
                return `<code>${this.escapeHtml(part)}</code>`;
            }
        }).join('');
    }

    /**
     * Format response for Slack markdown
     * Converts to Slack's blockquote format
     * @param {string} text - Text to format
     * @param {boolean} asBlockquote - Whether to format as blockquote (default: true)
     * @returns {string} Formatted text
     */
    static formatResponseForSlack(text, asBlockquote = true) {
        if (!text) return '';

        if (asBlockquote) {
            // Format each line as blockquote with > prefix
            const lines = text.split('\n');
            return lines.map(line => `> ${line}`).join('\n');
        }

        return text;
    }
}

module.exports = TextFormatter;
