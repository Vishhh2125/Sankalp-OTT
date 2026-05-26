import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { fetchHomeAnnouncements } from '../components/home/homePromoApi';
import {
  filterUnseenAnnouncements,
  getSeenAnnouncementIds,
  markAnnouncementIdsSeen,
} from '../components/home/homePromoStorage';
import {
  registerAnnouncementRefresh,
  unregisterAnnouncementRefresh,
} from '../components/home/homePromoRefresh';

export function useHomeAnnouncements() {
  const [unseenAnnouncements, setUnseenAnnouncements] = useState([]);

  const refreshAnnouncements = useCallback(async () => {
    try {
      const [list, seenIds] = await Promise.all([
        fetchHomeAnnouncements(),
        getSeenAnnouncementIds(),
      ]);
      setUnseenAnnouncements(
        filterUnseenAnnouncements(list.slice(0, 3), seenIds)
      );
    } catch {
      setUnseenAnnouncements([]);
    }
  }, []);

  useEffect(() => {
    refreshAnnouncements();
    registerAnnouncementRefresh(refreshAnnouncements);
    return () => unregisterAnnouncementRefresh();
  }, [refreshAnnouncements]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshAnnouncements();
    });
    return () => sub.remove();
  }, [refreshAnnouncements]);

  const dismissAnnouncements = useCallback(async () => {
    const ids = unseenAnnouncements.map((a) => a.id);
    if (ids.length) await markAnnouncementIdsSeen(ids);
    setUnseenAnnouncements([]);
  }, [unseenAnnouncements]);

  return {
    unseenAnnouncements,
    refreshAnnouncements,
    dismissAnnouncements,
  };
}
