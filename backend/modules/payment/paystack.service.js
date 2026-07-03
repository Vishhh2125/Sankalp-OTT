import crypto from 'node:crypto';
import logger from '../../config/logger.js';
import { paystackConfig, assertPaystackConfigured } from '../../config/paystack.js';
import { ApiError } from '../../utils/ApiError.js';

const PAYMENT_STATUS_MAP = {
  success: 'completed',
  failed: 'failed',
  abandoned: 'cancelled',
  pending: 'pending',
};

export function mapPaystackTransactionStatus(status) {
  const key = String(status || '').toLowerCase();
  return PAYMENT_STATUS_MAP[key] || 'pending';
}

export function generatePaystackReference(prefix = 'ott') {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${ts}_${rand}`.slice(0, 50);
}

async function paystackRequest(method, path, body = null) {
  assertPaystackConfigured();

  const response = await fetch(`${paystackConfig.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${paystackConfig.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    logger.error('Paystack API error', {
      method,
      path,
      status: response.status,
      data,
    });
    const message = data?.message || data?.error || `Paystack request failed (${response.status})`;
    throw new ApiError(response.status >= 500 ? 502 : 400, message);
  }

  return data;
}

export async function initializePaystackTransaction({
  reference,
  amount,
  currency = paystackConfig.currency,
  email,
  callbackUrl,
  metadata = {},
}) {
  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new ApiError(400, 'Invalid order amount');
  }

  if (!email) {
    throw new ApiError(400, 'Customer email is required for Paystack');
  }

  const payload = {
    email,
    amount: Math.round(normalizedAmount * 100),
    currency,
    reference,
    callback_url: callbackUrl || paystackConfig.callbackUrl || undefined,
    metadata,
  };

  const data = await paystackRequest('POST', '/transaction/initialize', payload);

  return {
    authorizationUrl: data?.data?.authorization_url || null,
    accessCode: data?.data?.access_code || null,
    reference: data?.data?.reference || reference,
    raw: data,
  };
}

export async function verifyPaystackTransaction(reference) {
  return paystackRequest('GET', `/transaction/verify/${encodeURIComponent(reference)}`);
}

export function extractPaystackPaymentDetails(transactionData) {
  return {
    transactionReference: transactionData?.reference || null,
    paymentId: transactionData?.id ? String(transactionData.id) : null,
    paymentMethod: transactionData?.channel || transactionData?.authorization?.channel || null,
    paymentStatus: transactionData?.status || null,
  };
}

export function verifyPaystackWebhookSignature(rawBody, signature) {
  assertPaystackConfigured();

  if (!signature) {
    return false;
  }

  const expected = crypto
    .createHmac('sha512', paystackConfig.secretKey)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
