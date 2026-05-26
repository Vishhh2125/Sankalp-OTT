import { API_BASE_URL } from '../../constants/config';

export async function fetchHomeBanners() {
  const res = await fetch(`${API_BASE_URL}/api/content/home/banners`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Failed to load banners');
  return Array.isArray(data?.banners) ? data.banners : [];
}

export async function fetchHomeAnnouncements() {
  const res = await fetch(`${API_BASE_URL}/api/content/home/announcements`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Failed to load announcements');
  return Array.isArray(data?.announcements) ? data.announcements : [];
}
