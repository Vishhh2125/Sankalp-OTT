import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';

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
} from '../redux/slices/showPlayerSlice';

const PLAYER_PAGE_SIZE = 30;

export default function ShowPlayerScreen({ navigation }) {
  const dispatch = useDispatch();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);

  const episodes = useSelector(selectShowPlayerEpisodes);
  const loading = useSelector(selectShowPlayerLoading);
  const hasMore = useSelector(selectShowPlayerHasMore);
  const loadedUpTo = useSelector(selectShowPlayerLoadedUpTo);
  const startIndex = useSelector(selectShowPlayerStartIndex);
  const showId = useSelector(selectShowPlayerShowId);

  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [initialScrollDone, setInitialScrollDone] = useState(false);

  // Scroll to starting episode once the list has rendered
  useEffect(() => {
    if (!initialScrollDone && episodes.length > 0 && startIndex > 0) {
      // Small delay to let FlatList finish first layout
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
      const newIndex = Math.round(e.nativeEvent.contentOffset.y / SCREEN_HEIGHT);
      setCurrentIndex(newIndex);

      // Prefetch next page when nearing the end
      if (hasMore && newIndex >= episodes.length - DEFAULT_PREFETCH_THRESHOLD) {
        if (!loading && showId) {
          dispatch(
            fetchShowPlayerPage({
              showId,
              fromEp: loadedUpTo + 1,
              limit: PLAYER_PAGE_SIZE,
            })
          );
        }
      }
    },
    [dispatch, hasMore, episodes.length, loading, loadedUpTo, showId]
  );

  const handleScrollToIndexFailed = useCallback((info) => {
    // Fallback: scroll to the nearest valid index
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

  if (episodes.length === 0) {
    return (
      <View style={styles.centered}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <ActivityIndicator size="large" color={shortVideoTheme.crimson} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Back button — floats above the video */}
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
            // No onOpenDetails / onWatchAll needed inside the player itself
            renderTopOverlay={() => null}
          />
        )}
        pagingEnabled
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        removeClippedSubviews
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        ListFooterComponent={
          loading ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color={shortVideoTheme.crimson} />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
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
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
});