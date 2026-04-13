import * as service from './content.service.js';

// ── Categories ──
async function getCategories(req, res, next) {
  try { res.json(await service.getAllCategories()); } catch (e) { next(e); }
}
async function createCategory(req, res, next) {
  try { res.status(201).json(await service.createCategory(req.body, req.admin.id)); } catch (e) { next(e); }
}
async function updateCategory(req, res, next) {
  try { res.json(await service.updateCategory(req.params.id, req.body)); } catch (e) { next(e); }
}
async function deleteCategory(req, res, next) {
  try { res.json(await service.deleteCategory(req.params.id)); } catch (e) { next(e); }
}

// ── Tags ──
async function getTags(req, res, next) {
  try { res.json(await service.getAllTags()); } catch (e) { next(e); }
}
async function createTag(req, res, next) {
  try { res.status(201).json(await service.createTag(req.body)); } catch (e) { next(e); }
}
async function updateTag(req, res, next) {
  try { res.json(await service.updateTag(req.params.id, req.body)); } catch (e) { next(e); }
}
async function deleteTag(req, res, next) {
  try { res.json(await service.deleteTag(req.params.id)); } catch (e) { next(e); }
}

// ── Shows (Dramas) ──
async function getShows(req, res, next) {
  try {
    const { category_id, status, search, page, limit } = req.query;
    res.json(await service.getAllShows({
      category_id, status, search,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
    }));
  } catch (e) { next(e); }
}
async function getShow(req, res, next) {
  try { res.json(await service.getShowById(req.params.id)); } catch (e) { next(e); }
}
async function createShow(req, res, next) {
  try { res.status(201).json(await service.createShow(req.body, req.admin.id)); } catch (e) { next(e); }
}
async function updateShow(req, res, next) {
  try { res.json(await service.updateShow(req.params.id, req.body)); } catch (e) { next(e); }
}
async function deleteShow(req, res, next) {
  try { res.json(await service.deleteShow(req.params.id)); } catch (e) { next(e); }
}
async function togglePublish(req, res, next) {
  try { res.json(await service.toggleShowPublish(req.params.id)); } catch (e) { next(e); }
}
async function updateFeedPosition(req, res, next) {
  try {
    const position = parseInt(req.body.feed_position) || 0;
    res.json(await service.updateFeedPosition(req.params.id, position));
  } catch (e) { next(e); }
}

// ── Episodes ──
async function getEpisodes(req, res, next) {
  try { res.json(await service.getEpisodesByShow(req.params.showId)); } catch (e) { next(e); }
}
async function createEpisode(req, res, next) {
  try { res.status(201).json(await service.createEpisode(req.body)); } catch (e) { next(e); }
}
async function updateEpisode(req, res, next) {
  try { res.json(await service.updateEpisode(req.params.id, req.body)); } catch (e) { next(e); }
}
async function deleteEpisode(req, res, next) {
  try { res.json(await service.deleteEpisode(req.params.id)); } catch (e) { next(e); }
}

export {
  getCategories, createCategory, updateCategory, deleteCategory,
  getTags, createTag, updateTag, deleteTag,
  getShows, getShow, createShow, updateShow, deleteShow, togglePublish, updateFeedPosition,
  getEpisodes, createEpisode, updateEpisode, deleteEpisode,
};
