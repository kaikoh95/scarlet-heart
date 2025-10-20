const fs = require('fs');
const FileSystemUtils = require('./file-system-utils');

/**
 * JSON Data Store
 * Shared utilities for loading and saving JSON data files
 */
class JsonDataStore {
    /**
     * Load JSON data from a file
     * @param {string} filePath - Path to the JSON file
     * @param {*} defaultValue - Default value if file doesn't exist or is invalid (default: {})
     * @param {object} options - Options for loading
     * @param {boolean} options.silent - Suppress error messages (default: false)
     * @returns {*} - Parsed JSON data or default value
     */
    static load(filePath, defaultValue = {}, options = {}) {
        const { silent = false } = options;

        if (!fs.existsSync(filePath)) {
            return defaultValue;
        }

        try {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (!silent) {
                console.error(`Failed to load JSON from ${filePath}:`, error.message);
            }
            return defaultValue;
        }
    }

    /**
     * Save JSON data to a file
     * @param {string} filePath - Path to the JSON file
     * @param {*} data - Data to save
     * @param {object} options - Options for saving
     * @param {number} options.indent - Indentation level (default: 2)
     * @param {boolean} options.silent - Suppress error messages (default: false)
     * @param {boolean} options.ensureDir - Ensure parent directory exists (default: true)
     * @returns {boolean} - True if save was successful
     */
    static save(filePath, data, options = {}) {
        const { indent = 2, silent = false, ensureDir = true } = options;

        try {
            if (ensureDir) {
                FileSystemUtils.ensureParentDirectory(filePath);
            }

            fs.writeFileSync(filePath, JSON.stringify(data, null, indent));
            return true;
        } catch (error) {
            if (!silent) {
                console.error(`Failed to save JSON to ${filePath}:`, error.message);
            }
            return false;
        }
    }

    /**
     * Atomic update of JSON data (load, modify, save)
     * @param {string} filePath - Path to the JSON file
     * @param {function} updateFn - Function that takes current data and returns updated data
     * @param {*} defaultValue - Default value if file doesn't exist (default: {})
     * @returns {boolean} - True if update was successful
     */
    static update(filePath, updateFn, defaultValue = {}) {
        const data = this.load(filePath, defaultValue);
        const updatedData = updateFn(data);
        return this.save(filePath, updatedData);
    }

    /**
     * Load JSON array from file
     * @param {string} filePath - Path to the JSON file
     * @param {object} options - Options for loading
     * @returns {Array} - Parsed JSON array or empty array
     */
    static loadArray(filePath, options = {}) {
        return this.load(filePath, [], options);
    }

    /**
     * Load JSON object from file
     * @param {string} filePath - Path to the JSON file
     * @param {object} options - Options for loading
     * @returns {Object} - Parsed JSON object or empty object
     */
    static loadObject(filePath, options = {}) {
        return this.load(filePath, {}, options);
    }
}

module.exports = JsonDataStore;
