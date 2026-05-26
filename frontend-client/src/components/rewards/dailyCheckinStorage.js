import * as SecureStore from 'expo-secure-store';

function dismissKey(userId) {
  return userId
    ? `daily_checkin_popup_dismissed_date_${userId}`
    : 'daily_checkin_popup_dismissed_date';
}

export function todayDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function wasCheckinPopupDismissedToday(userId) {
  try {
    const stored = await SecureStore.getItemAsync(dismissKey(userId));
    return stored === todayDateKey();
  } catch {
    return false;
  }
}

export async function markCheckinPopupDismissedToday(userId) {
  try {
    await SecureStore.setItemAsync(dismissKey(userId), todayDateKey());
  } catch {
    // ignore
  }
}

export async function clearCheckinPopupDismissed(userId) {
  try {
    await SecureStore.deleteItemAsync(dismissKey(userId));
  } catch {
    // ignore
  }
}
