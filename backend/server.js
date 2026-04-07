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
    // MAIN priority
    logger.info('Starting server initialization...');
    validateEnvironment();

    // DB init (MAIN)
    await initializeDatabase();

    // 3. Start HTTP server
    server = app.listen(PORT, "0.0.0.0", () => {
      logger.info(`✓ Server is running on http://localhost:${PORT}`);
      logger.info(`✓ Environment: ${process.env.NODE_ENV}`);
      logger.info(`✓ Health check available at http://localhost:${PORT}/health`);
    });

    // MAIN timeouts
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    // ➕ Added from admin_ui_v2 (non-conflicting)
    server.requestTimeout = 30 * 60 * 1000; // 30 min
    server.timeout = 30 * 60 * 1000;

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

    if (server) {
      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          // MAIN DB disconnect
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

      setTimeout(() => {
        logger.error('Forced shutdown - graceful shutdown timeout exceeded');
        process.exit(1);
      }, 30000);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });

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