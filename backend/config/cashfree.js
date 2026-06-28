/**
 * Cashfree Payment Gateway configuration (env-only).
 */

const ENV = (process.env.CASHFREE_ENV || 'SANDBOX').toUpperCase();
const isProduction = ENV === 'PRODUCTION';

export const cashfreeConfig = {
  appId: process.env.CASHFREE_APP_ID || '',
  secretKey: process.env.CASHFREE_SECRET_KEY || '',
  env: ENV,
  isProduction,
  apiVersion: process.env.CASHFREE_API_VERSION || '2023-08-01',
  baseUrl: isProduction
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg',
  webhookUrl: process.env.CASHFREE_WEBHOOK_URL || '',
  returnUrl: process.env.CASHFREE_RETURN_URL || '',
  orderExpiryMinutes: parseInt(process.env.CASHFREE_ORDER_EXPIRY_MINUTES || '30', 10),
};

export function assertCashfreeConfigured() {
  if (!cashfreeConfig.appId || !cashfreeConfig.secretKey) {
    throw new Error('Cashfree credentials are not configured (CASHFREE_APP_ID, CASHFREE_SECRET_KEY)');
  }
}

export function getCashfreeCheckoutMode() {
  return cashfreeConfig.isProduction ? 'production' : 'sandbox';
}
