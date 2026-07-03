import express from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  createSubscriptionOrderSchema,
  createWalletOrderSchema,
  verifyOrderSchema,
} from './payment.validation.js';
import {
  createSubscriptionOrderHandler,
  createWalletOrderHandler,
  verifyOrderHandler,
  getPaymentHistoryHandler,
  getCurrentSubscriptionHandler,
  getWalletHistoryHandler,
  getPaystackCallbackHandler,
} from './payment.controller.js';
import { verifyCashfreeWebhook } from '../../middleware/verifyCashfreeWebhook.js';
import { handleCashfreeWebhook } from './webhook.controller.js';

const router = express.Router();

router.post(
  '/create-subscription-order',
  requireAuth,
  validate(createSubscriptionOrderSchema),
  createSubscriptionOrderHandler
);

router.post(
  '/create-wallet-order',
  requireAuth,
  validate(createWalletOrderSchema),
  createWalletOrderHandler
);

router.post(
  '/verify-order',
  requireAuth,
  validate(verifyOrderSchema),
  verifyOrderHandler
);

router.get('/history', requireAuth, getPaymentHistoryHandler);

router.get('/paystack/callback', getPaystackCallbackHandler);

// Cashfree webhook — express.raw() preserves raw body needed for HMAC signature verification
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  verifyCashfreeWebhook,
  handleCashfreeWebhook
);

export default router;

export const subscriptionRouter = express.Router();
subscriptionRouter.get('/current', requireAuth, getCurrentSubscriptionHandler);

export const walletRouter = express.Router();
walletRouter.get('/history', requireAuth, getWalletHistoryHandler);
