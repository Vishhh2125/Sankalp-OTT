import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';

import {
  setForYouDramaSheetSession,
  setForYouReopenSheetAfterPlayer,
  setHomeDramaSheetSession,
  setHomeReopenSheetAfterPlayer,
} from '../redux/slices/reelsSlice';

import {
  DEFAULT_PREFETCH_THRESHOLD,
  SCREEN_HEIGHT,
  ShortVideoReelItem,
  shortVideoTheme,
} from '../components/shortVideoPlayer';
import {
  clearShowPlayer,
  fetchShowPlayerPage,
  selectShowPlayerEpisodes,
  selectShowPlayerHasMore,
  selectShowPlayerLoading,
  selectShowPlayerLoadedUpTo,
  selectShowPlayerStartIndex,
  selectShowPlayerShowId,
  selectShowPlayerStartProgressSec,
} from '../redux/slices/showPlayerSlice';
import { upsertWatchHistory } from '../redux/slices/myListSlice';
import { ROUTES } from '../constants/routes';
import { useLandscapePlaybackContext } from '../context/LandscapePlaybackContext';

const PLAYER_PAGE_SIZE = 30;

function reelItemToHomeSelected(reelItem) {
  return {
    id: reelItem.show_id,
    show_id: reelItem.show_id,
    title: reelItem.show_title,
    show_title: reelItem.show_title,
    thumbnail_url: reelItem.thumbnail_url,
    category: reelItem.category,
    category_name: reelItem.category,
    episode_count: reelItem.total_episodes,
    total_episodes: reelItem.total_episodes,
    synopsis: reelItem.synopsis,
    tags: reelItem.tags,
    episode_num: reelItem.episode_num,
  };
}

export default function ShowPlayerScreen({ navigation }) {
  const dispatch = useDispatch();
  const route = useRoute();
  const isFocused = useIsFocused();
  const fromForYou = !!route.params?.fromForYou;
  const fromHome = !!route.params?.fromHome;
  const fromMyList = !!route.params?.fromMyList;
  const fromDeepLink = !!route.params?.fromDeepLink; // NEW — arrived via shared link
  const dramaSheetSource = fromForYou ? 'forYou' : fromHome ? 'home' : null;
  const detailsSheetSource = dramaSheetSource || (fromMyList ? 'home' : null);
  const { isLandscape } = useLandscapePlaybackContext();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);
  const pendingAutoAdvanceIndexRef = useRef(null);

  const [itemHeight, setItemHeight] = useState(SCREEN_HEIGHT);
  const onScreenLayout = useCallback((e) => {
    const { width, height } = e.nativeEvent.layout;
    // Only capture portrait height — keeps FlatList layout stable during landscape playback
    if (height > 0 && height >= width) setItemHeight(height);
  }, []);

  const episodes = useSelector(selectShowPlayerEpisodes);
  const loading = useSelector(selectShowPlayerLoading);
  const hasMore = useSelector(selectShowPlayerHasMore);
  const loadedUpTo = useSelector(selectShowPlayerLoadedUpTo);
  const startIndex = useSelector(selectShowPlayerStartIndex);
  const showId = useSelector(selectShowPlayerShowId);
  const startProgressSec = useSelector(selectShowPlayerStartProgressSec);
  const accessToken = useSelector((state) => state.auth?.accessToken);

  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const prevStartIndexRef = useRef(startIndex);
  const currentProgressSecRef = useRef(startProgressSec || 0);

  const resolveScrollIndex = useCallback((event, itemCount) => {
    if (!itemCount) return 0;

    const offsetY = event.nativeEvent.contentOffset?.y ?? 0;
    const layoutHeight = event.nativeEvent.layoutMeasurement?.height || itemHeight || 1;
    const contentHeight = event.nativeEvent.contentSize?.height || layoutHeight * itemCount;
    const lastIndex = itemCount - 1;

    if (offsetY + layoutHeight >= contentHeight - 2) {
      return lastIndex;
    }

    return Math.max(0, Math.min(Math.round(offsetY / layoutHeight), lastIndex));
  }, [itemHeight]);

  // Track whether we've already done the initial seek for the starting episode
  const hasSeenRef = useRef(false);

  // Helper to dispatch watch history
  const recordWatchHistory = useCallback((ep, progressSec) => {
    if (!accessToken || !ep) return;
    dispatch(upsertWatchHistory({
      episodeId: ep.episode_id,
      progressSec,
      showId: ep.show_id,
      showTitle: ep.show_title,
      thumbnailUrl: ep.thumbnail_url,
      category: ep.category || null,
      episodeNum: ep.episode_num,
      durationSec: ep.duration_sec,
    }));
  }, [accessToken, dispatch]);

  // Record watch history for starting episode on mount with saved progress
  useEffect(() => {
    if (episodes.length === 0) return;
    const ep = episodes[startIndex];
    recordWatchHistory(ep, startProgressSec || 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchedRangesRef = useRef(new Set());

  // Ensure episode streams are loaded (My List seeds hls_url: null until fetch completes)
  useEffect(() => {
    if (!showId || loading) return;

    const targetEp = episodes[startIndex]?.episode_num || episodes[0]?.episode_num || 1;
    const fromEp = Math.max(1, Math.floor((targetEp - 1) / PLAYER_PAGE_SIZE) * PLAYER_PAGE_SIZE + 1);

    if (fetchedRangesRef.current.has(fromEp)) {
      return;
    }

    const needsFetch = episodes.length === 0 || episodes.some((ep) => !ep.hls_url && ep.video_source !== 'YOUTUBE' && !ep.localVideoPath);
    if (!needsFetch) return;

    fetchedRangesRef.current.add(fromEp);
    dispatch(fetchShowPlayerPage({ showId, fromEp, limit: PLAYER_PAGE_SIZE }));
  }, [dispatch, episodes, loading, showId, startIndex]);

  // Scroll to starting episode
  useEffect(() => {
    // Check if startIndex changed (happens after Redux sorts episodes)
    const startIndexChanged = prevStartIndexRef.current !== startIndex && startIndex > 0;
    if (startIndexChanged) {
      prevStartIndexRef.current = startIndex;
      setInitialScrollDone(false); // Reset flag to allow scroll
    }

    if (!initialScrollDone && episodes.length > 0 && startIndex > 0) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: startIndex,
          animated: false,
        });
        setCurrentIndex(startIndex);
        setInitialScrollDone(true);
      }, 100);
      return () => clearTimeout(timer);
    } else if (!initialScrollDone) {
      setInitialScrollDone(true);
    }
  }, [episodes.length, startIndex, initialScrollDone]);

  useEffect(() => {
    if (!isLandscape || !episodes[currentIndex]) return undefined;

    const timer = setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: currentIndex,
        animated: false,
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [currentIndex, episodes, isLandscape]);

  const onMomentumScrollEnd = useCallback(
    (e) => {
      const newIndex = resolveScrollIndex(e, episodes.length);
      setCurrentIndex(newIndex);

      if (episodes[newIndex]) {
        recordWatchHistory(episodes[newIndex], 0);
      }

      if (hasMore && newIndex >= episodes.length - DEFAULT_PREFETCH_THRESHOLD) {
        if (!loading && showId) {
          dispatch(fetchShowPlayerPage({
            showId,
            fromEp: loadedUpTo + 1,
            limit: PLAYER_PAGE_SIZE,
          }));
        }
      }
    },
    [dispatch, hasMore, episodes, loading, loadedUpTo, recordWatchHistory, resolveScrollIndex, showId]
  );

  const handleScrollToIndexFailed = useCallback((info) => {
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: Math.min(info.index, episodes.length - 1),
        animated: false,
      });
    }, 200);
  }, [episodes.length]);

  const scrollToEpisodeIndex = useCallback((nextIndex, animated = true) => {
    if (!episodes[nextIndex]) return;
    setCurrentIndex(nextIndex);
    flatListRef.current?.scrollToIndex({
      index: nextIndex,
      animated,
    });
  }, [episodes]);

  const handlePlaybackEnd = useCallback((endedIndex) => {
    const nextIndex = endedIndex + 1;
    if (episodes[nextIndex]) {
      scrollToEpisodeIndex(nextIndex);
      return;
    }

    if (hasMore && showId) {
      pendingAutoAdvanceIndexRef.current = nextIndex;
      if (!loading) {
        dispatch(fetchShowPlayerPage({
          showId,
          fromEp: loadedUpTo + 1,
          limit: PLAYER_PAGE_SIZE,
        }));
      }
    }
  }, [
    dispatch,
    episodes,
    hasMore,
    loadedUpTo,
    loading,
    scrollToEpisodeIndex,
    showId,
  ]);

  useEffect(() => {
    const pendingIndex = pendingAutoAdvanceIndexRef.current;
    if (pendingIndex == null) return;

    if (episodes[pendingIndex]) {
      pendingAutoAdvanceIndexRef.current = null;
      scrollToEpisodeIndex(pendingIndex);
    } else if (!hasMore && !loading) {
      pendingAutoAdvanceIndexRef.current = null;
    }
  }, [episodes, hasMore, loading, scrollToEpisodeIndex]);

  const handleClose = useCallback(() => {
    dispatch(clearShowPlayer());
    if (fromDeepLink) {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: ROUTES.MAIN_TABS,
            params: { screen: ROUTES.HOME },
          },
        ],
      });
    } else {
      navigation.goBack();
    }
  }, [dispatch, navigation, fromDeepLink]);

  const returnToDramaSheet = useCallback(
    (reelItem, initialTab) => {
      const currentEpisode = episodes[currentIndex] || reelItem;
      const playerSnapshot = {
        showId,
        showTitle: currentEpisode?.show_title,
        thumbnailUrl: currentEpisode?.thumbnail_url,
        totalEpisodes: currentEpisode?.total_episodes || episodes.length,
        seedEpisodes: episodes,
        startEpisodeNum: currentEpisode?.episode_num || reelItem?.episode_num || 1,
        streamBase: '',
        startProgressSec: currentProgressSecRef.current || 0,
      };

      if (detailsSheetSource === 'forYou') {
        dispatch(
          setForYouDramaSheetSession({
            item: reelItem,
            initialTab,
            returnToPlayer: true,
            playerSnapshot,
          })
        );
      } else if (detailsSheetSource === 'home') {
        dispatch(
          setHomeDramaSheetSession({
            selectedItem: reelItemToHomeSelected(reelItem),
            initialTab,
            returnToPlayer: true,
            playerSnapshot,
          })
        );
      }

      if (fromMyList) {
        dispatch(setHomeReopenSheetAfterPlayer(true));
        navigation.navigate(ROUTES.MAIN_TABS, {
          screen: ROUTES.HOME,
        });
        return;
      }

      navigation.goBack();
    },
    [detailsSheetSource, dispatch, episodes, currentIndex, fromMyList, navigation, showId]
  );

  useEffect(() => {
    if (!dramaSheetSource) return undefined;
    const sub = navigation.addListener('beforeRemove', () => {
      if (dramaSheetSource === 'forYou') {
        dispatch(setForYouReopenSheetAfterPlayer(true));
      } else if (dramaSheetSource === 'home') {
        dispatch(setHomeReopenSheetAfterPlayer(true));
      }
    });
    return sub;
  }, [navigation, dramaSheetSource, dispatch]);

  if (episodes.length === 0) {
    return (
      <View style={styles.centered}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <ActivityIndicator size="large" color={shortVideoTheme.crimson} />
      </View>
    );
  }

  return (
    <View style={styles.screen} onLayout={onScreenLayout}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {!isLandscape ? (
      <Pressable
        style={[styles.backButton, { top: insets.top + 10 }]}
        onPress={handleClose}
        hitSlop={14}
      >
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </Pressable>
      ) : null}

      <FlatList
        ref={flatListRef}
        data={episodes}
        keyExtractor={(item) => item.episode_id}
        scrollEnabled={!isLandscape}
        renderItem={({ item, index }) => (
          (() => {
            const isFinalEpisode = !hasMore && index === episodes.length - 1;
            return (
          <ShortVideoReelItem
            item={item}
            isActive={index === currentIndex && isFocused}
            shouldPreload={Math.abs(index - currentIndex) === 1}
            isFocused={isFocused}
            streamBase=""
            itemHeight={itemHeight}
            renderTopOverlay={() => null}
            onReturnToDramaSheet={detailsSheetSource ? returnToDramaSheet : undefined}
            walletReturnParams={
              fromHome ? { fromHome: true } : fromForYou ? { fromForYou: true } : null
            }
            showEpisodeStrip={dramaSheetSource === 'forYou'}
            repeatPlayback={isFinalEpisode}
            autoAdvanceOnEnd={!isFinalEpisode}
            onPlaybackEnd={() => handlePlaybackEnd(index)}
            // Seek to saved progress on first render of the starting episode
            initialSeekSec={
              index === startIndex && !hasSeenRef.current
                ? startProgressSec || 0
                : 0
            }
            onFirstFrameReady={
              index === startIndex && !hasSeenRef.current
                ? () => { hasSeenRef.current = true; }
                : null
            }
            // Progress update for active episode only
            onProgressUpdate={
              index === currentIndex && accessToken
                ? (progressSec) => {
                    currentProgressSecRef.current = progressSec;
                    recordWatchHistory(item, progressSec);
                  }
                : null
            }
            showPlaybackSpeedControl
          />
            );
          })()
        )}
        pagingEnabled
        snapToInterval={itemHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        removeClippedSubviews={!isLandscape}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        getItemLayout={(_, index) => ({
          length: itemHeight,
          offset: itemHeight * index,
          index,
        })}
        ListFooterComponent={
          loading ? (
            <View style={[styles.footer, { height: itemHeight }]}>
              <ActivityIndicator size="small" color={shortVideoTheme.crimson} />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  centered: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 12,
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
