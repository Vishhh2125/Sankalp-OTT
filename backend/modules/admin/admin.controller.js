import { prisma } from '../../prisma/client.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { AppError } from '../../middleware/error.middleware.js';

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
        title: title?.trim() ?? existing.title,
        show_id: resolvedShowId,
        image_url,
        is_active: is_active !== undefined ? Boolean(is_active) : existing.is_active,
        starts_at: starts_at !== undefined ? (starts_at ? new Date(starts_at) : null) : existing.starts_at,
        ends_at: ends_at !== undefined ? (ends_at ? new Date(ends_at) : null) : existing.ends_at,
      },
      include: { show: { select: { id: true, title: true } } },
    });

    return res.json(
      new ApiResponse(200, {
        id: updated.id,
        title: updated.title,
        image_url: updated.image_url,
        show_id: updated.show_id,
        show_name: updated.show?.title || null,
        is_active: updated.is_active,
        starts_at: updated.starts_at ? updated.starts_at.toISOString().split('T')[0] : null,
        ends_at: updated.ends_at ? updated.ends_at.toISOString().split('T')[0] : null,
      }, 'Banner updated successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/admin/banners/:id
 */
export async function deleteBanner(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new AppError('Banner not found', 404);

    await prisma.banner.delete({ where: { id } });

    return res.json(new ApiResponse(200, { id }, 'Banner deleted successfully'));
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/admin/banners/:id/toggle
 * Toggle is_active
 */
export async function toggleBanner(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new AppError('Banner not found', 404);

    const updated = await prisma.banner.update({
      where: { id },
      data: { is_active: !existing.is_active },
    });

    return res.json(
      new ApiResponse(200, { id: updated.id, is_active: updated.is_active }, 'Banner status toggled')
    );
  } catch (error) {
    next(error);
  }
}