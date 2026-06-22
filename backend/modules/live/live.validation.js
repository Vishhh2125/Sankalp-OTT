import Joi from 'joi';

export const createStreamSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  thumbnail_url: Joi.string().max(500).allow('', null),
  scheduled_at: Joi.date().iso().allow(null),
});

export const authHookSchema = Joi.object({
  user: Joi.string().allow(''),
  password: Joi.string().allow(''),
  token: Joi.string().allow(''),
  ip: Joi.string().allow(''),
  action: Joi.string().required(),
  path: Joi.string().allow(''),
  protocol: Joi.string().allow(''),
  id: Joi.string().allow(''),
  query: Joi.string().allow(''),
}).unknown(true);

export const webhookSchema = Joi.object({
  path: Joi.string().required(),
  source_type: Joi.string().allow(''),
  protocol: Joi.string().allow(''),
}).unknown(true);
