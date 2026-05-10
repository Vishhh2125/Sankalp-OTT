import express from 'express';
import { prisma } from '../../prisma/client.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────
// BOOKMARKS
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/user/bookmarks/:showId
 * Toggle bookmark for a show.
 * Body: { episode_id?, progress_sec? }
 *
 * If episode_id is provided but progress_sec is not,
 * we check WatchHistory to find the most recent progress for this user+show
 * and use that instead (covers the DramaDetailsSheet case).
 *
 * Returns: { bookmarked: boolean, episode_id, progress_sec }
 */
router.post('/bookmarks/:showId', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { showId } = req.params;
    let { episode_id, progress_sec } = req.body;

    // Validate show exists
    const show = await prisma.show.findUnique({ where: { id: showId } });
    if (!show) {
      return res.status(404).json(new ApiResponse(404, null, 'Show not found'));
    }

    // Check if bookmark already exists for this user+show
    const existing = await prisma.bookmark.findUnique({
      where: { idx_bm_user_show: { user_id: userId, show_id: showId } },
    });

    // If bookmark exists with the SAME episode → toggle off (remove)
    if (existing && existing.episode_id === episode_id) {
      await prisma.bookmark.delete({ where: { id: existing.id } });
      return res.json(new ApiResponse(200, {
        bookmarked: false,
        show_id: showId,
      }, 'Bookmark removed'));
    }

    // Resolve episode_id and progress_sec if not fully provided
    // Case 1: episode_id given but no progress_sec → look up WatchHistory
    if (episode_id && (progress_sec === undefined || progress_sec === null)) {
      const watchEntry = await prisma.watchHistory.findUnique({
        where: { idx_wh_user_ep: { user_id: userId, episode_id } },
      });
      progress_sec = watchEntry?.progress_sec ?? 0;
    }

    // Case 2: no episode_id at all → find most recently watched episode of this show
    if (!episode_id) {
      const recentWatch = await prisma.watchHistory.findFirst({
        where: {
          user_id: userId,
          episode: { show_id: showId },
        },
        orderBy: { last_watched: 'desc' },
      });

      if (recentWatch) {
        episode_id = recentWatch.episode_id;
        progress_sec = recentWatch.progress_sec;
      } else {
        // No watch history — fall back to episode 1
        const ep1 = await prisma.episode.findFirst({
          where: { show_id: showId, episode_num: 1 },
          select: { id: true },
        });
        episode_id = ep1?.id || null;
        progress_sec = 0;
      }
    }

    const progressFloor = Math.floor(progress_sec || 0);

    // If bookmark exists with DIFFERENT episode → UPDATE to latest episode
    if (existing) {
      const updated = await prisma.bookmark.update({
        where: { id: existing.id },
        data: {
          episode_id: episode_id || null,
          progress_sec: progressFloor,
        },
      });
      return res.json(new ApiResponse(200, {
        bookmarked: true,
        show_id: showId,
        episode_id: updated.episode_id,
        progress_sec: updated.progress_sec,
      }, 'Bookmark updated'));
    }

    // No existing bookmark → CREATE
    const bookmark = await prisma.bookmark.create({
      data: {
        user_id: userId,
        show_id: showId,
        episode_id: episode_id || null,
        progress_sec: progressFloor,
      },
    });

    return res.json(new ApiResponse(200, {
      bookmarked: true,
      show_id: showId,
      episode_id: bookmark.episode_id,
      progress_sec: bookmark.progress_sec,
    }, 'Bookmark added'));

  } catch (e) { next(e); }
});

/**
 * GET /api/user/bookmarks
 * Fetch all bookmarks for the logged-in user, ordered newest first.
 * Joins Show for title/thumbnail, Episode for episode_num/duration_sec.
 */
router.get('/bookmarks', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const bookmarks = await prisma.bookmark.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      include: {
        show: {
          select: {
            id: true,
            title: true,
            thumbnail_url: true,
            category: { select: { name: true } },
          },
        },
        episode: {
          select: {
            id: true,
            episode_num: true,
            duration_sec: true,
            title: true,
          },
        },
      },
    });

    const items = bookmarks.map(b => ({
      bookmark_id: b.id,
      show_id: b.show_id,
      show_title: b.show?.title || '',
      thumbnail_url: b.show?.thumbnail_url || null,
      category: b.show?.category?.name || null,
      episode_id: b.episode_id,
      episode_num: b.episode?.episode_num || 1,
      episode_title: b.episode?.title || null,
      duration_sec: b.episode?.duration_sec || 0,
      progress_sec: b.progress_sec,
      created_at: b.created_at,
    }));

    return res.json(new ApiResponse(200, { items }, 'Bookmarks fetched'));

  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────
// WATCH HISTORY
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/user/watch-history
 * Upsert a watch history entry.
 * Body: { episode_id, progress_sec }
 *
 * Creates if first time watching, updates progress_sec + last_watched
 * if already exists. Uses the idx_wh_user_ep unique constraint.
 */
router.post('/watch-history', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { episode_id, progress_sec } = req.body;

    if (!episode_id) {
      return res.status(400).json(new ApiResponse(400, null, 'episode_id is required'));
    }

    const episode = await prisma.episode.findUnique({
      where: { id: episode_id },
      select: { id: true, show_id: true },
    });
    if (!episode) {
      return res.status(404).json(new ApiResponse(404, null, 'Episode not found'));
    }

    const entry = await prisma.watchHistory.upsert({
      where: { idx_wh_user_ep: { user_id: userId, episode_id } },
      create: {
        user_id: userId,
        episode_id,
        progress_sec: Math.floor(progress_sec || 0),
        last_watched: new Date(),
      },
      update: {
        progress_sec: Math.floor(progress_sec || 0),
        last_watched: new Date(),
      },
    });

    return res.json(new ApiResponse(200, {
      episode_id: entry.episode_id,
      progress_sec: entry.progress_sec,
      last_watched: entry.last_watched,
    }, 'Watch history updated'));

  } catch (e) { next(e); }
});

/**
 * GET /api/user/watch-history
 * Fetch recent watch history for logged-in user.
 * Ordered by last_watched descending. Limit 20.
 * Joins Episode → Show for full card data.
 */
router.get('/watch-history', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Fetch more than needed so we have enough after show-level dedup
    const history = await prisma.watchHistory.findMany({
      where: { user_id: userId },
      orderBy: { last_watched: 'desc' },
      take: 100,
      include: {
        episode: {
          select: {
            id: true,
            episode_num: true,
            duration_sec: true,
            title: true,
            show: {
              select: {
                id: true,
                title: true,
                thumbnail_url: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    // Deduplicate by show — keep only the most recently watched episode per show.
    // Results are already ordered by last_watched desc so the first occurrence
    // of each show_id is always the most recent episode for that show.
    const seenShowIds = new Set();
    const deduplicated = [];

    for (const h of history) {
      const showId = h.episode?.show?.id;
      if (!showId) continue;
      if (seenShowIds.has(showId)) continue;
      seenShowIds.add(showId);
      deduplicated.push(h);
      if (deduplicated.length >= 20) break;
    }

    const items = deduplicated.map(h => ({
      history_id: h.id,
      show_id: h.episode?.show?.id || null,
      show_title: h.episode?.show?.title || '',
      thumbnail_url: h.episode?.show?.thumbnail_url || null,
      category: h.episode?.show?.category?.name || null,
      episode_id: h.episode_id,
      episode_num: h.episode?.episode_num || 1,
      episode_title: h.episode?.title || null,
      duration_sec: h.episode?.duration_sec || 0,
      progress_sec: h.progress_sec,
      last_watched: h.last_watched,
    }));

    return res.json(new ApiResponse(200, { items }, 'Watch history fetched'));

  } catch (e) { next(e); }
});

export default router;