import * as SecureStore from 'expo-secure-store';

const DISMISS_KEY = 'daily_checkin_popup_dismissed_date';

export function todayDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function wasCheckinPopupDismissedToday() {
  try {
    const stored = await SecureStore.getItemAsync(DISMISS_KEY);
    return stored === todayDateKey();
  } catch {
    return false;
  }
}

export async function markCheckinPopupDismissedToday() {
  try {
    await SecureStore.setItemAsync(DISMISS_KEY, todayDateKey());
  } catch {
    // ignore
  }
}

export async function clearCheckinPopupDismissed() {
  try {
    await SecureStore.deleteItemAsync(DISMISS_KEY);
  } catch {
    // ignore
  }
}
