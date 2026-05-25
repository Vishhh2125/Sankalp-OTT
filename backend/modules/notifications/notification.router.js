import express from 'express';
import * as controller from './notification.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireAdmin } from '../../middleware/admin.middleware.js';

const router = express.Router();

// ──────────────────────────────────
// ADMIN ROUTES
// ──────────────────────────────────

// Get all available dramas for notification targeting
router.get('/admin/dramas', requireAuth, requireAdmin(), controller.getAllDramas);

// Send a notification to users
router.post('/admin/send', requireAuth, requireAdmin(), controller.sendNotification);

// Get notification statistics
router.get('/admin/stats', requireAuth, requireAdmin(), controller.getNotificationStats);

// Get all sent notifications
router.get('/admin/sent', requireAuth, requireAdmin(), controller.getSentNotifications);

// Get notification configuration
router.get('/admin/config', requireAuth, requireAdmin(), controller.getNotificationConfig);

// Update notification configuration
router.put('/admin/config', requireAuth, requireAdmin(), controller.updateNotificationConfig);

// ──────────────────────────────────
// USER ROUTES
// ──────────────────────────────────

// Get all notifications for the logged-in user
router.get('/', requireAuth, controller.getUserNotifications);

// Get pending (unread) notifications - used on login
router.get('/pending', requireAuth, controller.getPendingNotifications);

// Mark a notification as read
router.put('/:notificationId/read', requireAuth, controller.markAsRead);

export default router;
