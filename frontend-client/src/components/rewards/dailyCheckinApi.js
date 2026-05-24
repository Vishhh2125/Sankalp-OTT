import {
  userApi,
  authHeader,
  walletApiErrorMessage,
} from '../wallet/topUpApi';

export { walletApiErrorMessage };

export async function fetchCheckinStatus(accessToken) {
  const res = await userApi.get('/checkin', {
    headers: authHeader(accessToken),
  });
  return res.data?.data ?? null;
}

export async function claimDailyCheckin(accessToken) {
  const res = await userApi.post(
    '/checkin',
    {},
    { headers: authHeader(accessToken) }
  );
  return res.data?.data ?? null;
}
