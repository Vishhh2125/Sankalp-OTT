import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  Alert,
} from 'react-native';
import { FontAwesome6, Ionicons } from '@expo/vector-icons';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import GuestAccessPrompt from '../components/GuestAccessPrompt';
import { theme } from '../constants/theme';
import { ROUTES } from '../constants/routes';
import { useGuestAuth } from '../context/GuestAuthContext';
import { fetchCheckinStatus } from '../components/rewards/dailyCheckinApi';
import { formatMembershipEnd } from '../components/membership/membershipApi';
import { logoutUser, clearLogoutError } from '../redux/slices/authSlice';
import { customAlert } from '../context/CustomAlertContext';

const FEATURE_ICONS = [
  { icon: 'infinite-outline', label: 'Unlimited Access' },
  { icon: 'lock-open-outline', label: 'Unlock Episodes' },
];

const MENU_ITEMS = [ 
  { icon: 'wallet-outline', label: 'Top Up', right: null },
  { icon: 'card-outline', label: 'My Wallet', right: null },
  { icon: 'gift-outline', label: 'Earn Rewards', badge: null },
];

const SETTINGS_ITEMS = [
  { icon: 'help-circle-outline', label: 'Help & feedback', right: null },
];

function MenuItem({ icon, label, right, badge, onPress, disabled, labelStyle }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.menuItem,
        pressed && !disabled && styles.menuItemPressed,
        disabled && styles.menuItemDisabled,
      ]}
    >
      <View style={styles.menuLeft}>
        <Ionicons name={icon} size={20} color={disabled ? theme.darkGray : theme.white} />
        <Text style={[styles.menuLabel, disabled && styles.menuLabelDisabled, labelStyle]}>{label}</Text>
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

function GuestProfileScreen({ insets }) {
  const { openSignUp } = useGuestAuth();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 12 },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={28} color={theme.darkGray} />
          </View>
          <View>
            <Text style={styles.loginText}>Guest</Text>
            <Text style={styles.guestSubtext}>Browsing without an account</Text>
          </View>
        </View>
      </View>

      <View style={styles.guestPromptCard}>
        <GuestAccessPrompt
          compact
          title="Sign in to access your profile"
          subtitle="Create a free account to use My Wallet, save your list, earn rewards, and unlock episodes with coins."
          showLoginLink
        />
      </View>

      <View style={styles.menuCard}>
        <MenuItem icon="star-outline" label="Membership" disabled />
        {MENU_ITEMS.map((item) => (
          <MenuItem key={item.label} {...item} disabled />
        ))}
      </View>

      <View style={styles.menuCard}>
        {SETTINGS_ITEMS.map((item) => (
          <MenuItem key={item.label} {...item} disabled />
        ))}
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const accessToken = useSelector((state) => state.auth?.accessToken);
  const name = useSelector((state) => state.auth.name);
  const coins = useSelector((state) => state.auth.coins);
  const plan = useSelector((state) => state.auth.plan);
  const memberships = useSelector((state) => state.auth.memberships) || [];
  const hasAllAccess = useSelector((state) => state.auth.has_all_access);
  const isPaid = plan && plan !== 'FREE';
  const dispatch = useDispatch();
  const { logout: logoutState } = useSelector((state) => state.auth);
  const [earnRewardsBadge, setEarnRewardsBadge] = useState(null);
  const [membershipsDropdownOpen, setMembershipsDropdownOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!accessToken) {
        setEarnRewardsBadge(null);
        return;
      }
      let cancelled = false;
      (async () => {
        try {
          const data = await fetchCheckinStatus(accessToken);
          if (cancelled) return;
          if (data && !data.claimed_today && data.today_reward > 0) {
            setEarnRewardsBadge(`+${data.today_reward}`);
          } else {
            setEarnRewardsBadge(null);
          }
        } catch {
          if (!cancelled) setEarnRewardsBadge(null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [accessToken])
  );

  useEffect(() => {
    if (logoutState.error && !logoutState.isLoading) {
      customAlert('Logout Failed', logoutState.error, [
        { text: 'Dismiss', style: 'cancel', onPress: () => dispatch(clearLogoutError()) },
        { text: 'Retry', onPress: () => dispatch(logoutUser()) },
      ]);
    }
  }, [logoutState.error, logoutState.isLoading, dispatch]);

  if (!accessToken) {
    return <GuestProfileScreen insets={insets} />;
  }

  function goToMembership() {
    navigation.navigate(ROUTES.MEMBERSHIP);
  }

  function goToMyWallet() {
    navigation.navigate(ROUTES.MY_WALLET);
  }

  function goToTopUp() {
    navigation.navigate(ROUTES.TOP_UP);
  }

  function goToEarnRewards() {
    navigation.navigate(ROUTES.EARN_REWARDS);
  }

  function handleMenuPress(label) {
    if (label === 'Top Up') goToTopUp();
    else if (label === 'My Wallet') goToMyWallet();
    else if (label === 'Earn Rewards') goToEarnRewards();
  }

  function handleLogout() {
    customAlert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          onPress: () => dispatch(logoutUser()),
        },
      ]
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 12 },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatar, isPaid && styles.avatarPaid]}>
            <Ionicons
              name="person"
              size={28}
              color={isPaid ? '#4CAF50' : theme.darkGray}
            />
          </View>
          <View>
            <View style={styles.loginRow}>
              <Text style={styles.loginText}>{name || 'User'}</Text>
            </View>
            {isPaid && memberships.length > 0 ? (
              memberships.length === 1 ? (
                <Text style={styles.membershipEndText}>
                  {(() => {
                    const m = memberships[0];
                    const scope = m.category_name ? ` · ${m.category_name}` : '';
                    if (!m.end_date) return `Member · Lifetime${scope}`;
                    return `Member until ${formatMembershipEnd(m.end_date)}${scope}`;
                  })()}
                </Text>
              ) : (
                <Pressable
                  style={styles.membershipsDropdownTrigger}
                  onPress={() => setMembershipsDropdownOpen((prev) => !prev)}
                  hitSlop={8}
                >
                  <Text style={styles.membershipEndText}>
                    {memberships.length} Active Memberships
                  </Text>
                  <Ionicons
                    name={membershipsDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={theme.gold}
                  />
                </Pressable>
              )
            ) : null}
          </View>
        </View>
        <Pressable style={styles.coinsChip} onPress={goToMyWallet} hitSlop={8}>
          <FontAwesome6 name="coins" size={14} color={theme.gold} />
          <Text style={styles.coinsText}>{coins ?? 0}</Text>
        </Pressable>

        {isPaid && memberships.length > 1 && membershipsDropdownOpen ? (
          <View style={styles.floatingDropdownCard}>
            {memberships.map((m, index) => {
              const scope = m.category_name ? m.category_name : 'All Categories';
              const text = !m.end_date
                ? `Member · Lifetime · ${scope}`
                : `Member until ${formatMembershipEnd(m.end_date)} · ${scope}`;
              return (
                <View key={index} style={styles.membershipDropdownRow}>
                  <Ionicons name="star" size={12} color={theme.gold} />
                  <Text style={styles.membershipDropdownText}>{text}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      {!isPaid && (
        <View style={styles.memberBanner}>
          <View style={styles.bannerContent}>
            <View style={styles.bannerLeft}>
              <Text style={styles.bannerTitle}>Join Membership</Text>
              <Text style={styles.bannerSub}>
                Enjoy these exclusive benefits:
              </Text>
            </View>
            <Pressable style={styles.joinSmallBtn} onPress={goToMembership}>
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
      )}

      <View style={styles.menuCard}>
        <MenuItem
          icon="star-outline"
          label={isPaid ? 'Member' : 'Membership'}
          labelStyle={isPaid ? styles.memberLabelActive : null}
          onPress={goToMembership}
        />
        {MENU_ITEMS.map((item) => (
          <MenuItem
            key={item.label}
            {...item}
            badge={
              item.label === 'Earn Rewards' ? earnRewardsBadge : item.badge
            }
            onPress={() => handleMenuPress(item.label)}
          />
        ))}
      </View>

      <View style={styles.menuCard}>
        {SETTINGS_ITEMS.map((item) => (
          <MenuItem key={item.label} {...item} />
        ))}
        <MenuItem icon="log-out-outline" label="Log out" onPress={handleLogout} />
        {logoutState.error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Error: {logoutState.error}</Text>
          </View>
        ) : null}
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    position: 'relative',
    zIndex: 100,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPaid: {
    backgroundColor: 'rgba(76, 175, 80, 0.18)',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  coinsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,214,0,0.12)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,214,0,0.3)',
  },
  coinsText: {
    color: theme.gold,
    fontSize: 14,
    fontWeight: '700',
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
  membershipEndText: {
    color: theme.gold,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  membershipsDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  floatingDropdownCard: {
    position: 'absolute',
    top: 56,
    left: 84,
    right: 16,
    backgroundColor: '#1b1424',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 10, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 12,
    zIndex: 999,
    gap: 8,
  },
  membershipDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  membershipDropdownText: {
    color: theme.gold,
    fontSize: 11,
    fontWeight: '600',
  },
  memberLabelActive: {
    color: '#4CAF50',
    fontWeight: '700',
  },
  guestSubtext: {
    color: theme.gray,
    fontSize: 12,
    marginTop: 4,
  },
  guestPromptCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: theme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
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
  menuItemDisabled: {
    opacity: 0.45,
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
  menuLabelDisabled: {
    color: theme.darkGray,
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
  signUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  signUpRowText: {
    color: theme.crimson,
    fontSize: 15,
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
