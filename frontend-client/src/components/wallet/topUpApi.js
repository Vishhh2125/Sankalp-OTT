import { API_BASE_URL } from '../../constants/config';
import { api, createAuthenticatedApi } from '../../services/api';

export const userApi = createAuthenticatedApi({
  baseURL: `${API_BASE_URL}/api/user`,
});

export const authHeader = (token) =>
  token ? { Authorization: `Bearer ${token}` } : {};

/** Normalize Express ApiResponse / axios errors for UI. */
export function walletApiErrorMessage(err, fallback = 'Request failed') {
  const data = err?.response?.data;
  if (data?.message && data.message !== 'Success') return data.message;
  if (typeof data?.data?.error === 'string') return data.data.error;
  if (err?.message) return err.message;
  return fallback;
}

/** Admin plan name (primary title in UI). */
export function packPlanTitle(pack) {
  const name = pack?.name?.trim();
  if (name) return name;
  return pack?.label ?? 'Top-up pack';
}

/** Price/coins line under the plan name. */
export function packPlanSubtitle(pack, fallback = '') {
  const name = pack?.name?.trim();
  if (name && pack?.label) return pack.label;
  if (pack?.coins != null) {
    return `${pack.coins} coins${fallback ? ` · ${fallback}` : ''}`;
  }
  return pack?.label ?? fallback;
}

export async function fetchTopUpOptions(accessToken) {
  const res = await userApi.get('/wallet/top-up-options', {
    headers: authHeader(accessToken),
  });
  return res.data?.data?.packs ?? [];
}

export async function createWalletPaymentOrder(packId, gateway = 'cashfree') {
  const res = await api.post('/payments/create-wallet-order', {
    pack_id: packId,
    gateway,
  });
  return res.data?.data;
}

export async function verifyPaymentOrder(orderId) {
  const res = await api.post('/payments/verify-order', { order_id: orderId });
  return res.data?.data;
}

export async function fetchWalletHistory(accessToken, { limit = 50, offset = 0 } = {}) {
  const res = await api.get('/wallet/history', {
    headers: authHeader(accessToken),
    params: { limit, offset },
  });
  return res.data?.data ?? { items: [], total: 0, limit, offset };
}

/** @deprecated Dev-only simulated purchase */
export async function simulatePurchase(accessToken, packId) {
  const res = await userApi.post(
    '/wallet/simulate-purchase',
    { pack_id: packId },
    { headers: authHeader(accessToken) }
  );
  return res.data?.data;
}

export async function fetchWalletTransactions(accessToken, { limit = 50, offset = 0 } = {}) {
  const res = await userApi.get('/wallet/transactions', {
    headers: authHeader(accessToken),
    params: { limit, offset },
  });
  return res.data?.data ?? { items: [], total: 0, limit, offset };
}
