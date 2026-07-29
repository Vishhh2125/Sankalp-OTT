import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GuestAccessPrompt from '../components/GuestAccessPrompt';
import { useTheme } from '../context/ThemeContext';
import { ROUTES } from '../constants/routes';
import { fetchActiveLiveStreams } from '../components/live/liveApi';
import { useNetwork } from '../context/NetworkContext';
import { API_BASE_URL } from '../constants/config';

// ─────────────────────────────────────────────────────────────────
// Guest screen
// Uses the same GuestAccessPrompt component as My Learning.
// Only the wording is changed for the Live screen.
// ─────────────────────────────────────────────────────────────────
function GuestScreen() {
  return (
    <GuestAccessPrompt
      title="Sign in to watch Live"
      subtitle="Sign in to join live streams and watch live learning sessions."
    />
  );
}

export default function LiveScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useStyles(theme, insets);
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { isOffline } = useNetwork();

  // Same authentication check used by My Learning.
  const accessToken = useSelector((state) => state.auth?.accessToken);

  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'scheduled'

  // ───────────────────────────────────────────────────────────────
  // Load active live streams
  // ───────────────────────────────────────────────────────────────
  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const data = await fetchActiveLiveStreams();

      setStreams(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load live streams'
      );

      setStreams([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Do not call the live API for guest users.
  useEffect(() => {
    if (!isFocused || !accessToken) return;

    load();
  }, [isFocused, accessToken, load]);

  // ───────────────────────────────────────────────────────────────
  // Open Live Viewer
  // Guest users never reach this function because the entire
  // Live screen is replaced with GuestAccessPrompt.
  // ───────────────────────────────────────────────────────────────
  const openViewer = (stream) => {
    const isLive = stream.is_live || stream.status === 'LIVE';

    if (!isLive && stream.status === 'SCHEDULED') {
      // Keeping the existing scheduled-stream behaviour.
      // Using Alert here is unnecessary because the original
      // project already had showAlert removed for guest handling.
      return;
    }

    navigation.navigate(ROUTES.LIVE_VIEWER, {
      streamId: stream.id,
      title: stream.title,
    });
  };

  // ───────────────────────────────────────────────────────────────
  // Guest Account
  // Same behaviour as My Learning:
  //
  // if (!accessToken) {
  //   return <GuestScreen />;
  // }
  //
  // This prevents API loading and displays the common styled
  // sign-in prompt instead.
  // ───────────────────────────────────────────────────────────────
  if (!accessToken) {
    return (
      <View
        style={[
          styles.screen,
          {
            paddingTop: insets.top,
          },
        ]}
      >
        <GuestScreen />
      </View>
    );
  }

  // ───────────────────────────────────────────────────────────────
  // Loading
  // ───────────────────────────────────────────────────────────────
  if (loading && !refreshing) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Live</Text>
          <Text style={styles.headerSub}>
            Watch streams happening now
          </Text>
        </View>

        <View style={styles.loadingWrap}>
          <ActivityIndicator
            size="large"
            color={theme.primary}
          />
        </View>
      </View>
    );
  }

  const liveStreams = streams.filter(s => s.is_live || s.status === 'LIVE');
  const scheduledStreams = streams.filter(s => !s.is_live && s.status === 'SCHEDULED');
  const activeStreams = activeTab === 'live' ? liveStreams : scheduledStreams;

  // ───────────────────────────────────────────────────────────────
  // Main Screen
  // ───────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + 70 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live</Text>
        <Text style={styles.headerSub}>
          Watch streams happening now
        </Text>
      </View>

      {/* Tab Bar — same style as My Learning */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'live' && styles.tabActive]}
          onPress={() => setActiveTab('live')}
        >
          <Text style={[styles.tabText, activeTab === 'live' && styles.tabTextActive]}>Live</Text>
          <Text style={[styles.tabText, activeTab === 'live' && styles.tabTextActive, { marginTop: 2, fontSize: 11 }]}>
            ({liveStreams.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'scheduled' && styles.tabActive]}
          onPress={() => setActiveTab('scheduled')}
        >
          <Text style={[styles.tabText, activeTab === 'scheduled' && styles.tabTextActive]}>Scheduled</Text>
          <Text style={[styles.tabText, activeTab === 'scheduled' && styles.tabTextActive, { marginTop: 2, fontSize: 11 }]}>
            ({scheduledStreams.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Error */}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {isOffline ? 'You are offline' : error}
          </Text>

          <Pressable
            style={styles.retryBtn}
            onPress={() => load()}
          >
            <Text style={styles.retryText}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Live Streams */}
      <FlatList
        data={activeStreams}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={theme.primary}
          />
        }
        contentContainerStyle={
          streams.length === 0
            ? styles.emptyWrap
            : styles.list
        }
        ListEmptyComponent={
          !error ? (
            <View style={styles.empty}>
              <Ionicons
                name={
                  isOffline
                    ? 'cloud-offline-outline'
                    : 'radio-outline'
                }
                size={48}
                color={theme.gray}
              />

              <Text style={styles.emptyTitle}>
                {isOffline
                  ? 'You are offline'
                  : 'No live streams right now'}
              </Text>

              <Text style={styles.emptySub}>
                {isOffline
                  ? 'Check your internet connection and try again.'
                  : 'Check back soon — new sessions go live from the admin panel.'}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isLive =
            item.is_live ||
            item.status === 'LIVE';

          const badgeBg = isLive
            ? 'rgba(255,76,0,0.15)'
            : 'rgba(255,214,10,0.15)';

          const badgeDot = isLive
            ? theme.primary
            : theme.gold;

          const badgeText = isLive
            ? 'LIVE'
            : 'SCHEDULED';

          const linkText = isLive
            ? 'Join now'
            : '';

          const linkColor = isLive
            ? theme.primary
            : theme.gold;

          const resolvedUrl = resolveThumbnailUrl(
            item.show?.thumbnail_url ||
            item.thumbnail_url
          );

          const formatDate = (dateString) => {
            if (!dateString) return '';

            const d = new Date(dateString);

            const day = String(
              d.getDate()
            ).padStart(2, '0');

            const month = String(
              d.getMonth() + 1
            ).padStart(2, '0');

            const year = d.getFullYear();

            const hours = String(
              d.getHours()
            ).padStart(2, '0');

            const minutes = String(
              d.getMinutes()
            ).padStart(2, '0');

            return `${day}/${month}/${year}, ${hours}:${minutes}`;
          };

          return (
            <Pressable
              style={styles.card}
              onPress={() => openViewer(item)}
            >
              {/* Thumbnail */}
              <View style={styles.thumbnailWrap}>
                {resolvedUrl ? (
                  <Image
                    source={{
                      uri: resolvedUrl,
                    }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.thumbnail,
                      styles.centered,
                      {
                        backgroundColor:
                          '#2C2C2E',
                      },
                    ]}
                  >
                    <Ionicons
                      name="film-outline"
                      size={28}
                      color={theme.gray}
                    />
                  </View>
                )}
              </View>

              {/* Stream Information */}
              <View style={styles.info}>
                <View style={{ gap: 2 }}>
                  <View style={styles.rowHeader}>
                    {/* Live / Scheduled Badge */}
                    <View
                      style={[
                        styles.liveBadge,
                        {
                          backgroundColor:
                            badgeBg,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.liveDot,
                          {
                            backgroundColor:
                              badgeDot,
                          },
                        ]}
                      />

                      <Text
                        style={[
                          styles.liveBadgeText,
                          {
                            color:
                              badgeDot,
                          },
                        ]}
                      >
                        {badgeText}
                      </Text>
                    </View>
                  </View>

                  {/* Course / Show Name */}
                  {item.show?.title ? (
                    <Text
                      style={
                        styles.cardCourse
                      }
                      numberOfLines={1}
                    >
                      {item.show.title}
                    </Text>
                  ) : null}

                  {/* Stream Title */}
                  <Text
                    style={styles.cardTitle}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>

                  {/* Scheduled Time */}
                  {item.scheduled_at &&
                    !isLive ? (
                    <Text
                      style={styles.cardSub}
                      numberOfLines={1}
                    >
                      Sch:{' '}
                      {formatDate(
                        item.scheduled_at
                      )}
                    </Text>
                  ) : null}
                </View>

                {/* Footer */}
                <View style={styles.watchRow}>
                  {linkText ? (
                    <Text
                      style={[
                        styles.watchText,
                        {
                          color:
                            linkColor,
                        },
                      ]}
                    >
                      {linkText}
                    </Text>
                  ) : (
                    <View />
                  )}

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={linkColor}
                  />
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// Resolve thumbnail URL
// ─────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────
const useStyles = (theme, insets = {}) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.deepBlack,
    },

    centered: {
      justifyContent: 'center',
      alignItems: 'center',
    },

    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 16,
    },

    headerTitle: {
      color: theme.text,
      fontSize: 26,
      fontWeight: '800',
    },

    headerSub: {
      color: theme.gray,
      fontSize: 13,
      marginTop: 4,
      marginBottom: 16,
    },

    loadingWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },

    list: {
      paddingHorizontal: 16,
      paddingBottom:
        16 + (insets.bottom || 0),
      gap: 14,
    },

    emptyWrap: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingBottom:
        insets.bottom || 0,
    },

    empty: {
      alignItems: 'center',
      paddingHorizontal: 32,
    },

    emptyTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '700',
      marginTop: 12,
    },

    emptySub: {
      color: theme.gray,
      fontSize: 13,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 20,
    },

    card: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: 16,
      overflow: 'hidden',
      height: 120,
      borderWidth: 1,
      borderColor: theme.border,
    },

    thumbnailWrap: {
      width: 95,
      height: '100%',
      backgroundColor: theme.isDark
        ? '#1C1C1E'
        : '#F3F4F6',
    },

    thumbnail: {
      width: '100%',
      height: '100%',
    },

    info: {
      flex: 1,
      padding: 12,
      justifyContent: 'space-between',
    },

    rowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      gap: 6,
    },

    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },

    liveBadgeText: {
      fontSize: 11,
      fontWeight: '800',
    },

    cardCourse: {
      color: theme.gray,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
    },

    cardTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
      marginTop: 2,
    },

    cardSub: {
      color: theme.gray,
      fontSize: 12,
      marginTop: 2,
    },

    watchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    },

    watchText: {
      fontWeight: '700',
      fontSize: 13,
    },

    errorBox: {
      padding: 16,
      alignItems: 'center',
    },

    errorText: {
      color: theme.text,
      fontSize: 14,
      textAlign: 'center',
    },

    retryBtn: {
      marginTop: 10,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: theme.primary,
      borderRadius: 8,
    },

    retryText: {
      color: '#fff',
      fontWeight: '600',
    },

    // Tab bar — same style as My Learning
    tabBar: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 4,
      marginHorizontal: 16,
      marginBottom: 12,
    },
    tab: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
    },
    tabActive: {
      backgroundColor: theme.primary,
    },
    tabText: {
      color: theme.gray,
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
    },
    tabTextActive: {
      color: theme.white || '#fff',
    },
  });