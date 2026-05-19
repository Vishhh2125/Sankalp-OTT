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
import adminRouter from './modules/admin/admin.routes.js';

// added from admin_ui_v2 (non-conflicting)
import contentRouter from './modules/content/content.router.js';
import feedRouter from './modules/content/feed.router.js';
import mediaRouter from './modules/media/media.router.js';
import userRouter from './modules/user/user.router.js'; // NEW
import helmet from 'helmet';

import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import cors from 'cors';

const require = createRequire(import.meta.url);

const app = express();

// ============= MIDDLEWARE =============

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Morgan HTTP logger with skip filter for polling endpoints
// Skip /auth/me logs to reduce disk usage (3+ calls/min per user = 15+ GB/year at scale)
app.use(morgan("dev", {
  skip: (req) => {
    // Skip noisy polling requests used for real-time coin syncing
    return req.path === '/api/v1/auth/me' || req.path === '/me';
  }
}));

app.use(cookieParser());

// CORS: reads SERVER_ORIGIN from env so it works for any machine IP without code changes.
// Always also allows localhost so local dev never breaks.
const SERVER_ORIGIN = process.env.SERVER_ORIGIN || 'http://localhost';

app.use(cors({
  origin: [
    SERVER_ORIGIN,
    `${SERVER_ORIGIN}:80`,
    `${SERVER_ORIGIN}:5173`,
    `${SERVER_ORIGIN}:3000`,
    'http://localhost',
    'http://localhost:80',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-client-type'],
}));

app.use(helmet());

// Request logging middleware (with skip filter for polling endpoints)
app.use((req, res, next) => {
  const startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Skip polling endpoints to reduce log spam
  const isPollingEndpoint = req.path === '/api/v1/auth/me' || req.path === '/me';

  logger.debug(`[${requestId}] ${req.method} ${req.path}`);

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    // Don't log polling endpoints to reduce disk usage
    if (!isPollingEndpoint) {
      logger.info(`[${requestId}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
    }
  });

  next();
});

// Serve static player
app.use('/player', express.static('public'));

// ============= ROUTES =============

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

app.get('/info', (req, res) => {
  const { version } = require('./package.json');

  res.json({
    name: process.env.APP_NAME || 'OTT Backend',
    version,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.get("/test", (req, res) => {
  res.send("API is working");
});

// ============= API ROUTES =============

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/content', contentRouter);
app.use('/api/feed', feedRouter);
app.use('/api/media', mediaRouter);
app.use('/api/user', userRouter); // NEW

// ============= 404 HANDLER =============

app.use((req, res) => {
  res.status(404).json(
    new ApiResponse(404, null, 'Route not found')
  );
});

// ============= ERROR HANDLER =============
app.use(errorHandler);

export default app;