import { prisma } from '../../prisma/client.js';
import { AppError } from '../../middleware/error.middleware.js';

/**
 * =====================================================
 * TOP-UP PLANS SERVICE
 * =====================================================
 * All business logic for top-up plan management
 */

/**
 * Get all active top-up plans
 * Used by users to view available top-up options
 */
export async function getAllActiveTopUpPlans() {
  try {
    const plans = await prisma.topUpPlan.findMany({
      where: { is_active: true },
      orderBy: { price: 'asc' },
    });

    return plans.map(p => ({
      id: p.id,
      name: p.name,
      price: parseFloat(p.price),
      coins_amount: p.coins_amount,
      currency: p.currency,
      isActive: p.is_active,
    }));
  } catch (error) {
    throw error;
  }
}

/**
 * Get all top-up plans (including inactive)
 * Used by admin to manage plans
 */
export async function getAllTopUpPlans() {
  try {
    const plans = await prisma.topUpPlan.findMany({
      orderBy: { created_at: 'asc' },
    });

    return plans.map(p => ({
      id: p.id,
      name: p.name,
      price: parseFloat(p.price),
      coins_amount: p.coins_amount,
      currency: p.currency,
      isActive: p.is_active,
      createdAt: p.created_at,
    }));
  } catch (error) {
    throw error;
  }
}

/**
 * Get single top-up plan by ID
 */
export async function getTopUpPlanById(planId) {
  try {
    const plan = await prisma.topUpPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new AppError('Top-up plan not found', 404);
    }

    return {
      id: plan.id,
      name: plan.name,
      price: parseFloat(plan.price),
      coins_amount: plan.coins_amount,
      currency: plan.currency,
      isActive: plan.is_active,
      createdAt: plan.created_at,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Create new top-up plan
 * Admin only
 */
export async function createTopUpPlan(data) {
  try {
    const { name, price, coins_amount, currency = 'INR' } = data;

    // Validation
    if (!name || !price || !coins_amount) {
      throw new AppError('Missing required fields: name, price, coins_amount', 400);
    }

    if (isNaN(price) || price <= 0) {
      throw new AppError('Price must be a valid positive number', 400);
    }

    if (isNaN(coins_amount) || coins_amount <= 0) {
      throw new AppError('Coins amount must be a valid positive number', 400);
    }

    // Create plan
    const plan = await prisma.topUpPlan.create({
      data: {
        name: name.trim(),
        price: parseFloat(price),
        coins_amount: parseInt(coins_amount),
        currency,
        is_active: true,
      },
    });

    return {
      id: plan.id,
      name: plan.name,
      price: parseFloat(plan.price),
      coins_amount: plan.coins_amount,
      currency: plan.currency,
      isActive: plan.is_active,
      createdAt: plan.created_at,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Update top-up plan
 * Admin only
 */
export async function updateTopUpPlan(planId, data) {
  try {
    const plan = await prisma.topUpPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new AppError('Top-up plan not found', 404);
    }

    const { name, price, coins_amount, isActive } = data;

    // Validation
    if (price !== undefined && (isNaN(price) || price <= 0)) {
      throw new AppError('Price must be a valid positive number', 400);
    }

    if (coins_amount !== undefined && (isNaN(coins_amount) || coins_amount <= 0)) {
      throw new AppError('Coins amount must be a valid positive number', 400);
    }

    // Build update object
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (price !== undefined) updateData.price = parseFloat(price);
    if (coins_amount !== undefined) updateData.coins_amount = parseInt(coins_amount);
    if (isActive !== undefined) updateData.is_active = isActive;

    const updated = await prisma.topUpPlan.update({
      where: { id: planId },
      data: updateData,
    });

    return {
      id: updated.id,
      name: updated.name,
      price: parseFloat(updated.price),
      coins_amount: updated.coins_amount,
      currency: updated.currency,
      isActive: updated.is_active,
      createdAt: updated.created_at,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Delete top-up plan
 * Admin only
 */
export async function deleteTopUpPlan(planId) {
  try {
    const plan = await prisma.topUpPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new AppError('Top-up plan not found', 404);
    }

    await prisma.topUpPlan.delete({
      where: { id: planId },
    });

    return { message: 'Top-up plan deleted successfully' };
  } catch (error) {
    throw error;
  }
}

/**
 * Toggle top-up plan active status
 * Admin only
 */
export async function toggleTopUpPlanStatus(planId) {
  try {
    const plan = await prisma.topUpPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new AppError('Top-up plan not found', 404);
    }

    const updated = await prisma.topUpPlan.update({
      where: { id: planId },
      data: { is_active: !plan.is_active },
    });

    return {
      id: updated.id,
      isActive: updated.is_active,
    };
  } catch (error) {
    throw error;
  }
}
