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
import { useIsFocused, useNavigation, useFocusEffect } from '@react-navigation/native';
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
  clearForYouDramaSheetSession,
  fetchForYouFeed,
  fetchShowEpisodes,
  selectForYouHasMore,
  selectForYouItems,
  selectForYouLoading,
  selectForYouOffset,
  selectForYouDramaSheetSession,
  selectForYouReopenSheetAfterPlayer,
  selectShowMode,
  selectShowModeError,
  selectShowModeLoading,
  setForYouDramaSheetSession,
  setForYouReopenSheetAfterPlayer,
} from '../redux/slices/reelsSlice';
import {
  initShowPlayer,
} from '../redux/slices/showPlayerSlice';
import { upsertWatchHistory } from '../redux/slices/myListSlice';

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
  const sheetSession = useSelector(selectForYouDramaSheetSession);
  const reopenAfterPlayer = useSelector(selectForYouReopenSheetAfterPlayer);
  const isFocused = useIsFocused();
  const accessToken = useSelector((state) => state.auth?.accessToken);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedDrama, setSelectedDrama] = useState(null);
  const [sheetInitialTab, setSheetInitialTab] = useState('synopsis');
  const [dramaSheetKey, setDramaSheetKey] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(SCREEN_HEIGHT);

  const onScreenLayout = useCallback((e) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setViewportHeight(h);
  }, []);

  useEffect(() => {
    dispatch(fetchForYouFeed({ offset: 0, refresh: true }));
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      if (!reopenAfterPlayer || !sheetSession?.item) return;
      dispatch(setForYouReopenSheetAfterPlayer(false));
      const { item, initialTab } = sheetSession;
      setDramaSheetKey((k) => k + 1);
      setSelectedDrama(item);
      setSheetInitialTab(initialTab || 'synopsis');
      setSheetVisible(true);
      const sid = item.show_id;
      if (!showMode || showMode.show_id !== sid) {
        dispatch(
          fetchShowEpisodes({
            showId: sid,
            fromEp: 1,
            limit: DETAILS_PAGE_SIZE,
          })
        );
      }
    }, [dispatch, reopenAfterPlayer, sheetSession, showMode])
  );

  const onMomentumScrollEnd = useCallback((e) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.y / viewportHeight);
    setCurrentIndex(newIndex);

    if (hasMore && newIndex >= items.length - DEFAULT_PREFETCH_THRESHOLD) {
      dispatch(fetchForYouFeed({ offset }));
    }
  }, [dispatch, hasMore, items.length, offset, viewportHeight]);

  const openDramaDetails = useCallback((item, initialTab = 'synopsis') => {
    setDramaSheetKey((k) => k + 1);
    setSelectedDrama(item);
    setSheetInitialTab(initialTab);
    setSheetVisible(true);
    dispatch(setForYouDramaSheetSession({ item, initialTab }));
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
    dispatch(setForYouReopenSheetAfterPlayer(false));
    dispatch(clearForYouDramaSheetSession());
    setSheetVisible(false);
    setSelectedDrama(null);
    dispatch(clearShowMode());
  }, [dispatch]);

  const handleEpisodePress = useCallback((episode) => {
    if (!selectedDrama || !showMode) return;
    if (episode.status !== 'ready' && !episode.is_locked) return;

    setSheetVisible(false);
    dispatch(
      setForYouDramaSheetSession({
        item: selectedDrama,
        initialTab: sheetInitialTab,
      })
    );

    if (accessToken) {
      dispatch(upsertWatchHistory({
        episodeId: episode.episode_id,
        progressSec: 0,
        showId: showMode.show_id,
        showTitle: showMode.show_title,
        thumbnailUrl: showMode.thumbnail_url,
        category: showMode.category || null,
        episodeNum: episode.episode_num,
        durationSec: episode.duration_sec || 0,
      }));
    }

    dispatch(
      initShowPlayer({
        showId: showMode.show_id,
        showTitle: showMode.show_title,
        thumbnailUrl: showMode.thumbnail_url,
        totalEpisodes: showMode.total_episodes,
        seedEpisodes: showMode.episodes || [],
        startEpisodeNum: episode.episode_num,
        streamBase: API_BASE_URL,
      })
    );

    navigation.navigate(ROUTES.SHOW_PLAYER, { fromForYou: true });
  }, [dispatch, navigation, selectedDrama, showMode, accessToken, sheetInitialTab]);

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
    <View style={styles.screen} onLayout={onScreenLayout}>
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
            itemHeight={viewportHeight}
            showPlaybackSpeedControl
            showOttOverlayControls
          />
        )}
        pagingEnabled
        snapToInterval={viewportHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        removeClippedSubviews
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        getItemLayout={(_, index) => ({
          length: viewportHeight,
          offset: viewportHeight * index,
          index,
        })}
        onRefresh={handleRefresh}
        refreshing={loading}
      />

      <DramaDetailsSheetConnected
        key={`for-you-drama-${dramaSheetKey}-${selectedDrama?.show_id ?? 'none'}`}
        visible={isFocused && sheetVisible}
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