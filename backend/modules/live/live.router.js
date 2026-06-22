import express from 'express';
import * as ctrl from './live.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireAdmin } from '../../middleware/admin.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createStreamSchema, webhookSchema } from './live.validation.js';

const router = express.Router();

// MediaMTX callbacks (no auth — loose body parsing)
router.post('/auth-hook', ctrl.authHook);
router.post('/webhook/on-live', validate(webhookSchema), ctrl.webhookOnLive);
router.post('/webhook/on-ended', validate(webhookSchema), ctrl.webhookOnEnded);

// Public viewer API
router.get('/active', ctrl.getActiveStreams);

// Admin (register before /:id/play to avoid shadowing)
router.post('/streams', requireAuth, requireAdmin('live'), validate(createStreamSchema), ctrl.createStream);
router.get('/streams', requireAuth, requireAdmin('live'), ctrl.listStreams);
router.get('/streams/:id', requireAuth, requireAdmin('live'), ctrl.getStream);
router.delete('/streams/:id', requireAuth, requireAdmin('live'), ctrl.forceEndStream);

// Public playback — must be after /streams routes
router.get('/:id/play', ctrl.getPlayUrl);

export default router;
