import { prisma } from '../../prisma/client.js';
import { AppError } from '../../middleware/error.middleware.js';
import { displayedViewCount } from '../user/view-count.service.js';
import minioClient from '../../config/minio.js';
import config from '../../config/index.js';
import { extractYoutubeVideoId } from '../live/live.config.js';

const MINIO_BUCKET = config.minio.bucket;

/**
 * Delete all MinIO objects under a given prefix by listing and batch-removing them.
 * Silent on errors — MinIO cleanup is best-effort; DB delete still proceeds.
 */
async function deleteMinioPrefix(prefix) {
  try {
    const objectNames = await new Promise((resolve, reject) => {
      const names = [];
      const stream = minioClient.listObjectsV2(MINIO_BUCKET, prefix, true);
      stream.on('data', (obj) => names.push(obj.name));
      stream.on('end', () => resolve(names));
      stream.on('error', reject);
    });

    if (objectNames.length === 0) return;

    // minio-js removeObjects takes an array of { name } objects
    await new Promise((resolve, reject) => {
      const objectList = objectNames.map((name) => ({ name }));
      minioClient.removeObjects(MINIO_BUCKET, objectList, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log(`[MinIO] Deleted ${objectNames.length} object(s) under prefix "${prefix}"`);
  } catch (err) {
    // Log but do not throw — storage cleanup failure must not block the DB delete
    console.error(`[MinIO] Failed to delete objects under prefix "${prefix}":`, err.message);
  }
}

/**
 * Delete a single MinIO object silently.
 */
async function deleteMinioObject(objectName) {
  try {
    await minioClient.removeObject(MINIO_BUCKET, objectName);
    console.log(`[MinIO] Deleted object "${objectName}"`);
  } catch (err) {
    console.error(`[MinIO] Failed to delete object "${objectName}":`, err.message);
  }
}

// ═══════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════

async function getAllCategories() {
  return prisma.category.findMany({
    orderBy: { display_order: 'asc' },
    include: { _count: { select: { shows: true } } },
  });
}

async function getCategoryById(id) {
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat) throw new AppError('Category not found', 404);
  return cat;
}

async function createCategory(data, adminId) {
  return prisma.category.create({
    data: { ...data, created_by: adminId },
  });
}

async function updateCategory(id, data) {
  await getCategoryById(id);
  return prisma.category.update({ where: { id }, data });
}

async function deleteCategory(id) {
  await getCategoryById(id);
  // Check if any shows are assigned
  const showCount = await prisma.show.count({ where: { category_id: id } });
  if (showCount > 0) {
    throw new AppError(`Cannot delete: ${showCount} shows are assigned to this category`, 409);
  }
  return prisma.category.delete({ where: { id } });
}

// ═══════════════════════════════════════
// TAGS
// ═══════════════════════════════════════

async function getAllTags() {
  return prisma.tag.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { show_tags: true } } },
  });
}

async function createTag(data) {
  const existing = await prisma.tag.findUnique({ where: { name: data.name } });
  if (existing) throw new AppError('Tag with this name already exists', 409);
  return prisma.tag.create({ data });
}

async function updateTag(id, data) {
  const tag = await prisma.tag.findUnique({ where: { id } });
  if (!tag) throw new AppError('Tag not found', 404);
  if (data.name && data.name !== tag.name) {
    const dup = await prisma.tag.findUnique({ where: { name: data.name } });
    if (dup) throw new AppError('Tag name already taken', 409);
  }
  return prisma.tag.update({ where: { id }, data });
}

async function deleteTag(id) {
  const tag = await prisma.tag.findUnique({ where: { id } });
  if (!tag) throw new AppError('Tag not found', 404);
  // Cascade deletes show_tags automatically (onDelete: Cascade in schema)
  return prisma.tag.delete({ where: { id } });
}

// ═══════════════════════════════════════
// SHOWS (Dramas)
// ═══════════════════════════════════════

async function getAllShows({
  category_id,
  status,
  search,
  page = 1,
  limit = 50,
  include_inactive = false,
  requesting_user = null,
} = {}) {
  const where = {};
  if (category_id) where.category_id = category_id;

  if (requesting_user && (requesting_user.role === 'ADMIN' || requesting_user.role === 'SUB_ADMIN' || requesting_user.role === 'TEACHER')) {
    include_inactive = true;
  }

  if (requesting_user && requesting_user.role === 'TEACHER') {
    where.teacher_id = requesting_user.id;
  } else if (requesting_user && (requesting_user.role === 'ADMIN' || requesting_user.role === 'SUB_ADMIN')) {
    // Admins see all shows, including teacher drafts
  } else if (!requesting_user || requesting_user.role === 'USER') {
    where.approval_status = 'PUBLISHED';
    where.is_active = true;
  }

  if (status === 'Published') where.is_active = true;
  else if (status === 'Draft') where.is_active = false;
  else if (!include_inactive && (!requesting_user || requesting_user.role === 'USER')) {
    where.is_active = true;
    where.approval_status = 'PUBLISHED';
  }
  if (search) {
    const term = String(search).trim();
    const tokens = term.split(/\s+/).filter(Boolean);
    const orConditions = [
      { title: { contains: term, mode: 'insensitive' } },
      { synopsis: { contains: term, mode: 'insensitive' } },
      {
        show_tags: {
          some: {
            tag: { name: { contains: term, mode: 'insensitive' } },
          },
        },
      },
    ];

    for (const token of tokens) {
      orConditions.push({
        show_tags: {
          some: {
            tag: { name: { contains: token, mode: 'insensitive' } },
          },
        },
      });
    }

    where.OR = orConditions;
  }

  const [shows, total] = await Promise.all([
    prisma.show.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        category: { select: { id: true, name: true } },
        show_tags: { include: { tag: { select: { id: true, name: true } } } },
        teacher: { select: { id: true, name: true } },
        _count: { select: { episodes: true } },
        episodes: { select: { id: true } }, // needed to count unlocks
      },
    }),
    prisma.show.count({ where }),
  ]);

  // Batch-fetch unlock counts for all shows in one query
  const allEpisodeIds = shows.flatMap(s => s.episodes.map(e => e.id));
  const unlockCounts = allEpisodeIds.length > 0
    ? await prisma.episodeAccess.groupBy({
        by: ['episode_id'],
        where: { episode_id: { in: allEpisodeIds } },
        _count: { episode_id: true },
      })
    : [];

  // Build episodeId -> unlock count map
  const unlockMap = {};
  for (const row of unlockCounts) {
    unlockMap[row.episode_id] = row._count.episode_id;
  }

  // Transform to flat format the frontend expects
  const items = shows.map((s) => {
    const unlock_count = s.episodes.reduce((sum, ep) => sum + (unlockMap[ep.id] || 0), 0);
    return {
      id: s.id,
      title: s.title,
      synopsis: s.synopsis,
      category: s.category.name,
      category_id: s.category.id,
      status: s.is_active ? 'Published' : 'Draft',
      approval_status: s.approval_status,
      teacher_id: s.teacher_id,
      teacher: s.teacher ? { id: s.teacher.id, name: s.teacher.name } : null,
      tags: s.show_tags.map((st) => st.tag.name),
      tag_ids: s.show_tags.map((st) => st.tag.id),
      view_count: displayedViewCount(s),
      unlock_count,
      rating_avg: s.rating_avg,
      rating_count: s.rating_count,
      feed_position: s.feed_position,
      thumbnail_url: s.thumbnail_url,
      banner_url: s.banner_url,
      episode_count: s._count.episodes,
      is_free: s.is_free,
      coin_cost: s.coin_cost,
      created_at: s.created_at,
    };
  });

  return { items, total, page, limit };
}

async function getShowById(id, requesting_user = null) {
  const show = await prisma.show.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      show_tags: { include: { tag: { select: { id: true, name: true } } } },
      episodes: { orderBy: { episode_num: 'asc' } },
      teacher: {
        select: {
          id: true,
          name: true,
          teacherProfile: true,
        },
      },
    },
  });
  if (!show) throw new AppError('Show not found', 404);

  // Check show visibility if requesting_user is student or guest
  const isAdminOrTeacherOwner = 
    requesting_user && 
    (requesting_user.role === 'ADMIN' || 
     requesting_user.role === 'SUB_ADMIN' ||
     (requesting_user.role === 'TEACHER' && show.teacher_id === requesting_user.id));

  if (!isAdminOrTeacherOwner && (show.approval_status !== 'PUBLISHED' || !show.is_active)) {
    throw new AppError('Show not found', 404);
  }

  // Filter episodes if not admin/teacher owner
  let episodes = show.episodes;
  if (!isAdminOrTeacherOwner) {
    episodes = episodes.filter(e => e.approval_status === 'PUBLISHED');
  }

  return {
    ...show,
    episodes,
    view_count: displayedViewCount(show),
    thumbnail_url: show.thumbnail_url,
    category_name: show.category.name,
    tags: show.show_tags.map((st) => st.tag.name),
    tag_ids: show.show_tags.map((st) => st.tag.id),
    status: show.is_active ? 'Published' : 'Draft',
    teacher: show.teacher ? { id: show.teacher.id, name: show.teacher.name } : null,
    teacher_profile: show.teacher?.teacherProfile || null,
  };
}

/** Up to 6 published dramas sharing at least one tag with the given show. */
async function getRelatedShows(showId, limit = 6) {
  const show = await prisma.show.findUnique({
    where: { id: showId },
    include: { show_tags: { select: { tag_id: true } } },
  });
  if (!show) throw new AppError('Show not found', 404);

  const tagIds = show.show_tags.map((st) => st.tag_id);
  if (tagIds.length === 0) return { items: [] };

  const tagIdSet = new Set(tagIds);
  const candidates = await prisma.show.findMany({
    where: {
      id: { not: showId },
      is_active: true,
      approval_status: 'PUBLISHED',
      show_tags: { some: { tag_id: { in: tagIds } } },
    },
    take: Math.min(limit * 4, 24),
    include: {
      category: { select: { id: true, name: true } },
      show_tags: { include: { tag: { select: { id: true, name: true } } } },
      _count: { select: { episodes: true } },
    },
  });

  const ranked = candidates
    .map((s) => ({
      show: s,
      matchCount: s.show_tags.filter((st) => tagIdSet.has(st.tag_id)).length,
    }))
    .sort(
      (a, b) =>
        b.matchCount - a.matchCount
        || b.show.created_at.getTime() - a.show.created_at.getTime()
    )
    .slice(0, limit)
    .map(({ show: s }) => s);

  const items = ranked.map((s) => ({
    id: s.id,
    title: s.title,
    synopsis: s.synopsis,
    category: s.category.name,
    category_id: s.category.id,
    status: 'Published',
    tags: s.show_tags.map((st) => st.tag.name),
    tag_ids: s.show_tags.map((st) => st.tag.id),
    view_count: displayedViewCount(s),
    rating_avg: s.rating_avg,
    rating_count: s.rating_count,
    thumbnail_url: s.thumbnail_url,
    episode_count: s._count.episodes,
  }));

  return { items };
}

async function createShow(data, admin) {
  const { tag_ids = [], ...showData } = data;

  // Verify category exists
  const cat = await prisma.category.findUnique({ where: { id: showData.category_id } });
  if (!cat) throw new AppError('Category not found', 404);

  // Map status string to is_active boolean
  const is_active = showData.is_active !== undefined ? showData.is_active : false;

  // If creating with a feed position, shift existing positions down
  const feedPos = showData.feed_position || 0;
  if (feedPos > 0) {
    await prisma.show.updateMany({
      where: { feed_position: { gte: feedPos } },
      data: { feed_position: { increment: 1 } },
    });
  }

  const createData = {
    title: showData.title,
    synopsis: showData.synopsis || null,
    category_id: showData.category_id,
    feed_position: showData.feed_position || 0,
    is_active,
    is_free: showData.is_free !== undefined ? showData.is_free : true,
    coin_cost: showData.coin_cost !== undefined ? showData.coin_cost : 0,
    thumbnail_url: showData.thumbnail_url || null,
    banner_url: showData.banner_url || null,
    manual_view_count: showData.manual_view_count || 0,
    teacher_id: showData.teacher_id || null,
    show_tags: {
      create: tag_ids.map((tag_id) => ({ tag_id })),
    },
  };

  // If the creator is a teacher OR a teacher is assigned by admin, start as unpublished draft
  if ((admin && admin.role === 'TEACHER') || showData.teacher_id) {
    if (admin && admin.role === 'TEACHER') {
      createData.teacher_id = admin.id;
    }
    createData.is_active = false; // teachers' shows start unpublished
    createData.approval_status = 'DRAFT';
  }

  const show = await prisma.show.create({
    data: createData,
    include: {
      category: { select: { id: true, name: true } },
      show_tags: { include: { tag: { select: { id: true, name: true } } } },
    },
  });

  return show;
}

async function updateShow(id, data) {
  const existing = await prisma.show.findUnique({
    where: { id },
    include: { _count: { select: { episodes: true } } }
  });
  if (!existing) throw new AppError('Show not found', 404);

  if (data.approval_status === 'PENDING_REVIEW' && existing._count.episodes === 0) {
    throw new AppError('Cannot submit a course for review with zero episodes', 400);
  }

  const { tag_ids, ...showData } = data;

  // If tag_ids provided, replace all tags
  if (tag_ids !== undefined) {
    await prisma.showTag.deleteMany({ where: { show_id: id } });
    await prisma.showTag.createMany({
      data: tag_ids.map((tag_id) => ({ show_id: id, tag_id })),
    });
  }

  // If feed_position is being changed, run auto-shift logic
  if (showData.feed_position !== undefined && showData.feed_position !== existing.feed_position) {
    const newPos = showData.feed_position;
    const oldPos = existing.feed_position;

    if (newPos === 0 && oldPos > 0) {
      // Removing from feed: shift others up to fill the gap
      await prisma.show.updateMany({
        where: { feed_position: { gt: oldPos }, id: { not: id } },
        data: { feed_position: { decrement: 1 } },
      });
    } else if (newPos > 0) {
      if (oldPos === 0) {
        // New entry into feed: shift everything at newPos and below DOWN
        await prisma.show.updateMany({
          where: { feed_position: { gte: newPos }, id: { not: id } },
          data: { feed_position: { increment: 1 } },
        });
      } else if (newPos < oldPos) {
        // Moving UP (e.g. 5 to 2): shift positions 2-4 DOWN
        await prisma.show.updateMany({
          where: { feed_position: { gte: newPos, lt: oldPos }, id: { not: id } },
          data: { feed_position: { increment: 1 } },
        });
      } else if (newPos > oldPos) {
        // Moving DOWN (e.g. 2 to 5): shift positions 3-5 UP
        await prisma.show.updateMany({
          where: { feed_position: { gt: oldPos, lte: newPos }, id: { not: id } },
          data: { feed_position: { decrement: 1 } },
        });
      }
    }
  }

  if (showData.is_free === true) {
    const showOnlyEpisodes = await prisma.episode.count({
      where: { show_id: id, is_show_only: true },
    });
    if (showOnlyEpisodes > 0) {
      throw new AppError('Cannot make show free while it contains show-only episodes', 400);
    }
  }

  if (showData.is_active !== undefined && !showData.approval_status) {
    showData.approval_status = showData.is_active ? 'PUBLISHED' : 'DRAFT';
  }

  const show = await prisma.show.update({
    where: { id },
    data: showData,
    include: {
      category: { select: { id: true, name: true } },
      show_tags: { include: { tag: { select: { id: true, name: true } } } },
    },
  });

  return show;
}

async function deleteShow(id) {
  const show = await prisma.show.findUnique({
    where: { id },
    select: {
      id: true,
      feed_position: true,
      episodes: { select: { id: true } },
    },
  });

  if (!show) throw new AppError('Show not found', 404);

  // ── MinIO cleanup (best-effort, never blocks DB delete) ──
  // 1. Delete raw source video for each episode: raw/{episodeId}/video.mp4
  if (show.episodes && show.episodes.length > 0) {
    for (const ep of show.episodes) {
      await deleteMinioObject(`raw/${ep.id}/video.mp4`);
    }
  }

  // 2. Delete all files under dramas/{showId}/ (thumbnails, banners, episode HLS streams)
  await deleteMinioPrefix(`dramas/${id}/`);

  // If show was in the feed, shift higher feed_positions down to fill gap
  if (show.feed_position > 0) {
    await prisma.show.updateMany({
      where: { feed_position: { gt: show.feed_position } },
      data: { feed_position: { decrement: 1 } },
    });
  }

  // Manually delete dependent records that aren't on ON DELETE CASCADE
  await prisma.$transaction([
    prisma.rating.deleteMany({ where: { show_id: id } }),
    prisma.viewCountEvent.deleteMany({ where: { show_id: id } }),
  ]);

  // Cascade deletes episodes, show_tags, episode_access, watch_history, etc.
  return prisma.show.delete({ where: { id } });
}

async function toggleShowPublish(id) {
  const show = await prisma.show.findUnique({ where: { id } });
  if (!show) throw new AppError('Show not found', 404);
  const newActive = !show.is_active;
  return prisma.show.update({
    where: { id },
    data: {
      is_active: newActive,
      approval_status: newActive ? 'PUBLISHED' : 'DRAFT',
    },
  });
}

async function updateFeedPosition(id, newPosition) {
  const show = await prisma.show.findUnique({ where: { id } });
  if (!show) throw new AppError('Show not found', 404);

  const oldPosition = show.feed_position;

  // If setting to 0 (removing from feed), shift others up to fill the gap
  if (newPosition === 0 && oldPosition > 0) {
    await prisma.show.updateMany({
      where: { feed_position: { gt: oldPosition } },
      data: { feed_position: { decrement: 1 } },
    });
  }

  // If inserting into a position (newPosition > 0)
  if (newPosition > 0) {
    if (oldPosition === 0 || oldPosition === null) {
      // New entry: shift everything at newPosition and below DOWN by 1
      await prisma.show.updateMany({
        where: { feed_position: { gte: newPosition }, id: { not: id } },
        data: { feed_position: { increment: 1 } },
      });
    } else if (newPosition < oldPosition) {
      // Moving UP (e.g. from position 5 to position 2): shift positions 2-4 DOWN by 1
      await prisma.show.updateMany({
        where: {
          feed_position: { gte: newPosition, lt: oldPosition },
          id: { not: id },
        },
        data: { feed_position: { increment: 1 } },
      });
    } else if (newPosition > oldPosition) {
      // Moving DOWN (e.g. from position 2 to position 5): shift positions 3-5 UP by 1
      await prisma.show.updateMany({
        where: {
          feed_position: { gt: oldPosition, lte: newPosition },
          id: { not: id },
        },
        data: { feed_position: { decrement: 1 } },
      });
    }
    // If same position, no shift needed
  }

  return prisma.show.update({
    where: { id },
    data: { feed_position: newPosition },
    include: {
      category: { select: { id: true, name: true } },
      show_tags: { include: { tag: { select: { id: true, name: true } } } },
    },
  });
}

// ═══════════════════════════════════════
// EPISODES
// ═══════════════════════════════════════

async function getEpisodesByShow(showId, requesting_user = null) {
  const show = await prisma.show.findUnique({ where: { id: showId } });
  if (!show) throw new AppError('Show not found', 404);

  if (requesting_user && requesting_user.role === 'TEACHER' && show.teacher_id !== requesting_user.id) {
    throw new AppError('Access denied', 403);
  }

  const where = { show_id: showId };

  // For students and guests, only show published episodes
  const isAdminOrTeacherOwner = 
    requesting_user && 
    (requesting_user.role === 'ADMIN' || 
     requesting_user.role === 'SUB_ADMIN' ||
     (requesting_user.role === 'TEACHER' && show.teacher_id === requesting_user.id));

  if (!isAdminOrTeacherOwner) {
    where.approval_status = 'PUBLISHED';
  }

  return prisma.episode.findMany({
    where,
    orderBy: { episode_num: 'asc' },
  });
}

async function createEpisode(data, admin) {
  const show = await prisma.show.findUnique({ where: { id: data.show_id } });
  if (!show) throw new AppError('Course not found', 404);

  if (data.is_show_only === true && show.is_free) {
    throw new AppError('Course-only episodes are not allowed on free courses', 400);
  }

  // Auto-assign episode number if not provided or if it conflicts
  if (!data.episode_num) {
    const lastEp = await prisma.episode.findFirst({
      where: { show_id: data.show_id },
      orderBy: { episode_num: 'desc' },
    });
    data.episode_num = (lastEp?.episode_num || 0) + 1;
  }

  const isYouTube = data.video_source === 'YOUTUBE';
  const youtubeId = isYouTube ? extractYoutubeVideoId(data.youtube_video_id) : null;
  if (isYouTube && !youtubeId) {
    throw new AppError('Invalid YouTube video ID or URL', 400);
  }

  // New episodes should start pending until a video upload is confirmed,
  // EXCEPT for YouTube videos which are instantly ready.
  const episodeData = {
    ...data,
    status: isYouTube ? 'ready' : (data.status || 'pending'),
    total_profiles: data.total_profiles ?? 4,
    completed_profiles: data.completed_profiles ?? 0,
    video_source: isYouTube ? 'YOUTUBE' : 'UPLOAD',
    youtube_video_id: youtubeId,
  };

  if (admin && admin.role === 'TEACHER') {
    episodeData.approval_status = 'DRAFT';
  } else if (!data.approval_status) {
    episodeData.approval_status = 'PUBLISHED';
  }

  return prisma.episode.create({ data: episodeData });
}

async function updateEpisode(id, data, admin) {
  const ep = await prisma.episode.findUnique({ where: { id } });
  if (!ep) throw new AppError('Lecture not found', 404);

  const updateData = { ...data };

  if (updateData.is_show_only === true) {
    const show = await prisma.show.findUnique({ where: { id: ep.show_id } });
    if (show && show.is_free) {
      throw new AppError('Show-only Lectures are not allowed on free shows', 400);
    }
  }

  const parentShow = await prisma.show.findUnique({ where: { id: ep.show_id } });
  const isTeacherShow = !!parentShow?.teacher_id;
  const isTeacherActor = admin && admin.role === 'TEACHER';
  
  if (updateData.video_source === 'YOUTUBE' || (updateData.youtube_video_id && ep.video_source === 'YOUTUBE')) {
    const youtubeId = extractYoutubeVideoId(updateData.youtube_video_id || ep.youtube_video_id);
    if (!youtubeId) throw new AppError('Invalid YouTube video ID or URL', 400);
    
    const videoChanged = ep.video_source !== 'YOUTUBE' || ep.youtube_video_id !== youtubeId;
    if (isTeacherShow && isTeacherActor && videoChanged) {
      updateData.approval_status = 'DRAFT';
    }

    updateData.youtube_video_id = youtubeId;
    updateData.status = 'ready';
    updateData.video_source = 'YOUTUBE';
  } else if (updateData.video_source === 'UPLOAD' && ep.video_source !== 'UPLOAD') {
    if (isTeacherShow && isTeacherActor) {
      updateData.approval_status = 'DRAFT';
    }
    updateData.youtube_video_id = null;
    updateData.status = 'pending';
  }

  return prisma.episode.update({ where: { id }, data: updateData });
}

async function deleteEpisode(id) {
  const ep = await prisma.episode.findUnique({ where: { id } });
  if (!ep) throw new AppError('Lecture not found', 404);

  // ── MinIO cleanup (best-effort, never blocks DB delete) ──
  // 1. Delete all transcoded HLS files: dramas/{showId}/episodes/{episodeId}/
  await deleteMinioPrefix(`dramas/${ep.show_id}/episodes/${id}/`);

  // 2. Delete raw source video: raw/{episodeId}/video.mp4
  await deleteMinioObject(`raw/${id}/video.mp4`);

  // Use transaction to ensure delete + renumber happens atomically
  await prisma.$transaction(async (tx) => {
    // Delete the episode
    await tx.episode.delete({ where: { id } });

    // Renumber remaining episodes - use a temporary negative number to avoid conflicts
    const remaining = await tx.episode.findMany({
      where: { show_id: ep.show_id },
      orderBy: { episode_num: 'asc' },
    });

    // First pass: set temporary negative numbers to avoid unique constraint violations
    for (let i = 0; i < remaining.length; i++) {
      await tx.episode.update({
        where: { id: remaining[i].id },
        data: { episode_num: -(i + 1) },
      });
    }

    // Second pass: convert negative numbers to final sequence
    for (let i = 0; i < remaining.length; i++) {
      await tx.episode.update({
        where: { id: remaining[i].id },
        data: { episode_num: i + 1 },
      });
    }
  });

  return { deleted: true };
}

// ═══════════════════════════════════════
// HOME PROMOTIONS (mobile app)
// ═══════════════════════════════════════

const NOTIFICATION_EMOJI = {
  drama: '🎬',
  membership: '👑',
  reward: '🎁',
  reminder: '⏰',
  're-engage': '📞',
  custom: '📬',
};

function emojiForNotificationType(type) {
  return NOTIFICATION_EMOJI[String(type || '').toLowerCase()] || '📬';
}

/**
 * Up to 3 most recent active homepage banners (admin toggle + optional date window).
 */
async function getActiveHomeBanners(limit = 3) {
  const now = new Date();
  const banners = await prisma.banner.findMany({
    where: {
      is_active: true,
      show_id: { not: null },
      AND: [
        { OR: [{ starts_at: null }, { starts_at: { lte: now } }] },
        { OR: [{ ends_at: null }, { ends_at: { gte: now } }] },
      ],
    },
    orderBy: { created_at: 'desc' },
    take: limit,
    include: {
      show: {
        select: {
          id: true,
          title: true,
          thumbnail_url: true,
          banner_url: true,
          synopsis: true,
        },
      },
    },
  });

  return banners.map((b) => ({
    id: b.id,
    title: b.title,
    image_url: b.image_url,
    show_id: b.show_id,
    show_title: b.show?.title || b.title,
    show_thumbnail_url: b.show?.thumbnail_url || null,
    show_synopsis: b.show?.synopsis || null,
  }));
}

/**
 * Active hero slider banners ordered by display_order (1st, 2nd, …).
 */
async function getActiveHeroBanners(limit = 10) {
  const now = new Date();
  const banners = await prisma.heroBanner.findMany({
    where: {
      is_active: true,
      show_id: { not: null },
      AND: [
        { OR: [{ starts_at: null }, { starts_at: { lte: now } }] },
        { OR: [{ ends_at: null }, { ends_at: { gte: now } }] },
      ],
    },
    orderBy: [{ display_order: 'asc' }, { created_at: 'asc' }],
    take: limit,
    include: {
      show: {
        select: {
          id: true,
          title: true,
          thumbnail_url: true,
          banner_url: true,
          synopsis: true,
          is_active: true,
        },
      },
    },
  });

  return banners
    .filter((b) => b.show?.is_active !== false)
    .map((b) => ({
      id: b.id,
      title: b.title,
      image_url: b.image_url,
      display_order: b.display_order,
      show_id: b.show_id,
      show_title: b.show?.title || b.title,
      show_thumbnail_url: b.show?.thumbnail_url || null,
      show_synopsis: b.show?.synopsis || null,
    }));
}

/**
 * Up to 3 most recent admin broadcast notifications (deduped by title+body+type).
 */
async function getLatestAnnouncements(limit = 3) {
  const rows = await prisma.notificationLog.findMany({
    orderBy: { sent_at: 'desc' },
    take: 150,
    select: {
      title: true,
      body: true,
      type: true,
      sent_at: true,
    },
  });

  const seen = new Set();
  const announcements = [];

  for (const row of rows) {
    const key = `${row.title}::${row.body}::${row.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    announcements.push({
      id: `ann_${row.sent_at.getTime()}_${row.type}`,
      title: row.title,
      body: row.body,
      type: row.type,
      emoji: emojiForNotificationType(row.type),
      sent_at: row.sent_at,
    });
    if (announcements.length >= limit) break;
  }

  return announcements;
}

export {
  getAllCategories, getCategoryById, createCategory, updateCategory, deleteCategory,
  getAllTags, createTag, updateTag, deleteTag,
  getAllShows, getShowById, getRelatedShows, createShow, updateShow, deleteShow, toggleShowPublish, updateFeedPosition,
  getEpisodesByShow, createEpisode, updateEpisode, deleteEpisode,
  getActiveHomeBanners, getActiveHeroBanners, getLatestAnnouncements,
};