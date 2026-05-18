import { prisma } from '../../prisma/client.js';

function buildEpisodeHlsPath(episode) {
  if (episode.status === 'ready' && episode.hls_master_url) {
    return `/api/media/hls/${episode.show_id}/${episode.id}/master.m3u8`;
  }
  return null;
}

function buildUnlockResponse(episode, coins) {
  return {
    coins,
    episode_id: episode.id,
    show_id: episode.show_id,
    coin_cost: episode.coin_cost,
    is_locked: false,
    hls_url: buildEpisodeHlsPath(episode),
  };
}

/**
 * Unlock a paid episode for a user (coins, membership, or idempotent access).
 * @returns {{ ok: true, data: object, message: string } | { ok: false, status: number, data: object|null, message: string }}
 */
export async function unlockEpisodeForUser(userId, episodeId) {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    select: {
      id: true,
      show_id: true,
      is_free: true,
      coin_cost: true,
      status: true,
      hls_master_url: true,
    },
  });

  if (!episode) {
    return { ok: false, status: 404, data: null, message: 'Episode not found' };
  }
  if (episode.is_free) {
    return { ok: false, status: 400, data: null, message: 'Episode is free' };
  }
  if (!episode.coin_cost || episode.coin_cost <= 0) {
    return { ok: false, status: 400, data: null, message: 'Episode has no coin cost' };
  }

  const existingAccess = await prisma.episodeAccess.findUnique({
    where: { idx_ea_user_ep: { user_id: userId, episode_id: episodeId } },
  });
  if (existingAccess) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { coins: true },
    });
    return {
      ok: true,
      data: buildUnlockResponse(episode, user?.coins ?? 0),
      message: 'Already unlocked',
    };
  }

  const membership = await prisma.userMembership.findFirst({
    where: {
      user_id: userId,
      status: 'ACTIVE',
      end_date: { gte: new Date() },
    },
  });
  if (membership) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { coins: true },
    });
    return {
      ok: true,
      data: buildUnlockResponse(episode, user?.coins ?? 0),
      message: 'Unlocked via membership',
    };
  }

  const txResult = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, coins: true },
    });
    if (!user) return { error: 'USER_NOT_FOUND' };

    const accessAgain = await tx.episodeAccess.findUnique({
      where: { idx_ea_user_ep: { user_id: userId, episode_id: episodeId } },
    });
    if (accessAgain) {
      return { coins: user.coins ?? 0, idempotent: true };
    }

    const balance = user.coins ?? 0;
    if (balance < episode.coin_cost) {
      return { error: 'INSUFFICIENT', coins: balance };
    }

    const nextCoins = balance - episode.coin_cost;

    await tx.user.update({
      where: { id: userId },
      data: { coins: nextCoins },
    });

    await tx.episodeAccess.create({
      data: {
        user_id: userId,
        episode_id: episodeId,
        coins_spent: episode.coin_cost,
      },
    });

    await tx.coinTransaction.create({
      data: {
        user_id: userId,
        type: 'debit',
        amount: episode.coin_cost,
        reason: 'episode_unlock',
        ref_id: episodeId,
      },
    });

    return { coins: nextCoins };
  });

  if (txResult.error === 'USER_NOT_FOUND') {
    return { ok: false, status: 404, data: null, message: 'User not found' };
  }
  if (txResult.error === 'INSUFFICIENT') {
    return {
      ok: false,
      status: 402,
      data: { coins: txResult.coins },
      message: 'Insufficient coins',
    };
  }

  return {
    ok: true,
    data: buildUnlockResponse(episode, txResult.coins),
    message: 'Episode unlocked',
  };
}
