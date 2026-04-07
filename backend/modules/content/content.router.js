import express from 'express';
import * as ctrl from './content.controller.js';
import { devAdmin } from '../../middleware/dev-admin.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  createCategorySchema, updateCategorySchema,
  createTagSchema, updateTagSchema,
  createShowSchema, updateShowSchema,
  createEpisodeSchema, updateEpisodeSchema,
} from './content.validation.js';

const router = express.Router();

// ── Categories ──
router.get('/categories', ctrl.getCategories);
router.post('/categories', devAdmin('Categories'), validate(createCategorySchema), ctrl.createCategory);
router.put('/categories/:id', devAdmin('Categories'), validate(updateCategorySchema), ctrl.updateCategory);
router.delete('/categories/:id', devAdmin('Categories'), ctrl.deleteCategory);

// ── Tags ──
router.get('/tags', ctrl.getTags);
router.post('/tags', devAdmin('Categories'), validate(createTagSchema), ctrl.createTag);
router.put('/tags/:id', devAdmin('Categories'), validate(updateTagSchema), ctrl.updateTag);
router.delete('/tags/:id', devAdmin('Categories'), ctrl.deleteTag);

// ── Shows (Dramas) ──
router.get('/shows', ctrl.getShows);
router.get('/shows/:id', ctrl.getShow);
router.post('/shows', devAdmin('Dramas'), validate(createShowSchema), ctrl.createShow);
router.put('/shows/:id', devAdmin('Dramas'), validate(updateShowSchema), ctrl.updateShow);
router.delete('/shows/:id', devAdmin('Dramas'), ctrl.deleteShow);
router.patch('/shows/:id/publish', devAdmin('Dramas'), ctrl.togglePublish);
router.patch('/shows/:id/feature', devAdmin('Dramas'), ctrl.toggleFeatured);

// ── Episodes ──
router.get('/shows/:showId/episodes', ctrl.getEpisodes);
router.post('/episodes', devAdmin('Dramas'), validate(createEpisodeSchema), ctrl.createEpisode);
//router.post('/episodes', validate(createEpisodeSchema), ctrl.createEpisode);
router.put('/episodes/:id', devAdmin('Dramas'), validate(updateEpisodeSchema), ctrl.updateEpisode);
router.delete('/episodes/:id', devAdmin('Dramas'), ctrl.deleteEpisode);

export default router;

/* After access
const express = require('express');
const router = express.Router();
const ctrl = require('./content.controller');
const { requireAdmin } = require('../../middleware/admin.middleware');
const { validate } = require('../../middleware/validate.middleware');
const {
  createCategorySchema, updateCategorySchema,
  createTagSchema, updateTagSchema,
  createShowSchema, updateShowSchema,
  createEpisodeSchema, updateEpisodeSchema,
} = require('./content.validation');

// ── Categories ──
router.get('/categories', ctrl.getCategories);
router.post('/categories', requireAdmin('Categories'), validate(createCategorySchema), ctrl.createCategory);
router.put('/categories/:id', requireAdmin('Categories'), validate(updateCategorySchema), ctrl.updateCategory);
router.delete('/categories/:id', requireAdmin('Categories'), ctrl.deleteCategory);

// ── Tags ──
router.get('/tags', ctrl.getTags);
router.post('/tags', requireAdmin('Categories'), validate(createTagSchema), ctrl.createTag);
router.put('/tags/:id', requireAdmin('Categories'), validate(updateTagSchema), ctrl.updateTag);
router.delete('/tags/:id', requireAdmin('Categories'), ctrl.deleteTag);

// ── Shows (Dramas) ──
router.get('/shows', ctrl.getShows);
router.get('/shows/:id', ctrl.getShow);
router.post('/shows', requireAdmin('Dramas'), validate(createShowSchema), ctrl.createShow);
router.put('/shows/:id', requireAdmin('Dramas'), validate(updateShowSchema), ctrl.updateShow);
router.delete('/shows/:id', requireAdmin('Dramas'), ctrl.deleteShow);
router.patch('/shows/:id/publish', requireAdmin('Dramas'), ctrl.togglePublish);
router.patch('/shows/:id/feature', requireAdmin('Dramas'), ctrl.toggleFeatured);

// ── Episodes ──
router.get('/shows/:showId/episodes', ctrl.getEpisodes);
router.post('/episodes', requireAdmin('Dramas'), validate(createEpisodeSchema), ctrl.createEpisode);
router.put('/episodes/:id', requireAdmin('Dramas'), validate(updateEpisodeSchema), ctrl.updateEpisode);
router.delete('/episodes/:id', requireAdmin('Dramas'), ctrl.deleteEpisode);

module.exports = router;
*/