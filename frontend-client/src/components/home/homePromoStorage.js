import * as SecureStore from 'expo-secure-store';

const SEEN_BANNERS_KEY = 'home_seen_banner_ids';
const SEEN_ANNOUNCEMENTS_KEY = 'home_seen_announcement_ids';

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

export async function getSeenBannerIds() {
  return readIdList(SEEN_BANNERS_KEY);
}

export async function markBannerIdsSeen(ids) {
  const existing = await getSeenBannerIds();
  await writeIdList(SEEN_BANNERS_KEY, [...existing, ...ids]);
}

export async function getSeenAnnouncementIds() {
  return readIdList(SEEN_ANNOUNCEMENTS_KEY);
}

export async function markAnnouncementIdsSeen(ids) {
  const existing = await getSeenAnnouncementIds();
  await writeIdList(SEEN_ANNOUNCEMENTS_KEY, [...existing, ...ids]);
}

export function filterUnseenBanners(banners, seenIds) {
  const seen = new Set(seenIds);
  return (banners || []).filter((b) => b?.id && !seen.has(b.id));
}

export function filterUnseenAnnouncements(announcements, seenIds) {
  const seen = new Set(seenIds);
  return (announcements || []).filter((a) => a?.id && !seen.has(a.id));
}
