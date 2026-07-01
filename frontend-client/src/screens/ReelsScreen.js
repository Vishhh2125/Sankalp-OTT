import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  FlatList,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Keyboard,
  Modal,
} from 'react-native';
import { Ionicons, FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused, useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';

import CoinIcon from '../components/CoinIcon';
import DramaDetailsSheetConnected from '../components/DramaDetailsSheetConnected';
import HomeHeroSlider from '../components/home/HomeHeroSlider';
import HomeShowSection from '../components/home/HomeShowSection';
import { fetchHeroBanners } from '../components/home/homePromoApi';
import { ROUTES } from '../constants/routes';
import { theme } from '../constants/theme';
import { clearPendingHomeBanner } from '../redux/slices/promoFlowSlice';
import { API_BASE_URL } from '../constants/config';
import { createAuthenticatedApi } from '../services/api';
import { initShowPlayer, fetchShowPlayerPage } from '../redux/slices/showPlayerSlice';
import {
  fetchBookmarks,
  fetchWatchHistory,
  selectBookmarks,
  selectWatchHistory,
} from '../redux/slices/myListSlice';
import {
  clearHomeDramaSheetSession,
  selectHomeDramaSheetSession,
  selectHomeReopenSheetAfterPlayer,
  setHomeDramaSheetSession,
  setHomeReopenSheetAfterPlayer,
} from '../redux/slices/reelsSlice';
import { useNetwork } from '../context/NetworkContext';

function selectPendingHomeBanner(state) {
  return state.promoFlow?.pendingHomeBanner;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - 32) / 3;
const TAG_GRID_GAP = 8;
const TAG_GRID_WIDTH = SCREEN_WIDTH - 32;
const TAG_GRID_ITEM_WIDTH = (TAG_GRID_WIDTH - TAG_GRID_GAP * 2) / 3;
const TAG_FILTER_ITEM_HEIGHT = 34;
const TAG_FILTER_ROW_GAP = 8;
const TAG_FILTER_VISIBLE_ROWS = 4;
const TAG_FILTER_MAX_HEIGHT =
  TAG_FILTER_ITEM_HEIGHT * TAG_FILTER_VISIBLE_ROWS + TAG_FILTER_ROW_GAP * TAG_FILTER_VISIBLE_ROWS;
const HOME_SECTION_PREVIEW_LIMIT = 10;
const feedApi = createAuthenticatedApi({
  baseURL: API_BASE_URL,
});

function formatViews(viewCount) {
  if (typeof viewCount !== 'number' || Number.isNaN(viewCount)) return '0';
  if (viewCount >= 1_000_000) return `${(viewCount / 1_000_000).toFixed(1)}M`;
  if (viewCount >= 1_000) return `${(viewCount / 1_000).toFixed(1)}K`;
  return String(viewCount);
}

function sameCategoryId(a, b) {
  return String(a ?? 'all') === String(b ?? 'all');
}

function showMatchesCategory(show, tab) {
  if (!tab?.id) return true;
  const categoryId = String(tab.id);
  return String(show.category_id) === categoryId
    || String(show.category?.id) === categoryId
    || show.category_name === tab.name
    || show.category === tab.name;
}

function ThumbnailProgressBar({ progressSec, durationSec }) {
  if (!durationSec || durationSec === 0) return null;
  const pct = Math.min((progressSec / durationSec) * 100, 100);
  if (pct <= 0) return null;

  return (
    <View style={styles.progressBarTrack}>
      <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
    </View>
  );
}

const DramaCard = ({ item, onPress }) => (
  <TouchableOpacity style={styles.cardContainer} onPress={onPress} activeOpacity={0.85}>
    <View style={styles.imageWrapper}>
      <Image
        style={styles.posterImage}
        source={{ uri: item.thumbnail_url }}
        resizeMode="cover"
      />
      {item.tag && (
        <View style={[styles.statusTag, { backgroundColor: item.tag === 'Hot' ? '#FF2D55' : '#7B2FFF' }]}>
          <Text style={styles.tagText}>{item.tag}</Text>
        </View>
      )}
      <View style={styles.viewCountContainer}>
        <Ionicons name="eye-outline" size={11} color="#fff" />
        <Text style={styles.viewCountText}>
          {formatViews(item.view_count || item.views)}
        </Text>
      </View>
      <ThumbnailProgressBar
        progressSec={item.progress_sec || 0}
        durationSec={item.duration_sec || 0}
      />
    </View>
    <Text style={styles.dramaTitle} numberOfLines={2}>{item.title}</Text>
    <Text style={styles.dramaTagsText} numberOfLines={1}>
      {item.tags?.length > 0 ? item.tags[0] : (item.category_name || item.category || '')}
    </Text>
  </TouchableOpacity>
);

export default function PopularScreen() {
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.auth?.accessToken);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { isOffline } = useNetwork();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [searchInputFocused, setSearchInputFocused] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [allTags, setAllTags] = useState([]);
  const [headerHeight, setHeaderHeight] = useState(0);
  const searchInputRef = useRef(null);
  const filterPanelOpenRef = useRef(false);
  const [selected, setSelected] = useState(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetInitialTab, setSheetInitialTab] = useState('synopsis');
  const [sheetHistory, setSheetHistory] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(null);
  const [showDetailsLoading, setShowDetailsLoading] = useState(false);
  const [showDetailsError, setShowDetailsError] = useState(null);
  const homeSession = useSelector(selectHomeDramaSheetSession);
  const reopenHomeSheet = useSelector(selectHomeReopenSheetAfterPlayer);
  const [dramaSheetKey, setDramaSheetKey] = useState(0);
  const pendingHomeBanner = useSelector(selectPendingHomeBanner);
  const bookmarks = useSelector(selectBookmarks);
  const watchHistory = useSelector(selectWatchHistory);
  const [heroBanners, setHeroBanners] = useState([]);
  const [expandedSection, setExpandedSection] = useState(null);
  const [expandedCategoryTab, setExpandedCategoryTab] = useState(null);

  const goToEarnRewards = () => {
    navigation.navigate(ROUTES.PROFILE, {
      screen: ROUTES.EARN_REWARDS,
      params: { backToHome: true },
    });
  };

  // 1. Load Categories
  useEffect(() => {
    let cancelled = false;
    async function loadCategories() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/content/categories`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];

        const activeCats = list
          .filter((c) => c && c.is_active !== false)
          .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
          .map((c) => ({ id: c.id, name: c.name }));

        if (!cancelled) {
          // Default view: show ALL dramas, then filter when a category is selected
          setTabs([{ id: null, name: 'All' }, ...activeCats]);
          setActiveTab(null);
        }
      } catch (e) {
        console.error("Category Load Error:", e);
        if (!cancelled) {
          setTabs([{ id: null, name: 'All' }]);
          setActiveTab(null);
        }
      }
    }
    loadCategories();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadTags() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/content/tags`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        if (!cancelled) {
          setAllTags(
            list
              .filter((tag) => tag?.name)
              .sort((a, b) => a.name.localeCompare(b.name))
          );
        }
      } catch (e) {
        console.error('Tags Load Error:', e);
        if (!cancelled) setAllTags([]);
      }
    }
    loadTags();
    return () => { cancelled = true; };
  }, []);

  const effectiveSearch = useMemo(() => {
    if (selectedTags.length > 0) return selectedTags.join(' ');
    return searchQuery.trim();
  }, [selectedTags, searchQuery]);

  const isSearchActive = Boolean(effectiveSearch);
  const allTrendingShows = useMemo(() => {
    return [...shows]
      .sort((a, b) => (b.view_count || b.views || 0) - (a.view_count || a.views || 0));
  }, [shows]);
  const trendingShowsPreview = useMemo(
    () => allTrendingShows.slice(0, HOME_SECTION_PREVIEW_LIMIT),
    [allTrendingShows]
  );
  const activeCategory = useMemo(
    () => tabs.find((tab) => sameCategoryId(tab.id, activeTab)) || tabs[0] || { id: null, name: 'All' },
    [tabs, activeTab]
  );
  const categoryShowsPreview = useMemo(
    () => shows
      .filter((show) => showMatchesCategory(show, activeCategory))
      .slice(0, HOME_SECTION_PREVIEW_LIMIT),
    [shows, activeCategory]
  );

  const expandedItems = useMemo(() => {
    if (!expandedSection) return [];
    if (expandedSection === 'all') {
      const selectedExpandedTab = tabs.find((tab) => sameCategoryId(tab.id, expandedCategoryTab))
        || { id: null, name: 'All' };
      return shows.filter((show) => showMatchesCategory(show, selectedExpandedTab));
    }
    if (expandedSection === 'trending') return allTrendingShows;
    if (expandedSection === 'continue') return watchHistory;
    if (expandedSection === 'saved') return bookmarks;
    return [];
  }, [expandedSection, shows, tabs, allTrendingShows, watchHistory, bookmarks, expandedCategoryTab]);

  useEffect(() => {
    filterPanelOpenRef.current = filterPanelOpen;
  }, [filterPanelOpen]);

  const showFilterButton = searchInputFocused
    || filterPanelOpen
    || selectedTags.length > 0
    || searchQuery.length > 0;

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSelectedTags([]);
    setSearchInputFocused(false);
    setFilterPanelOpen(false);
    searchInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const handleSearchTextChange = useCallback((text) => {
    setSearchQuery(text);
    if (text.trim()) setSelectedTags([]);
  }, []);

  const handleSearchFocus = useCallback(() => {
    setSearchInputFocused(true);
    setFilterPanelOpen(true);
  }, []);

  const handleSearchBlur = useCallback(() => {
    setTimeout(() => {
      if (!filterPanelOpenRef.current) {
        setSearchInputFocused(false);
      }
    }, 200);
  }, []);

  const handleFilterPress = useCallback(() => {
    Keyboard.dismiss();
    searchInputRef.current?.blur();
    setSearchInputFocused(false);
    setFilterPanelOpen((open) => !open);
  }, []);

  const closeFilterPanel = useCallback(() => {
    setFilterPanelOpen(false);
  }, []);

  const toggleTag = useCallback((tagName) => {
    setSelectedTags((prev) => (
      prev.includes(tagName)
        ? prev.filter((tag) => tag !== tagName)
        : [...prev, tagName]
    ));
    setSearchQuery('');
  }, []);

  const removeSelectedTag = useCallback((tagName) => {
    setSelectedTags((prev) => prev.filter((tag) => tag !== tagName));
  }, []);

  const buildMyListPreviewItems = useCallback((entries) => (
    entries.slice(0, HOME_SECTION_PREVIEW_LIMIT).map((entry) => {
      const showDetails = shows.find(s => s.id === entry.show_id || s.show_id === entry.show_id);
      return {
        id: entry.history_id || entry.bookmark_id,
        title: entry.show_title,
        thumbnail_url: entry.thumbnail_url,
        category: entry.category,
        tags: showDetails?.tags || entry.tags || [],
        progress_sec: entry.progress_sec,
        duration_sec: entry.duration_sec,
        view_count: 0,
        _entry: entry,
      };
    })
  ), [shows]);

  const loadShows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('status', 'Published');
      params.set('page', '1');
      params.set('limit', '60');
      if (effectiveSearch) params.set('search', effectiveSearch);

      const res = await fetch(`${API_BASE_URL}/api/content/shows?${params.toString()}`);
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      setShows(items.filter((s) => s.status === 'Published'));
    } catch (e) {
      setShows([]);
      console.error('Shows Load Error:', e);
    } finally {
      setLoading(false);
    }
  }, [effectiveSearch]);

  useEffect(() => {
    loadShows();
  }, [loadShows]);

  useFocusEffect(
    useCallback(() => {
      loadShows();
      fetchHeroBanners(10)
        .then(setHeroBanners)
        .catch(() => setHeroBanners([]));
      if (accessToken) {
        dispatch(fetchBookmarks());
        dispatch(fetchWatchHistory());
      }
    }, [loadShows, accessToken, dispatch])
  );

  // Re-open drama sheet after returning from ShowPlayer (back, gesture, title, episodes)
  useFocusEffect(
    useCallback(() => {
      if (!reopenHomeSheet || !homeSession?.selectedItem) return;
      dispatch(setHomeReopenSheetAfterPlayer(false));
      const { selectedItem, initialTab } = homeSession;
      setDramaSheetKey((k) => k + 1);
      setSelected(selectedItem);
      setSheetInitialTab(initialTab || 'synopsis');
      setSheetHistory([]);
      setSheetVisible(true);
      fetchShowDetails(selectedItem.show_id, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, reopenHomeSheet, homeSession])
  );

  const fetchShowDetails = async (showId, fromEp = 1) => {
    setShowDetailsLoading(true);
    setShowDetailsError(null);
    try {
      const res = await feedApi.get(`/api/feed/show/${showId}`, {
        params: { from_ep: fromEp, limit: 30 },
      });
      setShowDetails(res.data);
    } catch (e) {
      setShowDetails(null);
      setShowDetailsError(
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        'Failed to load episodes'
      );
    } finally {
      setShowDetailsLoading(false);
    }
  };

  const openDetails = useCallback(
    (item, initialTab = 'synopsis', options = {}) => {
      if (options.fromRelated && selected) {
        setSheetHistory((history) => [
          history[0] || { item: selected, initialTab: sheetInitialTab },
        ]);
      } else {
        setSheetHistory([]);
      }
      setDramaSheetKey((k) => k + 1);
      const showId = item.id ?? item.show_id;
      const selectedItem = {
        ...item,
        show_id: showId,
        show_title: item.title ?? item.show_title,
        title: item.title ?? item.show_title,
        episode_num: 1,
        total_episodes: item.episode_count || item.total_episodes || 0,
      };
      setSelected(selectedItem);
      setSheetInitialTab(initialTab);
      setSheetVisible(true);
      dispatch(setHomeDramaSheetSession({
        selectedItem,
        initialTab,
        returnToPlayer: homeSession?.returnToPlayer,
        playerSnapshot: homeSession?.playerSnapshot,
      }));
      fetchShowDetails(showId, 1);
    },
    [
      dispatch,
      homeSession?.playerSnapshot,
      homeSession?.returnToPlayer,
      selected,
      sheetInitialTab,
    ]
  );

  const handleRelatedPress = useCallback(
    (relatedItem) => {
      openDetails({
        id: relatedItem.id,
        title: relatedItem.title,
        thumbnail_url: relatedItem.thumbnail_url,
        category: relatedItem.category,
        category_name: relatedItem.category,
        view_count: relatedItem.view_count,
        tags: relatedItem.tags,
        episode_count: relatedItem.episode_count,
      }, 'synopsis', { fromRelated: true });
    },
    [openDetails]
  );

  useEffect(() => {
    if (!pendingHomeBanner || !isFocused) return;
    openDetails({
      id: pendingHomeBanner.id,
      title: pendingHomeBanner.title,
      thumbnail_url: pendingHomeBanner.thumbnail_url,
      category_name: '',
      view_count: 0,
    });
    dispatch(clearPendingHomeBanner());
  }, [pendingHomeBanner, isFocused, openDetails, dispatch]);

  const handleRangeChange = (fromEp) => {
    if (!selected?.show_id) return;
    fetchShowDetails(selected.show_id, fromEp);
  };

  const handleEpisodePress = (episode) => {
    if (!selected || !showDetails) return;
    if (episode.status !== 'ready' && !episode.is_locked) return;

    dispatch(
      setHomeDramaSheetSession({
        selectedItem: selected,
        initialTab: sheetInitialTab,
      })
    );

    dispatch(
      initShowPlayer({
        showId: showDetails.show_id,
        showTitle: showDetails.show_title || selected.show_title,
        thumbnailUrl: showDetails.thumbnail_url || selected.thumbnail_url,
        totalEpisodes: showDetails.total_episodes || selected.total_episodes || 0,
        seedEpisodes: showDetails.episodes || [],
        startEpisodeNum: episode?.episode_num || 1,
        streamBase: API_BASE_URL,
      })
    );

    setSheetVisible(false);
    navigation.navigate(ROUTES.SHOW_PLAYER, { fromHome: true });
  };

  const handleStartWatching = useCallback(() => {
    if (!selected) return;
    const episodes = showDetails?.show_id === selected.show_id
      ? showDetails.episodes
      : null;
    const episode = episodes?.find((ep) => ep.status === 'ready' && !ep.is_locked)
      || episodes?.[0];
    if (episode && showDetails) {
      handleEpisodePress(episode);
      return;
    }
    dispatch(
      initShowPlayer({
        showId: selected.show_id,
        showTitle: selected.show_title || selected.title,
        thumbnailUrl: selected.thumbnail_url,
        totalEpisodes: selected.total_episodes || 0,
        seedEpisodes: [],
        startEpisodeNum: 1,
        streamBase: API_BASE_URL,
      })
    );
    setSheetVisible(false);
    navigation.navigate(ROUTES.SHOW_PLAYER, { fromHome: true });
  }, [selected, showDetails, dispatch, navigation]);

  const handleBannerPress = useCallback((banner) => {
    if (!banner?.show_id) return;
    openDetails({
      id: banner.show_id,
      title: banner.show_title || banner.title,
      thumbnail_url: banner.show_thumbnail_url || banner.image_url,
      synopsis: banner.show_synopsis,
    });
  }, [openDetails]);

  const openMyListEntry = useCallback((entry) => {
    dispatch(
      initShowPlayer({
        showId: entry.show_id,
        showTitle: entry.show_title,
        thumbnailUrl: entry.thumbnail_url,
        totalEpisodes: entry.total_episodes || 1,
        seedEpisodes: [{
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
        }],
        startEpisodeNum: entry.episode_num,
        streamBase: API_BASE_URL,
        startProgressSec: entry.progress_sec || 0,
      })
    );
    dispatch(
      fetchShowPlayerPage({
        showId: entry.show_id,
        fromEp: Math.max(1, Math.floor((entry.episode_num - 1) / 30) * 30 + 1),
        limit: 30,
      })
    );
    navigation.navigate(ROUTES.SHOW_PLAYER, { fromHome: true });
  }, [dispatch, navigation]);

  const openExpandedAll = useCallback(() => {
    setExpandedCategoryTab(activeTab);
    setExpandedSection('all');
  }, [activeTab]);

  const handleCloseSheet = () => {
    if (sheetHistory.length > 0) {
      const previous = sheetHistory[0];
      setSheetHistory([]);
      setDramaSheetKey((k) => k + 1);
      setSelected(previous.item);
      setSheetInitialTab(previous.initialTab || 'synopsis');
      dispatch(setHomeDramaSheetSession({
        selectedItem: previous.item,
        initialTab: previous.initialTab || 'synopsis',
        returnToPlayer: homeSession?.returnToPlayer,
        playerSnapshot: homeSession?.playerSnapshot,
      }));
      setShowDetails(null);
      setShowDetailsError(null);
      fetchShowDetails(previous.item.show_id, 1);
      return;
    }

    const returnToPlayer = homeSession?.returnToPlayer;
    const playerSnapshot = homeSession?.playerSnapshot;
    dispatch(setHomeReopenSheetAfterPlayer(false));
    setSheetVisible(false);
    setSelected(null);
    setSheetHistory([]);
    setShowDetails(null);
    setShowDetailsError(null);
    dispatch(clearHomeDramaSheetSession());

    if (returnToPlayer) {
      if (playerSnapshot) {
        dispatch(initShowPlayer(playerSnapshot));
      }
      navigation.navigate(ROUTES.SHOW_PLAYER, { fromHome: true });
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <View
        style={styles.header}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.searchColumn}>
          <View style={styles.searchRow}>
            <View style={[styles.searchBar, showFilterButton && styles.searchBarWithFilter]}>
              <Ionicons name="search" size={18} color="#666" style={styles.searchIcon} />
              {selectedTags.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.selectedFilterScrollContent}
                  style={styles.selectedFilterScroll}
                >
                  {selectedTags.map((tag) => (
                    <View key={tag} style={styles.selectedFilterChip}>
                      <Text style={styles.selectedFilterText} numberOfLines={1}>
                        {tag}
                      </Text>
                      <TouchableOpacity
                        onPress={() => removeSelectedTag(tag)}
                        hitSlop={8}
                        style={styles.selectedFilterRemove}
                      >
                        <Ionicons name="close" size={12} color={theme.gray} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder="Search dramas or tags..."
                  placeholderTextColor="#666"
                  value={searchQuery}
                  onChangeText={handleSearchTextChange}
                  onFocus={handleSearchFocus}
                  onBlur={handleSearchBlur}
                />
              )}
              {(selectedTags.length > 0 || searchQuery.length > 0) && (
                <TouchableOpacity onPress={clearSearch} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="#666" />
                </TouchableOpacity>
              )}
            </View>

            {showFilterButton && (
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  (filterPanelOpen || selectedTags.length > 0) && styles.filterButtonActive,
                ]}
                onPress={handleFilterPress}
                hitSlop={6}
              >
                <Ionicons
                  name="funnel-outline"
                  size={18}
                  color={selectedTags.length > 0 || filterPanelOpen ? theme.crimson : '#AAA'}
                />
                {selectedTags.length > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{selectedTags.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>

          {filterPanelOpen && (
            <View style={styles.tagFilterPanel}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                style={styles.tagFilterScroll}
              >
                <View style={styles.tagSearchWrap}>
                  {allTags.length === 0 ? (
                    <Text style={styles.tagSearchEmpty}>No tags available</Text>
                  ) : (
                    allTags.map((tag, index) => {
                      const isSelected = selectedTags.includes(tag.name);
                      const isThirdColumn = (index + 1) % 3 === 0;
                      return (
                        <TouchableOpacity
                          key={`${tag.id || tag.name || 'tag'}-${index}`}
                          style={[
                            styles.tagSearchItem,
                            isThirdColumn && styles.tagSearchItemLastInRow,
                            isSelected && styles.tagSearchItemActive,
                          ]}
                          onPress={() => toggleTag(tag.name)}
                        >
                          <Text
                            style={[
                              styles.tagSearchItemText,
                              isSelected && styles.tagSearchItemTextActive,
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.78}
                          >
                            {tag.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              </ScrollView>
            </View>
          )}
        </View>

        <View style={styles.headerIcons}>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate(ROUTES.PROFILE, {
                screen: ROUTES.MEMBERSHIP,
                params: { backToHome: true },
              })
            }
          >
            <FontAwesome6 name="crown" size={22} color="#FFD700" />
          </TouchableOpacity>
          <TouchableOpacity onPress={goToEarnRewards} hitSlop={8}>
            <Ionicons name="gift" size={24} color="#FFD700" />
          </TouchableOpacity>
        </View>
      </View>

      {filterPanelOpen && (
        <Pressable
          style={[styles.tagSearchBackdrop, { top: headerHeight }]}
          onPress={closeFilterPanel}
        >
          <Text style={styles.tapHintText}>
            Tap anywhere to apply filters
          </Text>
        </Pressable>
      )}

      {loading && shows.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <ActivityIndicator size="large" color={theme.crimson} />
        </View>
      ) : isOffline && shows.length === 0 && heroBanners.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <Ionicons name="cloud-offline-outline" size={48} color="#555" />
          <Text style={[styles.emptyText, { marginTop: 16, fontSize: 18, color: theme.white, fontWeight: 'bold' }]}>You are offline</Text>
          <Text style={{ color: theme.gray, marginTop: 8 }}>Check your internet connection and try again.</Text>
          <TouchableOpacity style={{ marginTop: 20, backgroundColor: theme.crimson, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }} onPress={loadShows}>
            <Text style={{ color: theme.white, fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : isSearchActive ? (
        <FlatList
          data={shows}
          renderItem={({ item }) => <DramaCard item={item} onPress={() => openDetails(item)} />}
          keyExtractor={(item, index) => `${item.id || item.show_id || 'show'}-${index}`}
          numColumns={3}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Ionicons name={isOffline ? "cloud-offline-outline" : "search-outline"} size={48} color="#555" />
              <Text style={styles.emptyText}>{isOffline ? 'You are offline' : 'No dramas found.'}</Text>
            </View>
          }
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.homeScrollContent}
        >
          <HomeHeroSlider banners={heroBanners} onBannerPress={handleBannerPress} />

          <HomeShowSection
            title="All"
            items={categoryShowsPreview}
            onItemPress={(item) => openDetails(item)}
            onExpand={openExpandedAll}
            categoryTabs={tabs}
            activeCategoryId={activeTab}
            onCategoryPress={(tab) => setActiveTab(tab.id)}
            emptyText="No dramas found."
          />

          <HomeShowSection
            title="Trending"
            items={trendingShowsPreview}
            onItemPress={(item) => openDetails(item)}
            onExpand={() => setExpandedSection('trending')}
          />

          {accessToken && watchHistory.length > 0 ? (
            <HomeShowSection
              title="Continue Watching"
              items={buildMyListPreviewItems(watchHistory)}
              onItemPress={(item) => openMyListEntry(item._entry)}
              onExpand={() => setExpandedSection('continue')}
            />
          ) : null}

          {accessToken && bookmarks.length > 0 ? (
            <HomeShowSection
              title="Saved"
              items={buildMyListPreviewItems(bookmarks)}
              onItemPress={(item) => openMyListEntry(item._entry)}
              onExpand={() => setExpandedSection('saved')}
            />
          ) : null}
        </ScrollView>
      )}

      <Modal
        visible={Boolean(expandedSection)}
        animationType="slide"
        onRequestClose={() => {
          setExpandedSection(null);
          setExpandedCategoryTab(null);
        }}
      >
        <View style={[styles.expandModal, { paddingTop: insets.top }]}>
          <View style={styles.expandHeader}>
            <Text style={styles.expandTitle}>
              {expandedSection === 'all' && 'All Dramas'}
              {expandedSection === 'trending' && 'Trending'}
              {expandedSection === 'continue' && 'Continue Watching'}
              {expandedSection === 'saved' && 'Saved'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setExpandedSection(null);
                setExpandedCategoryTab(null);
              }}
              hitSlop={10}
            >
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>

          {expandedSection === 'all' && tabs.length > 0 ? (
            <View style={styles.expandTabContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabScrollContent}
              >
                {tabs.map((tab) => (
                  <TouchableOpacity
                    key={`${tab.id ?? 'all'}-${tab.name}`}
                    onPress={() => setExpandedCategoryTab(tab.id)}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        sameCategoryId(expandedCategoryTab, tab.id) && styles.activeTabText,
                      ]}
                    >
                      {tab.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <FlatList
            data={expandedItems}
            keyExtractor={(item, index) => `${item.id || item.show_id || item.history_id || item.bookmark_id || 'expanded'}-${index}`}
            numColumns={3}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
            renderItem={({ item }) => {
              if (expandedSection === 'continue' || expandedSection === 'saved') {
                const entry = item._entry || item;
                return (
                  <DramaCard
                    item={{
                      id: entry.show_id,
                      title: entry.show_title,
                      thumbnail_url: entry.thumbnail_url,
                      category: entry.category,
                      tags: entry.tags || [],
                      progress_sec: entry.progress_sec,
                      duration_sec: entry.duration_sec,
                    }}
                    onPress={() => {
                      setExpandedSection(null);
                      openMyListEntry(entry);
                    }}
                  />
                );
              }
              return (
                <DramaCard
                  item={item}
                  onPress={() => {
                    setExpandedSection(null);
                    openDetails(item);
                  }}
                />
              );
            }}
          />
        </View>
      </Modal>

      <DramaDetailsSheetConnected
        key={`drama-${dramaSheetKey}-${selected?.show_id ?? 'none'}`}
        visible={isFocused && sheetVisible}
        item={selected}
        details={selected?.show_id === showDetails?.show_id ? showDetails : null}
        loading={showDetailsLoading}
        error={showDetailsError}
        initialTab={sheetInitialTab}
        onRangeChange={handleRangeChange}
        onEpisodePress={handleEpisodePress}
        onRelatedPress={handleRelatedPress}
        onStartWatching={handleStartWatching}
        onClose={handleCloseSheet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    zIndex: 110,
  },
  searchColumn: {
    flex: 1,
    zIndex: 111,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBar: {
    flex: 1,
    height: 40,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 8,
  },
  searchBarWithFilter: {
    flex: 1,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    height: 40,
    padding: 0,
  },
  selectedFilterScroll: {
    flex: 1,
  },
  selectedFilterScrollContent: {
    alignItems: 'center',
    gap: 6,
    paddingRight: 6,
  },
  selectedFilterChip: {
    maxWidth: 120,
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 9,
    paddingRight: 5,
    borderRadius: 6,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  selectedFilterText: {
    flexShrink: 1,
    color: theme.gray,
    fontSize: 12,
    fontWeight: '600',
  },
  selectedFilterRemove: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  filterButtonActive: {
    borderColor: theme.crimson,
    backgroundColor: 'rgba(255, 45, 85, 0.12)',
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.crimson,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: theme.white,
    fontSize: 10,
    fontWeight: '800',
  },
  tagFilterPanel: {
    paddingTop: 8,
    paddingBottom: 2,
    backgroundColor: 'transparent',
    width: TAG_GRID_WIDTH,
  },
  tagFilterScroll: {
    maxHeight: TAG_FILTER_MAX_HEIGHT,
  },
  tagSearchBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  
    backgroundColor: 'rgba(0,0,0,0.55)',
  
    zIndex: 100,
  
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagSearchWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: TAG_GRID_WIDTH,
  },
  tagSearchItem: {
    width: TAG_GRID_ITEM_WIDTH,
    height: TAG_FILTER_ITEM_HEIGHT,
    paddingHorizontal: 10,
    marginRight: TAG_GRID_GAP,
    marginBottom: TAG_FILTER_ROW_GAP,
    borderRadius: 8,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagSearchItemLastInRow: {
    marginRight: 0,
  },
  tagSearchItemActive: {
    backgroundColor: theme.surfaceLight,
    borderColor: '#5A0068',
  },
  tagSearchItemText: {
    color: theme.gray,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  tagSearchItemTextActive: {
    color: theme.white,
  },
  tagSearchEmpty: {
    color: theme.gray,
    fontSize: 13,
    paddingVertical: 8,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    height: 40,
    paddingTop: 2,
  },
  tabContainer: { paddingHorizontal: 16, paddingVertical: 15 },
  tabScrollContent: { flexDirection: 'row', gap: 20 },
  tabText: { color: '#999', fontSize: 16, fontWeight: '600' },
  activeTabText: { color: '#FFF', fontSize: 18, borderBottomWidth: 2, borderBottomColor: '#FFF' },
  listContent: { paddingHorizontal: 8, paddingBottom: 20 },
  columnWrapper: { justifyContent: 'flex-start', gap: 8, marginBottom: 15 },
  cardContainer: { width: COLUMN_WIDTH },
  imageWrapper: { width: '100%', aspectRatio: 0.7, borderRadius: 4, overflow: 'hidden', backgroundColor: '#1A1A1A', position: 'relative' },
  posterImage: { width: '100%', height: '100%' },
  statusTag: { position: 'absolute', top: 0, right: 0, paddingHorizontal: 6, paddingVertical: 2, borderBottomLeftRadius: 4 },
  tagText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  viewCountContainer: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  viewCountText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  progressBarTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.crimson,
    borderRadius: 2,
  },
  dramaTitle: { color: '#FFF', fontSize: 13, marginTop: 8, fontWeight: '500', lineHeight: 18 },
  dramaTagsText: { color: '#E0E0E0', fontSize: 11, marginTop: 4, fontWeight: '400' },
  categoryText: { color: '#666', fontSize: 11, marginTop: 4 },
  homeScrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
  expandModal: { flex: 1, backgroundColor: '#000' },
  expandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  expandTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  expandTabContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 50, fontSize: 16 },
  
  tapHintText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  
    overflow: 'hidden',
  },
});
