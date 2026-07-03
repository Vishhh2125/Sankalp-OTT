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

export const getPaystackCallbackHandler = asyncHandler(async (req, res) => {
  const reference = req.query.reference || req.query.trxref || req.query.ref || '';
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Payment Complete</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #0d0010; color: #fff; display: grid; place-items: center; min-height: 100vh; }
    .card { max-width: 480px; padding: 24px; text-align: center; }
    h1 { margin: 0 0 12px; font-size: 24px; }
    p { margin: 0; color: rgba(255,255,255,0.8); }
  </style>
</head>
<body>
  <div class="card">
    <h1>Payment returned successfully</h1>
    <p>${reference ? `Reference: ${reference}` : 'You can close this page and return to the app.'}</p>
  </div>
  <script>
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'success', reference: ${JSON.stringify(reference)} }));
      }
      if (window.opener) {
        window.close();
      }
    } catch (e) {}
  </script>
</body>
</html>`;

  res.type('html').send(html);
});

export const createSubscriptionOrderHandler = asyncHandler(async (req, res) => {
  const planId = req.body.plan_id;
  const gateway = req.body.gateway || 'cashfree';

  const result = await createSubscriptionOrder({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    planId,
    gateway,
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
  const gateway = req.body.gateway || 'cashfree';

  const result = await createWalletOrder({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    packId,
    gateway,
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
