const fs = require('fs');
const path = require('path');

// Log levels
const LogLevel = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

class Logger {
    constructor() {
        this.logLevel = process.env.LOG_LEVEL ? LogLevel[process.env.LOG_LEVEL.toUpperCase()] : LogLevel.INFO;
        this.logToFile = process.env.LOG_TO_FILE === 'true';
        this.logDirectory = process.env.LOG_DIR || './logs';
        
        // Create logs directory if it doesn't exist
        if (this.logToFile && !fs.existsSync(this.logDirectory)) {
            fs.mkdirSync(this.logDirectory, { recursive: true });
        }
    }

    /**
     * Format log message with timestamp and level
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @returns {string} Formatted log message
     */
    formatMessage(level, message) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] ${message}`;
    }

    /**
     * Write log to console and optionally to file
     * @param {string} level - Log level
     * @param {number} levelValue - Numeric log level
     * @param {string} message - Log message
     * @param {*} data - Additional data to log
     */
    log(level, levelValue, message, data = null) {
        if (levelValue > this.logLevel) return;

        const formattedMessage = this.formatMessage(level, message);
        
        // Log to console with colors
        switch (level) {
            case 'ERROR':
                console.error('\x1b[31m%s\x1b[0m', formattedMessage, data ? data : '');
                break;
            case 'WARN':
                console.warn('\x1b[33m%s\x1b[0m', formattedMessage, data ? data : '');
                break;
            case 'INFO':
                console.info('\x1b[36m%s\x1b[0m', formattedMessage, data ? data : '');
                break;
            case 'DEBUG':
                console.log('\x1b[90m%s\x1b[0m', formattedMessage, data ? data : '');
                break;
            default:
                console.log(formattedMessage, data ? data : '');
        }

        // Log to file if enabled
        if (this.logToFile) {
            this.writeToFile(level, formattedMessage, data);
        }
    }

    /**
     * Write log message to file
     * @param {string} level - Log level
     * @param {string} formattedMessage - Pre-formatted log message
     * @param {*} data - Additional data to log
     */
    writeToFile(level, formattedMessage, data) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const logFile = path.join(this.logDirectory, `${today}.log`);
            
            let logEntry = formattedMessage;
            if (data) {
                if (data instanceof Error) {
                    logEntry += ` | Error: ${data.message}\nStack: ${data.stack}`;
                } else if (typeof data === 'object') {
                    logEntry += ` | Data: ${JSON.stringify(data, null, 2)}`;
                } else {
                    logEntry += ` | Data: ${data}`;
                }
            }
            logEntry += '\n';

            fs.appendFileSync(logFile, logEntry);
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    /**
     * Log error message
     * @param {string} message - Error message
     * @param {*} data - Additional error data
     */
    error(message, data = null) {
        this.log('ERROR', LogLevel.ERROR, message, data);
    }

    /**
     * Log warning message
     * @param {string} message - Warning message
     * @param {*} data - Additional warning data
     */
    warn(message, data = null) {
        this.log('WARN', LogLevel.WARN, message, data);
    }

    /**
     * Log info message
     * @param {string} message - Info message
     * @param {*} data - Additional info data
     */
    info(message, data = null) {
        this.log('INFO', LogLevel.INFO, message, data);
    }

    /**
     * Log debug message
     * @param {string} message - Debug message
     * @param {*} data - Additional debug data
     */
    debug(message, data = null) {
        this.log('DEBUG', LogLevel.DEBUG, message, data);
    }

    /**
     * Set log level
     * @param {string} level - Log level (ERROR, WARN, INFO, DEBUG)
     */
    setLevel(level) {
        const upperLevel = level.toUpperCase();
        if (LogLevel[upperLevel] !== undefined) {
            this.logLevel = LogLevel[upperLevel];
            this.info(`Log level set to ${upperLevel}`);
        } else {
            this.warn(`Invalid log level: ${level}`);
        }
    }

    /**
     * Get current log level
     * @returns {string} Current log level
     */
    getLevel() {
        const levels = Object.keys(LogLevel);
        return levels.find(level => LogLevel[level] === this.logLevel);
    }

    /**
     * Clean up old log files
     * @param {number} daysToKeep - Number of days of logs to keep
     */
    cleanOldLogs(daysToKeep = 30) {
        if (!this.logToFile || !fs.existsSync(this.logDirectory)) {
            return;
        }

        try {
            const files = fs.readdirSync(this.logDirectory);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            let deletedCount = 0;

            files.forEach(file => {
                if (file.endsWith('.log')) {
                    const filePath = path.join(this.logDirectory, file);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.mtime < cutoffDate) {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                    }
                }
            });

            if (deletedCount > 0) {
                this.info(`Cleaned up ${deletedCount} old log file(s)`);
            }
        } catch (error) {
            this.error('Failed to clean old logs:', error);
        }
    }

    /**
     * Get log statistics
     * @returns {Object} Log statistics
     */
    getStats() {
        const stats = {
            logLevel: this.getLevel(),
            logToFile: this.logToFile,
            logDirectory: this.logDirectory
        };

        if (this.logToFile && fs.existsSync(this.logDirectory)) {
            try {
                const files = fs.readdirSync(this.logDirectory).filter(file => file.endsWith('.log'));
                stats.logFiles = files.length;
                
                if (files.length > 0) {
                    const sizes = files.map(file => {
                        const filePath = path.join(this.logDirectory, file);
                        return fs.statSync(filePath).size;
                    });
                    stats.totalLogSize = sizes.reduce((a, b) => a + b, 0);
                    stats.averageLogSize = stats.totalLogSize / files.length;
                }
            } catch (error) {
                this.error('Failed to get log stats:', error);
            }
        }

        return stats;
    }
}

// Create and export logger instance
const logger = new Logger();

// Clean old logs on startup
logger.cleanOldLogs();

module.exports = logger;
