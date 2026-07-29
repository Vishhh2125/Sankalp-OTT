import express from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireAdmin, requireAnyAdmin, requireMainAdmin } from '../../middleware/admin.middleware.js';
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
  getHeroBanners,
  createHeroBanner,
  updateHeroBanner,
  deleteHeroBanner,
  toggleHeroBanner,
  reorderHeroBanners,
  getDashboardMetrics,
  getRevenueChart,
  getTopShowsChart,
  getAnalyticsReport,
  adjustShowViewCount,
  getShowStats,
  listTeachers,
  createTeacher,
  patchTeacherStatus,
  getTeacherProfileAdmin,
  putTeacherProfileAdmin,
  listApprovals,
  approveShow,
  approveEpisode,
  onboardStudent,
  listStudents,
  assignCoursesToStudent,
  revokeCourseFromStudent,
  getAccountDeletionsController,
  exportAccountDeletionsController,
} from './admin.controller.js';
import {
  getAdminMe,
  getSubAdmins,
  postSubAdmin,
  patchSubAdmin,
  removeSubAdmin,
  getActivityLogs,
} from './subadmin.controller.js';

const router = express.Router();

// ── Profile (any admin) ──
router.get('/me', requireAnyAdmin(), getAdminMe);

// ── Sub-admin management (main admin only) ──
router.get('/sub-admins', requireMainAdmin(), getSubAdmins);
router.post('/sub-admins', requireMainAdmin(), postSubAdmin);
router.patch('/sub-admins/:id', requireMainAdmin(), patchSubAdmin);
router.delete('/sub-admins/:id', requireMainAdmin(), removeSubAdmin);
router.get('/activity-logs', requireMainAdmin(), getActivityLogs);

// ── Dashboard ──
router.get('/dashboard/metrics', requireAdmin('dashboard'), getDashboardMetrics);
router.get('/dashboard/revenue-chart', requireAdmin('dashboard'), getRevenueChart);
router.get('/dashboard/top-shows', requireAdmin('dashboard'), getTopShowsChart);

// ── Users ──
router.get('/users', requireAuth, requireAdmin('users'), getAllUsers);
router.get('/users/:userId/profile', requireAuth, requireAdmin('users'), getUserProfile);
router.patch('/users/:userId/status', requireAuth, requireAdmin('users'), toggleUserStatus);
router.patch('/users/:userId/coins', requireAuth, requireAdmin('users'), adjustUserCoins);
router.get('/account-deletions', requireAuth, requireAdmin('users'), getAccountDeletionsController);
router.get('/account-deletions/export', requireAuth, requireAdmin('users'), exportAccountDeletionsController);

// ── Coins ──
router.get('/coins/rules', requireAuth, requireAdmin('coins'), getCoinRules);
router.put('/coins/rules', requireAuth, requireAdmin('coins'), saveCoinRules);
router.get('/coins/metrics', requireAuth, requireAdmin('coins'), getCoinMetrics);
router.get('/coins/transactions', requireAuth, requireAdmin('coins'), getCoinTransactions);

// ── Analytics ──
router.get('/reports/:reportType', requireAuth, requireAdmin('analytics'), getAnalyticsReport);

// ── Banners ──
router.get('/banners', requireAuth, requireAdmin('banners'), getBanners);
router.post('/banners', requireAuth, requireAdmin('banners'), createBanner);
router.put('/banners/:id', requireAuth, requireAdmin('banners'), updateBanner);
router.patch('/banners/:id/toggle', requireAuth, requireAdmin('banners'), toggleBanner);
router.delete('/banners/:id', requireAuth, requireAdmin('banners'), deleteBanner);

// ── Hero banners (home slider) ──
router.get('/hero-banners', requireAuth, requireAdmin('hero_banners'), getHeroBanners);
router.post('/hero-banners', requireAuth, requireAdmin('hero_banners'), createHeroBanner);
router.put('/hero-banners/reorder', requireAuth, requireAdmin('hero_banners'), reorderHeroBanners);
router.put('/hero-banners/:id', requireAuth, requireAdmin('hero_banners'), updateHeroBanner);
router.patch('/hero-banners/:id/toggle', requireAuth, requireAdmin('hero_banners'), toggleHeroBanner);
router.delete('/hero-banners/:id', requireAuth, requireAdmin('hero_banners'), deleteHeroBanner);

// ── View count (dramas section) --
router.post('/shows/:showId/view-count-adjust', requireAuth, requireAdmin('dramas'), adjustShowViewCount);
router.get('/shows/:showId/stats', requireAuth, requireAdmin('dramas'), getShowStats);

// ── Teachers management (roles)
router.get('/teachers', requireAuth, requireAdmin('roles'), listTeachers);
router.post('/teachers', requireAuth, requireAdmin('roles'), createTeacher);
router.patch('/teachers/:id/status', requireAuth, requireAdmin('roles'), patchTeacherStatus);
router.get('/teachers/:id/profile', requireAuth, requireAdmin('roles'), getTeacherProfileAdmin);
router.put('/teachers/:id/profile', requireAuth, requireAdmin('roles'), putTeacherProfileAdmin);

// ── Approvals
router.get('/approvals', requireAuth, requireAdmin('dramas'), listApprovals);
router.patch('/approvals/shows/:id', requireAuth, requireAdmin('dramas'), approveShow);
router.patch('/approvals/episodes/:id', requireAuth, requireAdmin('dramas'), approveEpisode);

// ── Student Onboarding & Course Assignment ──
router.post('/students', requireAuth, requireAdmin('student_onboarding'), onboardStudent);
router.get('/students', requireAuth, requireAnyAdmin(), listStudents);
router.post('/students/:userId/courses', requireAuth, requireAdmin('assign_courses'), assignCoursesToStudent);
router.delete('/students/:userId/courses/:showId', requireAuth, requireAdmin('assign_courses'), revokeCourseFromStudent);

export default router;