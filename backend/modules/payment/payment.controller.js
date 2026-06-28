import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createSubscriptionOrder,
  createWalletOrder,
  verifyAndFulfillOrder,
  getPaymentHistory,
  getCurrentSubscription,
  getWalletHistory,
} from './payment.service.js';

export const createSubscriptionOrderHandler = asyncHandler(async (req, res) => {
  const planId = req.body.plan_id;

  const result = await createSubscriptionOrder({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    planId,
  });

  if (!result.ok) {
    return res
      .status(result.status || 400)
      .json(new ApiResponse(result.status || 400, null, result.message));
  }

  return res.json(
    new ApiResponse(200, result.data, 'Subscription payment order created')
  );
});

export const createWalletOrderHandler = asyncHandler(async (req, res) => {
  const packId = req.body.pack_id;

  const result = await createWalletOrder({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    packId,
  });

  if (!result.ok) {
    return res
      .status(result.status || 400)
      .json(new ApiResponse(result.status || 400, null, result.message));
  }

  return res.json(
    new ApiResponse(200, result.data, 'Wallet payment order created')
  );
});

export const verifyOrderHandler = asyncHandler(async (req, res) => {
  const orderId = req.body.order_id;

  const result = await verifyAndFulfillOrder(req.user.id, orderId);

  if (!result.ok) {
    return res
      .status(result.status || 400)
      .json(new ApiResponse(result.status || 400, result.data || null, result.message));
  }

  return res.json(new ApiResponse(200, result.data, 'Payment verified'));
});

export const getPaymentHistoryHandler = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = parseInt(req.query.offset, 10) || 0;
  const history = await getPaymentHistory(req.user.id, { limit, offset });

  return res.json(
    new ApiResponse(200, history, 'Payment history fetched')
  );
});

export const getCurrentSubscriptionHandler = asyncHandler(async (req, res) => {
  const subscription = await getCurrentSubscription(req.user.id);

  return res.json(
    new ApiResponse(200, subscription, 'Current subscription fetched')
  );
});

export const getWalletHistoryHandler = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = parseInt(req.query.offset, 10) || 0;
  const history = await getWalletHistory(req.user.id, { limit, offset });

  return res.json(
    new ApiResponse(200, history, 'Wallet history fetched')
  );
});
