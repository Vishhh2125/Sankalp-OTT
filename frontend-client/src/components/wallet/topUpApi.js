import axios from 'axios';

import { API_BASE_URL } from '../../constants/config';
import * as authService from '../../services/authService';

export const userApi = axios.create({
  baseURL: `${API_BASE_URL}/api/user`,
  headers: {
    'Content-Type': 'application/json',
    'x-client-type': authService.getClientType(),
  },
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

export async function fetchTopUpOptions(accessToken) {
  const res = await userApi.get('/wallet/top-up-options', {
    headers: authHeader(accessToken),
  });
  return res.data?.data?.packs ?? [];
}

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
