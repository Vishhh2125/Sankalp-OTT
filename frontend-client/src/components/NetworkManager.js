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

  const [hasRedirected, setHasRedirected] = React.useState(false);
  const [showBanner, setShowBanner] = React.useState(false);

  const getCurrentRouteName = () => {
    if (!navReady || !navigationRef?.current) return null;
    return navigationRef.current.getCurrentRoute()?.name;
  };

  useEffect(() => {
    if (isOffline) {
      setShowBanner(true);
      const timer = setTimeout(() => setShowBanner(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setHasRedirected(false);
      setShowBanner(false);
    }
  }, [isOffline, hasRedirected, navReady, navigationRef]);

  if (!isOffline || !showBanner) return null;

  return (
    <Pressable
      style={[styles.banner, { top: insets.top + 10 }]}
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
    left: 16,
    right: 16,
    borderRadius: 8,
    backgroundColor: theme.crimson,
    paddingVertical: 12,
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
