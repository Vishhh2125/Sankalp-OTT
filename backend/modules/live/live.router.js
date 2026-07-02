import express from 'express';
import * as ctrl from './live.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireAdmin } from '../../middleware/admin.middleware.js';
import { optionalAuth } from '../../middleware/optionalAuth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createStreamSchema, webhookSchema } from './live.validation.js';

const router = express.Router();

router.use((req, res, next) => {
  delete req.headers['if-none-match'];
  delete req.headers['if-modified-since'];
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// MediaMTX callbacks (no auth — loose body parsing)
router.post('/auth-hook', ctrl.authHook);
router.post('/webhook/on-live', validate(webhookSchema), ctrl.webhookOnLive);
router.post('/webhook/on-ended', validate(webhookSchema), ctrl.webhookOnEnded);

// Public viewer API
router.get('/active', ctrl.getActiveStreams);

// Admin (register before /:id/play to avoid shadowing)
router.post('/streams', requireAuth, requireAdmin('live'), validate(createStreamSchema), ctrl.createStream);
router.post('/streams/:id/go-live', requireAuth, requireAdmin('live'), ctrl.goLive);
router.get('/streams', requireAuth, requireAdmin('live'), ctrl.listStreams);
router.get('/streams/:id', requireAuth, requireAdmin('live'), ctrl.getStream);
router.delete('/streams/:id', requireAuth, requireAdmin('live'), ctrl.forceEndStream);

// Viewer tracking — leave uses sessionId, not streamId
router.post('/session/:sessionId/leave', ctrl.leaveStream);

// Viewer tracking — join (optionalAuth: user if token present, guest if not)
router.post('/:id/join', optionalAuth, ctrl.joinStream);

// Viewer tracking — admin-only viewer list
router.get('/:id/viewers', requireAuth, requireAdmin('live'), ctrl.getViewers);

// Public playback — must be after /streams routes
router.get('/:id/play', ctrl.getPlayUrl);

export default router;
