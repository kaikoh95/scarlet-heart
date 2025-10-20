const fs = require('fs');
const path = require('path');

/**
 * File System Utilities
 * Shared utilities for file system operations
 */
class FileSystemUtils {
    /**
     * Ensure a directory exists, creating it if necessary
     * @param {string} dirPath - Path to the directory
     * @param {boolean} recursive - Whether to create parent directories (default: true)
     */
    static ensureDirectory(dirPath, recursive = true) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive });
        }
    }

    /**
     * Ensure a file's parent directory exists
     * @param {string} filePath - Path to the file
     */
    static ensureParentDirectory(filePath) {
        const dirPath = path.dirname(filePath);
        this.ensureDirectory(dirPath);
    }

    /**
     * Check if a path exists
     * @param {string} filePath - Path to check
     * @returns {boolean} - True if path exists
     */
    static exists(filePath) {
        return fs.existsSync(filePath);
    }

    /**
     * Safely delete a file if it exists
     * @param {string} filePath - Path to the file
     * @returns {boolean} - True if file was deleted
     */
    static deleteIfExists(filePath) {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    }

    /**
     * Safely delete a directory if it exists
     * @param {string} dirPath - Path to the directory
     * @param {boolean} recursive - Whether to delete recursively (default: true)
     * @returns {boolean} - True if directory was deleted
     */
    static deleteDirectoryIfExists(dirPath, recursive = true) {
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive, force: true });
            return true;
        }
        return false;
    }
}

module.exports = FileSystemUtils;
