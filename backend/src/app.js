const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { errorHandler } = require('./middleware/error.middleware');

const app = express();

// ── Global middleware ──
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      workerSrc:  ["'self'", "blob:"],
      mediaSrc: ["'self'", "blob:", "http://localhost:9000", "http://127.0.0.1:9000"],
      connectSrc: ["'self'", "http://localhost:*", "http://127.0.0.1:*","https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "blob:", "http://localhost:9000"],
    },
  },
}));
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:8081', 'http://localhost:19006'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Serve web reels player
app.use('/player', express.static('public'));

// ── Health check ──
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ── Routes ──
// app.use('/api/auth', require('./modules/auth/auth.router'));
// app.use('/api/users', require('./modules/users/users.router'));
app.use('/api/content', require('./modules/content/content.router'));
app.use('/api/feed', require('./modules/content/feed.router'));
// app.use('/api/home', require('./modules/content/home.router'));
// app.use('/api/coins', require('./modules/coins/coins.router'));
// app.use('/api/payments', require('./modules/payments/payments.router'));
app.use('/api/media', require('./modules/media/media.router'));
// app.use('/api/notifications', require('./modules/notifications/notifications.router'));
// app.use('/api/search', require('./modules/search/search.router'));
// app.use('/api/banners', require('./modules/banners/banners.router'));
// app.use('/api/playlists', require('./modules/playlists/playlists.router'));
// app.use('/api/ratings', require('./modules/ratings/ratings.router'));
// app.use('/api/admin', require('./modules/admin/admin.router'));

// ── 404 handler ──
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler (must be last) ──
app.use(errorHandler);

module.exports = app;
