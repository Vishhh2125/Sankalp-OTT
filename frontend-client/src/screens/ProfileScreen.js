import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  Alert,
  Switch,
  Linking,
} from 'react-native';
import { FontAwesome6, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import GuestAccessPrompt from '../components/GuestAccessPrompt';
import CoinIcon from '../components/CoinIcon';
import { ROUTES } from '../constants/routes';
import { useGuestAuth } from '../context/GuestAuthContext';
import { useTheme } from '../context/ThemeContext';
import { fetchCheckinStatus } from '../components/rewards/dailyCheckinApi';
import { formatMembershipEnd } from '../components/membership/membershipApi';
import { logoutUser, clearLogoutError } from '../redux/slices/authSlice';
import { showAlert } from '../services/alertService';
import { fetchPublishedCmsPages } from '../services/cmsApi';
import { courseworkApi } from '../services/courseworkApi';
import { downloadFile } from '../utils/fileDownloader';

const FEATURE_ICONS = [
  { icon: 'infinite-outline', label: 'Unlimited Access' },
  { icon: 'lock-open-outline', label: 'Unlock Lectures' },
];

const MENU_ITEMS = [
  { icon: 'wallet-outline', label: 'Top Up', right: null },
  { icon: 'card-outline', label: 'My Wallet', right: null },
  { icon: 'gift-outline', label: 'Earn Rewards', badge: null },
  { icon: 'ribbon-outline', label: 'My Certificates', badge: null },
];


function MenuItem({ icon, label, right, rightComponent, badge, onPress, disabled, labelStyle, hideArrow }) {
  const { theme: appTheme } = useTheme();
  const styles = useStyles(appTheme);
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
        <Ionicons name={icon} size={20} color={disabled ? appTheme.textMuted : appTheme.text} />
        <Text style={[styles.menuLabel, { color: appTheme.text }, disabled && styles.menuLabelDisabled, labelStyle]}>{label}</Text>
      </View>
      <View style={styles.menuRight}>
        {badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
        {right && <Text style={styles.menuRightText}>{right}</Text>}
        {rightComponent}
        {!hideArrow && <Ionicons name="chevron-forward" size={18} color={appTheme.textMuted} />}
      </View>
    </Pressable>
  );
}

function GuestProfileScreen({ insets }) {
  const { theme: appTheme, isDarkMode, toggleTheme } = useTheme();
  const styles = useStyles(appTheme);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 100 },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={28} color={appTheme.darkGray} />
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
          subtitle="Create a free account to use My Wallet, save your list, earn rewards, and unlock lectures with coins."
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
        <MenuItem
          icon="moon-outline"
          label="Appearance"
          rightComponent={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="sunny" size={16} color={!isDarkMode ? appTheme.primary : appTheme.textMuted} />
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{ false: appTheme.border, true: appTheme.primary }}
                thumbColor={appTheme.surface}
              />
              <Ionicons name="moon" size={14} color={isDarkMode ? appTheme.primary : appTheme.textMuted} />
            </View>
          }
        />
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme: appTheme, isDarkMode, toggleTheme } = useTheme();
  const styles = useStyles(appTheme);
  const accessToken = useSelector((state) => state.auth?.accessToken);
  const name = useSelector((state) => state.auth.name);
  const coins = useSelector((state) => state.auth.coins);
  const plan = useSelector((state) => state.auth.plan);
  const memberships = useSelector((state) => state.auth.memberships) || [];
  const isPaid = plan && plan !== 'FREE';
  const dispatch = useDispatch();
  const { logout: logoutState } = useSelector((state) => state.auth);
  const [earnRewardsBadge, setEarnRewardsBadge] = useState(null);
  const [cmsPages, setCmsPages] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const pages = await fetchPublishedCmsPages();
          if (!cancelled && Array.isArray(pages)) {
            setCmsPages(pages);
          }
        } catch {
          if (!cancelled) setCmsPages([]);
        }
      })();

      if (!accessToken) {
        setEarnRewardsBadge(null);
        return () => {
          cancelled = true;
        };
      }

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
      showAlert('Logout Failed', logoutState.error, [
        { text: 'Retry', onPress: () => dispatch(logoutUser()) },
        { text: 'Dismiss', onPress: () => dispatch(clearLogoutError()) },
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

  const handleMyCertificatesPress = () => {
    navigation.navigate(ROUTES.MY_CERTIFICATES);
  };

  function handleMenuPress(label) {
    if (label === 'Top Up') goToTopUp();
    else if (label === 'My Wallet') goToMyWallet();
    else if (label === 'Earn Rewards') goToEarnRewards();
    else if (label === 'My Certificates') handleMyCertificatesPress();
  }

  function handleLogout() {
    showAlert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
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
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 100 },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => navigation.navigate(ROUTES.MY_DETAILS)}
            style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12 }, pressed && { opacity: 0.75 }]}
          >
            <View style={[styles.avatar, isPaid && styles.avatarPaid]}>
              <Ionicons
                name="person"
                size={28}
                color={isPaid ? '#4CAF50' : appTheme.darkGray}
              />
            </View>
            <View>
              <View style={styles.loginRow}>
                <Text style={styles.loginText}>{name || 'User'}</Text>
                <Ionicons name="chevron-forward" size={16} color={appTheme.white} />
              </View>
              {isPaid && memberships.length > 0 ? (
                <Text style={styles.membershipEndText}>
                  {memberships.map((m) => {
                    const scope = m.category_name ? ` · ${m.category_name}` : '';
                    if (!m.end_date) return `Lifetime${scope}`;
                    return `Until ${formatMembershipEnd(m.end_date)}${scope}`;
                  }).join('  ·  ')}
                </Text>
              ) : null}
            </View>
          </Pressable>
        </View>
      </View>

      {!isPaid && (
        <LinearGradient
          colors={appTheme.isDark ? ['#cd6728ff', '#44250fff'] : ['#FF6B35', '#FFB38F']}
          style={styles.memberBanner}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
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
                <Ionicons name={f.icon} size={22} color={appTheme.white} />
                <Text style={styles.featureLabel}>{f.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
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
            rightComponent={
              item.label === 'My Wallet' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 6 }}>
                  <CoinIcon size={14} color={appTheme.gold} />
                  <Text style={{ color: appTheme.text, fontWeight: '700', fontSize: 14 }}>
                    {coins ?? 0}
                  </Text>
                </View>
              ) : null
            }
            onPress={() => handleMenuPress(item.label)}
          />
        ))}
      </View>

      {/* Dynamic Published CMS Pages */}
      {cmsPages.length > 0 ? (
        <View style={styles.menuCard}>
          {cmsPages.map((pg) => (
            <MenuItem
              key={pg.id || pg.slug}
              icon="document-text-outline"
              label={pg.name}
              onPress={() =>
                navigation.navigate(ROUTES.CMS_VIEWER, {
                  slug: pg.slug,
                  title: pg.name,
                })
              }
            />
          ))}
        </View>
      ) : null}

      <View style={styles.menuCard}>
        <MenuItem
          icon="moon-outline"
          label="Appearance"
          hideArrow={true}
          rightComponent={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="sunny" size={16} color={!isDarkMode ? appTheme.primary : appTheme.textMuted} />
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{ false: appTheme.border, true: appTheme.primary }}
                thumbColor={appTheme.surface}
              />
              <Ionicons name="moon" size={14} color={isDarkMode ? appTheme.primary : appTheme.textMuted} />
            </View>
          }
        />
        <MenuItem icon="log-out-outline" label="Log out" onPress={handleLogout} />
        <MenuItem
          icon="trash-outline"
          label="Delete Account"
          labelStyle={{ color: '#FF3B30', fontWeight: '600' }}
          onPress={() => navigation.navigate(ROUTES.DELETE_ACCOUNT)}
        />
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

const useStyles = (appTheme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appTheme.deepBlack,
  },
  container: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
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
    backgroundColor: appTheme.surface,
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
    color: appTheme.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  loginText: {
    color: appTheme.white,
    fontSize: 17,
    fontWeight: '700',
  },
  membershipEndText: {
    color: appTheme.gold,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  memberLabelActive: {
    color: '#4CAF50',
    fontWeight: '700',
  },
  guestSubtext: {
    color: appTheme.gray,
    fontSize: 12,
    marginTop: 4,
  },
  guestPromptCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: appTheme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: appTheme.border,
    overflow: 'hidden',
  },
  memberBanner: {
    marginHorizontal: 16,
    backgroundColor: appTheme.crimson,
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
    color: appTheme.white,
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
    color: appTheme.white,
    fontSize: 18,
    fontWeight: '800',
  },
  bannerSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 2,
  },
  joinSmallBtn: {
    backgroundColor: appTheme.white,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  joinSmallText: {
    color: appTheme.crimson,
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
    backgroundColor: appTheme.surface,
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
    fontSize: 15,
    fontWeight: '500',
  },
  menuLabelDisabled: {
    color: appTheme.darkGray,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuRightText: {
    color: appTheme.gray,
    fontSize: 14,
  },
  badge: {
    backgroundColor: appTheme.crimson,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: appTheme.white,
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
    color: appTheme.crimson,
    fontSize: 15,
    fontWeight: '700',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: appTheme.crimson,
  },
  errorText: {
    color: appTheme.crimson,
    fontSize: 12,
    fontWeight: '500',
  },
});
