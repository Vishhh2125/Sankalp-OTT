import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  getAllActivePlans,
  getAllPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  togglePlanStatus,
} from './membership.service.js';

/**
 * =====================================================
 * MEMBERSHIP CONTROLLER
 * =====================================================
 * API endpoint handlers for membership plan management
 */

/**
 * GET /api/v1/membership/plans
 * Get all active membership plans (Public endpoint)
 */
export const getActivePlans = asyncHandler(async (req, res) => {
  const plans = await getAllActivePlans();

  return res.json(
    new ApiResponse(200, plans, 'Active membership plans fetched successfully')
  );
});

/**
 * GET /api/v1/admin/membership/plans
 * Get all membership plans with stats (Admin only)
 */
export const getAllMembershipPlans = asyncHandler(async (req, res) => {
  const plans = await getAllPlans();

  return res.json(
    new ApiResponse(200, plans, 'All membership plans fetched successfully')
  );
});

/**
 * GET /api/v1/admin/membership/plans/:planId
 * Get single plan details (Admin only)
 */
export const getMembershipPlan = asyncHandler(async (req, res) => {
  const { planId } = req.params;
  const plan = await getPlanById(planId);

  return res.json(
    new ApiResponse(200, plan, 'Membership plan fetched successfully')
  );
});

/**
 * POST /api/v1/admin/membership/plans
 * Create new membership plan (Admin only)
 * Body: { name, duration, price, currency? }
 */
export const createMembershipPlan = asyncHandler(async (req, res) => {
  const plan = await createPlan(req.body);

  return res.status(201).json(
    new ApiResponse(201, plan, 'Membership plan created successfully')
  );
});

/**
 * PATCH /api/v1/admin/membership/plans/:planId
 * Update membership plan (Admin only)
 * Body: { name?, duration?, price?, isActive? }
 */
export const updateMembershipPlan = asyncHandler(async (req, res) => {
  const { planId } = req.params;
  const plan = await updatePlan(planId, req.body);

  return res.json(
    new ApiResponse(200, plan, 'Membership plan updated successfully')
  );
});

/**
 * DELETE /api/v1/admin/membership/plans/:planId
 * Delete membership plan (Admin only)
 */
export const deleteMembershipPlan = asyncHandler(async (req, res) => {
  const { planId } = req.params;
  await deletePlan(planId);

  return res.json(
    new ApiResponse(200, {}, 'Membership plan deleted successfully')
  );
});

/**
 * PATCH /api/v1/admin/membership/plans/:planId/toggle
 * Toggle plan active status (Admin only)
 */
export const toggleMembershipPlanStatus = asyncHandler(async (req, res) => {
  const { planId } = req.params;
  const result = await togglePlanStatus(planId);

  return res.json(
    new ApiResponse(200, result, 'Membership plan status toggled successfully')
  );
});
