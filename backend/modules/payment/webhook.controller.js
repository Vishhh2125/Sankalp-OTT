import logger from '../../config/logger.js';
import { processCashfreeWebhook } from './payment.service.js';
import { deriveWebhookEventId } from '../../middleware/verifyCashfreeWebhook.js';

/**
 * Cashfree webhook handler — must respond 200 on success so Cashfree stops retries.
 */
export async function handleCashfreeWebhook(req, res) {
  try {
    const webhookMeta = req.cashfreeWebhook;
    if (!webhookMeta?.payload) {
      return res.status(400).json({ success: false, message: 'Invalid webhook' });
    }

    webhookMeta.eventId = deriveWebhookEventId(webhookMeta, webhookMeta.payload);

    const result = await processCashfreeWebhook(webhookMeta);

    if (!result.ok && result.status >= 400 && result.status !== 404) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    return res.status(200).json({ success: true, message: result.message });
  } catch (err) {
    logger.error('Cashfree webhook processing error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
}
