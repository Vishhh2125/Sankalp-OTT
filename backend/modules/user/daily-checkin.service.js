import { prisma } from '../../prisma/client.js';

const CHECKIN_KEYS = [
  'checkin_day_1',
  'checkin_day_2',
  'checkin_day_3',
  'checkin_day_4',
  'checkin_day_5',
  'checkin_day_6',
  'checkin_day_7',
];

const DEFAULT_RULES = {
  day1: 10,
  day2: 10,
  day3: 20,
  day4: 20,
  day5: 25,
  day6: 30,
  day7: 50,
};

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(date, days) {
  const x = new Date(date);
  x.setDate(x.getDate() + days);
  return x;
}

function isSameCalendarDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/**
 * Load 7-day check-in coin rewards from settings (same keys as admin).
 */
export async function loadCheckinRules() {
  const settings = await prisma.setting.findMany({
    where: { key: { in: CHECKIN_KEYS } },
  });

  const rules = { ...DEFAULT_RULES };
  for (let i = 1; i <= 7; i++) {
    const key = `checkin_day_${i}`;
    const row = settings.find((s) => s.key === key);
    if (row?.value != null) {
      const n = parseInt(row.value, 10);
      if (!Number.isNaN(n)) rules[`day${i}`] = n;
    }
  }
  return rules;
}

export function rulesToArray(rules) {
  return [1, 2, 3, 4, 5, 6, 7].map((day) => ({
    day,
    coins: rules[`day${day}`] ?? DEFAULT_RULES[`day${day}`],
  }));
}

function coinsForStreakDay(rules, streakDay) {
  const d = Math.min(Math.max(streakDay, 1), 7);
  return rules[`day${d}`] ?? DEFAULT_RULES[`day${d}`];
}

/**
 * Compute next streak day for today's claim (before claiming).
 */
export function computeNextStreakDay(lastCheckin) {
  const today = startOfDay();
  const yesterday = addDays(today, -1);

  if (!lastCheckin) {
    return 1;
  }

  const lastDate = startOfDay(lastCheckin.checkin_date);

  if (isSameCalendarDay(lastDate, today)) {
    return null;
  }

  if (lastDate.getTime() === yesterday.getTime()) {
    return lastCheckin.streak_day === 7 ? 1 : lastCheckin.streak_day + 1;
  }

  return 1;
}

/**
 * GET status: rules, streak info, claimed_today, balances.
 */
export async function getCheckinStatus(userId) {
  const today = startOfDay();
  const rules = await loadCheckinRules();

  const [user, lastCheckin, todayCheckin] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { coins: true },
    }),
    prisma.dailyCheckin.findFirst({
      where: { user_id: userId },
      orderBy: { checkin_date: 'desc' },
    }),
    prisma.dailyCheckin.findUnique({
      where: {
        idx_dc_user_date: {
          user_id: userId,
          checkin_date: today,
        },
      },
    }),
  ]);

  const claimedToday = Boolean(todayCheckin);
  const nextStreak = claimedToday
    ? todayCheckin.streak_day
    : computeNextStreakDay(lastCheckin);

  const todayReward =
    nextStreak != null ? coinsForStreakDay(rules, nextStreak) : 0;

  return {
    rules: rulesToArray(rules),
    streak_day: nextStreak,
    claimed_today: claimedToday,
    last_checkin_date: lastCheckin?.checkin_date ?? null,
    today_reward: todayReward,
    coins: user?.coins ?? 0,
    last_streak_day: lastCheckin?.streak_day ?? null,
  };
}

/**
 * POST claim: credit coins, record check-in and ledger row.
 */
export async function claimDailyCheckin(userId) {
  const today = startOfDay();
  const rules = await loadCheckinRules();

  const existingToday = await prisma.dailyCheckin.findUnique({
    where: {
      idx_dc_user_date: {
        user_id: userId,
        checkin_date: today,
      },
    },
  });

  if (existingToday) {
    return {
      ok: false,
      status: 409,
      message: 'Already checked in today',
    };
  }

  const lastCheckin = await prisma.dailyCheckin.findFirst({
    where: { user_id: userId },
    orderBy: { checkin_date: 'desc' },
  });

  const nextStreak = computeNextStreakDay(lastCheckin);
  if (nextStreak == null) {
    return {
      ok: false,
      status: 409,
      message: 'Already checked in today',
    };
  }

  const coinsAwarded = coinsForStreakDay(rules, nextStreak);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { coins: true },
    });
    if (!user) {
      return null;
    }

    const prev = user.coins ?? 0;
    const nextCoins = prev + coinsAwarded;

    const checkin = await tx.dailyCheckin.create({
      data: {
        user_id: userId,
        checkin_date: today,
        coins_awarded: coinsAwarded,
        streak_day: nextStreak,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { coins: nextCoins },
    });

    await tx.coinTransaction.create({
      data: {
        user_id: userId,
        type: 'credit',
        amount: coinsAwarded,
        reason: 'daily_checkin',
        ref_id: checkin.id,
        title: 'Daily check-in',
        description: `Day ${nextStreak} reward`,
        status: 'completed',
      },
    });

    return {
      coins: nextCoins,
      streak_day: nextStreak,
      coins_awarded: coinsAwarded,
      checkin_id: checkin.id,
    };
  });

  if (!result) {
    return { ok: false, status: 404, message: 'User not found' };
  }

  return {
    ok: true,
    data: result,
    message: 'Daily check-in reward claimed',
  };
}
