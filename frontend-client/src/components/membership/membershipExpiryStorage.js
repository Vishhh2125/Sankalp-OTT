import * as SecureStore from 'expo-secure-store';

import { todayDateKey } from '../rewards/dailyCheckinStorage';

function dismissKey(userId, daysLeft) {
  return `membership_expiry_dismiss_${daysLeft}_${userId}`;
}

/** Whether user dismissed the N-day reminder today. */
export async function wasMembershipExpiryDismissedToday(userId, daysLeft) {
  if (!userId || !daysLeft) return false;
  try {
    const stored = await SecureStore.getItemAsync(dismissKey(userId, daysLeft));
    return stored === todayDateKey();
  } catch {
    return false;
  }
}

export async function markMembershipExpiryDismissedToday(userId, daysLeft) {
  if (!userId || !daysLeft) return;
  try {
    await SecureStore.setItemAsync(dismissKey(userId, daysLeft), todayDateKey());
  } catch {
    // ignore
  }
}
