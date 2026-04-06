/**
 * Express Application Setup
 * Production-grade Express configuration with middleware and routes
 */

import express from 'express';
import { createRequire } from 'node:module';
import logger from './config/logger.js';
import { checkDatabaseHealth } from './config/db.js';
import { errorHandler } from './middleware/error.middleware.js';
import authRouter from './modules/auth/auth.routes.js';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import cors from 'cors';

const require = createRequire(import.meta.url);

const app = express();

// ============= MIDDLEWARE =============

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(cookieParser());
app.use(cors());

// Request logging middleware (production-grade)
app.use((req, res, next) => {
  const startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  logger.debug(`[${requestId}] ${req.method} ${req.path}`);

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(`[${requestId}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });

  next();
});

// ============= ROUTES =============

/**
 * Health check endpoint
 * GET /health
 */
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();

    if (dbHealth.status === 'healthy') {
      return res.status(200).json({
        success: true,
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: dbHealth,
        environment: process.env.NODE_ENV,
      });
    } else {
      return res.status(503).json({
        success: false,
        status: 'SERVICE_UNAVAILABLE',
        timestamp: new Date().toISOString(),
        database: dbHealth,
      });
    }
  } catch (error) {
    logger.error('Health check error', { error: error.message });
    return res.status(500).json({
      success: false,
      status: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * Application info endpoint
 * GET /info
 */
app.get('/info', (req, res) => {
  const { version } = require('./package.json');

  res.json({
    name: process.env.APP_NAME || 'OTT Backend',
    version,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ============= API ROUTES =============

/**
 * API v1 Routes
 */
app.use('/api/v1/auth', authRouter);

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      path: req.path,
      method: req.method,
    },
  });
});

app.get("/test", (req, res) => {
  res.send("API is working");
});

// Error handling middleware (must be after routes)
app.use(errorHandler);

export default app;
