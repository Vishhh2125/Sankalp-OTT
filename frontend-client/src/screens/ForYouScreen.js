import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';

import DramaDetailsSheetConnected from '../components/DramaDetailsSheetConnected';
import {
  DEFAULT_PREFETCH_THRESHOLD,
  SCREEN_HEIGHT,
  ShortVideoReelItem,
  shortVideoTheme,
} from '../components/shortVideoPlayer';
import { API_BASE_URL } from '../constants/config';
import { ROUTES } from '../constants/routes';
import {
  clearShowMode,
  fetchForYouFeed,
  fetchShowEpisodes,
  selectForYouHasMore,
  selectForYouItems,
  selectForYouLoading,
  selectForYouOffset,
  selectShowMode,
  selectShowModeError,
  selectShowModeLoading,
} from '../redux/slices/reelsSlice';
import {
  initShowPlayer,
} from '../redux/slices/showPlayerSlice';

const DETAILS_PAGE_SIZE = 30;

export default function ForYouScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const items = useSelector(selectForYouItems);
  const loading = useSelector(selectForYouLoading);
  const hasMore = useSelector(selectForYouHasMore);
  const offset = useSelector(selectForYouOffset);
  const showMode = useSelector(selectShowMode);
  const showModeLoading = useSelector(selectShowModeLoading);
  const showModeError = useSelector(selectShowModeError);
  const isFocused = useIsFocused();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedDrama, setSelectedDrama] = useState(null);
  const [sheetInitialTab, setSheetInitialTab] = useState('synopsis');

  useEffect(() => {
    dispatch(fetchForYouFeed({ offset: 0, refresh: true }));
  }, [dispatch]);

  const onMomentumScrollEnd = useCallback((e) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.y / SCREEN_HEIGHT);
    setCurrentIndex(newIndex);

    if (hasMore && newIndex >= items.length - DEFAULT_PREFETCH_THRESHOLD) {
      dispatch(fetchForYouFeed({ offset }));
    }
  }, [dispatch, hasMore, items.length, offset]);

  const openDramaDetails = useCallback((item, initialTab = 'synopsis') => {
    setSelectedDrama(item);
    setSheetInitialTab(initialTab);
    setSheetVisible(true);
    dispatch(clearShowMode());
    dispatch(fetchShowEpisodes({
      showId: item.show_id,
      fromEp: 1,
      limit: DETAILS_PAGE_SIZE,
    }));
  }, [dispatch]);

  const handleOpenSynopsis = useCallback((item) => {
    openDramaDetails(item, 'synopsis');
  }, [openDramaDetails]);

  const handleOpenEpisodes = useCallback((item) => {
    openDramaDetails(item, 'episodes');
  }, [openDramaDetails]);

  const handleRangeChange = useCallback((fromEp) => {
    if (!selectedDrama?.show_id) return;

    dispatch(fetchShowEpisodes({
      showId: selectedDrama.show_id,
      fromEp,
      limit: DETAILS_PAGE_SIZE,
    }));
  }, [dispatch, selectedDrama]);

  const handleCloseSheet = useCallback(() => {
    setSelectedDrama(null);
    dispatch(clearShowMode());
  }, [dispatch]);

  // Tapping an episode in the detail sheet opens the single-drama reel player
  const handleEpisodePress = useCallback((episode) => {
    if (!selectedDrama || !showMode) return;

    // Don't open the player for episodes that are still processing
    if (episode.status !== 'ready' && !episode.is_locked) return;

    dispatch(
      initShowPlayer({
        showId: showMode.show_id,
        showTitle: showMode.show_title,
        thumbnailUrl: showMode.thumbnail_url,
        totalEpisodes: showMode.total_episodes,
        // Seed the player with the episodes already loaded in the sheet
        seedEpisodes: showMode.episodes || [],
        startEpisodeNum: episode.episode_num,
        streamBase: API_BASE_URL,
      })
    );

    navigation.navigate(ROUTES.SHOW_PLAYER);
  }, [dispatch, navigation, selectedDrama, showMode]);

  const handleRefresh = useCallback(() => {
    dispatch(fetchForYouFeed({ offset: 0, refresh: true }));
  }, [dispatch]);

  if (loading && items.length === 0) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <ActivityIndicator size="large" color={shortVideoTheme.crimson} />
        <Text style={styles.loadingText}>Loading feed...</Text>
      </View>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Ionicons name="videocam-off-outline" size={48} color="#555" />
        <Text style={styles.emptyTitle}>No shows available</Text>
        <Text style={styles.emptySubtitle}>Check back soon for new content</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <FlatList
        data={items}
        keyExtractor={(item) => item.episode_id}
        renderItem={({ item, index }) => (
          <ShortVideoReelItem
            item={item}
            isActive={index === currentIndex}
            isFocused={isFocused}
            onOpenDetails={handleOpenSynopsis}
            onWatchAll={handleOpenEpisodes}
            streamBase={API_BASE_URL}
          />
        )}
        pagingEnabled
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        removeClippedSubviews
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        onRefresh={handleRefresh}
        refreshing={loading}
      />

      <DramaDetailsSheetConnected
        visible={sheetVisible}
        item={selectedDrama}
        details={selectedDrama?.show_id === showMode?.show_id ? showMode : null}
        loading={showModeLoading}
        error={showModeError}
        initialTab={sheetInitialTab}
        onRangeChange={handleRangeChange}
        onClose={handleCloseSheet}
        onEpisodePress={handleEpisodePress}
        streamBase={API_BASE_URL}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  loadingScreen: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#888', fontSize: 14, marginTop: 12 },
  emptyTitle: { color: '#aaa', fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { color: '#666', fontSize: 14, marginTop: 6 },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#FF2D55',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});