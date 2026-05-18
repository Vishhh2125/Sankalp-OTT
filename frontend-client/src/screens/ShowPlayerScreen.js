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
  const dramaSheetSource = fromForYou ? 'forYou' : fromHome ? 'home' : null;
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);

  const [itemHeight, setItemHeight] = useState(SCREEN_HEIGHT);
  const onScreenLayout = useCallback((e) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setItemHeight(h);
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

  const onMomentumScrollEnd = useCallback(
    (e) => {
      const newIndex = Math.round(e.nativeEvent.contentOffset.y / itemHeight);
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
    [dispatch, hasMore, episodes, loading, loadedUpTo, showId, itemHeight, recordWatchHistory]
  );

  const handleScrollToIndexFailed = useCallback((info) => {
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: Math.min(info.index, episodes.length - 1),
        animated: false,
      });
    }, 200);
  }, [episodes.length]);

  const handleClose = useCallback(() => {
    dispatch(clearShowPlayer());
    navigation.goBack();
  }, [dispatch, navigation]);

  const returnToDramaSheet = useCallback(
    (reelItem, initialTab) => {
      if (dramaSheetSource === 'forYou') {
        dispatch(setForYouDramaSheetSession({ item: reelItem, initialTab }));
      } else if (dramaSheetSource === 'home') {
        dispatch(
          setHomeDramaSheetSession({
            selectedItem: reelItemToHomeSelected(reelItem),
            initialTab,
          })
        );
      }
      dispatch(clearShowPlayer());
      navigation.goBack();
    },
    [dispatch, navigation, dramaSheetSource]
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

      <Pressable
        style={[styles.backButton, { top: insets.top + 10 }]}
        onPress={handleClose}
        hitSlop={14}
      >
        <Ionicons name="chevron-back" size={28} color="#fff" />
      </Pressable>

      <FlatList
        ref={flatListRef}
        data={episodes}
        keyExtractor={(item) => item.episode_id}
        renderItem={({ item, index }) => (
          <ShortVideoReelItem
            item={item}
            isActive={index === currentIndex && isFocused}
            isFocused={isFocused}
            streamBase=""
            itemHeight={itemHeight}
            renderTopOverlay={() => null}
            onReturnToDramaSheet={dramaSheetSource ? returnToDramaSheet : undefined}
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
                ? (progressSec) => recordWatchHistory(item, progressSec)
                : null
            }
            showPlaybackSpeedControl
            showOttOverlayControls
          />
        )}
        pagingEnabled
        snapToInterval={itemHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        removeClippedSubviews
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