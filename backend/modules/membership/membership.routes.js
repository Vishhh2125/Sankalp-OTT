import express from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireAdmin } from '../../middleware/admin.middleware.js';
import {
  getActivePlans,
  getAllMembershipPlans,
  getMembershipPlan,
  createMembershipPlan,
  updateMembershipPlan,
  deleteMembershipPlan,
  toggleMembershipPlanStatus,
} from './membership.controller.js';

const router = express.Router();

/**
 * =====================================================
 * PUBLIC ROUTES (No auth required)
 * =====================================================
 */

// GET all active membership plans
router.get('/plans', getActivePlans);

/**
 * =====================================================
 * ADMIN ROUTES (Auth + Admin required)
 * =====================================================
 */

// All admin routes require authentication and admin role
router.use(requireAuth);
router.use(requireAdmin());

// GET all membership plans with stats
router.get('/plans', getAllMembershipPlans);

// GET single membership plan
router.get('/plans/:planId', getMembershipPlan);

// POST create new membership plan
router.post('/plans', createMembershipPlan);

// PATCH update membership plan
router.patch('/plans/:planId', updateMembershipPlan);

// PATCH toggle plan active status
router.patch('/plans/:planId/toggle', toggleMembershipPlanStatus);

// DELETE membership plan
router.delete('/plans/:planId', deleteMembershipPlan);

export default router;
