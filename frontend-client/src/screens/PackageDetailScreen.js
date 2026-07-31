import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRoute, useNavigation, useIsFocused, useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ROUTES } from '../constants/routes';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL } from '../constants/config';
import { packageApi } from '../services/packageApi';
import { setCoins } from '../redux/slices/authSlice';
import * as authService from '../services/authService';
import { initShowPlayer } from '../redux/slices/showPlayerSlice';
import { showAlert } from '../services/alertService';
import DramaDetailsSheetConnected from '../components/DramaDetailsSheetConnected';
import CoinIcon from '../components/CoinIcon';
import { createAuthenticatedApi } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const feedApi = createAuthenticatedApi({
  baseURL: API_BASE_URL,
});

function resolveThumbnailUrl(url) {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('file://')) {
    if (url.includes('/ott-media/')) return `${API_BASE_URL}${url.substring(url.indexOf('/ott-media/'))}`;
    if (url.includes('/uploads/')) return `${API_BASE_URL}${url.substring(url.indexOf('/uploads/'))}`;
    return url;
  }
  const separator = url.startsWith('/') ? '' : '/';
  return `${API_BASE_URL}${separator}${url}`;
}

export default function PackageDetailScreen() {
  const { theme, isDarkMode } = useTheme();
  const styles = useStyles(theme);
  const route = useRoute();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const packageId = route.params?.packageId;
  const userCoins = useSelector((state) => state.auth?.coins);
  const accessToken = useSelector((state) => state.auth?.accessToken);

  const [pkg, setPkg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [purchasing, setPurchasing] = useState(false);

  // Show Details Sheet State
  const [selectedShow, setSelectedShow] = useState(null);
  const [showSheetVisible, setShowSheetVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(null);
  const [showDetailsLoading, setShowDetailsLoading] = useState(false);
  const [showDetailsError, setShowDetailsError] = useState(null);
  const [dramaSheetKey, setDramaSheetKey] = useState(0);
  const [reopenSheetOnReturn, setReopenSheetOnReturn] = useState(false);

  const loadPackageDetail = useCallback(async () => {
    if (!packageId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await packageApi.getPackageDetail(packageId);
      setPkg(res.data?.data || res.data);
    } catch (err) {
      console.error('Failed to load package detail:', err);
      setError(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to retrieve package information'
      );
    } finally {
      setLoading(false);
    }
  }, [packageId]);

  useEffect(() => {
    if (isFocused) {
      loadPackageDetail();
    }
  }, [isFocused, loadPackageDetail]);

  const handleBuyPackage = async () => {
    if (!accessToken) {
      showAlert('Login Required', 'Please log in to purchase this package.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log In', onPress: () => navigation.navigate(ROUTES.LOGIN) },
      ]);
      return;
    }

    if (!pkg) return;

    if (userCoins < pkg.coin_price) {
      showAlert(
        'Insufficient Coins',
        `This package costs ${pkg.coin_price} coins, but you only have ${userCoins} coins. Would you like to buy more?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Buy Coins',
            onPress: () => navigation.navigate(ROUTES.TOP_UP, { returnToPackage: true }),
          },
        ]
      );
      return;
    }

    showAlert(
      'Confirm Purchase',
      `Unlock all Courses in "${pkg.title}" for ${pkg.coin_price} coins?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setPurchasing(true);
            try {
              const res = await packageApi.buyPackage(pkg.id);
              const data = res.data?.data || res.data;

              // Update user coins in Redux and local storage
              if (typeof data.coins === 'number') {
                dispatch(setCoins(data.coins));
                await authService.patchUserDataInStore({ coins: data.coins });
              }

              showAlert('Success', 'Package purchased successfully! All courses are now unlocked.');
              loadPackageDetail();
            } catch (err) {
              console.error('Purchase failed:', err);
              showAlert(
                'Purchase Failed',
                err?.response?.data?.message || err?.message || 'Transaction could not be completed'
              );
            } finally {
              setPurchasing(false);
            }
          },
        },
      ]
    );
  };

  // ── Show Sheet Handlers ──

  const fetchShowDetails = useCallback(async (showId, fromEp = 1) => {
    setShowDetailsLoading(true);
    setShowDetailsError(null);
    try {
      const res = await feedApi.get(`/api/feed/show/${showId}`, {
        params: { from_ep: fromEp, limit: 30 },
      });
      setShowDetails(res.data);
    } catch (e) {
      console.error('Show Details Sheet Load Error:', e);
      setShowDetails(null);
      setShowDetailsError(e?.response?.data?.message || e?.message || 'Failed to load details');
    } finally {
      setShowDetailsLoading(false);
    }
  }, []);

  // Re-open course details sheet when returning from player
  useFocusEffect(
    useCallback(() => {
      if (reopenSheetOnReturn && selectedShow) {
        setReopenSheetOnReturn(false);
        setDramaSheetKey((k) => k + 1);
        setShowSheetVisible(true);
        fetchShowDetails(selectedShow.show_id || selectedShow.id);
      }
    }, [reopenSheetOnReturn, selectedShow, fetchShowDetails])
  );

  const openShowSheet = (show) => {
    setDramaSheetKey((k) => k + 1);
    const selectedItem = {
      ...show,
      show_id: show.id,
      show_title: show.title,
      total_episodes: show.episode_count || show.total_episodes || 0,
    };
    setSelectedShow(selectedItem);
    setShowDetails(null);
    setShowSheetVisible(true);
    fetchShowDetails(show.id, 1);
  };

  const handleRangeChange = (fromEp) => {
    if (!selectedShow?.show_id) return;
    fetchShowDetails(selectedShow.show_id, fromEp);
  };

  const handleEpisodePress = (episode) => {
    if (!selectedShow || !showDetails) return;
    if (episode.status !== 'ready' && !episode.is_locked) return;

    const startProgressSec = episode?.is_completed ? 0 : (episode?.progress_sec || 0);

    dispatch(
      initShowPlayer({
        showId: showDetails.show_id,
        showTitle: showDetails.show_title || selectedShow.show_title,
        thumbnailUrl: showDetails.thumbnail_url || selectedShow.thumbnail_url,
        totalEpisodes: showDetails.total_episodes || selectedShow.total_episodes || 0,
        seedEpisodes: showDetails.episodes || [],
        startEpisodeNum: episode?.episode_num || 1,
        startProgressSec,
        streamBase: API_BASE_URL,
      })
    );

    setReopenSheetOnReturn(true);
    setShowSheetVisible(false);
    navigation.navigate(ROUTES.SHOW_PLAYER, { fromPackage: true });
  };

  const handleStartWatching = () => {
    if (!selectedShow) return;
    const episodes = showDetails?.show_id === selectedShow.show_id ? showDetails.episodes : null;
    const episode = episodes?.find((ep) => ep.status === 'ready' && !ep.is_locked) || episodes?.[0];

    if (episode && showDetails) {
      handleEpisodePress(episode);
      return;
    }

    dispatch(
      initShowPlayer({
        showId: selectedShow.show_id,
        showTitle: selectedShow.show_title || selectedShow.title,
        thumbnailUrl: selectedShow.thumbnail_url,
        totalEpisodes: selectedShow.total_episodes || 0,
        seedEpisodes: [],
        startEpisodeNum: 1,
        streamBase: API_BASE_URL,
      })
    );
    setReopenSheetOnReturn(true);
    setShowSheetVisible(false);
    navigation.navigate(ROUTES.SHOW_PLAYER, { fromPackage: true });
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading package...</Text>
      </View>
    );
  }

  if (error || !pkg) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top, paddingHorizontal: 20 }]}>
        <Ionicons name="alert-circle-outline" size={54} color={theme.red} />
        <Text style={styles.errorText}>{error || 'Package details could not be found'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadPackageDetail}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const savings = Math.max(0, (pkg.individual_price_sum || 0) - pkg.coin_price);
  const savingsPct = pkg.individual_price_sum > 0 ? Math.round((savings / pkg.individual_price_sum) * 100) : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} translucent />

      {/* Sticky Header Bar */}
      <View style={[styles.headerBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Package Details</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 40 }]} showsVerticalScrollIndicator={false}>
        {/* Package Header Row (Matches Show details modal poster layout) */}
        <View style={styles.packageHeaderRow}>
          {pkg.thumbnail_url ? (
            <Image
              source={{ uri: resolveThumbnailUrl(pkg.thumbnail_url) }}
              style={styles.packagePoster}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.packagePoster, styles.posterFallback]} />
          )}
          <View style={styles.packagePosterMeta}>
            <Text style={styles.packageTitle} numberOfLines={2}>
              {pkg.title}
            </Text>
            <Text style={styles.packageMetaText}>
              {pkg.shows?.length || 0} {pkg.shows?.length === 1 ? 'Course' : 'Courses'} Included
            </Text>
          </View>
        </View>

        <View style={styles.detailsBlock}>
          <Text style={styles.synopsisTitle}>About this package</Text>
          <Text style={styles.synopsis}>{pkg.synopsis}</Text>

          {!(pkg.is_owned || pkg.is_membership_covered) && (
            <View style={styles.pricingCard}>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Individual Course Total:</Text>
                <View style={styles.coinWrap}>
                  <Text style={styles.individualPriceText}>
                    {pkg.individual_price_sum || 0}
                  </Text>
                  <CoinIcon size={14} style={styles.coinIconMargin} />
                </View>
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Package Price:</Text>
                <View style={styles.coinWrap}>
                  <Text style={styles.packagePriceText}>{pkg.coin_price}</Text>
                  <CoinIcon size={20} style={styles.coinIconMargin} />
                </View>
              </View>

              {savings > 0 && (
                <View style={styles.savingsRow}>
                  <Text style={styles.savingsText}>
                    Save {savings} coins ({savingsPct}% discount)!
                  </Text>
                </View>
              )}
            </View>
          )}

          {pkg.is_membership_covered ? (
            <View style={[styles.actionBtn, styles.disabledBtn]}>
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color={theme.lightGray}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.disabledBtnText}>Already included in membership</Text>
            </View>
          ) : pkg.is_owned ? (
            <View style={[styles.actionBtn, styles.ownedBtn]}>
              <Ionicons
                name="lock-open-outline"
                size={18}
                color={theme.green}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.ownedBtnText}>Owned</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleBuyPackage}
              disabled={purchasing}
            >
              {purchasing ? (
                <ActivityIndicator size="small" color={theme.white} />
              ) : (
                <Text style={styles.actionBtnText}>
                  {userCoins < pkg.coin_price
                    ? `Not enough coins (${pkg.coin_price} Coins)`
                    : `Buy Package · ${pkg.coin_price} Coins`}
                </Text>
              )}
            </TouchableOpacity>
          )}

          <Text style={styles.showsHeader}>Included Courses ({pkg.shows?.length || 0})</Text>

          <View style={styles.showsList}>
            {pkg.shows?.map((show, index) => (
              <TouchableOpacity
                key={show.id || index}
                style={styles.showRow}
                onPress={() => openShowSheet(show)}
                activeOpacity={0.8}
              >
                {show.thumbnail_url ? (
                  <Image
                    source={{ uri: resolveThumbnailUrl(show.thumbnail_url) }}
                    style={styles.showPoster}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.showPosterFallback} />
                )}
                <View style={styles.showDetails}>
                  <Text style={styles.showTitle} numberOfLines={2}>
                    {show.title}
                  </Text>
                  <View style={styles.showMetaRow}>
                    {show.has_access ? (
                      <Text style={styles.showMetaText}>{show.is_free ? 'Free Show' : 'Unlocked'}</Text>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <CoinIcon size={12} color={theme.gold || "#FFD700"} />
                        <Text style={[styles.showMetaText, { marginLeft: 4 }]}>
                          {Number(show.coin_cost || 0).toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.darkGray} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Show Details Overlay Sheet */}
      <DramaDetailsSheetConnected
        key={`drama-${dramaSheetKey}-${selectedShow?.show_id ?? 'none'}`}
        visible={showSheetVisible}
        item={selectedShow}
        details={selectedShow?.show_id === showDetails?.show_id ? showDetails : null}
        loading={showDetailsLoading}
        error={showDetailsError}
        initialTab="synopsis"
        onRangeChange={handleRangeChange}
        onEpisodePress={handleEpisodePress}
        onStartWatching={handleStartWatching}
        onClose={() => {
          setShowSheetVisible(false);
          setSelectedShow(null);
          loadPackageDetail();
        }}
      />
    </View>
  );
}

const useStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.deepBlack,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.deepBlack,
  },
  loadingText: {
    color: theme.gray,
    fontSize: 14,
    marginTop: 10,
  },
  errorText: {
    color: theme.text,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: theme.primary,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    backgroundColor: theme.deepBlack,
  },
  backBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  packageHeaderRow: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  packagePoster: {
    width: 90,
    height: 110,
    borderRadius: 10,
    backgroundColor: theme.surface,
  },
  posterFallback: {
    borderWidth: 1,
    borderColor: theme.border,
  },
  packagePosterMeta: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  packageTitle: {
    color: theme.text,
    fontSize: 21,
    fontWeight: '800',
  },
  packageMetaText: {
    color: theme.gray,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  detailsBlock: {
    paddingHorizontal: 16,
  },
  synopsisTitle: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  synopsis: {
    fontSize: 14,
    color: theme.gray,
    lineHeight: 20,
    marginBottom: 20,
  },
  pricingCard: {
    backgroundColor: theme.isDark ? 'rgba(26, 0, 32, 0.65)' : '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    color: theme.gray,
    fontSize: 14,
    fontWeight: '600',
  },
  coinWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  individualPriceText: {
    color: theme.gray,
    fontSize: 14,
    textDecorationLine: 'line-through',
    fontWeight: '700',
  },
  packagePriceText: {
    color: theme.gold,
    fontSize: 20,
    fontWeight: '800',
  },
  coinIconMargin: {
    marginLeft: 4,
  },
  savingsRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    marginTop: 8,
    paddingTop: 8,
    alignItems: 'flex-end',
  },
  savingsText: {
    color: theme.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  actionBtn: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 24,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  disabledBtn: {
    backgroundColor: theme.disabledBg,
    borderWidth: 1,
    borderColor: theme.disabled,
  },
  disabledBtnText: {
    color: theme.gray,
    fontSize: 14,
    fontWeight: '700',
  },
  ownedBtn: {
    backgroundColor: theme.isDark ? 'rgba(52, 199, 89, 0.1)' : 'rgba(22, 163, 74, 0.08)',
    borderWidth: 1,
    borderColor: theme.green,
  },
  ownedBtnText: {
    color: theme.green,
    fontSize: 15,
    fontWeight: '700',
  },
  showsHeader: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
  },
  showsList: {
    gap: 12,
  },
  showRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  showPoster: {
    width: 48,
    height: 64,
    borderRadius: 4,
    backgroundColor: theme.inputBackground,
  },
  showPosterFallback: {
    width: 48,
    height: 64,
    borderRadius: 4,
    backgroundColor: theme.surfaceLight,
  },
  showDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  showTitle: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 4,
  },
  showMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  showMetaText: {
    color: theme.primary,
    fontSize: 11,
    fontWeight: '600',
  },
});