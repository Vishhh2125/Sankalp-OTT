import Joi from 'joi';

export const createSubscriptionOrderSchema = Joi.object({
  plan_id: Joi.string().uuid().required(),
  gateway: Joi.string().valid('cashfree', 'paystack').default('cashfree'),
});

export const createWalletOrderSchema = Joi.object({
  pack_id: Joi.string().uuid().required(),
  gateway: Joi.string().valid('cashfree', 'paystack').default('cashfree'),
});

export const verifyOrderSchema = Joi.object({
  order_id: Joi.string().trim().min(5).max(255).required(),
});
