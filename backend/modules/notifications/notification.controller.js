import * as service from './notification.service.js';
import * as validation from './notification.validation.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

// ──────────────────────────────────
// ADMIN ENDPOINTS
// ──────────────────────────────────

export const getAllDramas = asyncHandler(async (req, res) => {
  const dramas = await service.getAllDramas();
  res.json({
    success: true,
    data: dramas,
  });
});

export const sendNotification = asyncHandler(async (req, res) => {
  const { error, value } = validation.sendNotificationSchema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });

  const result = await service.sendNotification(value, req.admin.id);
  res.status(201).json({
    success: true,
    message: `Notification ${result.status} successfully`,
    data: result,
  });
});

export const getNotificationStats = asyncHandler(async (req, res) => {
  const stats = await service.getNotificationStats();
  res.json({
    success: true,
    data: stats,
  });
});

export const getSentNotifications = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const result = await service.getAllSentNotifications(page, limit);
  res.json({
    success: true,
    data: result,
  });
});

export const getNotificationConfig = asyncHandler(async (req, res) => {
  const config = await service.getNotificationConfig(req.admin.id);
  res.json({
    success: true,
    data: config,
  });
});

export const updateNotificationConfig = asyncHandler(async (req, res) => {
  const { error, value } = validation.updateNotificationConfigSchema.validate(req.body);
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });

  const result = await service.updateNotificationConfig(req.admin.id, value);
  res.json({
    success: true,
    message: 'Notification config updated successfully',
    data: result,
  });
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const { title, type, sent_at } = req.body;
  
  if (!title || !type || !sent_at) {
    return res.status(400).json({ success: false, message: 'Missing required fields: title, type, sent_at' });
  }

  const result = await service.deleteNotificationBroadcast(title, type, sent_at);
  res.json({
    success: true,
    message: 'Notification deleted successfully',
    data: result,
  });
});

// ──────────────────────────────────
// USER ENDPOINTS
// ──────────────────────────────────

export const getUserNotifications = asyncHandler(async (req, res) => {
  const { error, value } = validation.getNotificationsSchema.validate(req.query);
  if (error) return res.status(400).json({ success: false, message: error.details[0].message });

  const result = await service.getUserNotifications(req.user.id, {
    page: value.page,
    limit: value.limit,
  });

  res.json({
    success: true,
    data: result,
  });
});

export const markAsRead = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  const result = await service.markNotificationAsRead(notificationId, req.user.id);

  res.json({
    success: true,
    message: 'Notification marked as read',
    data: result,
  });
});

export const getPendingNotifications = asyncHandler(async (req, res) => {
  // Get unread notifications (used on login)
  const result = await service.getUserNotifications(req.user.id, {
    page: 1,
    limit: 100,
  });

  const pendingNotifications = result.notifications.filter(n => !n.is_read);

  res.json({
    success: true,
    data: {
      pending: pendingNotifications,
      total: pendingNotifications.length,
    },
  });
});
