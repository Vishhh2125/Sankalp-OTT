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
} from './payment.controller.js';

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

export default router;

export const subscriptionRouter = express.Router();
subscriptionRouter.get('/current', requireAuth, getCurrentSubscriptionHandler);

export const walletRouter = express.Router();
walletRouter.get('/history', requireAuth, getWalletHistoryHandler);
