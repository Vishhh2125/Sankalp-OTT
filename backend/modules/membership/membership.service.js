import { prisma } from '../../prisma/client.js';
import { AppError } from '../../middleware/error.middleware.js';
import { activeMembershipWhere, isLifetimePlan } from './membership.helpers.js';

const VALID_DURATIONS = [
  'week',
  'weekly',
  'month',
  'monthly',
  'year',
  'yearly',
  'annual',
  'lifetime',
];

function mapPlanRecord(p, extra = {}) {
  const lifetime = isLifetimePlan(p);
  return {
    id: p.id,
    name: p.name,
    duration: p.duration,
    price: parseFloat(p.price),
    currency: p.currency,
    isActive: p.is_active,
    category_id: p.category_id ?? null,
    category_name: p.category?.name ?? (p.category_id ? null : 'All Categories'),
    is_lifetime: lifetime,
    is_all_categories: p.category_id == null,
    ...extra,
  };
}

const planWithCategoryInclude = {
  category: { select: { name: true } },
};

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
      include: planWithCategoryInclude,
      orderBy: [{ category_id: 'asc' }, { created_at: 'asc' }],
    });

    return plans.map((p) => mapPlanRecord(p));
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
      include: planWithCategoryInclude,
      orderBy: [{ category_id: 'asc' }, { created_at: 'asc' }],
    });

    const plansWithStats = await Promise.all(
      plans.map(async (p) => {
        const subscriberCount = await prisma.userMembership.count({
          where: {
            plan_id: p.id,
            ...activeMembershipWhere(),
          },
        });

        return mapPlanRecord(p, {
          subscribers: subscriberCount,
          createdAt: p.created_at,
        });
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
      include: planWithCategoryInclude,
    });

    if (!plan) {
      throw new AppError('Plan not found', 404);
    }

    return mapPlanRecord(plan, { createdAt: plan.created_at });
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
    const { name, duration, price, currency = 'PHP', category_id = null } = data;

    if (!name || !duration || price === undefined || price === null || price === '') {
      throw new AppError('Missing required fields: name, duration, price', 400);
    }

    if (isNaN(price) || price <= 0) {
      throw new AppError('Price must be a valid positive number', 400);
    }

    if (!VALID_DURATIONS.includes(String(duration).toLowerCase())) {
      throw new AppError(`Duration must be one of: ${VALID_DURATIONS.join(', ')}`, 400);
    }

    if (category_id) {
      const category = await prisma.category.findUnique({ where: { id: category_id } });
      if (!category) {
        throw new AppError('Category not found', 404);
      }
    }

    const plan = await prisma.membershipPlan.create({
      data: {
        name: name.trim(),
        duration: String(duration).toLowerCase(),
        price: parseFloat(price),
        currency,
        category_id: category_id || null,
        is_active: true,
      },
      include: planWithCategoryInclude,
    });

    return mapPlanRecord(plan, { subscribers: 0, createdAt: plan.created_at });
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

    const { name, duration, price, isActive, category_id } = data;

    if (price !== undefined && (isNaN(price) || price <= 0)) {
      throw new AppError('Price must be a valid positive number', 400);
    }

    if (duration) {
      if (!VALID_DURATIONS.includes(String(duration).toLowerCase())) {
        throw new AppError(`Duration must be one of: ${VALID_DURATIONS.join(', ')}`, 400);
      }
    }

    if (category_id) {
      const category = await prisma.category.findUnique({ where: { id: category_id } });
      if (!category) {
        throw new AppError('Category not found', 404);
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (duration !== undefined) updateData.duration = String(duration).toLowerCase();
    if (price !== undefined) updateData.price = parseFloat(price);
    if (isActive !== undefined) updateData.is_active = isActive;
    if (category_id !== undefined) updateData.category_id = category_id || null;

    const updated = await prisma.membershipPlan.update({
      where: { id: planId },
      data: updateData,
      include: planWithCategoryInclude,
    });

    const subscriberCount = await prisma.userMembership.count({
      where: {
        plan_id: planId,
        ...activeMembershipWhere(),
      },
    });

    return mapPlanRecord(updated, {
      subscribers: subscriberCount,
      createdAt: updated.created_at,
    });
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
        ...activeMembershipWhere(),
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
      where: activeMembershipWhere(),
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
      currency: 'PHP',
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
        plan: {
          select: {
            name: true,
            price: true,
            currency: true,
            duration: true,
            category_id: true,
            category: { select: { name: true } },
          },
        },
        payment: { select: { amount: true, status: true, created_at: true } },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    });

    const total = await prisma.userMembership.count();

    const history = memberships.map((m) => ({
      id: m.id,
      user: m.user.name,
      plan: m.plan.name,
      category_id: m.plan.category_id,
      category_name: m.plan.category_id
        ? m.plan.category?.name ?? null
        : 'All Categories',
      is_lifetime: isLifetimePlan(m.plan),
      amount: m.payment?.amount ? parseFloat(m.payment.amount) : parseFloat(m.plan.price),
      currency: m.plan.currency,
      date: m.payment?.created_at || m.created_at,
      startDate: m.start_date,
      endDate: m.end_date,
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

/**
 * Get revenue breakdown by membership plan (Dynamic from database)
 * For admin revenue report - shows revenue for each membership plan
 * @param {Object} dateRange - { startDate, endDate } for filtering
 * @returns {Array} Array of revenue data by plan
 */
export async function getRevenueByPlan(dateRange = {}) {
  try {
    const { startDate = new Date(0), endDate = new Date() } = dateRange;

    // Get all membership plans
    const plans = await prisma.membershipPlan.findMany({
      include: planWithCategoryInclude,
      orderBy: { created_at: 'asc' },
    });

    // For each plan, calculate total revenue from completed payments
    const revenueByPlan = await Promise.all(
      plans.map(async (plan) => {
        // Sum revenue from payments for this plan
        // UserMembership links user to plan and payment
        const revenueResult = await prisma.paymentTransaction.aggregate({
          where: {
            status: 'completed',
            created_at: {
              gte: startDate,
              lte: endDate,
            },
            memberships: {
              some: {
                plan_id: plan.id,
              },
            },
          },
          _sum: {
            amount: true,
          },
        });

        const revenue = revenueResult._sum?.amount || 0;
        
        // Also get subscriber count for this plan (active subscriptions)
        const subscriberCount = await prisma.userMembership.count({
          where: {
            plan_id: plan.id,
            ...activeMembershipWhere(),
          },
        });

        return {
          id: plan.id,
          planName: plan.name,
          duration: plan.duration,
          price: parseFloat(plan.price),
          currency: plan.currency,
          category_id: plan.category_id,
          category_name: plan.category_id
            ? plan.category?.name ?? null
            : 'All Categories',
          is_lifetime: isLifetimePlan(plan),
          revenue: parseFloat(revenue),
          subscribers: subscriberCount,
          isActive: plan.is_active,
        };
      })
    );

    // Filter to only show active plans or plans with revenue
    const reportData = revenueByPlan
      .filter((item) => item.isActive || item.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue); // Sort by revenue descending

    return reportData;
  } catch (error) {
    throw error;
  }
}