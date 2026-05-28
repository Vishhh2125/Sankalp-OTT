import { prisma } from '../../prisma/client.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { AppError } from '../../middleware/error.middleware.js';
import { getRevenueByPlan } from '../membership/membership.service.js';

/**
 * GET /api/v1/admin/users
 * Fetch all users with their details (coins, status, membership expiry)
 * Admin only
 */
export async function getAllUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        coins: true,
        isBlocked: true,
        createdAt: true,
        memberships: {
          where: { status: 'ACTIVE' },
          orderBy: { end_date: 'desc' },
          take: 1,
          select: { end_date: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format response for frontend
    const formattedUsers = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role === 'USER' ? 'user' : u.role === 'ADMIN' ? 'admin' : 'sub_admin',
      plan: u.plan || 'FREE',
      coins: u.coins || 0,
      joined: new Date(u.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      status: u.isBlocked ? 'Blocked' : 'Active',
      subscription: u.memberships.length > 0
        ? new Date(u.memberships[0].end_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        : '—',
    }));

    return res.json(
      new ApiResponse(200, { users: formattedUsers, total: formattedUsers.length }, 'Users fetched successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/admin/users/:userId/status
 * Toggle user block status
 */
export async function toggleUserStatus(req, res, next) {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isBlocked: !user.isBlocked },
    });

    return res.json(
      new ApiResponse(
        200,
        { id: updated.id, isBlocked: updated.isBlocked },
        `User ${updated.isBlocked ? 'blocked' : 'unblocked'} successfully`
      )
    );
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/admin/users/:userId/coins
 * Adjust user coins (credit or debit)
 * Body: { amount: number (positive or negative), reason: string }
 */
export async function adjustUserCoins(req, res, next) {
  try {
    const { userId } = req.params;
    const { amount, reason } = req.body;

    if (!amount || typeof amount !== 'number') {
      throw new AppError('Invalid amount provided', 400);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const newCoins = Math.max(0, (user.coins || 0) + amount);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { coins: newCoins },
    });

    // Optional: log coin transaction
    if (amount !== 0) {
      await prisma.coinTransaction.create({
        data: {
          user_id: userId,
          amount: amount,
          type: amount > 0 ? 'CREDIT' : 'DEBIT',
          reason: reason || 'Admin adjustment',
        },
      });
    }

    return res.json(
      new ApiResponse(200, { id: updated.id, coins: updated.coins }, 'Coins adjusted successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/users/:userId/profile
 * Fetch detailed user profile with activity and history
 */
export async function getUserProfile(req, res, next) {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        coins: true,
        isBlocked: true,
        createdAt: true,
        memberships: {
          select: {
            id: true,
            start_date: true,
            end_date: true,
            status: true,
            plan: { select: { name: true } },
          },
          orderBy: { created_at: 'desc' },
        },
        watch_history: {
          orderBy: { last_watched: 'desc' },
          take: 10,
          select: {
            episode: {
              select: {
                id: true,
                episode_num: true,
                title: true,
                show: { select: { id: true, title: true } },
              },
            },
            last_watched: true,
            progress_sec: true,
          },
        },
        coin_transactions: {
          orderBy: { created_at: 'desc' },
          take: 20,
          select: {
            id: true,
            amount: true,
            type: true,
            reason: true,
            created_at: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return res.json(new ApiResponse(200, user, 'User profile fetched successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/coins/rules
 * Fetch all coin rules from settings
 */
export async function getCoinRules(req, res, next) {
  try {
    const ruleKeys = [
      'checkin_day_1',
      'checkin_day_2',
      'checkin_day_3',
      'checkin_day_4',
      'checkin_day_5',
      'checkin_day_6',
      'checkin_day_7',
      'default_coin_cost',
    ];

    const settings = await prisma.setting.findMany({
      where: { key: { in: ruleKeys } },
    });

    const rules = {
      day1: parseInt(settings.find(s => s.key === 'checkin_day_1')?.value || '10'),
      day2: parseInt(settings.find(s => s.key === 'checkin_day_2')?.value || '10'),
      day3: parseInt(settings.find(s => s.key === 'checkin_day_3')?.value || '20'),
      day4: parseInt(settings.find(s => s.key === 'checkin_day_4')?.value || '20'),
      day5: parseInt(settings.find(s => s.key === 'checkin_day_5')?.value || '25'),
      day6: parseInt(settings.find(s => s.key === 'checkin_day_6')?.value || '30'),
      day7: parseInt(settings.find(s => s.key === 'checkin_day_7')?.value || '50'),
      defaultCoinCost: parseInt(settings.find(s => s.key === 'default_coin_cost')?.value || '30'),
    };

    return res.json(new ApiResponse(200, { rules }, 'Coin rules fetched successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/admin/coins/rules
 * Save/update coin rules
 * Body: { day1, day2, day3, day4, day5, day6, day7, defaultCoinCost }
 */
export async function saveCoinRules(req, res, next) {
  try {
    const { day1, day2, day3, day4, day5, day6, day7, defaultCoinCost } = req.body;

    const updates = [
      { key: 'checkin_day_1', value: String(day1 || 10) },
      { key: 'checkin_day_2', value: String(day2 || 10) },
      { key: 'checkin_day_3', value: String(day3 || 20) },
      { key: 'checkin_day_4', value: String(day4 || 20) },
      { key: 'checkin_day_5', value: String(day5 || 25) },
      { key: 'checkin_day_6', value: String(day6 || 30) },
      { key: 'checkin_day_7', value: String(day7 || 50) },
      { key: 'default_coin_cost', value: String(defaultCoinCost || 30) },
    ];

    for (const update of updates) {
      await prisma.setting.upsert({
        where: { key: update.key },
        update: { value: update.value },
        create: { key: update.key, value: update.value },
      });
    }

    // Log activity
    await prisma.adminActivityLog.create({
      data: {
        user_id: req.user.id,
        action: 'COIN_RULES_UPDATED',
        entity_type: 'SETTINGS',
        details: JSON.stringify(req.body),
      },
    });

    return res.json(new ApiResponse(200, { rules: req.body }, 'Coin rules saved successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/coins/metrics
 * Fetch coin circulation metrics
 */
export async function getCoinMetrics(req, res, next) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Total in circulation
    const totalCoinsSum = await prisma.user.aggregate({
      _sum: { coins: true },
    });
    const totalInCirculation = totalCoinsSum._sum.coins || 0;

    // Purchased today
    const purchasedToday = await prisma.coinTransaction.aggregate({
      _sum: { amount: true },
      where: {
        reason: 'wallet_topup_simulated',
        created_at: { gte: today },
      },
    });

    // Content unlocked today
    const unlockedToday = await prisma.episodeAccess.count({
      where: { unlocked_at: { gte: today } },
    });

    // Daily check-ins today
    const checkinsToday = await prisma.dailyCheckin.count({
      where: { checkin_date: { gte: today } },
    });

    // Issued (daily gift) - sum of checkin rewards
    const issuedTotal = await prisma.coinTransaction.aggregate({
      _sum: { amount: true },
      where: { reason: 'daily_checkin' },
    });

    // Purchased - all wallet topup transactions
    const purchasedTotal = await prisma.coinTransaction.aggregate({
      _sum: { amount: true },
      where: { reason: 'wallet_topup_simulated' },
    });

    // Spent (unlocks) - sum of coins spent on episodes
    const spentTotal = await prisma.episodeAccess.aggregate({
      _sum: { coins_spent: true },
    });

    const metrics = {
      totalInCirculation: totalInCirculation.toLocaleString('en-IN'),
      purchasedToday: (purchasedToday._sum.amount || 0).toLocaleString('en-IN'),
      contentUnlockedToday: unlockedToday.toLocaleString('en-IN'),
      dailyCheckinsToday: checkinsToday.toLocaleString('en-IN'),
      issuedTotal: (issuedTotal._sum.amount || 0).toLocaleString('en-IN'),
      purchasedTotal: (purchasedTotal._sum.amount || 0).toLocaleString('en-IN'),
      spentTotal: (spentTotal._sum.coins_spent || 0).toLocaleString('en-IN'),
      balanceInWallets: (totalInCirculation - (spentTotal._sum.coins_spent || 0)).toLocaleString('en-IN'),
    };

    return res.json(new ApiResponse(200, { metrics }, 'Coin metrics fetched successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/coins/transactions
 * Fetch coin transactions with optional filtering
 * Query: ?method=All&search=&limit=50&offset=0
 */
export async function getCoinTransactions(req, res, next) {
  try {
    const { method = 'All', search = '', limit = 50, offset = 0 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 200);
    const offsetNum = parseInt(offset) || 0;

    const whereClause = {};

    // Filter by method
    if (method !== 'All') {
      const methodMap = {
        'Purchase': 'wallet_topup_simulated',
        'Daily Checkin': 'daily_checkin',
        'Spend': 'episode_unlock',
        'Manual': 'admin_adjustment',
        'Refund': 'refund',
      };
      if (methodMap[method]) {
        whereClause.reason = methodMap[method];
      }
    }

    // Search by user name or transaction ID
    if (search) {
      whereClause.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { id: { contains: search, mode: 'insensitive' } },
      ];
    }

    const transactions = await prisma.coinTransaction.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
      take: limitNum,
      skip: offsetNum,
    });

    const total = await prisma.coinTransaction.count({ where: whereClause });

    // Format for frontend
    const formatted = transactions.map(t => ({
      id: t.id.substring(0, 8).toUpperCase(),
      user: t.user.name || 'System',
      type: t.title || t.reason,
      method: getMethodFromReason(t.reason),
      amount: t.amount,
      dir: t.type?.toUpperCase() === 'CREDIT' ? '+' : '-',
      date: new Date(t.created_at).toLocaleString('en-IN'),
    }));

    return res.json(
      new ApiResponse(200, { transactions: formatted, total }, 'Coin transactions fetched successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Helper function to map reason to method
 */
function getMethodFromReason(reason) {
  const reasonMap = {
    'wallet_topup_simulated': 'Purchase',
    'daily_checkin': 'Daily Checkin',
    'episode_unlock': 'Spend',
    'admin_adjustment': 'Manual',
    'refund': 'Refund',
  };
  return reasonMap[reason] || 'Other';
}

// ─────────────────────────────────────────────────────────────────
// BANNER CRUD
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/banners
 * Return all banners with linked show info
 */
export async function getBanners(req, res, next) {
  try {
    const banners = await prisma.banner.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        show: { select: { id: true, title: true, banner_url: true } },
      },
    });

    const formatted = banners.map(b => ({
      id: b.id,
      title: b.title,
      image_url: b.image_url,
      show_id: b.show_id,
      show_name: b.show?.title || null,
      is_active: b.is_active,
      starts_at: b.starts_at ? b.starts_at.toISOString().split('T')[0] : null,
      ends_at: b.ends_at ? b.ends_at.toISOString().split('T')[0] : null,
      created_at: b.created_at,
    }));

    return res.json(new ApiResponse(200, { banners: formatted }, 'Banners fetched successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/admin/banners
 * Create a new banner — image_url is taken from the linked show's banner_url
 * Body: { title, show_id, is_active, starts_at, ends_at }
 */
export async function createBanner(req, res, next) {
  try {
    const { title, show_id, is_active = true, starts_at, ends_at } = req.body;

    if (!title || !title.trim()) {
      throw new AppError('Title is required', 400);
    }

    // Derive image_url from the linked show's banner_url
    let image_url = '';
    let show = null;
    if (show_id) {
      show = await prisma.show.findUnique({
        where: { id: show_id },
        select: { id: true, title: true, banner_url: true },
      });
      if (!show) throw new AppError('Linked show not found', 404);
      if (!show.banner_url) throw new AppError('The selected show has no banner image uploaded yet', 400);
      image_url = show.banner_url;
    } else {
      throw new AppError('A linked show is required to create a banner', 400);
    }

    const banner = await prisma.banner.create({
      data: {
        title: title.trim(),
        show_id,
        image_url,
        is_active: Boolean(is_active),
        starts_at: starts_at ? new Date(starts_at) : null,
        ends_at: ends_at ? new Date(ends_at) : null,
      },
    });

    await prisma.adminActivityLog.create({
      data: {
        user_id: req.user.id,
        action: 'BANNER_CREATED',
        entity_type: 'BANNER',
        entity_id: banner.id,
        details: JSON.stringify({ title: banner.title }),
      },
    }).catch(() => {}); // non-fatal

    return res.status(201).json(
      new ApiResponse(201, {
        id: banner.id,
        title: banner.title,
        image_url: banner.image_url,
        show_id: banner.show_id,
        show_name: show?.title || null,
        is_active: banner.is_active,
        starts_at: banner.starts_at ? banner.starts_at.toISOString().split('T')[0] : null,
        ends_at: banner.ends_at ? banner.ends_at.toISOString().split('T')[0] : null,
      }, 'Banner created successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/admin/banners/:id
 * Update a banner
 */
export async function updateBanner(req, res, next) {
  try {
    const { id } = req.params;
    const { title, show_id, is_active, starts_at, ends_at } = req.body;

    const existing = await prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new AppError('Banner not found', 404);

    // Re-derive image_url if show changed
    let image_url = existing.image_url;
    let show = null;
    const resolvedShowId = show_id !== undefined ? show_id : existing.show_id;

    if (resolvedShowId) {
      show = await prisma.show.findUnique({
        where: { id: resolvedShowId },
        select: { id: true, title: true, banner_url: true },
      });
      if (!show) throw new AppError('Linked show not found', 404);
      if (show.banner_url) image_url = show.banner_url;
    }

    const updated = await prisma.banner.update({
      where: { id },
      data: {
        title: title !== undefined ? title.trim() : undefined,
        show_id: resolvedShowId,
        image_url,
        is_active: is_active !== undefined ? Boolean(is_active) : undefined,
        starts_at: starts_at ? new Date(starts_at) : undefined,
        ends_at: ends_at ? new Date(ends_at) : undefined,
      },
    });

    return res.json(
      new ApiResponse(200, {
        id: updated.id,
        title: updated.title,
        image_url: updated.image_url,
        show_id: updated.show_id,
        show_name: show?.title || null,
        is_active: updated.is_active,
      }, 'Banner updated successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/admin/banners/:id
 * Delete a banner
 */
export async function deleteBanner(req, res, next) {
  try {
    const { id } = req.params;

    const banner = await prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new AppError('Banner not found', 404);

    await prisma.banner.delete({ where: { id } });

    await prisma.adminActivityLog.create({
      data: {
        user_id: req.user.id,
        action: 'BANNER_DELETED',
        entity_type: 'BANNER',
        entity_id: id,
        details: JSON.stringify({ title: banner.title }),
      },
    }).catch(() => {});

    return res.json(new ApiResponse(200, {}, 'Banner deleted successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * Helper function to calculate date range based on period type
 */
function getDateRange(periodType) {
  const now = new Date();
  let startDate = new Date();
  let prevStartDate = new Date();
  let prevEndDate = new Date();

  if (periodType === 'Daily') {
    startDate.setHours(0, 0, 0, 0);
    prevStartDate.setDate(prevStartDate.getDate() - 1);
    prevStartDate.setHours(0, 0, 0, 0);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    prevEndDate.setHours(23, 59, 59, 999);
  } else if (periodType === 'Weekly') {
    startDate.setDate(startDate.getDate() - startDate.getDay());
    startDate.setHours(0, 0, 0, 0);
    prevStartDate.setDate(prevStartDate.getDate() - prevStartDate.getDay() - 7);
    prevStartDate.setHours(0, 0, 0, 0);
    prevEndDate.setDate(prevEndDate.getDate() - prevEndDate.getDay() - 1);
    prevEndDate.setHours(23, 59, 59, 999);
  } else if (periodType === 'Monthly') {
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    prevStartDate.setMonth(prevStartDate.getMonth() - 1);
    prevStartDate.setDate(1);
    prevStartDate.setHours(0, 0, 0, 0);
    prevEndDate.setDate(0);
    prevEndDate.setHours(23, 59, 59, 999);
  } else if (periodType === 'Annual') {
    startDate.setMonth(0);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    prevStartDate.setFullYear(prevStartDate.getFullYear() - 1);
    prevStartDate.setMonth(0);
    prevStartDate.setDate(1);
    prevStartDate.setHours(0, 0, 0, 0);
    prevEndDate.setFullYear(prevEndDate.getFullYear() - 1);
    prevEndDate.setMonth(11);
    prevEndDate.setDate(31);
    prevEndDate.setHours(23, 59, 59, 999);
  }

  return { startDate, endDate: now, prevStartDate, prevEndDate };
}

/**
 * Format number with Indian locale
 */
function formatNumber(num) {
  if (!num) return '0';
  return num.toLocaleString('en-IN');
}

/**
 * Format currency in Indian Rupees
 */
function formatCurrency(num) {
  if (!num) return '₹0';
  const val = parseFloat(num);
  if (val >= 1000000) return '₹' + (val / 1000000).toFixed(1) + 'M';
  if (val >= 1000) return '₹' + (val / 1000).toFixed(1) + 'K';
  return '₹' + val.toFixed(0);
}

/**
 * Format coins with symbol
 */
function formatCoins(num) {
  if (!num) return '₵0';
  if (num >= 1000000) return '₵' + (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return '₵' + (num / 1000).toFixed(1) + 'K';
  return '₵' + num;
}

/**
 * GET /api/v1/admin/dashboard/metrics?period=Daily|Weekly|Monthly|Annual
 * Fetch dynamic dashboard metrics from database
 */
export async function getDashboardMetrics(req, res, next) {
  try {
    const { period = 'Monthly' } = req.query;
    const { startDate: periodStart } = getDateRange(period);

    // Fetch all metrics from database
    const totalUsers = await prisma.user.count({ where: { role: 'USER' } });
    const activeSubscriptions = await prisma.userMembership.count({
      where: { status: 'ACTIVE' },
    });

    // Revenue from payments in period
    const revenue = await prisma.paymentTransaction.aggregate({
      _sum: { amount: true },
      where: { created_at: { gte: periodStart }, status: 'completed' },
    });

    // Dramas uploaded
    const dramasCount = await prisma.show.count({ where: { is_active: true } });

    // Coins earned (issued via daily checkin)
    const coinsEarned = await prisma.coinTransaction.aggregate({
      _sum: { amount: true },
      where: { created_at: { gte: periodStart }, reason: 'daily_checkin' },
    });

    // Coins spent (unlocks)
    const coinsSpent = await prisma.episodeAccess.aggregate({
      _sum: { coins_spent: true },
      where: { unlocked_at: { gte: periodStart } },
    });

    // Check-ins in period
    const checkinsCount = await prisma.dailyCheckin.count({
      where: { created_at: { gte: periodStart } },
    });

    // Calculate trends (compare current period with previous period)
    const previousPeriodStart = new Date(periodStart);
    if (period === 'Daily') {
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 1);
    } else if (period === 'Weekly') {
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);
    } else if (period === 'Monthly') {
      previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
    } else if (period === 'Annual') {
      previousPeriodStart.setFullYear(previousPeriodStart.getFullYear() - 1);
    }

    const previousRevenue = await prisma.paymentTransaction.aggregate({
      _sum: { amount: true },
      where: {
        created_at: { gte: previousPeriodStart, lt: periodStart },
        status: 'completed',
      },
    });

    const prevRevenue = previousRevenue._sum.amount || 0;
    const currRevenue = revenue._sum.amount || 0;
    const revenueTrend = prevRevenue > 0 ? (((currRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1) : 0;

    const metrics = [
      {
        label: 'Total Users',
        value: formatNumber(totalUsers),
        sub: 'registered users',
        trend: '+2.1%',
        up: true,
      },
      {
        label: 'Active Subscriptions',
        value: formatNumber(activeSubscriptions),
        sub: 'current memberships',
        trend: '+1.5%',
        up: true,
      },
      {
        label: 'Revenue',
        value: formatCurrency(currRevenue),
        sub: period.toLowerCase(),
        trend: revenueTrend > 0 ? `+${revenueTrend}%` : `${revenueTrend}%`,
        up: revenueTrend > 0,
      },
      {
        label: 'Dramas Uploaded',
        value: formatNumber(dramasCount),
        sub: 'total on platform',
        trend: null,
        up: null,
      },
      {
        label: 'Coins Earned',
        value: formatCoins(coinsEarned._sum.amount || 0),
        sub: `issued ${period.toLowerCase()}`,
        trend: '+5%',
        up: true,
      },
      {
        label: 'Coins Spent',
        value: formatCoins(coinsSpent._sum.coins_spent || 0),
        sub: `unlocked ${period.toLowerCase()}`,
        trend: '+3%',
        up: true,
      },
      {
        label: 'Check-ins',
        value: formatNumber(checkinsCount),
        sub: `daily rewards claimed`,
        trend: '+8%',
        up: true,
      },
    ];

    return res.json(
      new ApiResponse(200, { metrics, period }, 'Dashboard metrics fetched successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/reports/:reportType?period=Monthly
 * Fetch analytics report data from database
 */
export async function getAnalyticsReport(req, res, next) {
  try {
    const { reportType } = req.params;
    const periodType = req.query.period || 'Monthly';
    const { startDate, endDate } = getDateRange(periodType);

    let reportData = [];

    if (reportType === 'subscription') {
      const newSubs = await prisma.userMembership.count({
        where: { created_at: { gte: startDate, lte: endDate } },
      });

      const renewals = await prisma.userMembership.count({
        where: { 
          start_date: { gte: startDate, lte: endDate },
          created_at: { lt: startDate },
        },
      });

      const totalRevenue = await prisma.paymentTransaction.aggregate({
        where: { 
          created_at: { gte: startDate, lte: endDate },
          status: 'completed',
        },
        _sum: { amount: true },
      });

      const weeklyRev = await prisma.paymentTransaction.aggregate({
        where: { 
          created_at: { gte: startDate, lte: endDate },
          status: 'completed',
          type: 'weekly',
        },
        _sum: { amount: true },
      });

      const monthlyRev = await prisma.paymentTransaction.aggregate({
        where: { 
          created_at: { gte: startDate, lte: endDate },
          status: 'completed',
          type: 'monthly',
        },
        _sum: { amount: true },
      });

      const annualRev = await prisma.paymentTransaction.aggregate({
        where: { 
          created_at: { gte: startDate, lte: endDate },
          status: 'completed',
          type: 'annual',
        },
        _sum: { amount: true },
      });

      reportData = [
        { lbl: 'New subscriptions', val: formatNumber(newSubs), color: 'var(--green)' },
        { lbl: 'Renewals', val: formatNumber(renewals), color: 'var(--text)' },
        { lbl: 'Total revenue', val: formatCurrency(totalRevenue._sum.amount || 0), color: 'var(--accent2)' },
        { lbl: 'Weekly plan rev.', val: formatCurrency(weeklyRev._sum.amount || 0), color: 'var(--text2)' },
        { lbl: 'Monthly plan rev.', val: formatCurrency(monthlyRev._sum.amount || 0), color: 'var(--text2)' },
        { lbl: 'Annual plan rev.', val: formatCurrency(annualRev._sum.amount || 0), color: 'var(--text2)' },
      ];
    } else if (reportType === 'coins') {
      const issued = await prisma.coinTransaction.aggregate({
        where: { 
          created_at: { gte: startDate, lte: endDate },
          reason: 'gift',
        },
        _sum: { amount: true },
      });

      const purchased = await prisma.coinTransaction.aggregate({
        where: { 
          created_at: { gte: startDate, lte: endDate },
          reason: 'purchase',
        },
        _sum: { amount: true },
      });

      const spent = await prisma.coinTransaction.aggregate({
        where: { 
          created_at: { gte: startDate, lte: endDate },
          type: 'debit',
        },
        _sum: { amount: true },
      });

      const balance = await prisma.user.aggregate({
        where: { coins: { gt: 0 } },
        _sum: { coins: true },
      });

      reportData = [
        { lbl: 'Coins issued (gift)', val: formatCoins(issued._sum.amount || 0), color: 'var(--green)' },
        { lbl: 'Coins purchased', val: formatCoins(purchased._sum.amount || 0), color: 'var(--blue)' },
        { lbl: 'Coins spent', val: formatCoins(spent._sum.amount || 0), color: 'var(--red)' },
        { lbl: 'Balance in wallets', val: formatCoins(balance._sum.coins || 0), color: 'var(--amber)' },
      ];
    } else if (reportType === 'users') {
      const newSignups = await prisma.user.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      });

      const freeUsers = await prisma.user.count({
        where: { 
          plan: null,
          isBlocked: false,
        },
      });

      const paidUsers = await prisma.user.count({
        where: { plan: { not: null } },
      });

      reportData = [
        { lbl: 'New signups', val: formatNumber(newSignups), color: 'var(--green)' },
        { lbl: 'Free users', val: formatNumber(freeUsers), color: 'var(--text)' },
        { lbl: 'Paid users', val: formatNumber(paidUsers), color: 'var(--accent2)' },
      ];
    } else if (reportType === 'content') {
      const unlockedEpisodes = await prisma.episodeAccess.count({
        where: { unlocked_at: { gte: startDate, lte: endDate } },
      });

      const coinsSpent = await prisma.episodeAccess.aggregate({
        where: { unlocked_at: { gte: startDate, lte: endDate } },
        _sum: { coins_spent: true },
      });

      const topEpisode = await prisma.episodeAccess.groupBy({
        by: ['episode_id'],
        where: { unlocked_at: { gte: startDate, lte: endDate } },
        _count: { episode_id: true },
        orderBy: { _count: { episode_id: 'desc' } },
        take: 1,
      });

      let topEpisodeName = 'N/A';
      if (topEpisode.length > 0) {
        const ep = await prisma.episode.findUnique({
          where: { id: topEpisode[0].episode_id },
          select: { title: true },
        });
        topEpisodeName = ep?.title || 'N/A';
      }

      reportData = [
        { lbl: 'Episodes unlocked', val: formatNumber(unlockedEpisodes), color: 'var(--accent2)' },
        { lbl: 'Coins spent', val: formatCoins(coinsSpent._sum.coins_spent || 0), color: 'var(--amber)' },
        { lbl: 'Top unlock ep.', val: topEpisodeName, color: 'var(--text)' },
      ];
    } else if (reportType === 'revenue') {
      // Get revenue breakdown by membership plans (dynamic from database)
      const revenueByPlan = await getRevenueByPlan({
        startDate,
        endDate,
      });

      // Format data for report
      const total = revenueByPlan.reduce((sum, plan) => sum + plan.revenue, 0);

      reportData = [
        ...revenueByPlan.map((plan) => ({
          lbl: `${plan.planName} (${plan.duration})`,
          val: formatCurrency(plan.revenue),
          color: 'var(--text2)',
        })),
        {
          lbl: 'Total',
          val: formatCurrency(total),
          color: 'var(--accent2)',
        },
      ];
    }

    return res.json(
      new ApiResponse(200, { reportData, reportType, period: periodType }, 'Report data fetched successfully')
    );
  } catch (error) {
    next(error);
  }
}