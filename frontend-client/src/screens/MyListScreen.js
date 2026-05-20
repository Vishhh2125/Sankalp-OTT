import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';

import GuestAccessPrompt from '../components/GuestAccessPrompt';
import { theme } from '../constants/theme';
import { ROUTES } from '../constants/routes';
import { API_BASE_URL } from '../constants/config';
import {
  fetchBookmarks,
  fetchWatchHistory,
  toggleBookmark,
  selectBookmarks,
  selectWatchHistory,
  selectBookmarksLoading,
  selectWatchHistoryLoading,
  selectBookmarksLoaded,
  selectWatchHistoryLoaded,
} from '../redux/slices/myListSlice';
import {
  initShowPlayer,
  fetchShowPlayerPage,
} from '../redux/slices/showPlayerSlice';

const { width } = Dimensions.get('window');

// Tab constants
const TAB_SAVED = 'saved';
const TAB_CONTINUE = 'continue';

// ─────────────────────────────────────────────────────────────────
// Progress bar shown on the thumbnail
// ─────────────────────────────────────────────────────────────────
function ThumbnailProgressBar({ progressSec, durationSec }) {
  if (!durationSec || durationSec === 0) return null;
  const pct = Math.min((progressSec / durationSec) * 100, 100);
  if (pct <= 0) return null;

  return (
    <View style={pStyles.track}>
      <View style={[pStyles.fill, { width: `${pct}%` }]} />
    </View>
  );
}

const pStyles = StyleSheet.create({
  track: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  fill: {
    height: '100%',
    backgroundColor: theme.crimson,
    borderRadius: 2,
  },
});

// ─────────────────────────────────────────────────────────────────
// Show card — matches the UI reference image exactly
// thumbnail on left, title + category + EP.X / EP.TOTAL on right
// ─────────────────────────────────────────────────────────────────
function ShowCard({ item, onPress, onRemove, showRemove = false }) {
  const progressPct =
    item.duration_sec > 0
      ? Math.min(Math.round((item.progress_sec / item.duration_sec) * 100), 100)
      : 0;

  return (
    <Pressable
      style={({ pressed }) => [
        cardStyles.card,
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
      ]}
      onPress={onPress}
    >
      {/* Thumbnail */}
      <View style={cardStyles.thumbnailWrap}>
        {item.thumbnail_url ? (
          <Image
            source={{ uri: item.thumbnail_url }}
            style={cardStyles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[cardStyles.thumbnail, { backgroundColor: theme.surface }]} />
        )}

        {/* Play icon overlay */}
        <View style={cardStyles.playOverlay}>
          <Ionicons name="play" size={18} color={theme.white} />
        </View>

        {/* Progress bar at bottom of thumbnail */}
        <ThumbnailProgressBar
          progressSec={item.progress_sec || 0}
          durationSec={item.duration_sec || 0}
        />
      </View>

      {/* Info */}
      <View style={cardStyles.info}>
        {/* Category / tags */}
        <Text style={cardStyles.category} numberOfLines={1}>
          {item.category || 'Drama'}
        </Text>

        {/* Title */}
        <Text style={cardStyles.title} numberOfLines={2}>
          {item.show_title}
        </Text>

        {/* EP.X / EP.TOTAL */}
        <Text style={cardStyles.epLine}>
          EP.{item.episode_num} {'/'} EP.{item.total_episodes || '?'}
        </Text>

        {/* Remove button (trash) — only shown for bookmarks */}
        {showRemove && onRemove ? (
          <TouchableOpacity
            style={cardStyles.removeBtn}
            onPress={onRemove}
            hitSlop={8}
          >
            <Ionicons name="trash-outline" size={16} color={theme.crimson} />
          </TouchableOpacity>
        ) : null}
      </View>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: 16,
    overflow: 'hidden',
    height: 110,
    marginBottom: 14,
  },
  thumbnailWrap: {
    width: 140,
    height: '100%',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -18,
    marginLeft: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    gap: 4,
  },
  category: {
    color: theme.gray,
    fontSize: 11,
    fontWeight: '500',
  },
  title: {
    color: theme.white,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  epLine: {
    color: theme.lightGray,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  removeBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
});

// ─────────────────────────────────────────────────────────────────
// Empty state component
// ─────────────────────────────────────────────────────────────────
function EmptyState({ icon, title, subtitle }) {
  return (
    <View style={emptyStyles.wrap}>
      <Ionicons name={icon} size={48} color={theme.border} />
      <Text style={emptyStyles.title}>{title}</Text>
      <Text style={emptyStyles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
  },
  title: {
    color: theme.gray,
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    color: theme.darkGray,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});

// ─────────────────────────────────────────────────────────────────
// Guest screen
// ─────────────────────────────────────────────────────────────────
function GuestScreen() {
  return (
    <GuestAccessPrompt
      title="Sign in to use My List"
      subtitle="Bookmark shows and track your watch progress across devices."
    />
  );
}

// ─────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────
export default function MyListScreen() {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const accessToken = useSelector((state) => state.auth?.accessToken);
  const bookmarks = useSelector(selectBookmarks);
  const watchHistory = useSelector(selectWatchHistory);
  const bookmarksLoading = useSelector(selectBookmarksLoading);
  const watchHistoryLoading = useSelector(selectWatchHistoryLoading);
  const bookmarksLoaded = useSelector(selectBookmarksLoaded);
  const watchHistoryLoaded = useSelector(selectWatchHistoryLoaded);

  const [activeTab, setActiveTab] = useState(TAB_SAVED);

  // Fetch data on mount if authenticated and not yet loaded
  useEffect(() => {
    if (!accessToken) return;
    if (!bookmarksLoaded) dispatch(fetchBookmarks());
    if (!watchHistoryLoaded) dispatch(fetchWatchHistory());
  }, [accessToken, bookmarksLoaded, watchHistoryLoaded, dispatch]);

  // ── Navigate to player from a bookmark or watch history entry ──
  const handleCardPress = useCallback((entry) => {
    // entry has: show_id, show_title, thumbnail_url, episode_id,
    // episode_num, duration_sec, progress_sec, total_episodes
    dispatch(
      initShowPlayer({
        showId: entry.show_id,
        showTitle: entry.show_title,
        thumbnailUrl: entry.thumbnail_url,
        totalEpisodes: entry.total_episodes || 1,
        seedEpisodes: [
          {
            // Shape matches what mapEpisode expects in showPlayerSlice
            episode_id: entry.episode_id,
            episode_num: entry.episode_num,
            hls_url: null, // will be fetched by fetchShowPlayerPage
            duration_sec: entry.duration_sec || 0,
            title: null,
            is_locked: false,
            lock_reason: null,
            is_free: true,
            coin_cost: 0,
            status: 'ready',
          },
        ],
        startEpisodeNum: entry.episode_num,
        streamBase: API_BASE_URL,
        startProgressSec: entry.progress_sec || 0,
      })
    );

    // Immediately fetch the full episode list from backend
    // so the player has HLS URL and can scroll through all episodes
    dispatch(
      fetchShowPlayerPage({
        showId: entry.show_id,
        fromEp: 1,
        limit: 30,
      })
    );

    navigation.navigate(ROUTES.SHOW_PLAYER);
  }, [dispatch, navigation]);

  // ── Remove bookmark ──────────────────────────────────────────
  const handleRemoveBookmark = useCallback((bookmark) => {
    dispatch(toggleBookmark({
      showId: bookmark.show_id,
      episodeId: bookmark.episode_id,
      progressSec: bookmark.progress_sec || 0,
    }));
  }, [dispatch]);

  // ── Merge bookmark with latest watch history ──────────────────
  // If a show was bookmarked but the user watched a later episode,
  // show and play the latest watched episode instead
  const getDisplayEntry = useCallback((bookmark) => {
    const watchEntry = watchHistory.find(w => w.show_id === bookmark.show_id);

    if (watchEntry) {
      // Merge: use bookmark data but replace episode info with latest watched
      return {
        show_id: bookmark.show_id,
        show_title: bookmark.show_title,
        thumbnail_url: bookmark.thumbnail_url,
        category: bookmark.category,
        episode_id: watchEntry.episode_id,
        episode_num: watchEntry.episode_num,
        duration_sec: watchEntry.duration_sec,
        progress_sec: watchEntry.progress_sec,
        total_episodes: bookmark.total_episodes,
      };
    }

    // No watch history for this show — use bookmark as-is
    return bookmark;
  }, [watchHistory]);

  const totalCount = bookmarks.length + watchHistory.length;

  if (!accessToken) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <GuestScreen />
      </View>
    );
  }

  const isLoading = (bookmarksLoading && !bookmarksLoaded) ||
    (watchHistoryLoading && !watchHistoryLoaded);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>My List</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{totalCount} Videos</Text>
        </View>
      </View>
      <Text style={styles.subtitle}>Your saved shows and watch progress</Text>

      {/* ── Tab bar ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === TAB_SAVED && styles.tabActive]}
          onPress={() => setActiveTab(TAB_SAVED)}
        >
          <Text style={[styles.tabText, activeTab === TAB_SAVED && styles.tabTextActive]}>
            Saved {bookmarks.length > 0 ? `(${bookmarks.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === TAB_CONTINUE && styles.tabActive]}
          onPress={() => setActiveTab(TAB_CONTINUE)}
        >
          <Text style={[styles.tabText, activeTab === TAB_CONTINUE && styles.tabTextActive]}>
            Continue Watching {watchHistory.length > 0 ? `(${watchHistory.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Content ── */}
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.crimson} />
        </View>
      ) : activeTab === TAB_SAVED ? (
        // ── Saved / Bookmarks tab ──────────────────────────────
        bookmarks.length === 0 ? (
          <EmptyState
            icon="bookmark-outline"
            title="No saved shows yet"
            subtitle="Tap the bookmark icon while watching to save a show"
          />
        ) : (
          <FlatList
            data={bookmarks}
            keyExtractor={(item) => item.bookmark_id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const displayEntry = getDisplayEntry(item);
              return (
                <ShowCard
                  item={{
                    show_id: displayEntry.show_id,
                    show_title: displayEntry.show_title,
                    thumbnail_url: displayEntry.thumbnail_url,
                    category: displayEntry.category,
                    episode_id: displayEntry.episode_id,
                    episode_num: displayEntry.episode_num,
                    duration_sec: displayEntry.duration_sec,
                    progress_sec: displayEntry.progress_sec,
                    total_episodes: displayEntry.total_episodes || null,
                  }}
                  onPress={() => handleCardPress({
                    show_id: displayEntry.show_id,
                    show_title: displayEntry.show_title,
                    thumbnail_url: displayEntry.thumbnail_url,
                    episode_id: displayEntry.episode_id,
                    episode_num: displayEntry.episode_num,
                    duration_sec: displayEntry.duration_sec,
                    progress_sec: displayEntry.progress_sec,
                    total_episodes: displayEntry.total_episodes || 1,
                  })}
                  onRemove={() => handleRemoveBookmark(item)}
                  showRemove
                />
              );
            }}
          />
        )
      ) : (
        // ── Continue Watching tab ──────────────────────────────
        watchHistory.length === 0 ? (
          <EmptyState
            icon="play-circle-outline"
            title="Nothing in progress yet"
            subtitle="Start watching an episode and it will appear here"
          />
        ) : (
          <FlatList
            data={watchHistory}
            keyExtractor={(item) => item.history_id || item.episode_id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <ShowCard
                item={{
                  show_id: item.show_id,
                  show_title: item.show_title,
                  thumbnail_url: item.thumbnail_url,
                  category: item.category,
                  episode_id: item.episode_id,
                  episode_num: item.episode_num,
                  duration_sec: item.duration_sec,
                  progress_sec: item.progress_sec,
                  total_episodes: item.total_episodes || null,
                }}
                onPress={() => handleCardPress({
                  show_id: item.show_id,
                  show_title: item.show_title,
                  thumbnail_url: item.thumbnail_url,
                  episode_id: item.episode_id,
                  episode_num: item.episode_num,
                  duration_sec: item.duration_sec,
                  progress_sec: item.progress_sec,
                  total_episodes: item.total_episodes || 1,
                })}
                showRemove={false}
              />
            )}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.deepBlack,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: theme.white,
    fontSize: 28,
    fontWeight: '800',
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countText: {
    color: theme.gray,
    fontSize: 12,
  },
  subtitle: {
    color: theme.gray,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: theme.crimson,
  },
  tabText: {
    color: theme.gray,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: theme.white,
  },
  list: {
    paddingBottom: 40,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});