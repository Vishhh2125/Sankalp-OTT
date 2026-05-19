import React, { useCallback, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import AuthWrapper from '../components/AuthWrapper';
import { ROUTES } from '../constants/routes';
import { useUserDataSync } from '../hooks/useUserDataSync';
import {
  clearShowPlayer,
  fetchShowPlayerPage,
  initShowPlayer,
} from '../redux/slices/showPlayerSlice';

// ---------------------------------------------------------------------------
// The two URL prefixes we accept:
//   • https://ott.ventagenie.com  — production universal / app link
//   • 7k://                       — custom scheme fallback (dev testing)
// ---------------------------------------------------------------------------
const LINKING = {
  prefixes: ['https://ott.ventagenie.com', '7k://'],
  config: {
    screens: {
      // AuthNavigator screens (for completeness — no deep links needed here)
      // AppNavigator wraps MainTabs + ShowPlayer
      [ROUTES.MAIN_TABS]: {
        screens: {
          [ROUTES.HOME]: 'home',
          [ROUTES.FOR_YOU]: 'foryou',
          [ROUTES.MY_LIST]: 'mylist',
          [ROUTES.PROFILE]: 'profile',
        },
      },
      // Deep link target:  /show/:showId/ep/:episodeNum
      [ROUTES.SHOW_PLAYER]: 'show/:showId/ep/:episodeNum',
    },
  },
};

export default function RootStackNavigator() {
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.auth?.accessToken);
  const navigationRef = useRef(null);
  
  // Sync user data (coins, plan, etc.) periodically from backend
  // This enables real-time updates when admin adjusts coins
  useUserDataSync();

  // -------------------------------------------------------------------------
  // Deep link handler
  // Called by React Navigation when a URL matching our config is opened.
  // React Navigation will parse the URL and pass showId / episodeNum as
  // route.params to ShowPlayerScreen — BUT ShowPlayerScreen reads from Redux,
  // not route.params directly. So we need to bootstrap Redux here first.
  // -------------------------------------------------------------------------
  const handleDeepLink = useCallback(
    ({ url }) => {
      if (!url) return;

      // Match: /show/<showId>/ep/<episodeNum>
      const match = url.match(/\/show\/([^/]+)\/ep\/(\d+)/);
      if (!match) return;

      const showId = match[1];
      const episodeNum = parseInt(match[2], 10);

      if (!showId || isNaN(episodeNum)) return;

      const nav = navigationRef.current;
      if (!nav) return;

      // If not logged in, send to Login and let them come back
      if (!accessToken) {
        nav.navigate(ROUTES.LOGIN);
        return;
      }

      // Clear any existing show player state first
      dispatch(clearShowPlayer());

      // Kick off the fetch — initShowPlayer is called inside fetchShowPlayerPage.fulfilled
      // via the existing slice logic. We bootstrap with fromEp = episodeNum so the
      // target episode is in the first page, and set startEpisodeNum so the slice
      // scrolls to it after sort.
      dispatch(
        fetchShowPlayerPage({
          showId,
          fromEp: Math.max(1, episodeNum - 2), // fetch a small window around the target ep
          limit: 10,
        })
      ).then((action) => {
        if (fetchShowPlayerPage.fulfilled.match(action)) {
          // Manually set startEpisodeNum so the slice scrolls to the right ep.
          // fetchShowPlayerPage.fulfilled already populates episodes in Redux;
          // we additionally dispatch initShowPlayer to set startEpisodeNum.
          const data = action.payload?.data;
          if (!data) return;

          dispatch(
            initShowPlayer({
              showId,
              showTitle: data.show_title || '',
              thumbnailUrl: data.thumbnail_url || '',
              totalEpisodes: data.total_episodes || 0,
              seedEpisodes: data.episodes || [],
              startEpisodeNum: episodeNum,
              streamBase: '',
            })
          );

          nav.navigate(ROUTES.SHOW_PLAYER, {
            showId,
            episodeNum,
            fromDeepLink: true,
          });
        }
      });
    },
    [dispatch, accessToken]
  );

  return (
    <SafeAreaProvider>
      <NavigationContainer
        ref={navigationRef}
        linking={LINKING}
        onUnhandledAction={() => {}} // silence unhandled action warnings
      >
        <AuthWrapper onDeepLink={handleDeepLink} />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}