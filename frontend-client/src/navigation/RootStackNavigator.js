import React, { useCallback, useRef, useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import AuthWrapper from '../components/AuthWrapper';
import { ROUTES } from '../constants/routes';
import { API_BASE_URL } from '../constants/config';
import { useUserDataSync } from '../hooks/useUserDataSync';
import { theme } from '../constants/theme';
import NetworkManager from '../components/NetworkManager';
import {
  clearShowPlayer,
  fetchShowPlayerPage,
  initShowPlayer,
} from '../redux/slices/showPlayerSlice';

// FIX: override NavigationContainer's default white background at the root level
// so no white flash appears during cold start or screen transitions
const NAV_THEME = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.deepBlack,
  },
};

const LINKING = {
  prefixes: ['https://ott.ventagenie.com', '7k://'],
  config: {
    screens: {
      [ROUTES.MAIN_TABS]: {
        screens: {
          [ROUTES.HOME]: 'home',
          [ROUTES.FOR_YOU]: 'foryou',
          [ROUTES.MY_LIST]: 'mylist',
          [ROUTES.PROFILE]: 'profile',
        },
      },
    },
  },
};

export default function RootStackNavigator() {
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.auth?.accessToken);
  const navigationRef = useRef(null);
  const pendingDeepLink = useRef(null);
  const [navReady, setNavReady] = useState(false);

  useUserDataSync();

  const processDeepLink = useCallback(
    (showId, episodeNum) => {
      if (!accessToken) {
        console.log('❌ Not logged in, navigating to LOGIN');
        navigationRef.current?.navigate(ROUTES.LOGIN);
        return;
      }

      console.log('✅ Fetching episodes for show', showId);
      dispatch(clearShowPlayer());

      dispatch(
        fetchShowPlayerPage({
          showId,
          fromEp: Math.max(1, episodeNum - 2),
          limit: 10,
        })
      ).then((action) => {
        console.log('✅ fetchShowPlayerPage response:', action.type);
        if (fetchShowPlayerPage.fulfilled.match(action)) {
          const data = action.payload?.data;
          if (!data) {
            console.log('❌ No data in response');
            return;
          }

          console.log('✅ Initializing ShowPlayer with', data.episodes?.length, 'episodes');
          console.log('📺 First episode HLS URL:', data.episodes?.[0]?.hls_url);
          dispatch(
            initShowPlayer({
              showId,
              showTitle: data.show_title || '',
              thumbnailUrl: data.thumbnail_url || '',
              totalEpisodes: data.total_episodes || 0,
              seedEpisodes: data.episodes || [],
              startEpisodeNum: episodeNum,
              streamBase: API_BASE_URL,
            })
          );

          console.log('✅ Navigating to SHOW_PLAYER');
          navigationRef.current?.navigate(ROUTES.SHOW_PLAYER, {
            showId,
            episodeNum,
            fromDeepLink: true,
          });
        } else {
          console.log('❌ fetchShowPlayerPage rejected:', action.type);
        }
      }).catch((error) => {
        console.log('❌ Error fetching episodes:', error);
      });
    },
    [dispatch, accessToken]
  );

  const handleDeepLink = useCallback(
    ({ url }) => {
      console.log('🔗 handleDeepLink called with:', url);

      if (!url) {
        console.log('❌ No URL provided');
        return;
      }

      const match = url.match(/\/show\/([^/]+)\/ep\/(\d+)/);
      if (!match) {
        console.log('❌ URL does not match pattern /show/ID/ep/NUM');
        return;
      }

      const showId = match[1];
      const episodeNum = parseInt(match[2], 10);
      console.log('✅ Parsed showId:', showId, 'episodeNum:', episodeNum);

      if (!showId || isNaN(episodeNum)) {
        console.log('❌ Invalid showId or episodeNum');
        return;
      }

      pendingDeepLink.current = { showId, episodeNum };

      if (!navReady) {
        console.log('⏳ Navigation not ready, queuing deep link');
        return;
      }

      processDeepLink(showId, episodeNum);
    },
    [navReady, processDeepLink]
  );

  useEffect(() => {
    if (navReady && pendingDeepLink.current) {
      console.log('✅ Navigation ready, processing queued deep link');
      const { showId, episodeNum } = pendingDeepLink.current;
      pendingDeepLink.current = null;
      processDeepLink(showId, episodeNum);
    }
  }, [navReady, processDeepLink]);

  return (
    <SafeAreaProvider>
      <NavigationContainer
        ref={navigationRef}
        linking={LINKING}
        theme={NAV_THEME}
        onReady={() => {
          console.log('✅ Navigation ready');
          setNavReady(true);
        }}
        onUnhandledAction={() => {}}
      >
        <NetworkManager navigationRef={navigationRef} navReady={navReady} />
        <AuthWrapper onDeepLink={handleDeepLink} />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}