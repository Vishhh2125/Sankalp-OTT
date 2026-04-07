import express from 'express';
import { prisma } from '../../prisma/client.js';
import { getPresignedGetUrl } from '../../utils/presigned-url.js';

const router = express.Router();

// GET /api/feed/for-you — Episode 1 of featured/random shows
router.get('/for-you', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const shows = await prisma.show.findMany({
      where: { is_active: true },
      orderBy: [{ is_featured_for_you: 'desc' }, { created_at: 'desc' }],
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

    const items = [];
    for (const show of shows) {
      const ep1 = show.episodes[0];
      if (!ep1) continue; // Skip shows without a ready Episode 1

      let streamUrl = null;
      if (ep1.hls_master_url) {
        // Use our HLS proxy instead of direct presigned URL
        streamUrl = `/api/media/hls/${ep1.id}/master.m3u8`;
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
        is_featured: show.is_featured_for_you,
        total_episodes: await prisma.episode.count({ where: { show_id: show.id } }),
      });
    }

    res.json({ items, offset, limit, total: items.length });
  } catch (e) { next(e); }
});

// GET /api/feed/show/:showId — sequential episodes for show-mode reels
router.get('/show/:showId', async (req, res, next) => {
  try {
    const { showId } = req.params;
    const fromEp = parseInt(req.query.from_ep) || 1;
    const limit = parseInt(req.query.limit) || 10;

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

    const items = episodes.map(ep => ({
      episode_id: ep.id,
      episode_num: ep.episode_num,
      title: ep.title,
      is_free: ep.is_free,
      coin_cost: ep.coin_cost,
      duration_sec: ep.duration_sec,
      status: ep.status,
      hls_url: ep.status === 'ready' && ep.hls_master_url
        ? `/api/media/hls/${ep.id}/master.m3u8`
        : null,
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
