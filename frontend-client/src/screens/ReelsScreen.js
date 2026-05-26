import React, { useCallback, useEffect, useState } from 'react';
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
} from 'react-native';
import { Ionicons, FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused, useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';

import DramaDetailsSheetConnected from '../components/DramaDetailsSheetConnected';
import { ROUTES } from '../constants/routes';
import { clearPendingHomeBanner } from '../redux/slices/promoFlowSlice';
import { API_BASE_URL } from '../constants/config';
import { initShowPlayer } from '../redux/slices/showPlayerSlice';
import {
  clearHomeDramaSheetSession,
  selectHomeDramaSheetSession,
  selectHomeReopenSheetAfterPlayer,
  setHomeDramaSheetSession,
  setHomeReopenSheetAfterPlayer,
} from '../redux/slices/reelsSlice';

function selectPendingHomeBanner(state) {
  return state.promoFlow?.pendingHomeBanner;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - 32) / 3;

function formatViews(viewCount) {
  if (typeof viewCount !== 'number' || Number.isNaN(viewCount)) return '0';
  if (viewCount >= 1_000_000) return `${(viewCount / 1_000_000).toFixed(1)}M`;
  if (viewCount >= 1_000) return `${(viewCount / 1_000).toFixed(1)}K`;
  return String(viewCount);
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
        <Ionicons name="play" size={10} color="#fff" />
        <Text style={styles.viewCountText}>
          {formatViews(item.view_count || item.views)}
        </Text>
      </View>
    </View>
    <Text style={styles.dramaTitle} numberOfLines={2}>{item.title}</Text>
    <Text style={styles.categoryText}>{item.category_name || item.category}</Text>
  </TouchableOpacity>
);

export default function PopularScreen() {
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.auth?.accessToken);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetInitialTab, setSheetInitialTab] = useState('synopsis');
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

  const goToEarnRewards = () => {
    navigation.navigate(ROUTES.PROFILE, { screen: ROUTES.EARN_REWARDS });
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

  // 2. Load Shows based on Category/Search
  useEffect(() => {
    let cancelled = false;

    async function loadShows() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (activeTab) params.set('category_id', activeTab);
        params.set('page', '1');
        params.set('limit', '60');
        if (searchQuery.trim()) params.set('search', searchQuery.trim());

        const res = await fetch(`${API_BASE_URL}/api/content/shows?${params.toString()}`);
        const data = await res.json();
        
        if (!cancelled) {
          setShows(Array.isArray(data?.items) ? data.items : []);
        }
      } catch (e) {
        if (!cancelled) setShows([]);
        console.error("Shows Load Error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadShows();
    return () => { cancelled = true; };
  }, [activeTab, searchQuery]);

  // Re-open drama sheet after returning from ShowPlayer (back, gesture, title, episodes)
  useFocusEffect(
    useCallback(() => {
      if (!reopenHomeSheet || !homeSession?.selectedItem) return;
      dispatch(setHomeReopenSheetAfterPlayer(false));
      const { selectedItem, initialTab } = homeSession;
      setDramaSheetKey((k) => k + 1);
      setSelected(selectedItem);
      setSheetInitialTab(initialTab || 'synopsis');
      setSheetVisible(true);
      fetchShowDetails(selectedItem.show_id, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, reopenHomeSheet, homeSession])
  );

  const fetchShowDetails = async (showId, fromEp = 1) => {
    setShowDetailsLoading(true);
    setShowDetailsError(null);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const res = await fetch(`${API_BASE_URL}/api/feed/show/${showId}?from_ep=${fromEp}&limit=30`, {
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed to load episodes: ${res.status}`);
      setShowDetails(data);
    } catch (e) {
      setShowDetails(null);
      setShowDetailsError(e?.message || 'Failed to load episodes');
    } finally {
      setShowDetailsLoading(false);
    }
  };

  const openDetails = useCallback(
    (item, initialTab = 'synopsis') => {
      setDramaSheetKey((k) => k + 1);
      const showId = item.id ?? item.show_id;
      const selectedItem = {
        ...item,
        show_id: showId,
        show_title: item.title,
        episode_num: 1,
        total_episodes: item.episode_count || 0,
      };
      setSelected(selectedItem);
      setSheetInitialTab(initialTab);
      setSheetVisible(true);
      dispatch(setHomeDramaSheetSession({ selectedItem, initialTab }));
      fetchShowDetails(showId, 1);
    },
    [dispatch, accessToken]
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

  const handleCloseSheet = () => {
    dispatch(setHomeReopenSheetAfterPlayer(false));
    dispatch(clearHomeDramaSheetSession());
    setSheetVisible(false);
    setSelected(null);
    setShowDetails(null);
    setShowDetailsError(null);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#666" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search dramas..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => navigation.navigate(ROUTES.PROFILE, { screen: ROUTES.MEMBERSHIP })}>
            <FontAwesome6 name="crown" size={22} color="#FFD700" />
          </TouchableOpacity>
          <TouchableOpacity onPress={goToEarnRewards} hitSlop={8}>
            <Ionicons name="gift" size={24} color="#FFD700" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
          {tabs.map((tab) => (
            <TouchableOpacity key={tab.id ?? 'all'} onPress={() => setActiveTab(tab.id)}>
              <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
                {tab.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading && shows.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#FF2D55" />
        </View>
      ) : (
        <FlatList
          data={shows}
          renderItem={({ item }) => <DramaCard item={item} onPress={() => openDetails(item)} />}
          keyExtractor={item => item.id.toString()}
          numColumns={3}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No dramas found in this category.</Text>
          }
        />
      )}

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
        onClose={handleCloseSheet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  searchBar: { flex: 1, height: 40, backgroundColor: '#1A1A1A', borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  searchInput: { flex: 1, color: '#FFF', fontSize: 14, height: '100%', padding: 0 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 15 },
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
  viewCountContainer: { position: 'absolute', bottom: 5, right: 5, flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewCountText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  dramaTitle: { color: '#FFF', fontSize: 13, marginTop: 8, fontWeight: '500', lineHeight: 18 },
  categoryText: { color: '#666', fontSize: 11, marginTop: 4 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 50, fontSize: 16 },
});