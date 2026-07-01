import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';

import GuestAccessPrompt from '../components/GuestAccessPrompt';
import { theme } from '../constants/theme';
import { ROUTES } from '../constants/routes';
import { API_BASE_URL } from '../constants/config';
import {
  fetchBookmarks,
  fetchWatchHistory,
  toggleBookmark,
  deleteWatchHistory,
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
const TAB_DOWNLOADS = 'downloads';

import { getDownloadedEpisodes } from '../services/downloadManager';

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

// ─────────────────────────────────────────────────────────────────
// Helper to resolve thumbnail URLs to absolute URLs
// ─────────────────────────────────────────────────────────────────
function resolveThumbnailUrl(url) {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('file://')) return url; // already absolute
  return `${API_BASE_URL}${url}`; // make it absolute
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
function ShowCard({ item, onPress, onLongPress, selectionMode, selected }) {
  const progressPct =
    item.duration_sec > 0
      ? Math.min(Math.round((item.progress_sec / item.duration_sec) * 100), 100)
      : 0;

  const resolvedThumbnailUrl = resolveThumbnailUrl(item.thumbnail_url);

  return (
    <Pressable
      style={({ pressed }) => [
        cardStyles.card,
        pressed && !selectionMode && { opacity: 0.85, transform: [{ scale: 0.98 }] },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {/* Checkbox on left side in selection mode */}
      {selectionMode && (
        <View style={cardStyles.selectIconWrap}>
          <Ionicons
            name={selected ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={selected ? theme.crimson : theme.white}
          />
        </View>
      )}

      {/* Thumbnail */}
      <View style={cardStyles.thumbnailWrap}>
        {resolvedThumbnailUrl ? (
          <Image
            source={{ uri: resolvedThumbnailUrl }}
            style={cardStyles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[cardStyles.thumbnail, { backgroundColor: theme.surface }]} />
        )}

        {/* Play icon overlay */}
        {!selectionMode && (
          <View style={cardStyles.playOverlay}>
            <Ionicons name="play" size={18} color={theme.white} />
          </View>
        )}

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
          {item.tags?.length > 0 ? item.tags[0] : (item.category || 'Drama')}
        </Text>

        {/* Title */}
        <Text style={cardStyles.title} numberOfLines={2}>
          {item.show_title}
        </Text>

        {/* EP.X / EP.TOTAL */}
        <Text style={cardStyles.epLine}>
          EP.{item.episode_num} {'/'} EP.{item.total_episodes || '?'}
        </Text>
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
    position: 'relative',
  },
  selectIconWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 2,
  },
  deleteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#E0E0E0',
    fontSize: 11,
    fontWeight: '400',
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
  const route = useRoute();

  const accessToken = useSelector((state) => state.auth?.accessToken);
  const bookmarks = useSelector(selectBookmarks);
  const watchHistory = useSelector(selectWatchHistory);
  const bookmarksLoading = useSelector(selectBookmarksLoading);
  const watchHistoryLoading = useSelector(selectWatchHistoryLoading);
  const bookmarksLoaded = useSelector(selectBookmarksLoaded);
  const watchHistoryLoaded = useSelector(selectWatchHistoryLoaded);

  const [activeTab, setActiveTab] = useState(route.params?.initialTab || TAB_SAVED);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [downloads, setDownloads] = useState([]);

  // Fetch data on mount if authenticated and not yet loaded
  useEffect(() => {
    if (!accessToken) return;
    if (!bookmarksLoaded) dispatch(fetchBookmarks());
    if (!watchHistoryLoaded) dispatch(fetchWatchHistory());
  }, [accessToken, bookmarksLoaded, watchHistoryLoaded, dispatch]);

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  // Refetch bookmarks and watch history when screen comes into focus
  // This ensures data is fresh after watching/browsing in other screens
  useFocusEffect(
    useCallback(() => {
      if (!accessToken) return;
      // Refetch to ensure we have the latest bookmarks and watch history
      dispatch(fetchBookmarks());
      dispatch(fetchWatchHistory());
      getDownloadedEpisodes().then(setDownloads);
    }, [accessToken, dispatch])
  );

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
            localVideoPath: entry.localVideoPath || null,
          },
        ],
        startEpisodeNum: entry.episode_num,
        streamBase: API_BASE_URL,
        startProgressSec: entry.progress_sec || 0,
      })
    );

    // Immediately fetch the full episode list from backend
    // so the player has HLS URL and can scroll through all episodes
    if (!entry.localVideoPath) {
      dispatch(
        fetchShowPlayerPage({
          showId: entry.show_id,
          fromEp: Math.max(1, Math.floor((entry.episode_num - 1) / 30) * 30 + 1),
          limit: 30,
        })
      );
    }

    navigation.navigate(ROUTES.SHOW_PLAYER, { fromMyList: true });
  }, [dispatch, navigation]);

  const handleCardPressAction = useCallback((entry) => {
    const id = activeTab === TAB_SAVED ? entry.bookmark_id : entry.history_id;
    if (selectionMode) {
      setSelectedItems((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          if (next.size === 0) setSelectionMode(false);
        } else {
          next.add(id);
        }
        return next;
      });
    } else {
      handleCardPress(entry);
    }
  }, [selectionMode, activeTab, handleCardPress]);

  const handleCardLongPress = useCallback((entry) => {
    if (!selectionMode) {
      setSelectionMode(true);
      const id = activeTab === TAB_SAVED ? entry.bookmark_id : entry.history_id;
      setSelectedItems(new Set([id]));
    }
  }, [selectionMode, activeTab]);

  const cancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedItems(new Set());
  }, []);

  const confirmDeleteSelected = useCallback(() => {
    if (activeTab === TAB_SAVED) {
      selectedItems.forEach(id => {
        const item = bookmarks.find(b => b.bookmark_id === id);
        if (item) {
          dispatch(toggleBookmark({
            showId: item.show_id,
            episodeId: item.episode_id,
            progressSec: item.progress_sec || 0,
          }));
        }
      });
    } else {
      selectedItems.forEach(id => {
        dispatch(deleteWatchHistory({ historyId: id }));
      });
    }
    setDeleteModalVisible(false);
    cancelSelection();
  }, [selectedItems, activeTab, bookmarks, dispatch, cancelSelection]);

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
        total_episodes: watchEntry.total_episodes ?? bookmark.total_episodes,
        bookmark_id: bookmark.bookmark_id,
        tags: bookmark.tags,
      };
    }

    // No watch history for this show — use bookmark as-is
    return bookmark;
  }, [watchHistory]);

  const totalCount = bookmarks.length + watchHistory.length + downloads.length;

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
      {selectionMode ? (
        <View style={styles.selectionHeader}>
          <TouchableOpacity onPress={cancelSelection} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.selectionTitle}>{selectedItems.size} Selected</Text>
          <TouchableOpacity onPress={() => setDeleteModalVisible(true)} style={styles.deleteActionBtn}>
            <Text style={styles.deleteActionText}>Delete</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>My List</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{totalCount} Videos</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>Your saved shows and watch progress</Text>
        </>
      )}

      {/* ── Tab bar ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === TAB_SAVED && styles.tabActive]}
          onPress={() => {
            setActiveTab(TAB_SAVED);
            cancelSelection();
          }}
        >
          <Text style={[styles.tabText, activeTab === TAB_SAVED && styles.tabTextActive]}>
            Saved {bookmarks.length > 0 ? `(${bookmarks.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === TAB_CONTINUE && styles.tabActive]}
          onPress={() => {
            setActiveTab(TAB_CONTINUE);
            cancelSelection();
          }}
        >
          <Text style={[styles.tabText, activeTab === TAB_CONTINUE && styles.tabTextActive]}>
            Continue Watching {watchHistory.length > 0 ? `(${watchHistory.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === TAB_DOWNLOADS && styles.tabActive]}
          onPress={() => {
            setActiveTab(TAB_DOWNLOADS);
            cancelSelection();
          }}
        >
          <Text style={[styles.tabText, activeTab === TAB_DOWNLOADS && styles.tabTextActive]}>
            Downloads {downloads.length > 0 ? `(${downloads.length})` : ''}
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
                    tags: displayEntry.tags,
                  }}
                  selectionMode={selectionMode}
                  selected={selectedItems.has(item.bookmark_id)}
                  onPress={() => handleCardPressAction({
                    show_id: displayEntry.show_id,
                    show_title: displayEntry.show_title,
                    thumbnail_url: displayEntry.thumbnail_url,
                    episode_id: displayEntry.episode_id,
                    episode_num: displayEntry.episode_num,
                    duration_sec: displayEntry.duration_sec,
                    progress_sec: displayEntry.progress_sec,
                    total_episodes: displayEntry.total_episodes || 1,
                    bookmark_id: item.bookmark_id,
                  })}
                  onLongPress={() => handleCardLongPress(item)}
                />
              );
            }}
          />
        )
      ) : activeTab === TAB_CONTINUE ? (
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
                  tags: item.tags,
                }}
                selectionMode={selectionMode}
                selected={selectedItems.has(item.history_id)}
                onPress={() => handleCardPressAction(item)}
                onLongPress={() => handleCardLongPress(item)}
              />
            )}
          />
        )
      ) : (
        // ── Downloads tab ──────────────────────────────
        downloads.length === 0 ? (
          <EmptyState
            icon="download-outline"
            title="No downloads yet"
            subtitle="Download episodes to watch them offline"
          />
        ) : (
          <FlatList
            data={downloads}
            keyExtractor={(item) => item.episodeId}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <ShowCard
                item={{
                  show_id: item.showName, // mock for local playback
                  show_title: item.showName || item.title,
                  thumbnail_url: item.localImagePath,
                  category: 'Downloaded',
                  episode_id: item.episodeId,
                  episode_num: item.episodeNum,
                  duration_sec: item.duration,
                  progress_sec: 0,
                  total_episodes: item.episodeNum,
                  tags: ['Offline'],
                }}
                selectionMode={false} // selection for downloads not implemented yet
                selected={false}
                onPress={() => handleCardPress({
                  show_id: item.showName || item.episodeId,
                  show_title: item.showName || item.title,
                  thumbnail_url: item.localImagePath,
                  episode_id: item.episodeId,
                  episode_num: item.episodeNum,
                  duration_sec: item.duration,
                  progress_sec: 0,
                  total_episodes: 1, // Set to 1 so the player won't try to fetch more episodes offline
                  localVideoPath: item.localVideoPath,
                })}
                onLongPress={() => {}}
              />
            )}
          />
        )
      )}

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Delete Selected</Text>
            <Text style={styles.modalText}>
              Are you sure you want to delete the selected videos from your list?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnDelete}
                onPress={confirmDeleteSelected}
              >
                <Text style={styles.modalBtnDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: theme.crimson,
  },
  tabText: {
    color: theme.gray,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
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
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 6,
  },
  selectionTitle: {
    color: theme.white,
    fontSize: 18,
    fontWeight: '700',
  },
  cancelBtn: {
    padding: 8,
  },
  cancelBtnText: {
    color: theme.white,
    fontSize: 16,
  },
  deleteActionBtn: {
    padding: 8,
    backgroundColor: theme.crimson,
    borderRadius: 8,
  },
  deleteActionText: {
    color: theme.white,
    fontSize: 14,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: theme.surface,
    width: '80%',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    color: theme.white,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalText: {
    color: theme.gray,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  modalBtnCancelText: {
    color: theme.white,
    fontSize: 16,
    fontWeight: '600',
  },
  modalBtnDelete: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: theme.crimson,
    alignItems: 'center',
  },
  modalBtnDeleteText: {
    color: theme.white,
    fontSize: 16,
    fontWeight: '600',
  },
});