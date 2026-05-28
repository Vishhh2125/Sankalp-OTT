import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  getAllActiveTopUpPlans,
  getAllTopUpPlans,
  getTopUpPlanById,
  createTopUpPlan,
  updateTopUpPlan,
  deleteTopUpPlan,
  toggleTopUpPlanStatus,
} from './topup.service.js';

/**
 * =====================================================
 * TOP-UP CONTROLLER
 * =====================================================
 * API endpoint handlers for top-up plan management
 */

/**
 * GET /api/v1/topup/plans
 * Get all active top-up plans (Public endpoint)
 */
export const getActiveTopUpPlans = asyncHandler(async (req, res) => {
  const plans = await getAllActiveTopUpPlans();

  return res.json(
    new ApiResponse(200, plans, 'Active top-up plans fetched successfully')
  );
});

/**
 * GET /api/v1/admin/topup/plans
 * Get all top-up plans with stats (Admin only)
 */
export const getAllTopUpPlansHandler = asyncHandler(async (req, res) => {
  const plans = await getAllTopUpPlans();

  return res.json(
    new ApiResponse(200, plans, 'All top-up plans fetched successfully')
  );
});

/**
 * GET /api/v1/admin/topup/plans/:planId
 * Get single top-up plan details (Admin only)
 */
export const getTopUpPlan = asyncHandler(async (req, res) => {
  const { planId } = req.params;
  const plan = await getTopUpPlanById(planId);

  return res.json(
    new ApiResponse(200, plan, 'Top-up plan fetched successfully')
  );
});

/**
 * POST /api/v1/admin/topup/plans
 * Create new top-up plan (Admin only)
 * Body: { name, price, coins_amount, currency? }
 */
export const createTopUpPlanHandler = asyncHandler(async (req, res) => {
  const plan = await createTopUpPlan(req.body);

  return res.status(201).json(
    new ApiResponse(201, plan, 'Top-up plan created successfully')
  );
});

/**
 * PATCH /api/v1/admin/topup/plans/:planId
 * Update top-up plan (Admin only)
 * Body: { name?, price?, coins_amount?, isActive? }
 */
export const updateTopUpPlanHandler = asyncHandler(async (req, res) => {
  const { planId } = req.params;
  const plan = await updateTopUpPlan(planId, req.body);

  return res.json(
    new ApiResponse(200, plan, 'Top-up plan updated successfully')
  );
});

/**
 * PATCH /api/v1/admin/topup/plans/:planId/toggle
 * Toggle top-up plan active status (Admin only)
 */
export const toggleTopUpPlanStatusHandler = asyncHandler(async (req, res) => {
  const { planId } = req.params;
  const result = await toggleTopUpPlanStatus(planId);

  return res.json(
    new ApiResponse(200, result, 'Top-up plan status toggled successfully')
  );
});

/**
 * DELETE /api/v1/admin/topup/plans/:planId
 * Delete top-up plan (Admin only)
 */
export const deleteTopUpPlanHandler = asyncHandler(async (req, res) => {
  const { planId } = req.params;
  const result = await deleteTopUpPlan(planId);

  return res.json(
    new ApiResponse(200, result, 'Top-up plan deleted successfully')
  );
});
