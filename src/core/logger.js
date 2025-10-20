/**
 * scarlet-heart Logger
 * Centralized logging utility
 */

class Logger {
    constructor(namespace = 'scarlet-heart') {
        this.namespace = namespace;
        this.logLevel = process.env.SCARLET_HEART_LOG_LEVEL || 'info';
    }

    _log(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${this.namespace}] [${level.toUpperCase()}]`;
        
        if (this._shouldLog(level)) {
            console.log(prefix, message, ...args);
        }
    }

    _shouldLog(level) {
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        return levels[level] >= levels[this.logLevel];
    }

    debug(message, ...args) {
        this._log('debug', message, ...args);
    }

    info(message, ...args) {
        this._log('info', message, ...args);
    }

    warn(message, ...args) {
        this._log('warn', message, ...args);
    }

    error(message, ...args) {
        this._log('error', message, ...args);
    }

    child(namespace) {
        return new Logger(`${this.namespace}:${namespace}`);
    }
}

module.exports = Logger;