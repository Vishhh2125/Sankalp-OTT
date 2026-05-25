import express from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireAdmin } from '../../middleware/admin.middleware.js';
import {
  getAllUsers,
  toggleUserStatus,
  adjustUserCoins,
  getUserProfile,
  getCoinRules,
  saveCoinRules,
  getCoinMetrics,
  getCoinTransactions,
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBanner,
} from './admin.controller.js';

const router = express.Router();

/**
 * All admin routes require authentication and admin role
 */
router.use(requireAuth);
router.use(requireAdmin());

// GET all users
router.get('/users', getAllUsers);

// GET user profile with details
router.get('/users/:userId/profile', getUserProfile);

// PATCH toggle block/unblock user
router.patch('/users/:userId/status', toggleUserStatus);

// PATCH adjust user coins
router.patch('/users/:userId/coins', adjustUserCoins);

// ─────────────────────────────────────────────────────────────────
// COIN MANAGEMENT ENDPOINTS
// ─────────────────────────────────────────────────────────────────

// GET coin rules
router.get('/coins/rules', getCoinRules);

// PUT save coin rules
router.put('/coins/rules', saveCoinRules);

// GET coin metrics
router.get('/coins/metrics', getCoinMetrics);

// GET coin transactions
router.get('/coins/transactions', getCoinTransactions);

// ─────────────────────────────────────────────────────────────────
// BANNER MANAGEMENT ENDPOINTS
// ─────────────────────────────────────────────────────────────────

// GET all banners
router.get('/banners', getBanners);

// POST create banner
router.post('/banners', createBanner);

// PUT update banner
router.put('/banners/:id', updateBanner);

// DELETE banner
router.delete('/banners/:id', deleteBanner);

// PATCH toggle active status
router.patch('/banners/:id/toggle', toggleBanner);

export default router;