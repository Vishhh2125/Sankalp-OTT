import express from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireAdmin } from '../../middleware/admin.middleware.js';
import {
  getActiveTopUpPlans,
  getAllTopUpPlansHandler,
  getTopUpPlan,
  createTopUpPlanHandler,
  updateTopUpPlanHandler,
  deleteTopUpPlanHandler,
  toggleTopUpPlanStatusHandler,
} from './topup.controller.js';

const router = express.Router();

/**
 * =====================================================
 * PUBLIC ROUTES (No auth required)
 * =====================================================
 */

// GET all active top-up plans
router.get('/plans', getActiveTopUpPlans);

/**
 * =====================================================
 * ADMIN ROUTES (Auth + Admin required)
 * =====================================================
 */

// All admin routes require authentication and admin role
router.use(requireAuth);
router.use(requireAdmin());

// GET all top-up plans with stats
router.get('/plans', getAllTopUpPlansHandler);

// GET single top-up plan
router.get('/plans/:planId', getTopUpPlan);

// POST create new top-up plan
router.post('/plans', createTopUpPlanHandler);

// PATCH update top-up plan
router.patch('/plans/:planId', updateTopUpPlanHandler);

// PATCH toggle plan active status
router.patch('/plans/:planId/toggle', toggleTopUpPlanStatusHandler);

// DELETE top-up plan
router.delete('/plans/:planId', deleteTopUpPlanHandler);

export default router;
