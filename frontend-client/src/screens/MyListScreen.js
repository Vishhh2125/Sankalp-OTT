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
import DramaDetailsSheetConnected, { TrophyProgressRing } from '../components/DramaDetailsSheetConnected';
import { useTheme } from '../context/ThemeContext';
import { ROUTES } from '../constants/routes';
import { API_BASE_URL } from '../constants/config';
import { createAuthenticatedApi } from '../services/api';
import {
  fetchBookmarks,
  fetchWatchHistory,
  fetchMyCourses,
  toggleBookmark,
  deleteWatchHistory,
  selectBookmarks,
  selectWatchHistory,
  selectMyCourses,
  selectBookmarksLoading,
  selectWatchHistoryLoading,
  selectMyCoursesLoading,
  selectBookmarksLoaded,
  selectWatchHistoryLoaded,
  selectMyCoursesLoaded,
} from '../redux/slices/myListSlice';
import {
  initShowPlayer,
  fetchShowPlayerPage,
} from '../redux/slices/showPlayerSlice';
import { getDownloadedEpisodes, removeDownload } from '../services/downloadManager';

const { width } = Dimensions.get('window');

// Tab constants
const TAB_MY_COURSES = 'my_courses';
const TAB_SAVED = 'saved';
const TAB_CONTINUE = 'continue';
const TAB_DOWNLOADS = 'downloads';

const feedApi = createAuthenticatedApi({ baseURL: API_BASE_URL });

// ─────────────────────────────────────────────────────────────────
// Progress bar shown on the thumbnail
// ─────────────────────────────────────────────────────────────────
function ThumbnailProgressBar({ progressSec, durationSec }) {
  const { theme: appTheme } = useTheme();
  const pStyles = usePStyles(appTheme);
  if (!durationSec || durationSec === 0) return null;
  const pct = Math.min((progressSec / durationSec) * 100, 100);
  if (pct <= 0) return null;

  return (
    <View style={pStyles.track}>
      <View style={[pStyles.fill, { width: `${pct}%` }]} />
    </View>
  );
}

const usePStyles = (appTheme) => StyleSheet.create({
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
    backgroundColor: appTheme.primary,
    borderRadius: 2,
  },
});

// ─────────────────────────────────────────────────────────────────
// Helper to resolve thumbnail URLs to absolute URLs
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
// Course Card — rendered in "My Courses" tab
// Tapping opens Course Details sheet on Lectures tab (No video auto-play)
// ─────────────────────────────────────────────────────────────────
function CourseCard({ item, onPress }) {
  const { theme: appTheme } = useTheme();
  const cardStyles = useCardStyles(appTheme);
  const resolvedThumbnailUrl = resolveThumbnailUrl(item.thumbnail_url);

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
        {resolvedThumbnailUrl ? (
          <Image
            source={{ uri: resolvedThumbnailUrl }}
            style={cardStyles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[cardStyles.thumbnail, { backgroundColor: appTheme.surface }]} />
        )}

        {/* Access Badge */}
        {item.access_label ? (
          <View style={cardStyles.accessBadge}>
            <Text style={cardStyles.accessBadgeText} numberOfLines={1}>
              {item.access_label}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Info */}
      <View style={cardStyles.info}>
        {/* Category & Top Right Trophy Badge */}
        <View style={cardStyles.cardTopRow}>
          <Text style={cardStyles.category} numberOfLines={1}>
            {item.category || item.teacher_name || 'Course'}
          </Text>

          <TrophyProgressRing
            completedCount={item.completed_episodes || 0}
            totalEpisodes={item.total_episodes || 1}
            size={20}
          />
        </View>

        {/* Title */}
        <Text style={cardStyles.title} numberOfLines={2}>
          {item.show_title}
        </Text>

        {/* EP / Lectures Info */}
        <View style={cardStyles.metaRow}>
          <Ionicons name="book-outline" size={13} color={appTheme.gray} style={{ marginRight: 4 }} />
          <Text style={cardStyles.epLine}>
            {item.unlocked_episodes} / {item.total_episodes || 0} Lectures
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────
// Show card — matches Saved / Continue / Downloads
// ─────────────────────────────────────────────────────────────────
function ShowCard({ item, onPress, onLongPress, selectionMode, selected, onDelete }) {
  const { theme: appTheme } = useTheme();
  const cardStyles = useCardStyles(appTheme);

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
            color={selected ? appTheme.primary : appTheme.white}
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
          <View style={[cardStyles.thumbnail, { backgroundColor: appTheme.surface }]} />
        )}

        {/* Play icon overlay */}
        {!selectionMode && (
          <View style={cardStyles.playOverlay}>
            <Ionicons name="play" size={18} color={appTheme.white} />
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
          {item.tags?.length > 0 ? item.tags[0] : (item.category || 'Course')}
        </Text>

        {/* Title */}
        <Text style={cardStyles.title} numberOfLines={2}>
          {item.show_title || item.title}
        </Text>

        {/* EP.X / EP.TOTAL */}
        <Text style={cardStyles.epLine}>
          LEC.{item.episode_num} {'/'} LEC.{item.total_episodes || '?'}
        </Text>
      </View>

      {/* Delete button on top right of the card */}
      {!selectionMode && onDelete && (
        <TouchableOpacity style={cardStyles.deleteBtn} onPress={onDelete}>
          <Ionicons name="trash-outline" size={16} color={appTheme.white} />
        </TouchableOpacity>
      )}
    </Pressable>
  );
}

const useCardStyles = (appTheme) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: appTheme.surface,
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
    backgroundColor: appTheme.surface,
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
  accessBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: appTheme.primary,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    zIndex: 2,
  },
  accessBadgeText: {
    color: appTheme.white,
    fontSize: 10,
    fontWeight: '700',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  category: {
    fontSize: 11,
    fontWeight: '600',
    color: appTheme.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: appTheme.white,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  epLine: {
    fontSize: 12,
    color: appTheme.gray,
    fontWeight: '500',
  },
});

// ─────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────
function EmptyState({ icon, title, subtitle }) {
  const { theme: appTheme } = useTheme();
  const emptyStyles = useEmptyStyles(appTheme);
  return (
    <View style={emptyStyles.container}>
      <Ionicons name={icon} size={64} color={appTheme.gray} style={{ opacity: 0.5 }} />
      <Text style={emptyStyles.title}>{title}</Text>
      <Text style={emptyStyles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const useEmptyStyles = (appTheme) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  title: {
    color: appTheme.white,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    color: appTheme.gray,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
});

function GuestScreen() {
  return (
    <GuestAccessPrompt
      title="Sign in to use My Learning"
      subtitle="Bookmark courses and track your study progress across devices."
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
  const { theme: appTheme } = useTheme();
  const styles = useStyles(appTheme);

  const accessToken = useSelector((state) => state.auth?.accessToken);
  const myCourses = useSelector(selectMyCourses);
  const bookmarks = useSelector(selectBookmarks);
  const watchHistory = useSelector(selectWatchHistory);
  const myCoursesLoading = useSelector(selectMyCoursesLoading);
  const bookmarksLoading = useSelector(selectBookmarksLoading);
  const watchHistoryLoading = useSelector(selectWatchHistoryLoading);
  const myCoursesLoaded = useSelector(selectMyCoursesLoaded);
  const bookmarksLoaded = useSelector(selectBookmarksLoaded);
  const watchHistoryLoaded = useSelector(selectWatchHistoryLoaded);

  const [activeTab, setActiveTab] = useState(route.params?.initialTab || TAB_MY_COURSES);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [downloads, setDownloads] = useState([]);

  // Drama Details Sheet State for My Courses
  const [selectedShow, setSelectedShow] = useState(null);
  const [showDetails, setShowDetails] = useState(null);
  const [showDetailsLoading, setShowDetailsLoading] = useState(false);
  const [showDetailsError, setShowDetailsError] = useState(null);
  const [showSheetVisible, setShowSheetVisible] = useState(false);
  const [dramaSheetKey, setDramaSheetKey] = useState(0);
  const [sheetInitialTab, setSheetInitialTab] = useState('synopsis');
  const [reopenSheetOnReturn, setReopenSheetOnReturn] = useState(false);

  // Fetch data on mount if authenticated
  useEffect(() => {
    if (!accessToken) return;
    if (!myCoursesLoaded) dispatch(fetchMyCourses());
    if (!bookmarksLoaded) dispatch(fetchBookmarks());
    if (!watchHistoryLoaded) dispatch(fetchWatchHistory());
  }, [accessToken, myCoursesLoaded, bookmarksLoaded, watchHistoryLoaded, dispatch]);

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  // Refetch data when screen comes into focus and reopen course sheet if returning from player
  useFocusEffect(
    useCallback(() => {
      if (!accessToken) return;
      dispatch(fetchMyCourses());
      dispatch(fetchBookmarks());
      dispatch(fetchWatchHistory());
      getDownloadedEpisodes().then(setDownloads);

      if (reopenSheetOnReturn && selectedShow) {
        setReopenSheetOnReturn(false);
        setDramaSheetKey((k) => k + 1);
        setShowSheetVisible(true);
        fetchShowDetails(selectedShow.show_id || selectedShow.id);
      }
    }, [accessToken, dispatch, reopenSheetOnReturn, selectedShow, fetchShowDetails])
  );

  // ── Show Sheet Handlers for My Courses ──
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

  const openCourseSheet = useCallback((course) => {
    setDramaSheetKey((k) => k + 1);
    const selectedItem = {
      ...course,
      show_id: course.show_id,
      show_title: course.show_title,
      total_episodes: course.total_episodes || 0,
      episode_num: course.latest_watched_episode_num || 1,
    };
    setSelectedShow(selectedItem);
    setShowDetails(null);
    setSheetInitialTab('synopsis');
    setShowSheetVisible(true);
    fetchShowDetails(course.show_id, 1);
  }, [fetchShowDetails]);

  const handleRangeChange = useCallback((fromEp) => {
    if (!selectedShow?.show_id) return;
    fetchShowDetails(selectedShow.show_id, fromEp);
  }, [selectedShow, fetchShowDetails]);

  const handleEpisodePress = useCallback((episode) => {
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
        streamBase: API_BASE_URL,
        startProgressSec,
      })
    );

    dispatch(
      fetchShowPlayerPage({
        showId: showDetails.show_id,
        fromEp: Math.max(1, Math.floor(((episode?.episode_num || 1) - 1) / 30) * 30 + 1),
        limit: 30,
      })
    );

    setSheetInitialTab('episodes');
    setReopenSheetOnReturn(true);
    setShowSheetVisible(false);
    navigation.navigate(ROUTES.SHOW_PLAYER, { fromMyList: true });
  }, [dispatch, navigation, selectedShow, showDetails]);

  const handleStartWatching = useCallback((startEpNum) => {
    if (!selectedShow || !showDetails) return;

    const targetEpNum = startEpNum || 1;
    const targetEp = (showDetails.episodes || []).find((e) => e.episode_num === targetEpNum);
    const startProgressSec = targetEp?.is_completed ? 0 : (targetEp?.progress_sec || 0);

    dispatch(
      initShowPlayer({
        showId: showDetails.show_id,
        showTitle: showDetails.show_title || selectedShow.show_title,
        thumbnailUrl: showDetails.thumbnail_url || selectedShow.thumbnail_url,
        totalEpisodes: showDetails.total_episodes || selectedShow.total_episodes || 0,
        seedEpisodes: showDetails.episodes || [],
        startEpisodeNum: targetEpNum,
        streamBase: API_BASE_URL,
        startProgressSec,
      })
    );

    dispatch(
      fetchShowPlayerPage({
        showId: showDetails.show_id,
        fromEp: Math.max(1, Math.floor((targetEpNum - 1) / 30) * 30 + 1),
        limit: 30,
      })
    );

    setSheetInitialTab('synopsis');
    setReopenSheetOnReturn(true);
    setShowSheetVisible(false);
    navigation.navigate(ROUTES.SHOW_PLAYER, { fromMyList: true });
  }, [dispatch, navigation, selectedShow, showDetails]);

  // ── Navigate to player from Saved/Continue ──
  const handleCardPress = useCallback((entry) => {
    dispatch(
      initShowPlayer({
        showId: entry.show_id,
        showTitle: entry.show_title,
        thumbnailUrl: entry.thumbnail_url,
        totalEpisodes: entry.total_episodes || 1,
        seedEpisodes: [
          {
            episode_id: entry.episode_id,
            episode_num: entry.episode_num,
            hls_url: null,
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
    let id;
    if (activeTab === TAB_SAVED) id = entry.bookmark_id;
    else if (activeTab === TAB_CONTINUE) id = entry.history_id;
    else if (activeTab === TAB_DOWNLOADS) id = entry.episodeId;

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
    if (activeTab === TAB_MY_COURSES) return;
    if (!selectionMode) {
      setSelectionMode(true);
      let id;
      if (activeTab === TAB_SAVED) id = entry.bookmark_id;
      else if (activeTab === TAB_CONTINUE) id = entry.history_id;
      else if (activeTab === TAB_DOWNLOADS) id = entry.episodeId;
      setSelectedItems(new Set([id]));
    }
  }, [selectionMode, activeTab]);

  const cancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedItems(new Set());
  }, []);

  const confirmDeleteSelected = useCallback(async () => {
    if (deleteTarget) {
      const { item, tab } = deleteTarget;
      if (tab === TAB_SAVED) {
        dispatch(toggleBookmark({
          showId: item.show_id,
          episodeId: item.episode_id,
          progressSec: item.progress_sec || 0,
        }));
      } else if (tab === TAB_CONTINUE) {
        dispatch(deleteWatchHistory({ historyId: item.history_id }));
      } else if (tab === TAB_DOWNLOADS) {
        await removeDownload(item.episodeId);
        const updatedDownloads = await getDownloadedEpisodes();
        setDownloads(updatedDownloads);
      }
    } else {
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
      } else if (activeTab === TAB_CONTINUE) {
        selectedItems.forEach(id => {
          dispatch(deleteWatchHistory({ historyId: id }));
        });
      } else if (activeTab === TAB_DOWNLOADS) {
        for (const id of selectedItems) {
          await removeDownload(id);
        }
        const updatedDownloads = await getDownloadedEpisodes();
        setDownloads(updatedDownloads);
      }
      cancelSelection();
    }
    setDeleteModalVisible(false);
    setDeleteTarget(null);
  }, [deleteTarget, selectedItems, activeTab, bookmarks, dispatch, cancelSelection]);

  const handleDeleteDirect = useCallback((item, tab) => {
    setDeleteTarget({ item, tab });
    setDeleteModalVisible(true);
  }, []);

  const getDisplayEntry = useCallback((bookmark) => {
    const watchEntry = watchHistory.find(w => w.show_id === bookmark.show_id);

    if (watchEntry) {
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

    return bookmark;
  }, [watchHistory]);

  const isBulk = deleteTarget === null;
  const modalTitle = isBulk ? "Delete Selected" : "Remove Item";
  const modalText = isBulk
    ? "Are you sure you want to delete the selected videos from your list?"
    : "Are you sure you want to remove this video from your list?";

  const totalCount = myCourses.length + bookmarks.length + watchHistory.length + downloads.length;

  if (!accessToken) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: appTheme.screenBg }]}>
        <GuestScreen />
      </View>
    );
  }

  const isLoading = (myCoursesLoading && !myCoursesLoaded) ||
    (bookmarksLoading && !bookmarksLoaded) ||
    (watchHistoryLoading && !watchHistoryLoaded);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 70, backgroundColor: appTheme.screenBg }]}>
      {/* ── Header ── */}
      {selectionMode ? (
        <View style={styles.selectionHeader}>
          <TouchableOpacity onPress={cancelSelection} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.selectionTitle}>{selectedItems.size} Selected</Text>
          <TouchableOpacity onPress={() => { setDeleteTarget(null); setDeleteModalVisible(true); }} style={styles.deleteActionBtn}>
            <Text style={styles.deleteActionText}>Delete</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>My Learning</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{totalCount} Items</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>Your enrolled courses and learning progress</Text>
        </>
      )}

      {/* ── Tab bar ── */}
      <View style={styles.tabBarScrollWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarContainer}
        >
          <TouchableOpacity
            style={[styles.tab, activeTab === TAB_MY_COURSES && styles.tabActive]}
            onPress={() => {
              setActiveTab(TAB_MY_COURSES);
              cancelSelection();
            }}
          >
            <Text style={[styles.tabText, activeTab === TAB_MY_COURSES && styles.tabTextActive]}>My Courses</Text>
            <Text style={[styles.tabText, activeTab === TAB_MY_COURSES && styles.tabTextActive, { marginTop: 2, fontSize: 11 }]}>
              ({myCourses.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === TAB_SAVED && styles.tabActive]}
            onPress={() => {
              setActiveTab(TAB_SAVED);
              cancelSelection();
            }}
          >
            <Text style={[styles.tabText, activeTab === TAB_SAVED && styles.tabTextActive]}>Saved</Text>
            <Text style={[styles.tabText, activeTab === TAB_SAVED && styles.tabTextActive, { marginTop: 2, fontSize: 11 }]}>
              ({bookmarks.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === TAB_CONTINUE && styles.tabActive]}
            onPress={() => {
              setActiveTab(TAB_CONTINUE);
              cancelSelection();
            }}
          >
            <Text style={[styles.tabText, activeTab === TAB_CONTINUE && styles.tabTextActive]}>Continue Learning</Text>
            <Text style={[styles.tabText, activeTab === TAB_CONTINUE && styles.tabTextActive, { marginTop: 2, fontSize: 11 }]}>
              ({watchHistory.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === TAB_DOWNLOADS && styles.tabActive]}
            onPress={() => {
              setActiveTab(TAB_DOWNLOADS);
              cancelSelection();
            }}
          >
            <Text style={[styles.tabText, activeTab === TAB_DOWNLOADS && styles.tabTextActive]}>Downloads</Text>
            <Text style={[styles.tabText, activeTab === TAB_DOWNLOADS && styles.tabTextActive, { marginTop: 2, fontSize: 11 }]}>
              ({downloads.length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ── Content ── */}
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={appTheme.primary} />
        </View>
      ) : activeTab === TAB_MY_COURSES ? (
        // ── My Courses tab ─────────────────────────────────────
        myCourses.length === 0 ? (
          <EmptyState
            icon="school-outline"
            title="No enrolled courses yet"
            subtitle="Explore available courses or purchase a membership to start learning"
          />
        ) : (
          <FlatList
            data={myCourses}
            keyExtractor={(item) => item.show_id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <CourseCard
                item={item}
                onPress={() => openCourseSheet(item)}
              />
            )}
          />
        )
      ) : activeTab === TAB_SAVED ? (
        // ── Saved / Bookmarks tab ──────────────────────────────
        bookmarks.length === 0 ? (
          <EmptyState
            icon="bookmark-outline"
            title="No saved courses yet"
            subtitle="Tap the bookmark icon while learning to save a course"
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
                  onDelete={() => handleDeleteDirect(item, TAB_SAVED)}
                  onPress={() => handleCardPressAction({
                    show_id: displayEntry.show_id,
                    show_title: displayEntry.show_title,
                    thumbnail_url: displayEntry.thumbnail_url,
                    episode_id: displayEntry.episode_id,
                    episode_num: displayEntry.episode_num,
                    duration_sec: displayEntry.duration_sec,
                    progress_sec: displayEntry.progress_sec,
                    total_episodes: displayEntry.total_episodes || null,
                    bookmark_id: item.bookmark_id,
                  })}
                  onLongPress={() => handleCardLongPress(item)}
                />
              );
            }}
          />
        )
      ) : activeTab === TAB_CONTINUE ? (
        // ── Continue Learning tab ──────────────────────────────
        watchHistory.length === 0 ? (
          <EmptyState
            icon="play-circle-outline"
            title="No watch progress"
            subtitle="Start watching courses to track your progress here"
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
                selectionMode={selectionMode}
                selected={selectedItems.has(item.history_id)}
                onDelete={() => handleDeleteDirect(item, TAB_CONTINUE)}
                onPress={() => handleCardPressAction(item)}
                onLongPress={() => handleCardLongPress(item)}
              />
            )}
          />
        )
      ) : (
        // ── Downloads tab ──────────────────────────────────────
        downloads.length === 0 ? (
          <EmptyState
            icon="download-outline"
            title="No downloaded videos"
            subtitle="Download episodes to watch offline anytime"
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
                  show_id: item.showId || item.episodeId,
                  show_title: item.showName || item.show_title || item.showTitle || item.title || 'Downloaded Video',
                  thumbnail_url: item.localImagePath || item.thumbnailUrl || item.thumbnail_url || null,
                  category: 'Offline',
                  episode_id: item.episodeId,
                  episode_num: item.episodeNum || 1,
                  duration_sec: item.duration || item.durationSec || 0,
                  progress_sec: item.progressSec || 0,
                  total_episodes: item.totalEpisodes || 1,
                  localVideoPath: item.localVideoPath,
                }}
                selectionMode={selectionMode}
                selected={selectedItems.has(item.episodeId)}
                onDelete={() => handleDeleteDirect(item, TAB_DOWNLOADS)}
                onPress={() => handleCardPressAction(item)}
                onLongPress={() => handleCardLongPress(item)}
              />
            )}
          />
        )
      )}

      {/* Course Detail Sheet overlay for My Courses */}
      <DramaDetailsSheetConnected
        key={`drama-${dramaSheetKey}-${selectedShow?.show_id ?? 'none'}`}
        visible={showSheetVisible}
        item={selectedShow}
        details={selectedShow?.show_id === showDetails?.show_id ? showDetails : null}
        loading={showDetailsLoading}
        error={showDetailsError}
        initialTab={sheetInitialTab}
        onRangeChange={handleRangeChange}
        onEpisodePress={handleEpisodePress}
        onStartWatching={handleStartWatching}
        onClose={() => {
          setShowSheetVisible(false);
          setSelectedShow(null);
          dispatch(fetchMyCourses());
        }}
      />

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <Text style={styles.modalText}>{modalText}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setDeleteTarget(null);
                }}
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

const useStyles = (appTheme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appTheme.deepBlack,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: appTheme.white,
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
    color: appTheme.gray,
    fontSize: 12,
  },
  subtitle: {
    color: appTheme.gray,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  // Tab bar
  tabBarScrollWrap: {
    marginBottom: 20,
  },
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: appTheme.surface,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    minWidth: 150,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: appTheme.primary,
  },
  tabText: {
    color: appTheme.gray,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabTextActive: {
    color: appTheme.white,
  },
  list: {
    paddingBottom: 100,
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
    color: appTheme.white,
    fontSize: 18,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  cancelBtnText: {
    color: appTheme.gray,
    fontSize: 15,
  },
  deleteActionBtn: {
    backgroundColor: 'rgba(255,59,48,0.15)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  deleteActionText: {
    color: appTheme.danger || '#FF3B30',
    fontSize: 15,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: appTheme.surface,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    color: appTheme.white,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalText: {
    color: appTheme.gray,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalBtnCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 10,
  },
  modalBtnCancelText: {
    color: appTheme.gray,
    fontSize: 14,
    fontWeight: '600',
  },
  modalBtnDelete: {
    backgroundColor: appTheme.danger || '#FF3B30',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  modalBtnDeleteText: {
    color: appTheme.white,
    fontSize: 14,
    fontWeight: '600',
  },
});