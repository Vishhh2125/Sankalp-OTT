import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useNetwork } from '../context/NetworkContext';
import { ROUTES } from '../constants/routes';
import { theme } from '../constants/theme';

export default function NetworkManager({ navigationRef, navReady }) {
  const { isOffline } = useNetwork();
  const insets = useSafeAreaInsets();

  // We can track if we've already redirected them once per offline session
  // to avoid repeatedly redirecting them if they try to navigate around.
  const [hasRedirected, setHasRedirected] = React.useState(false);

  // We only want to redirect if they are not already watching a video offline
  const getCurrentRouteName = () => {
    if (!navReady || !navigationRef?.current) return null;
    return navigationRef.current.getCurrentRoute()?.name;
  };

  useEffect(() => {
    if (isOffline) {
      const currentRouteName = getCurrentRouteName();
      if (!hasRedirected && navReady && currentRouteName && currentRouteName !== ROUTES.SHOW_PLAYER) {
        setHasRedirected(true);
        navigationRef.current?.navigate(ROUTES.MAIN_TABS, {
          screen: ROUTES.MY_LIST,
          params: { initialTab: 'downloads' },
        });
      }
    } else {
      setHasRedirected(false);
    }
  }, [isOffline, hasRedirected, navReady, navigationRef]);

  if (!isOffline) return null;

  return (
    <Pressable
      style={[styles.banner, { paddingTop: Math.max(insets.top, 20) }]}
      onPress={() => {
        if (navReady) {
          navigationRef.current?.navigate(ROUTES.MAIN_TABS, {
            screen: ROUTES.MY_LIST,
            params: { initialTab: 'downloads' },
          });
        }
      }}
    >
      <Ionicons name="cloud-offline" size={20} color={theme.white} style={styles.icon} />
      <Text style={styles.text}>You are offline. Tap to view Downloads.</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.crimson,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      }
    })
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: theme.white,
    fontSize: 14,
    fontWeight: '600',
  },
});
