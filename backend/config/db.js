/**
 * Database Configuration Module
 * Handles Prisma connection with production-grade best practices
 * - Connection pooling
 * - Error handling
 * - Connection monitoring
 * - Graceful disconnection
 */

import { PrismaClient } from '@prisma/client';
import logger from './logger.js';

// Single instance to avoid connection leaks
let prismaInstance = null;

/**
 * Get or create Prisma client instance
 * @returns {PrismaClient} Prisma client instance
 */
function getPrismaClient() {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      // Log levels: 'query', 'info', 'warn', 'error'
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['warn', 'error'],
      errorFormat: 'pretty',
    });

    // Event listeners for monitoring
    prismaInstance.$on('query', (e) => {
      if (process.env.DEBUG_QUERIES === 'true') {
        logger.debug(`Query: ${e.query}`, {
          duration: `${e.duration}ms`,
          params: e.params,
        });
      }
    });

    // Handle disconnect events
    prismaInstance.$on('disconnect', () => {
      logger.info('Prisma disconnected from database');
    });
  }

  return prismaInstance;
}

/**
 * Initialize database connection with health check
 * @returns {Promise<boolean>} True if connection is successful
 */
async function initializeDatabase() {
  try {
    const prisma = getPrismaClient();

    // Check database connectivity
    await prisma.$queryRaw`SELECT NOW()`;

    logger.info('✓ Database connection established successfully');
    return true;
  } catch (error) {
    logger.error('✗ Database connection failed', {
      error: error.message,
      code: error.code,
    });
    throw error;
  }
}

/**
 * Check database connection status
 * @returns {Promise<{status: string, message: string}>} Connection status
 */
async function checkDatabaseHealth() {
  try {
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT NOW()`;

    return {
      status: 'healthy',
      message: 'Database is responding normally',
    };
  } catch (error) {
    logger.error('Database health check failed', { error: error.message });

    return {
      status: 'unhealthy',
      message: `Database health check failed: ${error.message}`,
    };
  }
}

/**
 * Gracefully disconnect from database
 * @returns {Promise<void>}
 */
async function disconnectDatabase() {
  if (prismaInstance) {
    try {
      await prismaInstance.$disconnect();
      logger.info('Database disconnected gracefully');
    } catch (error) {
      logger.error('Error during database disconnection', {
        error: error.message,
      });
      throw error;
    } finally {
      prismaInstance = null;
    }
  }
}

export {
  getPrismaClient,
  initializeDatabase,
  checkDatabaseHealth,
  disconnectDatabase,
};
