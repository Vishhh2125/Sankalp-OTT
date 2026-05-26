import * as SecureStore from 'expo-secure-store';

function welcomeKey(userId) {
  return `welcome_promo_done_${userId}`;
}

/** First login for this account — show full daily → banner → notification sequence. */
export async function hasCompletedWelcomePromo(userId) {
  if (!userId) return false;
  try {
    const v = await SecureStore.getItemAsync(welcomeKey(userId));
    return v === '1';
  } catch {
    return false;
  }
}

export async function markWelcomePromoCompleted(userId) {
  if (!userId) return;
  try {
    await SecureStore.setItemAsync(welcomeKey(userId), '1');
  } catch {
    // ignore
  }
}
