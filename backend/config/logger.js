/**
 * Logger Module
 * Production-grade logging with different log levels
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
};

/**
 * Format log message with timestamp and level
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 * @returns {string} Formatted log message
 */
function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
}

/**
 * Write log to file
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 */
function writeLogToFile(level, message, meta) {
  const logFile = path.join(logsDir, `${level.toLowerCase()}.log`);
  const logEntry = formatLog(level, message, meta);

  fs.appendFile(logFile, logEntry + '\n', (err) => {
    if (err) console.error('Failed to write log:', err);
  });

  // Also write to combined log
  const combinedLogFile = path.join(logsDir, 'combined.log');
  fs.appendFile(combinedLogFile, logEntry + '\n', (err) => {
    if (err) console.error('Failed to write combined log:', err);
  });
}

/**
 * Log error message
 * @param {string} message - Error message
 * @param {object} meta - Additional metadata
 */
function error(message, meta = {}) {
  const logMessage = formatLog(LOG_LEVELS.ERROR, message, meta);
  console.error(logMessage);
  writeLogToFile(LOG_LEVELS.ERROR, message, meta);
}

/**
 * Log warning message
 * @param {string} message - Warning message
 * @param {object} meta - Additional metadata
 */
function warn(message, meta = {}) {
  const logMessage = formatLog(LOG_LEVELS.WARN, message, meta);
  console.warn(logMessage);
  writeLogToFile(LOG_LEVELS.WARN, message, meta);
}

/**
 * Log info message
 * @param {string} message - Info message
 * @param {object} meta - Additional metadata
 */
function info(message, meta = {}) {
  const logMessage = formatLog(LOG_LEVELS.INFO, message, meta);
  console.log(logMessage);
  writeLogToFile(LOG_LEVELS.INFO, message, meta);
}

/**
 * Log debug message (only in development)
 * @param {string} message - Debug message
 * @param {object} meta - Additional metadata
 */
function debug(message, meta = {}) {
  if (process.env.NODE_ENV === 'development') {
    const logMessage = formatLog(LOG_LEVELS.DEBUG, message, meta);
    console.debug(logMessage);
    writeLogToFile(LOG_LEVELS.DEBUG, message, meta);
  }
}

const logger = {
  error,
  warn,
  info,
  debug,
};

export default logger;
export { error, warn, info, debug };
