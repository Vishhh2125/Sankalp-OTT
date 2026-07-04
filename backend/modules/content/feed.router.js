import express from 'express';
import { prisma } from '../../prisma/client.js';
import { allowGuest, requireAuth } from '../../middleware/auth.middleware.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { unlockEpisodeForUser } from '../user/episode-unlock.service.js';
import { checkEpisodeAccess } from '../user/episode-access.service.js';
import { displayedViewCount } from '../user/view-count.service.js';
import { getSignedEpisodeHlsPath } from '../../utils/hls-signed-url.js';

const router = express.Router();

// ── Helper: Check if user can access a paid episode ──
// GET /api/feed/for-you — Episode 1 of shows, ordered by feed_position
// Uses allowGuest: logged-in users get personalized lock status, guests see locks on paid content
router.get('/for-you', allowGuest, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const userId = req.user?.id || null;
    const isGuest = req.isGuest || false;

    const readyEpisodeOneWhere = {
      episode_num: 1,
      status: 'ready',
      OR: [
        { video_source: 'YOUTUBE', youtube_video_id: { not: null } },
        { video_source: 'UPLOAD', hls_master_url: { not: null } },
      ],
    };

    const eligibleShowWhere = {
      is_active: true,
      episodes: {
        some: readyEpisodeOneWhere,
      },
    };

    const showInclude = {
      category: { select: { name: true } },
      show_tags: { include: { tag: { select: { name: true } } } },
      _count: { select: { episodes: true } },
      episodes: {
        where: readyEpisodeOneWhere,
        take: 1,
      },
    };

    const positionedWhere = {
      ...eligibleShowWhere,
      feed_position: { gt: 0 },
    };
    const nonPositionedWhere = {
      ...eligibleShowWhere,
      feed_position: 0,
    };

    const [positionedTotal, nonPositionedTotal] = await Promise.all([
      prisma.show.count({ where: positionedWhere }),
      prisma.show.count({ where: nonPositionedWhere }),
    ]);

    const totalEligible = positionedTotal + nonPositionedTotal;
    const positionedSkip = Math.min(offset, positionedTotal);
    const positionedTake = Math.min(limit, Math.max(positionedTotal - positionedSkip, 0));
    const nonPositionedSkip = Math.max(offset - positionedTotal, 0);
    const nonPositionedTake = limit - positionedTake;

    const [positionedShows, nonPositionedShows] = await Promise.all([
      positionedTake > 0 ? prisma.show.findMany({
        where: positionedWhere,
        orderBy: [
          { feed_position: 'asc' },
          { created_at: 'desc' },
        ],
        skip: positionedSkip,
        take: positionedTake,
        include: showInclude,
      }) : [],
      nonPositionedTake > 0 ? prisma.show.findMany({
        where: nonPositionedWhere,
        orderBy: { created_at: 'desc' },
        skip: nonPositionedSkip,
        take: nonPositionedTake,
        include: showInclude,
      }) : [],
    ]);

    const ordered = [...positionedShows, ...nonPositionedShows];

    const items = [];
    for (const show of ordered) {
      const ep1 = show.episodes[0];
      if (!ep1) continue;

      // Check access for this episode
      const { is_locked, lock_reason } = await checkEpisodeAccess(
        userId, isGuest, ep1.id, ep1.is_free, show.category_id
      );

      // Only provide HLS URL if episode is unlocked
      let streamUrl = null;
      let youtubeVideoId = null;
      
      if (ep1.video_source === 'YOUTUBE') {
        youtubeVideoId = ep1.youtube_video_id;
      } else if (!is_locked) {
        streamUrl = getSignedEpisodeHlsPath(ep1);
      }

      items.push({
        show_id: show.id,
        show_title: show.title,
        synopsis: show.synopsis,
        thumbnail_url: show.thumbnail_url ? `/api/media/image/${show.id}/thumbnail` : null,
        episode_id: ep1.id,
        episode_num: 1,
        video_source: ep1.video_source || 'UPLOAD',
        youtube_video_id: youtubeVideoId,
        hls_url: streamUrl,
        duration_sec: ep1.duration_sec,
        view_count: displayedViewCount(show),
        rating_avg: show.rating_avg,
        rating_count: show.rating_count,
        tags: show.show_tags.map(st => st.tag.name),
        category: show.category.name,
        feed_position: show.feed_position,
        total_episodes: show._count?.episodes || 0,

        // Lock info for frontend
        is_free: ep1.is_free,
        coin_cost: ep1.coin_cost,
        is_locked,
        lock_reason,
      });
    }

    res.json({
      items,
      offset,
      limit,
      total: totalEligible,
      has_more: offset + items.length < totalEligible,
    });
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
    if (!show.is_active) {
      return res.status(404).json({ error: 'Show not found' });
    }

    const episodes = await prisma.episode.findMany({
      where: { show_id: showId, episode_num: { gte: fromEp } },
      orderBy: { episode_num: 'asc' },
      take: limit,
    });

    const totalEpisodes = await prisma.episode.count({ where: { show_id: showId } });

    const items = await Promise.all(episodes.map(async (ep) => {
      const { is_locked, lock_reason } = await checkEpisodeAccess(
        userId, isGuest, ep.id, ep.is_free, show.category_id
      );

      return {
        episode_id: ep.id,
        episode_num: ep.episode_num,
        title: ep.title,
        is_free: ep.is_free,
        coin_cost: ep.coin_cost,
        duration_sec: ep.duration_sec,
        status: ep.status,
        video_source: ep.video_source || 'UPLOAD',
        youtube_video_id: ep.video_source === 'YOUTUBE' ? ep.youtube_video_id : null,
        hls_url: (!is_locked && ep.video_source !== 'YOUTUBE') ? getSignedEpisodeHlsPath(ep) : null,
        is_locked,
        lock_reason,
      };
    }));

    res.json({
      show_id: show.id,
      show_title: show.title,
      synopsis: show.synopsis,
      thumbnail_url: show.thumbnail_url ? `/api/media/image/${show.id}/thumbnail` : null,
      view_count: displayedViewCount(show),
      rating_avg: show.rating_avg,
      rating_count: show.rating_count,
      tags: show.show_tags.map(st => st.tag.name),
      total_episodes: totalEpisodes,
      episodes: items,
      has_more: fromEp + limit - 1 < totalEpisodes,
    });
  } catch (e) { next(e); }
});

// POST /api/feed/episodes/:episodeId/unlock — same logic as /api/user/... (for clients hitting feed base)
router.post('/episodes/:episodeId/unlock', requireAuth, async (req, res, next) => {
  try {
    const result = await unlockEpisodeForUser(req.user.id, req.params.episodeId);
    if (!result.ok) {
      return res
        .status(result.status)
        .json(new ApiResponse(result.status, result.data, result.message));
    }
    return res.json(new ApiResponse(200, result.data, result.message));
  } catch (e) {
    next(e);
  }
});

export default router;
