/**
 * Environment Validation Module
 * Validates all required environment variables on startup
 */

import logger from './logger.js';

const REQUIRED_VARS = ['DATABASE_URL', 'NODE_ENV'];

/**
 * Validate all required environment variables
 * @throws {Error} If any required variable is missing
 */
function validateEnvironment() {
  const missing = [];

  // Check required variables
  REQUIRED_VARS.forEach((varName) => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });

  if (missing.length > 0) {
    const error = `Missing required environment variables: ${missing.join(', ')}`;
    logger.error(error);
    throw new Error(error);
  }

  // Validate NODE_ENV
  const validEnvs = ['development', 'production', 'test'];
  if (!validEnvs.includes(process.env.NODE_ENV)) {
    const error = `Invalid NODE_ENV. Must be one of: ${validEnvs.join(', ')}`;
    logger.error(error);
    throw new Error(error);
  }

  logger.info('✓ Environment variables validated successfully');
  logEnvironmentConfig();
}

/**
 * Log environment configuration (without sensitive data)
 */
function logEnvironmentConfig() {
  const config = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT || 3000,
    DATABASE_URL: process.env.DATABASE_URL
      ? '***[REDACTED]***'
      : 'NOT SET',
  };

  logger.info('Environment Configuration', config);
}

export { validateEnvironment };
