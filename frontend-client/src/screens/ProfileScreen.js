import React, { useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';

import { theme } from '../constants/theme';
import { ROUTES } from '../constants/routes';
import { logoutUser, clearLogoutError } from '../redux/slices/authSlice';

const FEATURE_ICONS = [
  { icon: 'play-circle-outline', label: '8K+ series' },
  { icon: 'time-outline', label: 'Daily points' },
  // Removed Download icon from here
  { icon: 'videocam-outline', label: '1080p quality' },
];

const MENU_ITEMS = [
  { icon: 'wallet-outline', label: 'Top Up', right: null },
  { icon: 'card-outline', label: 'My Wallet', right: '🪙 10' },
  { icon: 'gift-outline', label: 'Earn Rewards', badge: '+70' },
  { icon: 'heart-outline', label: 'Gifts', right: null },
  { icon: 'time-outline', label: 'History', right: null },
  // Removed Download item from here
];

const SETTINGS_ITEMS = [
  // Removed Language item from here
  { icon: 'help-circle-outline', label: 'Help & feedback', right: null },
];

function MenuItem({ icon, label, right, badge, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        pressed && styles.menuItemPressed,
      ]}
    >
      <View style={styles.menuLeft}>
        <Ionicons name={icon} size={20} color={theme.white} />
        <Text style={styles.menuLabel}>{label}</Text>
      </View>
      <View style={styles.menuRight}>
        {badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
        {right && <Text style={styles.menuRightText}>{right}</Text>}
        <Ionicons name="chevron-forward" size={18} color={theme.darkGray} />
      </View>
    </Pressable>
  );
}

export default function ProfileScreen({ navigation }) {
  const dispatch = useDispatch();
  const { logout: logoutState } = useSelector((state) => state.auth);

  // Show error alert when logout fails
  useEffect(() => {
    if (logoutState.error && !logoutState.isLoading) {
      Alert.alert('Logout Failed', logoutState.error, [
        { text: 'Retry', onPress: () => dispatch(logoutUser()) },
        { text: 'Dismiss', onPress: () => dispatch(clearLogoutError()) },
      ]);
    }
  }, [logoutState.error, logoutState.isLoading, dispatch]);

  function goToMembership() {
    navigation.navigate(ROUTES.MEMBERSHIP);
  }

  function handleLogout() {
    // Dispatch logout action (clears tokens, calls backend)
    dispatch(logoutUser());
    // AuthWrapper will automatically handle navigation to login screen
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={28} color={theme.darkGray} />
          </View>
          <View>
            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Log in</Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.white}
              />
            </View>
            <Text style={styles.idText}>
              ID 447126581{' '}
              <Text style={styles.separator}>|</Text> Following 0
            </Text>
          </View>
        </View>
        <Pressable>
          <Ionicons name="settings-outline" size={24} color={theme.white} />
        </Pressable>
      </View>

      {/* Membership Banner */}
      <View style={styles.memberBanner}>
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>16% off</Text>
        </View>
        <View style={styles.bannerContent}>
          <View style={styles.bannerLeft}>
            <Text style={styles.bannerTitle}>Join Membership</Text>
            <Text style={styles.bannerSub}>
              Enjoy these exclusive benefits:
            </Text>
          </View>
          <Pressable
            style={styles.joinSmallBtn}
            onPress={goToMembership}
          >
            <Text style={styles.joinSmallText}>Join</Text>
          </Pressable>
        </View>
        <View style={styles.featureRow}>
          {FEATURE_ICONS.map((f) => (
            <View key={f.label} style={styles.featureItem}>
              <Ionicons name={f.icon} size={22} color={theme.white} />
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Main Menu */}
      <View style={styles.menuCard}>
        <MenuItem icon="star-outline" label="Membership" onPress={goToMembership} />
        {MENU_ITEMS.map((item) => (
          <MenuItem key={item.label} {...item} />
        ))}
      </View>

      {/* Settings Menu */}
      <View style={styles.menuCard}>
        {SETTINGS_ITEMS.map((item) => (
          <MenuItem key={item.label} {...item} />
        ))}
        <MenuItem
          icon="log-out-outline"
          label="Log out"
          onPress={handleLogout}
        />
        {/* Show logout error if exists */}
        {logoutState.error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Error: {logoutState.error}</Text>
          </View>
        )}
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.deepBlack,
  },
  container: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  loginText: {
    color: theme.white,
    fontSize: 17,
    fontWeight: '700',
  },
  idText: {
    color: theme.gray,
    fontSize: 12,
    marginTop: 4,
  },
  separator: {
    color: theme.darkGray,
  },
  memberBanner: {
    marginHorizontal: 16,
    backgroundColor: theme.crimson,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  discountBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF9500',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 10,
  },
  discountText: {
    color: theme.white,
    fontSize: 11,
    fontWeight: '700',
  },
  bannerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  bannerLeft: {
    flex: 1,
  },
  bannerTitle: {
    color: theme.white,
    fontSize: 18,
    fontWeight: '800',
  },
  bannerSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 2,
  },
  joinSmallBtn: {
    backgroundColor: theme.white,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  joinSmallText: {
    color: theme.crimson,
    fontWeight: '700',
    fontSize: 14,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  featureItem: {
    alignItems: 'center',
    gap: 4,
  },
  featureLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '600',
  },
  menuCard: {
    marginHorizontal: 16,
    backgroundColor: theme.surface,
    borderRadius: 16,
    paddingVertical: 4,
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  menuItemPressed: {
    opacity: 0.7,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuLabel: {
    color: theme.white,
    fontSize: 15,
    fontWeight: '500',
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuRightText: {
    color: theme.gray,
    fontSize: 14,
  },
  badge: {
    backgroundColor: theme.crimson,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: theme.white,
    fontSize: 11,
    fontWeight: '700',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: theme.crimson,
  },
  errorText: {
    color: theme.crimson,
    fontSize: 12,
    fontWeight: '500',
  },
});
