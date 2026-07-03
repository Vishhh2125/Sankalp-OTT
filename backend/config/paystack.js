/**
 * Paystack Payment Gateway configuration (env-only).
 */

const baseUrl = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';

export const paystackConfig = {
  secretKey: process.env.PAYSTACK_SECRET_KEY || '',
  publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
  webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || '',
  callbackUrl: process.env.PAYSTACK_CALLBACK_URL || '',
  currency: (process.env.PAYSTACK_DEFAULT_CURRENCY || 'NGN').toUpperCase(),
  environment: (process.env.PAYSTACK_ENV || 'TEST').toUpperCase(),
  baseUrl,
  isProduction: (process.env.PAYSTACK_ENV || 'TEST').toUpperCase() === 'PRODUCTION',
};

export function assertPaystackConfigured() {
  if (!paystackConfig.secretKey || !paystackConfig.publicKey) {
    throw new Error(
      'Paystack credentials are not configured (PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY)'
    );
  }
}
