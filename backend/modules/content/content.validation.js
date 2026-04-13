import Joi from 'joi';

const createCategorySchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  display_order: Joi.number().integer().min(0).default(0),
  is_active: Joi.boolean().default(true),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().min(1).max(100),
  display_order: Joi.number().integer().min(0),
  is_active: Joi.boolean(),
}).min(1);

const createTagSchema = Joi.object({
  name: Joi.string().min(1).max(50).required(),
  is_trending: Joi.boolean().default(false),
});

const updateTagSchema = Joi.object({
  name: Joi.string().min(1).max(50),
  is_trending: Joi.boolean(),
}).min(1);

const createShowSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  synopsis: Joi.string().allow('', null),
  category_id: Joi.string().uuid().required(),
  tag_ids: Joi.array().items(Joi.string().uuid()).default([]),
  feed_position: Joi.number().integer().min(0).default(0),
  is_active: Joi.boolean().default(true),
  thumbnail_url: Joi.string().max(500).allow('', null),
  banner_url: Joi.string().max(500).allow('', null),
});

const updateShowSchema = Joi.object({
  title: Joi.string().min(1).max(255),
  synopsis: Joi.string().allow('', null),
  category_id: Joi.string().uuid(),
  tag_ids: Joi.array().items(Joi.string().uuid()),
  feed_position: Joi.number().integer().min(0),
  is_active: Joi.boolean(),
  thumbnail_url: Joi.string().max(500).allow('', null),
  banner_url: Joi.string().max(500).allow('', null),
}).min(1);

const createEpisodeSchema = Joi.object({
  show_id: Joi.string().uuid().required(),
  episode_num: Joi.number().integer().min(1).required(),
  title: Joi.string().min(1).max(255).required(),
  is_free: Joi.boolean().default(false),
  coin_cost: Joi.number().integer().min(0).default(0),
  duration_sec: Joi.number().integer().min(0).default(0),
});

const updateEpisodeSchema = Joi.object({
  title: Joi.string().min(1).max(255),
  episode_num: Joi.number().integer().min(1),
  is_free: Joi.boolean(),
  coin_cost: Joi.number().integer().min(0),
  duration_sec: Joi.number().integer().min(0),
}).min(1);

export {
  createCategorySchema, updateCategorySchema,
  createTagSchema, updateTagSchema,
  createShowSchema, updateShowSchema,
  createEpisodeSchema, updateEpisodeSchema,
};
