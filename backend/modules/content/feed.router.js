import express from 'express';
import { prisma } from '../../prisma/client.js';
import { allowGuest } from '../../middleware/auth.middleware.js';

const router = express.Router();

// ── Helper: Check if user can access a paid episode ──
async function checkEpisodeAccess(userId, isGuest, episodeId, isFree) {
  // Free episodes are always accessible
  if (isFree) return { is_locked: false, lock_reason: null };

  // Guest users can never access paid episodes
  if (isGuest || !userId) {
    return { is_locked: true, lock_reason: 'login_required' };
  }

  // Check 1: Does the user have an active membership?
  const membership = await prisma.userMembership.findFirst({
    where: {
      user_id: userId,
      status: 'ACTIVE',
      end_date: { gte: new Date() },
    },
  });
  if (membership) return { is_locked: false, lock_reason: null };

  // Check 2: Did the user unlock this episode with coins?
  const coinUnlock = await prisma.episodeAccess.findUnique({
    where: { idx_ea_user_ep: { user_id: userId, episode_id: episodeId } },
  });
  if (coinUnlock) return { is_locked: false, lock_reason: null };

  // User is logged in but has no membership and hasn't unlocked with coins
  return { is_locked: true, lock_reason: 'coins_or_membership' };
}

// GET /api/feed/for-you — Episode 1 of shows, ordered by feed_position
// Uses allowGuest: logged-in users get personalized lock status, guests see locks on paid content
router.get('/for-you', allowGuest, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const userId = req.user?.id || null;
    const isGuest = req.isGuest || false;

    const shows = await prisma.show.findMany({
      where: { is_active: true },
      orderBy: [
        { feed_position: 'asc' },
        { created_at: 'desc' },
      ],
      skip: offset,
      take: limit,
      include: {
        category: { select: { name: true } },
        show_tags: { include: { tag: { select: { name: true } } } },
        episodes: {
          where: { episode_num: 1, status: 'ready' },
          take: 1,
        },
      },
    });

    // Separate positioned (>0) first, then non-positioned (0)
    const positioned = shows.filter(s => s.feed_position > 0).sort((a, b) => a.feed_position - b.feed_position);
    const nonPositioned = shows.filter(s => s.feed_position === 0);
    const ordered = [...positioned, ...nonPositioned];

    const items = [];
    for (const show of ordered) {
      const ep1 = show.episodes[0];
      if (!ep1) continue;

      // Check access for this episode
      const { is_locked, lock_reason } = await checkEpisodeAccess(
        userId, isGuest, ep1.id, ep1.is_free
      );

      // Only provide HLS URL if episode is unlocked
      let streamUrl = null;
      if (!is_locked && ep1.hls_master_url) {
        streamUrl = `/api/media/hls/${show.id}/${ep1.id}/master.m3u8`;
      }

      items.push({
        show_id: show.id,
        show_title: show.title,
        synopsis: show.synopsis,
        thumbnail_url: show.thumbnail_url,
        episode_id: ep1.id,
        episode_num: 1,
        hls_url: streamUrl,
        duration_sec: ep1.duration_sec,
        view_count: show.view_count,
        rating_avg: show.rating_avg,
        rating_count: show.rating_count,
        tags: show.show_tags.map(st => st.tag.name),
        category: show.category.name,
        feed_position: show.feed_position,
        total_episodes: await prisma.episode.count({ where: { show_id: show.id } }),

        // Lock info for frontend
        is_free: ep1.is_free,
        coin_cost: ep1.coin_cost,
        is_locked,
        lock_reason,
      });
    }

    res.json({ items, offset, limit, total: items.length });
  } catch (e) { next(e); }
});

// GET /api/feed/show/:showId — sequential episodes with lock status
router.get('/show/:showId', allowGuest, async (req, res, next) => {
  try {
    const { showId } = req.params;
    const fromEp = parseInt(req.query.from_ep) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const userId = req.user?.id || null;
    const isGuest = req.isGuest || false;

    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: {
        show_tags: { include: { tag: { select: { name: true } } } },
      },
    });
    if (!show) return res.status(404).json({ error: 'Show not found' });

    const episodes = await prisma.episode.findMany({
      where: { show_id: showId, episode_num: { gte: fromEp } },
      orderBy: { episode_num: 'asc' },
      take: limit,
    });

    const totalEpisodes = await prisma.episode.count({ where: { show_id: showId } });

    const items = await Promise.all(episodes.map(async (ep) => {
      const { is_locked, lock_reason } = await checkEpisodeAccess(
        userId, isGuest, ep.id, ep.is_free
      );

      return {
        episode_id: ep.id,
        episode_num: ep.episode_num,
        title: ep.title,
        is_free: ep.is_free,
        coin_cost: ep.coin_cost,
        duration_sec: ep.duration_sec,
        status: ep.status,
        hls_url: !is_locked && ep.status === 'ready' && ep.hls_master_url
          ? `/api/media/hls/${showId}/${ep.id}/master.m3u8`
          : null,
        is_locked,
        lock_reason,
      };
    }));

    res.json({
      show_id: show.id,
      show_title: show.title,
      synopsis: show.synopsis,
      tags: show.show_tags.map(st => st.tag.name),
      total_episodes: totalEpisodes,
      episodes: items,
      has_more: fromEp + limit - 1 < totalEpisodes,
    });
  } catch (e) { next(e); }
});

export default router;