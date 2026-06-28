import crypto from 'node:crypto';
import logger from '../../config/logger.js';
import { cashfreeConfig, assertCashfreeConfigured } from '../../config/cashfree.js';
import { ApiError } from '../../utils/ApiError.js';

const PAYMENT_STATUS_MAP = {
  SUCCESS: 'completed',
  PAID: 'completed',
  FAILED: 'failed',
  USER_DROPPED: 'cancelled',
  CANCELLED: 'cancelled',
  PENDING: 'pending',
  ACTIVE: 'pending',
};

export function mapCashfreeOrderStatus(orderStatus) {
  const key = String(orderStatus || '').toUpperCase();
  return PAYMENT_STATUS_MAP[key] || 'pending';
}

export function generateCashfreeOrderId(prefix = 'ott') {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${ts}_${rand}`.slice(0, 50);
}

async function cashfreeRequest(method, path, body = null) {
  assertCashfreeConfigured();

  const url = `${cashfreeConfig.baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'x-api-version': cashfreeConfig.apiVersion,
    'x-client-id': cashfreeConfig.appId,
    'x-client-secret': cashfreeConfig.secretKey,
  };

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    logger.error('Cashfree API error', {
      method,
      path,
      status: response.status,
      data,
    });
    const message =
      data?.message ||
      data?.error?.message ||
      `Cashfree request failed (${response.status})`;
    throw new ApiError(response.status >= 500 ? 502 : 400, message);
  }

  return data;
}

/**
 * Create a Cashfree PG order.
 */
export async function createCashfreeOrder({
  orderId,
  amount,
  currency = 'INR',
  customer,
  orderNote,
  orderTags = {},
  idempotencyKey,
}) {
  const orderAmount = Number(amount);
  if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
    throw new ApiError(400, 'Invalid order amount');
  }

  const payload = {
    order_id: orderId,
    order_amount: orderAmount,
    order_currency: currency,
    customer_details: {
      customer_id: String(customer.id),
      customer_email: customer.email,
      customer_phone: customer.phone || '9999999999',
      customer_name: customer.name || 'Customer',
    },
    order_note: orderNote || 'OTT Platform payment',
    order_tags: orderTags,
  };

  if (cashfreeConfig.webhookUrl) {
    payload.order_meta = {
      notify_url: cashfreeConfig.webhookUrl,
    };
  }

  if (cashfreeConfig.returnUrl) {
    payload.order_meta = {
      ...(payload.order_meta || {}),
      return_url: cashfreeConfig.returnUrl.replace('{order_id}', orderId),
    };
  }

  const headers = idempotencyKey
    ? { 'x-idempotency-key': idempotencyKey }
    : undefined;

  assertCashfreeConfigured();
  const url = `${cashfreeConfig.baseUrl}/orders`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-version': cashfreeConfig.apiVersion,
      'x-client-id': cashfreeConfig.appId,
      'x-client-secret': cashfreeConfig.secretKey,
      ...(headers || {}),
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    logger.error('Cashfree create order failed', { status: response.status, data });
    const message =
      data?.message ||
      data?.error?.message ||
      `Failed to create Cashfree order (${response.status})`;
    throw new ApiError(response.status >= 500 ? 502 : 400, message);
  }

  return {
    orderId: data.order_id,
    paymentSessionId: data.payment_session_id,
    orderStatus: data.order_status,
    orderExpiryTime: data.order_expiry_time,
    raw: data,
  };
}

/**
 * Fetch order details from Cashfree (server-side verification).
 */
export async function fetchCashfreeOrder(orderId) {
  return cashfreeRequest('GET', `/orders/${encodeURIComponent(orderId)}`);
}

/**
 * Fetch payments for an order.
 */
export async function fetchCashfreeOrderPayments(orderId) {
  return cashfreeRequest('GET', `/orders/${encodeURIComponent(orderId)}/payments`);
}

/**
 * Verify Cashfree webhook signature (HMAC SHA256, base64).
 */
export function verifyWebhookSignature(rawBody, signature, timestamp) {
  assertCashfreeConfigured();

  if (!signature || !timestamp) {
    return false;
  }

  const signedPayload = `${timestamp}${rawBody}`;
  const expected = crypto
    .createHmac('sha256', cashfreeConfig.secretKey)
    .update(signedPayload)
    .digest('base64');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

/**
 * Reject webhook replays older than maxAgeSeconds (default 5 min).
 */
export function isWebhookTimestampValid(timestamp, maxAgeSeconds = 300) {
  let ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;

  // Convert milliseconds to seconds if timestamp is 13-digit
  if (ts > 99999999999) {
    ts = Math.floor(ts / 1000);
  }

  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - ts) <= maxAgeSeconds;
}

export function getPaymentMethodString(paymentMethod, paymentGroup) {
  if (typeof paymentMethod === 'string') return paymentMethod;
  if (paymentMethod && typeof paymentMethod === 'object') {
    return Object.keys(paymentMethod)[0];
  }
  if (typeof paymentGroup === 'string') return paymentGroup;
  return null;
}

export function extractPaymentDetailsFromOrder(orderData) {
  const payments = orderData?.payments || [];
  const latest = Array.isArray(payments) ? payments[0] : null;

  return {
    orderStatus: orderData?.order_status,
    paymentId: latest?.cf_payment_id || latest?.payment_id || null,
    paymentMethod: latest ? getPaymentMethodString(latest.payment_method, latest.payment_group) : null,
    paymentStatus: latest?.payment_status || null,
  };
}
