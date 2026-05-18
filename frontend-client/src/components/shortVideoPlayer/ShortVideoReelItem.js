import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import Video from 'react-native-video';

import ProgressBar from './ProgressBar';
import SideAction from './SideAction';
import { styles } from './styles';
import { shortVideoTheme } from './theme';
import useShortVideoPlayback from './useShortVideoPlayback';
import { formatCount } from './utils';
import { ROUTES } from '../../constants/routes';
import {
  toggleBookmark,
  fetchBookmarks,
  selectIsBookmarked,
  selectBookmarksLoaded,
} from '../../redux/slices/myListSlice';
import { unlockEpisode } from '../../redux/slices/showPlayerSlice';

function DefaultTopOverlay({ top, style }) {
  return (
    <TouchableOpacity style={[style, { top }]}>
      <Ionicons name="search" size={26} color="#fff" />
    </TouchableOpacity>
  );
}

export default function ShortVideoReelItem({
  item,
  isActive,
  isFocused,
  onWatchAll,
  onOpenDetails,
  renderTopOverlay,
  streamBase = '',
  itemHeight,
  onProgressUpdate = null,   // periodic progress callback (from ShowPlayerScreen)
  initialSeekSec = 0,        // seek position on first frame (from ShowPlayerScreen/MyList)
  onFirstFrameReady = null,  // called once after seek completes (from ShowPlayerScreen)
}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const accessToken = useSelector((state) => state.auth?.accessToken);
  const isBookmarked = useSelector(selectIsBookmarked(item.show_id));
  const bookmarksLoaded = useSelector(selectBookmarksLoaded);

  useEffect(() => {
    if (accessToken && !bookmarksLoaded) {
      dispatch(fetchBookmarks());
    }
  }, [accessToken, bookmarksLoaded, dispatch]);

  let tabBarHeight = 0;
  try {
    tabBarHeight = useBottomTabBarHeight();
  } catch {
    tabBarHeight = 0;
  }

  const isLocked = item.is_locked;
  const streamUrl = !isLocked && item.hls_url ? `${streamBase}${item.hls_url}` : null;
  
  // Track if we've already seeked for this item to avoid multiple seeks
  const hasSeekRef = useRef(false);

  const {
    videoRef,
    paused,
    currentTime,
    duration,
    firstFrameReady,
    manuallyPaused,
    togglePlayback,
    seekTo,
    onLoad: originalOnLoad,
    onProgress,
    onReadyForDisplay: originalOnReadyForDisplay,
    setFirstFrameReady,
  } = useShortVideoPlayback({
    streamUrl,
    isActive,
    isFocused,
    isLocked,
    itemKey: item.episode_id,
    initialDuration: item.duration_sec || 0,
    onProgressUpdate,
  });

  // Wrap onLoad to seek to initialSeekSec after video metadata is loaded
  const wrappedOnLoad = useCallback((data) => {
    originalOnLoad(data);
    
    // Seek to initial position immediately after metadata loads
    // Only seek once per item change to avoid state oscillation
    if (initialSeekSec > 0 && videoRef.current && !hasSeekRef.current) {
      hasSeekRef.current = true;
      videoRef.current.seek(initialSeekSec);
    }
  }, [originalOnLoad, initialSeekSec]);
  
  // Reset seek flag when item changes
  useEffect(() => {
    hasSeekRef.current = false;
  }, [item.episode_id]);

  // Wrap onReadyForDisplay to call onFirstFrameReady callback
  const onReadyForDisplay = useCallback(() => {
    originalOnReadyForDisplay();
    if (onFirstFrameReady) {
      onFirstFrameReady();
    }
  }, [originalOnReadyForDisplay, onFirstFrameReady]);

  // Bookmark press handler — passes full item data for optimistic local update in Redux
  const handleBookmarkPress = useCallback(() => {
    if (!accessToken) {
      navigation.navigate(ROUTES.LOGIN);
      return;
    }
    dispatch(toggleBookmark({
      showId: item.show_id,
      episodeId: item.episode_id,
      progressSec: Math.floor(currentTime || 0),
      showData: item, // Pass full show metadata for immediate bookmarks array update
    }));
  }, [accessToken, navigation, dispatch, item, currentTime]);

  const topOverlay = renderTopOverlay
    ? renderTopOverlay({ insets, item })
    : <DefaultTopOverlay top={insets.top + 10} style={styles.topSearch} />;

  return (
    <View style={[styles.reelContainer, itemHeight ? { height: itemHeight } : null]}>
      {/* Thumbnail / blurred placeholder */}
      {item.thumbnail_url ? (
        <Image
          source={{ uri: item.thumbnail_url }}
          style={[StyleSheet.absoluteFill, { opacity: firstFrameReady ? 0 : 1 }]}
          resizeMode="cover"
          blurRadius={isLocked ? 15 : 0}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0D0010' }]} />
      )}

      {/* Video player */}
      {streamUrl && !isLocked ? (
        <TouchableWithoutFeedback onPress={togglePlayback}>
          <View style={StyleSheet.absoluteFill}>
            <Video
              key={item.episode_id}
              ref={videoRef}
              source={{ uri: streamUrl }}
              style={[StyleSheet.absoluteFill, { opacity: firstFrameReady ? 1 : 0 }]}
              resizeMode="cover"
              paused={paused}
              repeat={true}
              controls={false}
              progressUpdateInterval={500}
              onLoad={wrappedOnLoad}
              onProgress={onProgress}
              onReadyForDisplay={onReadyForDisplay}
              allowsExternalPlayback={false}
            />
          </View>
        </TouchableWithoutFeedback>
      ) : null}

      {/* Manual-pause overlay */}
      {isActive && manuallyPaused && !isLocked && firstFrameReady ? (
        <TouchableWithoutFeedback onPress={togglePlayback}>
          <View style={styles.pauseOverlay}>
            <View style={styles.pauseIconCircle}>
              <Ionicons name="play" size={40} color="#fff" />
            </View>
          </View>
        </TouchableWithoutFeedback>
      ) : null}

      {/* Locked-content overlay */}
      {isLocked ? (
        <LockOverlay
          item={item}
          accessToken={accessToken}
          navigation={navigation}
          dispatch={dispatch}
        />
      ) : null}

      {/* Buffering spinner */}
      {isActive && streamUrl && !isLocked && !firstFrameReady ? (
        <View style={styles.bufferingOverlay}>
          <ActivityIndicator size="large" color={shortVideoTheme.crimson} />
        </View>
      ) : null}

      <View
        style={[styles.uiOverlay, { paddingBottom: insets.bottom }]}
        pointerEvents="box-none"
      >
        <View style={styles.sideActionsColumn}>
          <SideAction
            icon={isBookmarked ? 'bookmark' : 'bookmark-outline'}
            label={item.view_count > 0 ? formatCount(item.view_count) : ''}
            color={isBookmarked ? shortVideoTheme.crimson : '#fff'}
            onPress={handleBookmarkPress}
          />
          <SideAction
            icon="list"
            label="Episodes"
            onPress={() => onWatchAll && onWatchAll(item)}
          />
          <SideAction icon="share-social" label="Share" />
        </View>

        <View style={styles.textContent}>
          <TouchableOpacity
            style={styles.titleRow}
            activeOpacity={0.8}
            onPress={() => onOpenDetails && onOpenDetails(item)}
          >
            <Text style={styles.reelTitle} numberOfLines={1}>{item.show_title}</Text>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </TouchableOpacity>

          <View style={styles.epBadge}>
            <Ionicons name="videocam" size={12} color={shortVideoTheme.crimson} />
            <Text style={styles.epBadgeText}>EP.{item.episode_num}</Text>
          </View>

          <View style={styles.tagsRow}>
            {(item.tags || []).slice(0, 4).map((tag) => (
              <View key={tag} style={styles.tagPill}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>

          {item.synopsis ? (
            <Text style={styles.descText} numberOfLines={2}>
              {item.synopsis}{' '}
              <Text style={{ fontWeight: 'bold', color: '#fff' }}>more</Text>
            </Text>
          ) : null}

          {!isLocked && firstFrameReady ? (
            <ProgressBar
              currentTime={currentTime}
              duration={duration}
              onSeek={seekTo}
            />
          ) : null}

          <TouchableOpacity
            style={styles.episodeStrip}
            onPress={() => onWatchAll && onWatchAll(item)}
          >
            <Ionicons name="play-circle" size={20} color={shortVideoTheme.crimson} />
            <Text style={styles.episodeText}>
              EP.{item.episode_num} / EP.{item.total_episodes}
            </Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.watchAllText}>Watch All</Text>
            <Ionicons name="chevron-forward" size={16} color={shortVideoTheme.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {topOverlay}
    </View>
  );
}

function LockOverlay({ item, accessToken, navigation, dispatch }) {
  const isAuthenticated = !!accessToken;
  const coins = useSelector((s) => s.auth?.coins) ?? 0;
  const coinCost = item.coin_cost || 0;
  const canUnlock = coins >= coinCost;
  const isCoinLock =
    isAuthenticated &&
    (item.lock_reason === 'coins_or_membership' || !item.lock_reason);

  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState(null);

  const goToLogin = useCallback(() => {
    navigation.navigate(ROUTES.LOGIN);
  }, [navigation]);

  const goToWallet = useCallback(() => {
    navigation.navigate(ROUTES.MAIN_TABS, {
      screen: ROUTES.PROFILE,
      params: { screen: ROUTES.MY_WALLET },
    });
  }, [navigation]);

  const episodeId = item.episode_id || item.id;

  const handleUnlock = useCallback(async () => {
    if (!episodeId || unlocking) return;
    setError(null);
    setUnlocking(true);
    try {
      const result = await dispatch(unlockEpisode(episodeId)).unwrap();
      if (result?.is_locked) {
        setError('Could not unlock this episode');
      }
    } catch (err) {
      const msg = err?.message || 'Unlock failed';
      setError(msg);
    } finally {
      setUnlocking(false);
    }
  }, [dispatch, episodeId, unlocking]);

  if (!isAuthenticated) {
    return (
      <View style={styles.lockOverlay}>
        <View style={styles.lockIconWrap}>
          <Ionicons name="lock-closed" size={32} color="#fff" />
        </View>
        <Text style={styles.lockTitle}>Sign up to watch</Text>
        <TouchableOpacity style={styles.lockButton} onPress={goToLogin}>
          <Text style={styles.lockButtonText}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isCoinLock) {
    return (
      <View style={styles.lockOverlay}>
        <View style={styles.lockIconWrap}>
          <Ionicons name="lock-closed" size={32} color="#fff" />
        </View>
        <Text style={styles.lockTitle}>This episode is locked</Text>
      </View>
    );
  }

  return (
    <View style={styles.lockOverlay}>
      <View style={styles.lockIconWrap}>
        <Ionicons name="lock-closed" size={32} color="#fff" />
      </View>
      <Text style={styles.lockTitle}>Unlock · {coinCost} coins</Text>
      <Text style={styles.lockBalance}>Your coins: {coins}</Text>
      {error ? <Text style={styles.lockError}>{error}</Text> : null}
      <TouchableOpacity
        style={[
          styles.lockButton,
          (!canUnlock || unlocking) && styles.lockButtonDisabled,
        ]}
        onPress={handleUnlock}
        disabled={!canUnlock || unlocking}
      >
        {unlocking ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.lockButtonText}>
            {canUnlock ? 'Unlock' : 'Not enough coins'}
          </Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.lockSecondaryButton} onPress={goToWallet}>
        <Text style={styles.lockSecondaryText}>Get Coins</Text>
      </TouchableOpacity>
    </View>
  );
}