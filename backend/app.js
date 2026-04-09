/**
 * Express Application Setup
 * Production-grade Express configuration with middleware and routes
 */

import express from 'express';
import { createRequire } from 'node:module';
import logger from './config/logger.js';
import { checkDatabaseHealth } from './config/db.js';
import { errorHandler } from './middleware/error.middleware.js';
import { ApiResponse } from './utils/ApiResponse.js';
import authRouter from './modules/auth/auth.routes.js';

// added from admin_ui_v2 (non-conflicting)
import contentRouter from './modules/content/content.router.js';
import feedRouter from './modules/content/feed.router.js';
import mediaRouter from './modules/media/media.router.js';
import helmet from 'helmet';

import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import cors from 'cors';

const require = createRequire(import.meta.url);

const app = express();

// ============= MIDDLEWARE =============

// MAIN priority
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(cookieParser());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : 'http://localhost:5173',
  credentials: true,
}));

// added (safe, no conflict)
app.use(helmet());

// Request logging middleware (MAIN)
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

// Serve static player (from admin_ui_v2)
app.use('/player', express.static('public'));

// ============= ROUTES =============

// MAIN health (kept)
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

// MAIN info
app.get('/info', (req, res) => {
  const { version } = require('./package.json');

  res.json({
    name: process.env.APP_NAME || 'OTT Backend',
    version,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// test route (MAIN)
app.get("/test", (req, res) => {
  res.send("API is working");
});

// ============= API ROUTES =============

// MAIN
app.use('/api/v1/auth', authRouter);

// added from admin_ui_v2
app.use('/api/content', contentRouter);
app.use('/api/feed', feedRouter);
app.use('/api/media', mediaRouter);

// ============= 404 HANDLER =============

// MAIN format
app.use((req, res) => {
  res.status(404).json(
    new ApiResponse(404, null, 'Route not found')
  );
});

// ============= ERROR HANDLER =============
app.use(errorHandler);

export default app;