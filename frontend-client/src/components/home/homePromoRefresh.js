/** Lets Home screen refetch tab-bar announcements after focus (new admin sends). */
let refreshAnnouncements = null;

export function registerAnnouncementRefresh(fn) {
  refreshAnnouncements = fn;
}

export function unregisterAnnouncementRefresh() {
  refreshAnnouncements = null;
}

export function triggerAnnouncementRefresh() {
  refreshAnnouncements?.();
}
