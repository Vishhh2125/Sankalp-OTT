import { prisma } from '../../prisma/client.js';
import { AppError } from '../../middleware/error.middleware.js';

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

async function getAllShows({ category_id, status, search, page = 1, limit = 50 } = {}) {
  const where = {};
  if (category_id) where.category_id = category_id;
  if (status === 'Published') where.is_active = true;
  if (status === 'Draft') where.is_active = false;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { synopsis: { contains: search, mode: 'insensitive' } },
    ];
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
        _count: { select: { episodes: true } },
      },
    }),
    prisma.show.count({ where }),
  ]);

  // Transform to flat format the frontend expects
  const items = shows.map((s) => ({
    id: s.id,
    title: s.title,
    synopsis: s.synopsis,
    category: s.category.name,
    category_id: s.category.id,
    status: s.is_active ? 'Published' : 'Draft',
    tags: s.show_tags.map((st) => st.tag.name),
    tag_ids: s.show_tags.map((st) => st.tag.id),
    view_count: s.view_count,
    rating_avg: s.rating_avg,
    rating_count: s.rating_count,
    is_featured_for_you: s.is_featured_for_you,
    thumbnail_url: s.thumbnail_url,
    banner_url: s.banner_url,
    episode_count: s._count.episodes,
    created_at: s.created_at,
  }));

  return { items, total, page, limit };
}

async function getShowById(id) {
  const show = await prisma.show.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      show_tags: { include: { tag: { select: { id: true, name: true } } } },
      episodes: { orderBy: { episode_num: 'asc' } },
    },
  });
  if (!show) throw new AppError('Show not found', 404);
  return {
    ...show,
    category_name: show.category.name,
    tags: show.show_tags.map((st) => st.tag.name),
    tag_ids: show.show_tags.map((st) => st.tag.id),
    status: show.is_active ? 'Published' : 'Draft',
  };
}

async function createShow(data, adminId) {
  const { tag_ids = [], ...showData } = data;

  // Verify category exists
  const cat = await prisma.category.findUnique({ where: { id: showData.category_id } });
  if (!cat) throw new AppError('Category not found', 404);

  // Map status string to is_active boolean
  const is_active = showData.is_active !== undefined ? showData.is_active : false;

  const show = await prisma.show.create({
    data: {
      title: showData.title,
      synopsis: showData.synopsis || null,
      category_id: showData.category_id,
      is_featured_for_you: showData.is_featured_for_you || false,
      is_active,
      thumbnail_url: showData.thumbnail_url || null,
      banner_url: showData.banner_url || null,
      show_tags: {
        create: tag_ids.map((tag_id) => ({ tag_id })),
      },
    },
    include: {
      category: { select: { id: true, name: true } },
      show_tags: { include: { tag: { select: { id: true, name: true } } } },
    },
  });

  return show;
}

async function updateShow(id, data) {
  const existing = await prisma.show.findUnique({ where: { id } });
  if (!existing) throw new AppError('Show not found', 404);

  const { tag_ids, ...showData } = data;

  // If tag_ids provided, replace all tags
  if (tag_ids !== undefined) {
    await prisma.showTag.deleteMany({ where: { show_id: id } });
    await prisma.showTag.createMany({
      data: tag_ids.map((tag_id) => ({ show_id: id, tag_id })),
    });
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
  const show = await prisma.show.findUnique({ where: { id } });
  if (!show) throw new AppError('Show not found', 404);
  // Cascade deletes episodes, show_tags, etc.
  return prisma.show.delete({ where: { id } });
}

async function toggleShowPublish(id) {
  const show = await prisma.show.findUnique({ where: { id } });
  if (!show) throw new AppError('Show not found', 404);
  return prisma.show.update({
    where: { id },
    data: { is_active: !show.is_active },
  });
}

async function toggleShowFeatured(id) {
  const show = await prisma.show.findUnique({ where: { id } });
  if (!show) throw new AppError('Show not found', 404);
  return prisma.show.update({
    where: { id },
    data: { is_featured_for_you: !show.is_featured_for_you },
  });
}

// ═══════════════════════════════════════
// EPISODES
// ═══════════════════════════════════════

async function getEpisodesByShow(showId) {
  const show = await prisma.show.findUnique({ where: { id: showId } });
  if (!show) throw new AppError('Show not found', 404);
  return prisma.episode.findMany({
    where: { show_id: showId },
    orderBy: { episode_num: 'asc' },
  });
}

async function createEpisode(data) {
  const show = await prisma.show.findUnique({ where: { id: data.show_id } });
  if (!show) throw new AppError('Show not found', 404);

  // Auto-assign episode number if not provided or if it conflicts
  if (!data.episode_num) {
    const lastEp = await prisma.episode.findFirst({
      where: { show_id: data.show_id },
      orderBy: { episode_num: 'desc' },
    });
    data.episode_num = (lastEp?.episode_num || 0) + 1;
  }

  // New episodes should start pending until a video upload is confirmed
  const episodeData = {
    ...data,
    status: data.status || 'pending',
    total_profiles: data.total_profiles ?? 4,
    completed_profiles: data.completed_profiles ?? 0,
  };

  return prisma.episode.create({ data: episodeData });
}

async function updateEpisode(id, data) {
  const ep = await prisma.episode.findUnique({ where: { id } });
  if (!ep) throw new AppError('Episode not found', 404);
  return prisma.episode.update({ where: { id }, data });
}

async function deleteEpisode(id) {
  const ep = await prisma.episode.findUnique({ where: { id } });
  if (!ep) throw new AppError('Episode not found', 404);

  await prisma.episode.delete({ where: { id } });

  // Renumber remaining episodes
  const remaining = await prisma.episode.findMany({
    where: { show_id: ep.show_id },
    orderBy: { episode_num: 'asc' },
  });
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].episode_num !== i + 1) {
      await prisma.episode.update({
        where: { id: remaining[i].id },
        data: { episode_num: i + 1 },
      });
    }
  }

  return { deleted: true };
}

export {
  getAllCategories, getCategoryById, createCategory, updateCategory, deleteCategory,
  getAllTags, createTag, updateTag, deleteTag,
  getAllShows, getShowById, createShow, updateShow, deleteShow, toggleShowPublish, toggleShowFeatured,
  getEpisodesByShow, createEpisode, updateEpisode, deleteEpisode,
};
