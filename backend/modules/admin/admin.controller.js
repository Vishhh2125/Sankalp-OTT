import { prisma } from '../../prisma/client.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { AppError } from '../../middleware/error.middleware.js';
import { getRevenueByPlan } from '../membership/membership.service.js';
import { activeMembershipWhere, membershipPlanInclude } from '../membership/membership.helpers.js';
import { logAdminActivity } from '../../utils/adminActivity.js';
import { displayedViewCount } from '../user/view-count.service.js';
import { hashPassword } from '../auth/auth.service.js';
import { sendTeacherCredentialsEmail, sendStudentCredentialsEmail } from '../../config/email.js';
import crypto from 'crypto';
import { fetchAccountDeletions, exportAccountDeletionsCSV } from './admin-deletions.service.js';

// --- Teacher management & approvals ---
export async function listTeachers(req, res, next) {
  try {
    const teachers = await prisma.user.findMany({
      where: { role: 'TEACHER' },
      include: { teacherProfile: true },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(new ApiResponse(200, { teachers }, 'Teachers fetched'));
  } catch (err) { next(err); }
}

export async function createTeacher(req, res, next) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email) throw new AppError('Missing fields', 400);
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    
    let user;
    const temporaryPassword = password?.trim() || crypto.randomBytes(8).toString('hex');
    const passwordHash = await hashPassword(temporaryPassword);

    if (existing) {
      if (existing.role === 'TEACHER') {
        throw new AppError('Email already registered', 409);
      }
      
      // Promote existing user to TEACHER
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: name.trim(),
          password: passwordHash,
          role: 'TEACHER',
          plan: null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isBlocked: true,
          createdAt: true,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password: passwordHash,
          role: 'TEACHER',
          plan: null,
          coins: 0,
          isBlocked: false,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isBlocked: true,
          createdAt: true,
        },
      });
    }

    try {
      await sendTeacherCredentialsEmail(user.email, user.name, temporaryPassword);
    } catch (emailError) {
      // The account is still usable even if email delivery is unavailable.
      console.error('Failed to send teacher credentials email', emailError);
    }

    await logAdminActivity({ userId: req.user.id, action: `Created teacher ${user.name}`, entityType: 'Roles', entityId: user.id });
    return res.status(201).json(new ApiResponse(201, { ...user, temporaryPassword }, 'Teacher created'));
  } catch (err) { next(err); }
}

export async function patchTeacherStatus(req, res, next) {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError('Teacher not found', 404);
    if (user.role !== 'TEACHER') throw new AppError('User is not a teacher', 400);
    const updated = await prisma.user.update({ where: { id }, data: { isBlocked: !user.isBlocked } });
    await logAdminActivity({ userId: req.user.id, action: `Updated teacher status ${updated.name}`, entityType: 'Roles', entityId: id });
    return res.json(new ApiResponse(200, { id: updated.id, isBlocked: updated.isBlocked }, 'Teacher status updated'));
  } catch (err) { next(err); }
}

export async function getTeacherProfileAdmin(req, res, next) {
  try {
    const { id } = req.params;
    const profile = await prisma.teacherProfile.findUnique({ where: { user_id: id } });
    if (!profile) return res.json(new ApiResponse(200, null, 'No profile'));
    return res.json(new ApiResponse(200, profile, 'Profile fetched'));
  } catch (err) { next(err); }
}

export async function putTeacherProfileAdmin(req, res, next) {
  try {
    const { id } = req.params; // teacher user id
    const data = req.body;
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) throw new AppError('User not found', 404);
    const upsert = await prisma.teacherProfile.upsert({ where: { user_id: id }, update: { ...data, is_completed: data.is_completed ?? false }, create: { ...data, user_id: id } });
    await logAdminActivity({ userId: req.user.id, action: `Updated teacher profile ${id}`, entityType: 'TeacherProfile', entityId: id });
    return res.json(new ApiResponse(200, upsert, 'Teacher profile saved'));
  } catch (err) { next(err); }
}

export async function listApprovals(req, res, next) {
  try {
    const [pendingShows, pendingEpisodes, rejectedShows, rejectedEpisodes] = await Promise.all([
      prisma.show.findMany({
        where: { approval_status: 'PENDING_REVIEW' },
        include: { teacher: { select: { id: true, name: true } } },
        orderBy: { created_at: 'desc' },
      }),
      prisma.episode.findMany({
        where: { approval_status: 'PENDING_REVIEW' },
        include: {
          show: {
            select: {
              id: true,
              title: true,
              teacher: { select: { id: true, name: true } }
            }
          }
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.show.findMany({
        where: { approval_status: 'REJECTED' },
        include: { teacher: { select: { id: true, name: true } } },
        orderBy: { created_at: 'desc' },
      }),
      prisma.episode.findMany({
        where: { approval_status: 'REJECTED' },
        include: {
          show: {
            select: {
              id: true,
              title: true,
              teacher: { select: { id: true, name: true } }
            }
          }
        },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return res.json(new ApiResponse(200, {
      shows: pendingShows,
      episodes: pendingEpisodes,
      rejectedShows,
      rejectedEpisodes,
    }, 'Approvals fetched'));
  } catch (err) { next(err); }
}

export async function approveShow(req, res, next) {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'approve' or 'reject'
    const show = await prisma.show.findUnique({ where: { id } });
    if (!show) throw new AppError('Show not found', 404);
    if (action === 'approve') {
      const updated = await prisma.show.update({ where: { id }, data: { approval_status: 'PUBLISHED', is_active: true } });
      await logAdminActivity({ userId: req.user.id, action: `Approved show ${updated.title}`, entityType: 'Approvals', entityId: id });
      return res.json(new ApiResponse(200, updated, 'Show approved'));
    }
    if (action === 'reject') {
      const updated = await prisma.show.update({ where: { id }, data: { approval_status: 'REJECTED', is_active: false } });
      await logAdminActivity({ userId: req.user.id, action: `Rejected show ${updated.title}`, entityType: 'Approvals', entityId: id });
      return res.json(new ApiResponse(200, updated, 'Show rejected'));
    }
    throw new AppError('Invalid action', 400);
  } catch (err) { next(err); }
}

export async function approveEpisode(req, res, next) {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const ep = await prisma.episode.findUnique({ where: { id }, include: { show: true } });
    if (!ep) throw new AppError('Episode not found', 404);
    if (action === 'approve') {
      const updated = await prisma.episode.update({ where: { id }, data: { approval_status: 'PUBLISHED' } });
      await logAdminActivity({ userId: req.user.id, action: `Approved episode ${ep.title}`, entityType: 'Approvals', entityId: id });
      return res.json(new ApiResponse(200, updated, 'Episode approved'));
    }
    if (action === 'reject') {
      const updated = await prisma.episode.update({ where: { id }, data: { approval_status: 'REJECTED' } });
      await logAdminActivity({ userId: req.user.id, action: `Rejected episode ${ep.title}`, entityType: 'Approvals', entityId: id });
      return res.json(new ApiResponse(200, updated, 'Episode rejected'));
    }
    throw new AppError('Invalid action', 400);
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/admin/users
 * Fetch all users with their details (coins, status, membership expiry)
 * Admin only
 */
export async function getAllUsers(req, res, next) {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [users, recentCheckins, recentWatchHistory] = await Promise.all([
      prisma.user.findMany({
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
            where: activeMembershipWhere(),
            orderBy: { end_date: 'desc' },
            take: 1,
            select: { end_date: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Users who checked in within last 7 days
      prisma.dailyCheckin.findMany({
        where: { created_at: { gte: sevenDaysAgo } },
        select: { user_id: true },
        distinct: ['user_id'],
      }),
      // Users who watched something within last 7 days
      prisma.watchHistory.findMany({
        where: { last_watched: { gte: sevenDaysAgo } },
        select: { user_id: true },
        distinct: ['user_id'],
      }),
    ]);

    // Build a Set of user IDs active in last 7 days
    const activeUserIds = new Set([
      ...recentCheckins.map(c => c.user_id),
      ...recentWatchHistory.map(w => w.user_id),
    ]);

    // Format response for frontend
    const formattedUsers = users.map(u => {
      let status;
      if (u.isBlocked) {
        status = 'Blocked';
      } else if (activeUserIds.has(u.id)) {
        status = 'Active';
      } else {
        status = 'Inactive';
      }

      return {
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
        status,
        subscription: u.memberships.length > 0
          ? (u.memberships[0].end_date
              ? new Date(u.memberships[0].end_date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : 'Lifetime')
          : '—',
      };
    });

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
      balanceInWallets: totalInCirculation.toLocaleString('en-IN'),
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
        starts_at: starts_at ? new Date(starts_at) : null,
        ends_at: ends_at ? new Date(ends_at) : null,
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
        starts_at: updated.starts_at ? updated.starts_at.toISOString().split('T')[0] : null,
        ends_at: updated.ends_at ? updated.ends_at.toISOString().split('T')[0] : null,
      }, 'Banner updated successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/admin/banners/:id/toggle
 * Toggle a banner's is_active status
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

    await prisma.adminActivityLog.create({
      data: {
        user_id: req.user.id,
        action: updated.is_active ? 'BANNER_ACTIVATED' : 'BANNER_DEACTIVATED',
        entity_type: 'BANNER',
        entity_id: id,
        details: JSON.stringify({ title: existing.title, is_active: updated.is_active }),
      },
    }).catch(() => {}); // non-fatal

    return res.json(
      new ApiResponse(200, { id: updated.id, is_active: updated.is_active }, 'Banner toggled successfully')
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

// ─────────────────────────────────────────────────────────────────
// HERO BANNER CRUD (home page slider)
// ─────────────────────────────────────────────────────────────────

function formatHeroBanner(b) {
  return {
    id: b.id,
    title: b.title,
    image_url: b.image_url,
    show_id: b.show_id,
    show_name: b.show?.title || null,
    display_order: b.display_order,
    is_active: b.is_active,
    starts_at: b.starts_at ? b.starts_at.toISOString().split('T')[0] : null,
    ends_at: b.ends_at ? b.ends_at.toISOString().split('T')[0] : null,
    created_at: b.created_at,
  };
}

export async function getHeroBanners(req, res, next) {
  try {
    const banners = await prisma.heroBanner.findMany({
      orderBy: [{ display_order: 'asc' }, { created_at: 'asc' }],
      include: { show: { select: { id: true, title: true, banner_url: true } } },
    });
    return res.json(new ApiResponse(200, { banners: banners.map(formatHeroBanner) }, 'Hero banners fetched'));
  } catch (error) {
    next(error);
  }
}

export async function createHeroBanner(req, res, next) {
  try {
    const { title, show_id, is_active = true, starts_at, ends_at, display_order } = req.body;
    if (!title?.trim()) throw new AppError('Title is required', 400);
    if (!show_id) throw new AppError('A linked show is required', 400);

    const show = await prisma.show.findUnique({
      where: { id: show_id },
      select: { id: true, title: true, banner_url: true },
    });
    if (!show) throw new AppError('Linked show not found', 404);
    if (!show.banner_url) throw new AppError('The selected show has no banner image uploaded yet', 400);

    let order = Number.isFinite(Number(display_order)) ? Number(display_order) : null;
    if (order == null) {
      const max = await prisma.heroBanner.aggregate({ _max: { display_order: true } });
      order = (max._max.display_order ?? 0) + 1;
    }

    const banner = await prisma.heroBanner.create({
      data: {
        title: title.trim(),
        show_id,
        image_url: show.banner_url,
        display_order: order,
        is_active: Boolean(is_active),
        starts_at: starts_at ? new Date(starts_at) : null,
        ends_at: ends_at ? new Date(ends_at) : null,
      },
      include: { show: { select: { id: true, title: true, banner_url: true } } },
    });

    return res.status(201).json(new ApiResponse(201, formatHeroBanner(banner), 'Hero banner created'));
  } catch (error) {
    next(error);
  }
}

export async function updateHeroBanner(req, res, next) {
  try {
    const { id } = req.params;
    const { title, show_id, is_active, starts_at, ends_at, display_order } = req.body;

    const existing = await prisma.heroBanner.findUnique({ where: { id } });
    if (!existing) throw new AppError('Hero banner not found', 404);

    const data = {};
    if (title !== undefined) data.title = String(title).trim();
    if (is_active !== undefined) data.is_active = Boolean(is_active);
    if (starts_at !== undefined) data.starts_at = starts_at ? new Date(starts_at) : null;
    if (ends_at !== undefined) data.ends_at = ends_at ? new Date(ends_at) : null;
    if (display_order !== undefined) data.display_order = Number(display_order);

    if (show_id !== undefined) {
      const show = await prisma.show.findUnique({
        where: { id: show_id },
        select: { id: true, title: true, banner_url: true },
      });
      if (!show) throw new AppError('Linked show not found', 404);
      if (!show.banner_url) throw new AppError('The selected show has no banner image uploaded yet', 400);
      data.show_id = show_id;
      data.image_url = show.banner_url;
    }

    const updated = await prisma.heroBanner.update({
      where: { id },
      data,
      include: { show: { select: { id: true, title: true, banner_url: true } } },
    });

    return res.json(new ApiResponse(200, formatHeroBanner(updated), 'Hero banner updated'));
  } catch (error) {
    next(error);
  }
}

export async function toggleHeroBanner(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await prisma.heroBanner.findUnique({ where: { id } });
    if (!existing) throw new AppError('Hero banner not found', 404);

    const updated = await prisma.heroBanner.update({
      where: { id },
      data: { is_active: !existing.is_active },
    });

    return res.json(new ApiResponse(200, { id: updated.id, is_active: updated.is_active }, 'Hero banner toggled'));
  } catch (error) {
    next(error);
  }
}

export async function reorderHeroBanners(req, res, next) {
  try {
    const { ordered_ids: orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      throw new AppError('ordered_ids array is required', 400);
    }

    await prisma.$transaction(
      orderedIds.map((bannerId, index) =>
        prisma.heroBanner.update({
          where: { id: bannerId },
          data: { display_order: index + 1 },
        })
      )
    );

    const banners = await prisma.heroBanner.findMany({
      orderBy: [{ display_order: 'asc' }, { created_at: 'asc' }],
      include: { show: { select: { id: true, title: true, banner_url: true } } },
    });

    return res.json(new ApiResponse(200, { banners: banners.map(formatHeroBanner) }, 'Hero banners reordered'));
  } catch (error) {
    next(error);
  }
}

export async function deleteHeroBanner(req, res, next) {
  try {
    const { id } = req.params;
    const banner = await prisma.heroBanner.findUnique({ where: { id } });
    if (!banner) throw new AppError('Hero banner not found', 404);

    await prisma.heroBanner.delete({ where: { id } });
    return res.json(new ApiResponse(200, {}, 'Hero banner deleted'));
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

  if (periodType === 'All') {
    startDate = new Date(0); // epoch — fetches all-time data
    prevStartDate = new Date(0);
    prevEndDate = new Date(0);
  } else if (periodType === 'Daily') {
    startDate.setHours(0, 0, 0, 0);
    prevStartDate.setDate(prevStartDate.getDate() - 1);
    prevStartDate.setHours(0, 0, 0, 0);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    prevEndDate.setHours(23, 59, 59, 999);
  } else if (periodType === 'Weekly') {
    // Start from Monday of the current week
    const day = startDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const diffToMonday = day === 0 ? -6 : 1 - day;
    startDate.setDate(startDate.getDate() + diffToMonday);
    startDate.setHours(0, 0, 0, 0);
    // Previous week: Monday to Sunday
    prevStartDate.setDate(prevStartDate.getDate() + diffToMonday - 7);
    prevStartDate.setHours(0, 0, 0, 0);
    prevEndDate.setDate(prevEndDate.getDate() + diffToMonday - 1);
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
  return '₹' + val.toLocaleString('en-IN');
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

    if (req.admin && req.admin.role === 'TEACHER') {
      const periodLabel = period === 'All' ? 'all time' : period.toLowerCase();
      const teacherId = req.admin.id;

      // 1. Total Shows
      const dramasCount = await prisma.show.count({
        where: { teacher_id: teacherId }
      });

      // 2. Total Episodes
      const episodesCount = await prisma.episode.count({
        where: { show: { teacher_id: teacherId } }
      });

      // 3. Live Sessions
      const liveCount = await prisma.liveStream.count({
        where: { created_by: teacherId }
      });

      // 4. Student Submissions pending grade
      const pendingSubmissions = await prisma.assignmentSubmission.count({
        where: { status: 'SUBMITTED', assignment: { show: { teacher_id: teacherId } } }
      });

      // 5. Graded Submissions
      const gradedSubmissions = await prisma.assignmentSubmission.count({
        where: { status: 'GRADED', assignment: { show: { teacher_id: teacherId } } }
      });

      // 6. Total Coins Earned (unlocked episodes of their shows)
      const coinsAggregate = await prisma.episodeAccess.aggregate({
        _sum: { coins_spent: true },
        where: { unlocked_at: { gte: periodStart }, episode: { show: { teacher_id: teacherId } } }
      });
      const coinsEarned = coinsAggregate._sum.coins_spent || 0;

      // 7. Total Views on their dramas
      const viewsAggregate = await prisma.show.aggregate({
        _sum: { view_count: true, manual_view_count: true },
        where: { teacher_id: teacherId }
      });
      const totalViews = (viewsAggregate._sum.view_count || 0) + (viewsAggregate._sum.manual_view_count || 0);

      const metrics = [
        {
          label: 'Total Dramas',
          value: formatNumber(dramasCount),
          sub: 'your courses',
          trend: null,
          up: null
        },
        {
          label: 'Total Lectures',
          value: formatNumber(episodesCount),
          sub: 'uploaded videos',
          trend: null,
          up: null
        },
        {
          label: 'Live Streams',
          value: formatNumber(liveCount),
          sub: 'scheduled/run',
          trend: null,
          up: null
        },
        {
          label: 'Pending Submissions',
          value: formatNumber(pendingSubmissions),
          sub: 'awaiting grading',
          trend: null,
          up: null
        },
        {
          label: 'Graded Submissions',
          value: formatNumber(gradedSubmissions),
          sub: 'graded coursework',
          trend: null,
          up: null
        },
        {
          label: 'Coins Earned',
          value: formatCoins(coinsEarned),
          sub: `from content ${periodLabel}`,
          trend: null,
          up: null
        },
        {
          label: 'Course Views',
          value: formatNumber(totalViews),
          sub: 'total aggregate views',
          trend: null,
          up: null
        }
      ];

      return res.json(
        new ApiResponse(200, { metrics, period }, 'Teacher dashboard metrics fetched successfully')
      );
    }

    // Fetch all metrics from database
    const totalUsers = await prisma.user.count({ where: { role: 'USER' } });
    const activeSubscriptions = await prisma.userMembership.count({
      where: { status: 'ACTIVE' },
    });

    // Total revenue from all payments in period
    const revenue = await prisma.paymentTransaction.aggregate({
      _sum: { amount: true },
      where: { created_at: { gte: periodStart }, status: 'completed' },
    });

    // Membership revenue (type = 'membership')
    const membershipRevenue = await prisma.paymentTransaction.aggregate({
      _sum: { amount: true },
      where: { created_at: { gte: periodStart }, status: 'completed', type: 'membership' },
    });

    // Top-up revenue (type = 'topup')
    const topupRevenue = await prisma.paymentTransaction.aggregate({
      _sum: { amount: true },
      where: { created_at: { gte: periodStart }, status: 'completed', type: 'topup' },
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
    // For 'All', trends are not applicable
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

    let prevRevenue = 0, prevMembershipRevenue = 0, prevTopupRevenue = 0;

    if (period !== 'All') {
      const previousMembershipRevenueResult = await prisma.paymentTransaction.aggregate({
        _sum: { amount: true },
        where: {
          created_at: { gte: previousPeriodStart, lt: periodStart },
          status: 'completed',
          type: 'membership',
        },
      });

      const previousTopupRevenueResult = await prisma.paymentTransaction.aggregate({
        _sum: { amount: true },
        where: {
          created_at: { gte: previousPeriodStart, lt: periodStart },
          status: 'completed',
          type: 'topup',
        },
      });

      const previousRevenueResult = await prisma.paymentTransaction.aggregate({
        _sum: { amount: true },
        where: {
          created_at: { gte: previousPeriodStart, lt: periodStart },
          status: 'completed',
        },
      });

      prevRevenue = previousRevenueResult._sum.amount || 0;
      prevMembershipRevenue = previousMembershipRevenueResult._sum.amount || 0;
      prevTopupRevenue = previousTopupRevenueResult._sum.amount || 0;
    }

    const currRevenue = revenue._sum.amount || 0;
    const revenueTrend = prevRevenue > 0 ? (((currRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1) : null;

    const currMembershipRevenue = membershipRevenue._sum.amount || 0;
    const membershipRevenueTrend = prevMembershipRevenue > 0
      ? (((currMembershipRevenue - prevMembershipRevenue) / prevMembershipRevenue) * 100).toFixed(1)
      : null;

    const currTopupRevenue = topupRevenue._sum.amount || 0;
    const topupRevenueTrend = prevTopupRevenue > 0
      ? (((currTopupRevenue - prevTopupRevenue) / prevTopupRevenue) * 100).toFixed(1)
      : null;

    const periodLabel = period === 'All' ? 'all time' : period.toLowerCase();

    const metrics = [
      // Row 1 — Revenue cards
      {
        label: 'Total Revenue',
        value: formatCurrency(currRevenue),
        sub: periodLabel,
        trend: revenueTrend !== null ? (revenueTrend > 0 ? `+${revenueTrend}%` : `${revenueTrend}%`) : null,
        up: revenueTrend !== null ? revenueTrend > 0 : null,
      },
      {
        label: 'Membership Revenue',
        value: formatCurrency(currMembershipRevenue),
        sub: `memberships ${periodLabel}`,
        trend: membershipRevenueTrend !== null ? (membershipRevenueTrend > 0 ? `+${membershipRevenueTrend}%` : `${membershipRevenueTrend}%`) : null,
        up: membershipRevenueTrend !== null ? membershipRevenueTrend > 0 : null,
      },
      {
        label: 'Top-Up Revenue',
        value: formatCurrency(currTopupRevenue),
        sub: `top-ups ${periodLabel}`,
        trend: topupRevenueTrend !== null ? (topupRevenueTrend > 0 ? `+${topupRevenueTrend}%` : `${topupRevenueTrend}%`) : null,
        up: topupRevenueTrend !== null ? topupRevenueTrend > 0 : null,
      },
      // Row 2+ — Remaining cards
      {
        label: 'Total Users',
        value: formatNumber(totalUsers),
        sub: 'registered users',
        trend: period !== 'All' ? '+2.1%' : null,
        up: period !== 'All' ? true : null,
      },
      {
        label: 'Active Subscriptions',
        value: formatNumber(activeSubscriptions),
        sub: 'current memberships',
        trend: period !== 'All' ? '+1.5%' : null,
        up: period !== 'All' ? true : null,
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
        sub: `issued ${periodLabel}`,
        trend: period !== 'All' ? '+5%' : null,
        up: period !== 'All' ? true : null,
      },
      {
        label: 'Coins Spent',
        value: formatCoins(coinsSpent._sum.coins_spent || 0),
        sub: `unlocked ${periodLabel}`,
        trend: period !== 'All' ? '+3%' : null,
        up: period !== 'All' ? true : null,
      },
      {
        label: 'Check-ins',
        value: formatNumber(checkinsCount),
        sub: `daily rewards claimed`,
        trend: period !== 'All' ? '+8%' : null,
        up: period !== 'All' ? true : null,
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
      // New subscriptions: memberships created within the period
      const newSubs = await prisma.userMembership.count({
        where: { created_at: { gte: startDate, lte: endDate } },
      });

      // Renewals — derived from the purchase flow behaviour:
      // When a user re-purchases, simulateMembershipPurchase:
      //   1. Sets the old ACTIVE row to EXPIRED (same transaction)
      //   2. Creates a new ACTIVE row (created_at is a few seconds later)
      // So a renewal = a membership created in this period where the same user
      // already has an EXPIRED row with a strictly earlier created_at.
      // This works even when first-sub and renewal both fall within the same period.
      const periodRows = await prisma.userMembership.findMany({
        where: { created_at: { gte: startDate, lte: endDate } },
        select: { id: true, user_id: true, created_at: true },
        orderBy: { created_at: 'asc' },
      });

      let renewals = 0;
      if (periodRows.length > 0) {
        const uniqueUserIds = [...new Set(periodRows.map(r => r.user_id))];

        // For each unique user, find their earliest EXPIRED row
        const expiredEarliestMap = {};
        await Promise.all(
          uniqueUserIds.map(async (uid) => {
            const earliest = await prisma.userMembership.findFirst({
              where: { user_id: uid, status: 'EXPIRED' },
              orderBy: { created_at: 'asc' },
              select: { created_at: true },
            });
            expiredEarliestMap[uid] = earliest?.created_at ?? null;
          })
        );

        // A row is a renewal if the user has an EXPIRED row created before
        // this row's own created_at — covers both cross-period and same-period renewals
        renewals = periodRows.filter(row => {
          const earliestExpired = expiredEarliestMap[row.user_id];
          return earliestExpired !== null && earliestExpired < row.created_at;
        }).length;
      }

      // Total membership revenue in period
      const totalRevenue = await prisma.paymentTransaction.aggregate({
        where: { 
          created_at: { gte: startDate, lte: endDate },
          status: 'completed',
          type: 'membership',
        },
        _sum: { amount: true },
      });

      const totalRevenueVal = parseFloat(totalRevenue._sum.amount || 0);

      // Avg revenue per subscriber (ARPU) — total membership rev ÷ new subs in period
      const arpu = newSubs > 0 ? totalRevenueVal / newSubs : 0;

      // Active memberships snapshot (current, not period-scoped — a live health number)
      const activeMemberships = await prisma.userMembership.count({
        where: activeMembershipWhere(),
      });

      reportData = [
        { lbl: 'New subscriptions', val: formatNumber(newSubs), color: 'var(--green)' },
        { lbl: 'Renewals', val: formatNumber(renewals), color: 'var(--text)' },
        { lbl: 'Total revenue', val: formatCurrency(totalRevenueVal), color: 'var(--accent2)' },
        { lbl: 'Avg. revenue per subscriber', val: formatCurrency(arpu), color: 'var(--text2)' },
        { lbl: 'Active memberships', val: formatNumber(activeMemberships), color: 'var(--text2)' },
      ];
    } else if (reportType === 'coins') {
      // Coins issued via daily check-in rewards in this period
      // reason = 'daily_checkin' (set by daily-checkin.service.js)
      const issued = await prisma.coinTransaction.aggregate({
        where: {
          created_at: { gte: startDate, lte: endDate },
          reason: 'daily_checkin',
        },
        _sum: { amount: true },
      });

      // Coins purchased via wallet top-up in this period
      // reason = 'wallet_topup_simulated' (set by user.router.js topup flow)
      const purchased = await prisma.coinTransaction.aggregate({
        where: {
          created_at: { gte: startDate, lte: endDate },
          reason: 'wallet_topup_simulated',
        },
        _sum: { amount: true },
      });

      // Coins spent on episode unlocks in this period
      // Source of truth: episodeAccess.coins_spent (same as dashboard)
      // Avoids double-counting manual admin debits that also write coinTransaction rows
      const spent = await prisma.episodeAccess.aggregate({
        where: { unlocked_at: { gte: startDate, lte: endDate } },
        _sum: { coins_spent: true },
      });

      // Balance in wallets: current snapshot of all user coin balances
      // Not period-scoped by design — it reflects the live state right now
      const balance = await prisma.user.aggregate({
        _sum: { coins: true },
      });

      reportData = [
        { lbl: 'Coins issued (daily rewards)', val: formatCoins(issued._sum.amount || 0), color: 'var(--green)' },
        { lbl: 'Coins purchased (top-ups)', val: formatCoins(purchased._sum.amount || 0), color: 'var(--blue)' },
        { lbl: 'Coins spent (unlocks)', val: formatCoins(spent._sum.coins_spent || 0), color: 'var(--red)' },
        { lbl: 'Balance in wallets (live)', val: formatCoins(balance._sum.coins || 0), color: 'var(--amber)' },
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
          select: {
            episode_num: true,
            title: true,
            show: { select: { title: true } },
          },
        });
        if (ep) {
          const showTitle = ep.show?.title || 'Unknown';
          topEpisodeName = showTitle + ' · Ep.' + ep.episode_num;
        }
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

/**
 * GET /api/v1/admin/dashboard/revenue-chart?period=Daily|Weekly|Monthly|Annual|All
 * Returns revenue grouped by day (Daily/Weekly/Monthly), month (Annual), or year (All)
 */
export async function getRevenueChart(req, res, next) {
  try {
    const { period = 'Daily' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    if (req.admin && req.admin.role === 'TEACHER') {
      const teacherId = req.admin.id;
      // Fetch all episode access unlocks for the teacher's shows in the date range
      const unlocks = await prisma.episodeAccess.findMany({
        where: {
          unlocked_at: { gte: startDate, lte: endDate },
          episode: { show: { teacher_id: teacherId } }
        },
        select: { unlocked_at: true, coins_spent: true },
        orderBy: { unlocked_at: 'asc' },
      });

      let chartData;

      if (period === 'Annual') {
        const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const monthMap = {};
        const now2 = new Date();
        const year = now2.getFullYear();
        const currentMonth = now2.getMonth();
        for (let m = 0; m <= currentMonth; m++) {
          const key = `${year}-${String(m + 1).padStart(2, '0')}`;
          monthMap[key] = { date: key, label: MONTH_NAMES[m], total: 0, membership: 0, topup: 0 };
        }
        for (const ul of unlocks) {
          const d = new Date(ul.unlocked_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!monthMap[key]) continue;
          monthMap[key].total += ul.coins_spent;
          monthMap[key].topup += ul.coins_spent;
        }
        const todayDay = now2.getDate();
        const currentMonthKey = `${year}-${String(currentMonth + 1).padStart(2, '0')}`;
        chartData = Object.values(monthMap).map(d => ({
          date: d.date,
          label: d.date === currentMonthKey ? `${d.label} ${todayDay}` : d.label,
          total: d.total,
          membership: 0,
          topup: d.topup,
        }));
      } else if (period === 'All') {
        const yearMap = {};
        for (const ul of unlocks) {
          const year = String(new Date(ul.unlocked_at).getFullYear());
          if (!yearMap[year]) yearMap[year] = { date: year, label: year, total: 0, membership: 0, topup: 0 };
          yearMap[year].total += ul.coins_spent;
          yearMap[year].topup += ul.coins_spent;
        }
        chartData = Object.values(yearMap)
          .sort((a, b) => a.date.localeCompare(b.date))
          .map(d => ({
            date: d.date,
            label: d.label,
            total: d.total,
            membership: 0,
            topup: d.topup,
          }));
        if (chartData.length === 0) {
          const y = String(new Date().getFullYear());
          chartData = [{ date: y, label: y, total: 0, membership: 0, topup: 0 }];
        }
      } else {
        const dayMap = {};
        const cursor = new Date(startDate);
        cursor.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        while (cursor <= end) {
          const key = cursor.toISOString().split('T')[0];
          dayMap[key] = { date: key, label: key, total: 0, membership: 0, topup: 0 };
          cursor.setDate(cursor.getDate() + 1);
        }
        for (const ul of unlocks) {
          const key = new Date(ul.unlocked_at).toISOString().split('T')[0];
          if (!dayMap[key]) continue;
          dayMap[key].total += ul.coins_spent;
          dayMap[key].topup += ul.coins_spent;
        }
        chartData = Object.values(dayMap).map(d => ({
          date: d.date,
          label: d.label,
          total: d.total,
          membership: 0,
          topup: d.topup,
        }));
      }

      return res.json(
        new ApiResponse(200, { chartData, period }, 'Revenue chart data fetched successfully')
      );
    }

    // Fetch all completed payment transactions in range
    const transactions = await prisma.paymentTransaction.findMany({
      where: {
        created_at: { gte: startDate, lte: endDate },
        status: 'completed',
      },
      select: { created_at: true, amount: true, type: true },
      orderBy: { created_at: 'asc' },
    });

    let chartData;

    if (period === 'Annual') {
      // Group by month: YYYY-MM
      const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const monthMap = {};
      // Only pre-populate months up to and including the current month
      const now2 = new Date();
      const year = now2.getFullYear();
      const currentMonth = now2.getMonth(); // 0-indexed
      for (let m = 0; m <= currentMonth; m++) {
        const key = `${year}-${String(m + 1).padStart(2, '0')}`;
        monthMap[key] = { date: key, label: MONTH_NAMES[m], total: 0, membership: 0, topup: 0 };
      }
      for (const tx of transactions) {
        const d = new Date(tx.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthMap[key]) continue;
        const amt = parseFloat(tx.amount) || 0;
        monthMap[key].total += amt;
        if (tx.type === 'membership') monthMap[key].membership += amt;
        else if (tx.type === 'topup') monthMap[key].topup += amt;
      }
      // For the current month, append today's day to the label so users know it's partial
      const todayDay = now2.getDate();
      const currentMonthKey = `${year}-${String(currentMonth + 1).padStart(2, '0')}`;
      chartData = Object.values(monthMap).map(d => ({
        date: d.date,
        label: d.date === currentMonthKey ? `${d.label} ${todayDay}` : d.label,
        total: parseFloat(d.total.toFixed(2)),
        membership: parseFloat(d.membership.toFixed(2)),
        topup: parseFloat(d.topup.toFixed(2)),
      }));

    } else if (period === 'All') {
      // Group by year
      const yearMap = {};
      for (const tx of transactions) {
        const year = String(new Date(tx.created_at).getFullYear());
        if (!yearMap[year]) yearMap[year] = { date: year, label: year, total: 0, membership: 0, topup: 0 };
        const amt = parseFloat(tx.amount) || 0;
        yearMap[year].total += amt;
        if (tx.type === 'membership') yearMap[year].membership += amt;
        else if (tx.type === 'topup') yearMap[year].topup += amt;
      }
      chartData = Object.values(yearMap)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(d => ({
          date: d.date,
          label: d.label,
          total: parseFloat(d.total.toFixed(2)),
          membership: parseFloat(d.membership.toFixed(2)),
          topup: parseFloat(d.topup.toFixed(2)),
        }));
      // If no data, return at least current year
      if (chartData.length === 0) {
        const y = String(new Date().getFullYear());
        chartData = [{ date: y, label: y, total: 0, membership: 0, topup: 0 }];
      }

    } else {
      // Daily grouping (Daily / Weekly / Monthly)
      const dayMap = {};
      const cursor = new Date(startDate);
      cursor.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      while (cursor <= end) {
        const key = cursor.toISOString().split('T')[0]; // YYYY-MM-DD
        dayMap[key] = { date: key, label: key, total: 0, membership: 0, topup: 0 };
        cursor.setDate(cursor.getDate() + 1);
      }
      for (const tx of transactions) {
        const key = new Date(tx.created_at).toISOString().split('T')[0];
        if (!dayMap[key]) continue;
        const amt = parseFloat(tx.amount) || 0;
        dayMap[key].total += amt;
        if (tx.type === 'membership') dayMap[key].membership += amt;
        else if (tx.type === 'topup') dayMap[key].topup += amt;
      }
      chartData = Object.values(dayMap).map(d => ({
        date: d.date,
        label: d.label,
        total: parseFloat(d.total.toFixed(2)),
        membership: parseFloat(d.membership.toFixed(2)),
        topup: parseFloat(d.topup.toFixed(2)),
      }));
    }

    return res.json(
      new ApiResponse(200, { chartData, period }, 'Revenue chart data fetched successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/dashboard/top-shows?period=Daily|Weekly|Monthly|Annual|All
 * Returns top 5 shows by views (ViewCountEvent) in the selected period
 */
export async function getTopShowsChart(req, res, next) {
  try {
    const { period = 'Daily' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    const whereClause = { created_at: { gte: startDate, lte: endDate } };
    if (req.admin && req.admin.role === 'TEACHER') {
      whereClause.show = { teacher_id: req.admin.id };
    }

    // Group ViewCountEvent by show_id, count views
    const topShowViews = await prisma.viewCountEvent.groupBy({
      by: ['show_id'],
      where: whereClause,
      _count: { show_id: true },
      orderBy: { _count: { show_id: 'desc' } },
      take: 5,
    });

    if (topShowViews.length === 0) {
      return res.json(new ApiResponse(200, { chartData: [], period }, 'No data'));
    }

    // Fetch show titles
    const showIds = topShowViews.map(s => s.show_id);
    const shows = await prisma.show.findMany({
      where: { id: { in: showIds } },
      select: { id: true, title: true },
    });

    const showTitleMap = {};
    for (const s of shows) showTitleMap[s.id] = s.title;

    const chartData = topShowViews
      .map(s => ({
        show: showTitleMap[s.show_id] || 'Unknown',
        views: s._count.show_id,
      }))
      .sort((a, b) => b.views - a.views);

    return res.json(
      new ApiResponse(200, { chartData, period }, 'Top shows chart data fetched successfully')
    );
  } catch (error) {
    next(error);
  }
}
// ─────────────────────────────────────────────────────────────────
// VIEW COUNT — Admin manual adjustment
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/admin/shows/:showId/view-count-adjust
 *
 * Adds a manual count delta to a show's manual_view_count.
 * Displayed count = organic view_count + manual_view_count.
 * Each call logs a ViewCountEvent row (source: 'manual') for audit.
 *
 * Body: {
 *   count_to_add: number  (positive integer only)
 *   note:         string  (reason — required for audit trail)
 * }
 *
 * Access: requireAdmin('dramas')
 */
export async function adjustShowViewCount(req, res, next) {
  try {
    const { showId } = req.params;
    const { count_to_add, note } = req.body;

    // Validate count_to_add
    const delta = parseInt(count_to_add, 10);
    if (!Number.isFinite(delta) || delta <= 0) {
      throw new AppError('count_to_add must be a positive integer', 400);
    }

    // Note is required for the audit trail
    if (!note || typeof note !== 'string' || !note.trim()) {
      throw new AppError('A note/reason is required for manual view count adjustment', 400);
    }

    // Show must exist
    const show = await prisma.show.findUnique({
      where: { id: showId },
      select: { id: true, title: true, view_count: true, manual_view_count: true },
    });
    if (!show) throw new AppError('Show not found', 404);

    // Apply delta + write audit row — both in one transaction
    const updatedShow = await prisma.$transaction(async (tx) => {
      const updated = await tx.show.update({
        where: { id: showId },
        data: { manual_view_count: { increment: delta } },
        select: { id: true, view_count: true, manual_view_count: true },
      });

      // Admin audit row — session_id prefix ensures it never collides with
      // organic UUID v4 session IDs from the mobile client
      await tx.viewCountEvent.create({
        data: {
          session_id: `admin_${req.user.id}_${Date.now()}`,
          show_id: showId,
          episode_id: null,
          user_id: req.user.id,
          watch_duration_sec: 0,
          source: 'manual',
          note: note.trim(),
        },
      });

      return updated;
    });

    // Activity log (non-fatal — never blocks the response)
    await logAdminActivity({
      userId: req.user.id,
      action: 'VIEW_COUNT_ADJUSTED',
      entityType: 'SHOW',
      entityId: showId,
      details: JSON.stringify({ show_title: show.title, delta, note: note.trim() }),
    });

    return res.json(
      new ApiResponse(200, {
        show_id: showId,
        show_title: show.title,
        count_added: delta,
        organic_view_count: updatedShow.view_count,
        manual_view_count: updatedShow.manual_view_count,
        displayed_view_count: displayedViewCount(updatedShow),
      }, 'View count adjusted successfully')
    );
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/shows/:showId/stats
 * Returns show-level stats + per-episode breakdown for the stats modal
 */
export async function getShowStats(req, res, next) {
  try {
    const { showId } = req.params;

    const show = await prisma.show.findUnique({
      where: { id: showId },
      select: {
        id: true,
        title: true,
        view_count: true,
        manual_view_count: true,
        episodes: { select: { id: true, episode_num: true, title: true, is_free: true } },
      },
    });
    if (!show) {
      throw new AppError('Show not found', 404);
    }

    const episodeIds = show.episodes.map(e => e.id);

    // All episode access rows for this show in one query
    const accessRows = episodeIds.length > 0
      ? await prisma.episodeAccess.groupBy({
          by: ['episode_id'],
          where: { episode_id: { in: episodeIds } },
          _count: { user_id: true },
          _sum: { coins_spent: true },
        })
      : [];

    // Build episodeId -> { unlocks, coinsSpent } map
    const accessMap = {};
    for (const row of accessRows) {
      accessMap[row.episode_id] = {
        unlocks: row._count.user_id,
        coinsSpent: row._sum.coins_spent || 0,
      };
    }

    // Total unlock records across the whole show
    const uniqueUnlockers = episodeIds.length > 0
      ? await prisma.episodeAccess.count({
          where: { episode_id: { in: episodeIds } },
        })
      : 0;

    // Totals
    const totalUnlocks = accessRows.reduce((sum, r) => sum + r._count.user_id, 0);
    const totalCoinsSpent = accessRows.reduce((sum, r) => sum + (r._sum.coins_spent || 0), 0);
    const totalViews = (show.view_count || 0) + (show.manual_view_count || 0);

    // Per-episode breakdown sorted by episode_num
    const episodes = show.episodes
      .sort((a, b) => a.episode_num - b.episode_num)
      .map(ep => ({
        id: ep.id,
        episode_num: ep.episode_num,
        title: ep.title,
        is_free: ep.is_free,
        unlocks: accessMap[ep.id]?.unlocks || 0,
        coins_spent: accessMap[ep.id]?.coinsSpent || 0,
      }));

    return res.json(
      new ApiResponse(200, {
        showId,
        totalViews,
        totalUnlocks,
        totalCoinsSpent,
        uniqueUnlockers,
        episodes,
      }, 'Show stats fetched successfully')
    );
  } catch (error) {
    next(error);
  }
}

// ──────────────────────────────────────
// STUDENT ONBOARDING (ADMIN)
// ──────────────────────────────────────

export async function onboardStudent(req, res, next) {
  try {
    const { email, name, password, student_id, dob, gender, country, state, city, mobile_no } = req.body;

    if (!email || !name || !password) {
      throw new AppError('Email, name, and password are mandatory', 400);
    }

    const sanitizedEmail = String(email).toLowerCase().trim();
    const sanitizedName = String(name).trim();
    const sanitizedPassword = String(password).trim();

    if (sanitizedPassword.length < 6) {
      throw new AppError('Password must be at least 6 characters', 400);
    }

    // 1. Hard Reject on Duplicate Email (Rule 4.2 / 5.3)
    const existing = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
    if (existing) {
      throw new AppError('A user with this email address already exists', 409);
    }

    // Validate gender if provided
    let validGender = null;
    if (gender) {
      const validGenders = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
      const upperGender = String(gender).toUpperCase().trim();
      if (!validGenders.includes(upperGender)) {
        throw new AppError(`Invalid gender. Must be one of: ${validGenders.join(', ')}`, 400);
      }
      validGender = upperGender;
    }

    // Validate DOB if provided
    let parsedDob = null;
    if (dob) {
      const d = new Date(dob);
      if (isNaN(d.getTime())) {
        throw new AppError('Invalid date of birth format', 400);
      }
      parsedDob = d;
    }

    const passwordHash = await hashPassword(sanitizedPassword);

    // Create student user
    const student = await prisma.user.create({
      data: {
        name: sanitizedName,
        email: sanitizedEmail,
        password: passwordHash,
        role: 'USER',
        coins: 0,
        onboarded_by: req.user.id,
        student_id: student_id ? String(student_id).trim() : null,
        dob: parsedDob,
        gender: validGender,
        country: country ? String(country).trim() : null,
        state: state ? String(state).trim() : null,
        city: city ? String(city).trim() : null,
        mobile_no: mobile_no ? String(mobile_no).trim() : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        student_id: true,
        mobile_no: true,
        dob: true,
        gender: true,
        country: true,
        state: true,
        city: true,
        onboarded_by: true,
        createdAt: true,
      },
    });

    // Dispatch credentials email
    try {
      await sendStudentCredentialsEmail(student.email, student.name, sanitizedPassword);
    } catch (emailError) {
      console.error('Failed to send student credentials email', emailError);
    }

    // Log admin activity
    await logAdminActivity({
      userId: req.user.id,
      action: `Onboarded student ${student.name} (${student.email})`,
      entityType: 'User',
      entityId: student.id,
    });

    return res.status(201).json(new ApiResponse(201, { student }, 'Student onboarded successfully'));
  } catch (err) {
    next(err);
  }
}

export async function listStudents(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const skip = (page - 1) * limit;
    const search = req.query.search ? String(req.query.search).trim() : '';

    const where = {
      role: 'USER',
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { student_id: { contains: search, mode: 'insensitive' } },
              { mobile_no: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, students] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          coins: true,
          student_id: true,
          mobile_no: true,
          dob: true,
          gender: true,
          country: true,
          state: true,
          city: true,
          onboarded_by: true,
          isBlocked: true,
          createdAt: true,
          memberships: {
            where: activeMembershipWhere(new Date()),
            include: membershipPlanInclude,
            orderBy: { end_date: 'desc' },
          },
          show_access: {
            where: { revoked_at: null },
            select: {
              id: true,
              show_id: true,
              access_type: true,
              purchased_at: true,
              show: {
                select: {
                  id: true,
                  title: true,
                  thumbnail_url: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return res.json(
      new ApiResponse(
        200,
        {
          students,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
        'Students fetched successfully'
      )
    );
  } catch (err) {
    next(err);
  }
}

// ──────────────────────────────────────
// ASSIGN & REVOKE COURSES (ADMIN)
// ──────────────────────────────────────

export async function assignCoursesToStudent(req, res, next) {
  try {
    const { userId } = req.params;
    const { show_ids } = req.body;

    if (!Array.isArray(show_ids) || show_ids.length === 0) {
      throw new AppError('show_ids must be a non-empty array of course IDs', 400);
    }

    // 1. Verify student user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) {
      throw new AppError('Student user not found', 404);
    }

    // 2. Validate valid show IDs in database
    const uniqueShowIds = [...new Set(show_ids.filter(Boolean))];
    const existingShows = await prisma.show.findMany({
      where: { id: { in: uniqueShowIds } },
      select: { id: true, title: true },
    });

    if (existingShows.length === 0) {
      throw new AppError('No valid courses found for provided IDs', 400);
    }

    const validShowIds = existingShows.map((s) => s.id);
    const assignedShows = [];

    // 3. Process show assignment for each valid show ID
    await prisma.$transaction(async (tx) => {
      for (const showId of validShowIds) {
        // Check existing record
        const existingRecord = await tx.showAccess.findFirst({
          where: { user_id: userId, show_id: showId },
        });

        if (existingRecord) {
          if (existingRecord.revoked_at !== null) {
            // Un-revoke and update to ADMIN_GRANTED
            await tx.showAccess.update({
              where: { id: existingRecord.id },
              data: {
                revoked_at: null,
                access_type: 'ADMIN_GRANTED',
                coins_spent: 0,
                purchased_at: new Date(),
              },
            });
          }
          // If already active, leave as-is (idempotent)
        } else {
          // Create new ADMIN_GRANTED record
          await tx.showAccess.create({
            data: {
              user_id: userId,
              show_id: showId,
              coins_spent: 0,
              access_type: 'ADMIN_GRANTED',
              revoked_at: null,
            },
          });
        }
        assignedShows.push(showId);
      }
    });

    await logAdminActivity({
      userId: req.user.id,
      action: `Assigned ${assignedShows.length} course(s) to user ${user.name} (${user.email})`,
      entityType: 'User',
      entityId: userId,
      details: JSON.stringify({ show_ids: assignedShows }),
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        { userId, assigned_show_ids: assignedShows },
        'Courses assigned successfully'
      )
    );
  } catch (err) {
    next(err);
  }
}

export async function revokeCourseFromStudent(req, res, next) {
  try {
    const { userId, showId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    if (!user) throw new AppError('Student user not found', 404);

    const show = await prisma.show.findUnique({
      where: { id: showId },
      select: { id: true, title: true },
    });

    // Check ShowAccess record
    const accessRecord = await prisma.showAccess.findFirst({
      where: { user_id: userId, show_id: showId, revoked_at: null },
    });

    if (!accessRecord) {
      throw new AppError('Active course access record not found', 404);
    }

    // Protection Check (Guardrail 4): Only ADMIN_GRANTED access can be revoked
    if (accessRecord.access_type !== 'ADMIN_GRANTED') {
      throw new AppError(
        `Only admin-granted course access can be revoked. Current access type is ${accessRecord.access_type}.`,
        403
      );
    }

    // Soft delete via revoked_at timestamp
    await prisma.showAccess.update({
      where: { id: accessRecord.id },
      data: { revoked_at: new Date() },
    });

    await logAdminActivity({
      userId: req.user.id,
      action: `Revoked admin course access for "${show?.title || showId}" from ${user.name}`,
      entityType: 'User',
      entityId: userId,
    });

    return res.status(200).json(
      new ApiResponse(200, { userId, showId }, 'Course access revoked successfully')
    );
  } catch (err) {
    next(err);
  }
}

// ──────────────────────────────────────
// ACCOUNT DELETIONS (ADMIN)
// ──────────────────────────────────────

export async function getAccountDeletionsController(req, res, next) {
  try {
    const { page, limit, search, reason, startDate, endDate } = req.query;
    const result = await fetchAccountDeletions({ page, limit, search, reason, startDate, endDate });
    return res.json(new ApiResponse(200, result, 'Account deletion records retrieved successfully'));
  } catch (err) {
    next(err);
  }
}

export async function exportAccountDeletionsController(req, res, next) {
  try {
    const { search, reason, startDate, endDate } = req.query;
    const csvContent = await exportAccountDeletionsCSV({ search, reason, startDate, endDate });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=account_deletions_${Date.now()}.csv`);
    return res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
}