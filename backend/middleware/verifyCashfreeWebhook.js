import crypto from 'node:crypto';
import logger from '../config/logger.js';
import { cashfreeConfig } from '../config/cashfree.js';
import {
  isWebhookTimestampValid,
  verifyWebhookSignature,
} from '../modules/payment/cashfree.service.js';

/**
 * Verify Cashfree webhook signature and timestamp.
 * Expects express.raw() body on req — attach before express.json().
 */
export function verifyCashfreeWebhook(req, res, next) {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  const eventId = req.headers['x-webhook-attempt'] || req.headers['x-idempotency-key'];

  if (!cashfreeConfig.appId || !cashfreeConfig.secretKey) {
    logger.error('Cashfree webhook received but credentials not configured');
    return res.status(503).json({ success: false, message: 'Payment gateway not configured' });
  }

  const rawBody = req.body;
  if (!Buffer.isBuffer(rawBody)) {
    logger.warn('Cashfree webhook: raw body missing — ensure express.raw() is used');
    return res.status(400).json({ success: false, message: 'Invalid webhook payload' });
  }

  const rawBodyString = rawBody.toString('utf8');

  if (!isWebhookTimestampValid(timestamp)) {
    logger.warn('Cashfree webhook: timestamp outside allowed window', { timestamp });
    return res.status(401).json({ success: false, message: 'Webhook timestamp invalid or expired' });
  }

  if (!verifyWebhookSignature(rawBodyString, signature, timestamp)) {
    logger.warn('Cashfree webhook: invalid signature');
    return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBodyString);
  } catch {
    return res.status(400).json({ success: false, message: 'Malformed JSON payload' });
  }

  req.cashfreeWebhook = {
    payload,
    rawBody: rawBodyString,
    signature,
    timestamp,
    eventId: eventId || payload?.event_id || payload?.data?.payment?.cf_payment_id || null,
  };

  return next();
}

/**
 * Derive a stable idempotency key for webhook deduplication.
 */
export function deriveWebhookEventId(webhookMeta, payload) {
  if (webhookMeta?.eventId) {
    return String(webhookMeta.eventId);
  }

  const payment = payload?.data?.payment || payload?.data?.order || payload?.data || {};
  const parts = [
    payload?.type || payload?.event || 'unknown',
    payment?.cf_payment_id || payment?.payment_id || '',
    payment?.order_id || payment?.order?.order_id || '',
    webhookMeta?.timestamp || '',
  ].filter(Boolean);

  if (parts.length <= 1) {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  return parts.join(':');
}
