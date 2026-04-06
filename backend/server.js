/**
 * Server Entry Point
 * Production-grade Node.js server with graceful shutdown and error handling
 */

import 'dotenv/config';
import { fileURLToPath } from 'node:url';

import app from './app.js';
import logger from './config/logger.js';
import { validateEnvironment } from './config/env.js';
import {
  initializeDatabase,
  disconnectDatabase,
} from './config/db.js';

const PORT = process.env.PORT || 3000;

let server;

/**
 * Start the server
 */
async function startServer() {
  try {
    // 1. Validate environment variables
    logger.info('Starting server initialization...');
    validateEnvironment();

    // 2. Initialize database
    await initializeDatabase();

    // 3. Start HTTP server
    server = app.listen(PORT, () => {
      logger.info(`✓ Server is running on http://localhost:${PORT}`);
      logger.info(`✓ Environment: ${process.env.NODE_ENV}`);
      logger.info(`✓ Health check available at http://localhost:${PORT}/health`);
    });

    // Set server timeout
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    setupGracefulShutdown();

    return server;
  } catch (error) {
    logger.error('Failed to start server', {
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown() {
  const gracefulShutdown = async (signal) => {
    logger.info(`\nReceived ${signal}, starting graceful shutdown...`);

    // Stop accepting new requests
    if (server) {
      server.close(async () => {
        logger.info('HTTP server closed');

        // Disconnect database
        try {
          await disconnectDatabase();
          logger.info('✓ Graceful shutdown completed successfully');
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown', {
            error: error.message,
          });
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown - graceful shutdown timeout exceeded');
        process.exit(1);
      }, 30000);
    }
  };

  // Handle termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', {
      reason,
      promise: promise.toString(),
    });
    process.exit(1);
  });
}

// Start server
const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  startServer();
}

export default startServer;
