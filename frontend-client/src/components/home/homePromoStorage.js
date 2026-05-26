import * as SecureStore from 'expo-secure-store';

function seenBannersKey(userId) {
  return userId ? `home_seen_banner_ids_${userId}` : 'home_seen_banner_ids';
}

function seenAnnouncementsKey(userId) {
  return userId ? `home_seen_announcement_ids_${userId}` : 'home_seen_announcement_ids';
}

async function readIdList(key) {
  try {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIdList(key, ids) {
  try {
    const unique = [...new Set(ids.filter(Boolean))];
    await SecureStore.setItemAsync(key, JSON.stringify(unique.slice(-200)));
  } catch {
    // ignore
  }
}

export async function getSeenBannerIds(userId) {
  return readIdList(seenBannersKey(userId));
}

export async function markBannerIdsSeen(ids, userId) {
  const existing = await getSeenBannerIds(userId);
  await writeIdList(seenBannersKey(userId), [...existing, ...ids]);
}

export async function getSeenAnnouncementIds(userId) {
  return readIdList(seenAnnouncementsKey(userId));
}

export async function markAnnouncementIdsSeen(ids, userId) {
  const existing = await getSeenAnnouncementIds(userId);
  await writeIdList(seenAnnouncementsKey(userId), [...existing, ...ids]);
}

export function filterUnseenBanners(banners, seenIds) {
  const seen = new Set(seenIds);
  return (banners || []).filter((b) => b?.id && !seen.has(b.id));
}

export function filterUnseenAnnouncements(announcements, seenIds) {
  const seen = new Set(seenIds);
  return (announcements || []).filter((a) => a?.id && !seen.has(a.id));
}
