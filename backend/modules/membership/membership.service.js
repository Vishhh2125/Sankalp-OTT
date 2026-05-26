import { prisma } from '../../prisma/client.js';
import { AppError } from '../../middleware/error.middleware.js';

/**
 * =====================================================
 * MEMBERSHIP SERVICE
 * =====================================================
 * All business logic for membership plan management
 */

/**
 * Get all active membership plans
 * Used by users to view available plans
 */
export async function getAllActivePlans() {
  try {
    const plans = await prisma.membershipPlan.findMany({
      where: { is_active: true },
      orderBy: { created_at: 'asc' },
    });

    return plans.map(p => ({
      id: p.id,
      name: p.name,
      duration: p.duration,
      price: parseFloat(p.price),
      currency: p.currency,
      isActive: p.is_active,
    }));
  } catch (error) {
    throw error;
  }
}

/**
 * Get all membership plans (including inactive)
 * Used by admin to manage plans
 */
export async function getAllPlans() {
  try {
    const plans = await prisma.membershipPlan.findMany({
      orderBy: { created_at: 'asc' },
    });

    // Get subscriber count for each plan
    const plansWithStats = await Promise.all(
      plans.map(async (p) => {
        const subscriberCount = await prisma.userMembership.count({
          where: {
            plan_id: p.id,
            status: 'ACTIVE',
          },
        });

        return {
          id: p.id,
          name: p.name,
          duration: p.duration,
          price: parseFloat(p.price),
          currency: p.currency,
          isActive: p.is_active,
          subscribers: subscriberCount,
          createdAt: p.created_at,
        };
      })
    );

    return plansWithStats;
  } catch (error) {
    throw error;
  }
}

/**
 * Get single plan by ID
 */
export async function getPlanById(planId) {
  try {
    const plan = await prisma.membershipPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new AppError('Plan not found', 404);
    }

    return {
      id: plan.id,
      name: plan.name,
      duration: plan.duration,
      price: parseFloat(plan.price),
      currency: plan.currency,
      isActive: plan.is_active,
      createdAt: plan.created_at,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Create new membership plan
 * Admin only
 */
export async function createPlan(data) {
  try {
    const { name, duration, price, currency = 'INR' } = data;

    // Validation
    if (!name || !duration || !price) {
      throw new AppError('Missing required fields: name, duration, price', 400);
    }

    if (isNaN(price) || price <= 0) {
      throw new AppError('Price must be a valid positive number', 400);
    }

    const validDurations = ['week', 'month', 'year'];
    if (!validDurations.includes(duration)) {
      throw new AppError(`Duration must be one of: ${validDurations.join(', ')}`, 400);
    }

    // Create plan
    const plan = await prisma.membershipPlan.create({
      data: {
        name: name.trim(),
        duration,
        price: parseFloat(price),
        currency,
        is_active: true,
      },
    });

    return {
      id: plan.id,
      name: plan.name,
      duration: plan.duration,
      price: parseFloat(plan.price),
      currency: plan.currency,
      isActive: plan.is_active,
      subscribers: 0,
      createdAt: plan.created_at,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Update membership plan
 * Admin only
 */
export async function updatePlan(planId, data) {
  try {
    const plan = await prisma.membershipPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new AppError('Plan not found', 404);
    }

    const { name, duration, price, isActive } = data;

    // Validation
    if (price !== undefined && (isNaN(price) || price <= 0)) {
      throw new AppError('Price must be a valid positive number', 400);
    }

    if (duration) {
      const validDurations = ['week', 'month', 'year'];
      if (!validDurations.includes(duration)) {
        throw new AppError(`Duration must be one of: ${validDurations.join(', ')}`, 400);
      }
    }

    // Build update object
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (duration !== undefined) updateData.duration = duration;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (isActive !== undefined) updateData.is_active = isActive;

    const updated = await prisma.membershipPlan.update({
      where: { id: planId },
      data: updateData,
    });

    // Get subscriber count
    const subscriberCount = await prisma.userMembership.count({
      where: {
        plan_id: planId,
        status: 'ACTIVE',
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      duration: updated.duration,
      price: parseFloat(updated.price),
      currency: updated.currency,
      isActive: updated.is_active,
      subscribers: subscriberCount,
      createdAt: updated.created_at,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Delete membership plan
 * Admin only - Only if no active memberships
 */
export async function deletePlan(planId) {
  try {
    const plan = await prisma.membershipPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new AppError('Plan not found', 404);
    }

    // Check if plan has active memberships
    const activeMemberships = await prisma.userMembership.count({
      where: {
        plan_id: planId,
        status: 'ACTIVE',
      },
    });

    if (activeMemberships > 0) {
      throw new AppError(
        `Cannot delete plan with ${activeMemberships} active memberships. Deactivate it instead.`,
        409
      );
    }

    await prisma.membershipPlan.delete({
      where: { id: planId },
    });

    return { message: 'Plan deleted successfully' };
  } catch (error) {
    throw error;
  }
}

/**
 * Toggle plan active status
 * Admin only
 */
export async function togglePlanStatus(planId) {
  try {
    const plan = await prisma.membershipPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new AppError('Plan not found', 404);
    }

    const updated = await prisma.membershipPlan.update({
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

/**
 * Get membership statistics (for admin dashboard)
 * Calculates: total subscribers, monthly revenue, active plans count
 */
export async function getMembershipStats() {
  try {
    // Get current month date range
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Total active subscribers across all plans
    const totalSubscribers = await prisma.userMembership.count({
      where: { status: 'ACTIVE' },
    });

    // Monthly revenue: sum of membership payments in current month
    const monthlyRevenueResult = await prisma.paymentTransaction.aggregate({
      where: {
        type: 'membership',
        created_at: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const monthlyRevenue = monthlyRevenueResult._sum?.amount || 0;

    // Count active and total plans
    const activePlansCount = await prisma.membershipPlan.count({
      where: { is_active: true },
    });
    const totalPlansCount = await prisma.membershipPlan.count();

    return {
      totalSubscribers,
      monthlyRevenue: parseFloat(monthlyRevenue),
      activePlans: activePlansCount,
      totalPlans: totalPlansCount,
      currency: 'INR',
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Get subscription history (all memberships)
 * For admin subscription history table
 */
export async function getSubscriptionHistory(page = 1, limit = 50) {
  try {
    const skip = (page - 1) * limit;

    const memberships = await prisma.userMembership.findMany({
      include: {
        user: { select: { name: true } },
        plan: { select: { name: true, price: true, currency: true } },
        payment: { select: { amount: true, status: true, created_at: true } },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    });

    const total = await prisma.userMembership.count();

    const history = memberships.map(m => ({
      id: m.id,
      user: m.user.name,
      plan: m.plan.name,
      amount: m.payment?.amount ? parseFloat(m.payment.amount) : parseFloat(m.plan.price),
      currency: m.plan.currency,
      date: m.payment?.created_at || m.created_at,
      status: m.status,
      txnId: m.payment?.id || m.id,
    }));

    return {
      history,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    throw error;
  }
}
