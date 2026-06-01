import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import Video from 'react-native-video';

import ProgressBar from './ProgressBar';
import SideAction from './SideAction';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './constants';
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
import { usePlaybackSpeed } from '../../context/PlaybackSpeedContext';
import { useGuestAuth } from '../../context/GuestAuthContext';

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
  onProgressUpdate = null,
  initialSeekSec = 0,
  onFirstFrameReady = null,
  showPlaybackSpeedControl = false,
  showOttOverlayControls = false,
  onReturnToDramaSheet,
}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const accessToken = useSelector((state) => state.auth?.accessToken);
  const isBookmarked = useSelector(selectIsBookmarked(item.show_id));
  const bookmarksLoaded = useSelector(selectBookmarksLoaded);
  const { speed: playbackRate, setSpeed, speeds: speedOptions } = usePlaybackSpeed();
  const [speedModalVisible, setSpeedModalVisible] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideControlsTimerRef = useRef(null);
  const layoutHeight = itemHeight || SCREEN_HEIGHT;

  useEffect(() => {
    if (accessToken && !bookmarksLoaded) {
      dispatch(fetchBookmarks());
    }
  }, [accessToken, bookmarksLoaded, dispatch]);

  const isLocked = item.is_locked;
  const streamUrl = !isLocked && item.hls_url ? `${streamBase}${item.hls_url}` : null;
  
  // Log streamUrl setup for debugging
  useEffect(() => {
    console.log(`📺 ShortVideoReelItem mounted - Episode: ${item.episode_num}, Locked: ${isLocked}, URL: ${streamUrl?.substring(0, 80)}...`);
  }, [item.episode_num, isLocked, streamUrl]);
  
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
    setManualPaused,
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
    console.log(`✅ Video loaded - Episode: ${item.episode_num}, Duration: ${data.duration}s`);
    originalOnLoad(data);
    
    // Seek to initial position immediately after metadata loads
    // Only seek once per item change to avoid state oscillation
    if (initialSeekSec > 0 && videoRef.current && !hasSeekRef.current) {
      hasSeekRef.current = true;
      console.log(`⏩ Seeking to ${initialSeekSec}s`);
      videoRef.current.seek(initialSeekSec);
    }
  }, [originalOnLoad, initialSeekSec, item.episode_num]);
  
  useEffect(() => {
    hasSeekRef.current = false;
    setVideoError(null);
  }, [item.episode_id, streamUrl]);

  // Wrap onReadyForDisplay to call onFirstFrameReady callback
  const onReadyForDisplay = useCallback(() => {
    console.log(`🎬 First frame ready - Episode: ${item.episode_num}`);
    originalOnReadyForDisplay();
    if (onFirstFrameReady) {
      onFirstFrameReady();
    }
  }, [originalOnReadyForDisplay, onFirstFrameReady, item.episode_num]);

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

  const clearHideControlsTimer = useCallback(() => {
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!showOttOverlayControls) return undefined;
    return () => {
      clearHideControlsTimer();
      StatusBar.setHidden(false);
    };
  }, [showOttOverlayControls, clearHideControlsTimer]);

  useEffect(() => {
    if (!showOttOverlayControls || !isActive) return;
    StatusBar.setHidden(false);
  }, [isActive, showOttOverlayControls]);

  useEffect(() => {
    if (!showOttOverlayControls) return;
    setControlsVisible(true);
  }, [item.episode_id, showOttOverlayControls]);

  useEffect(() => {
    if (!showOttOverlayControls || !isActive) return undefined;
    clearHideControlsTimer();
    if (!firstFrameReady || manuallyPaused || !controlsVisible) return undefined;
    hideControlsTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 2000);
    return clearHideControlsTimer;
  }, [
    controlsVisible,
    manuallyPaused,
    firstFrameReady,
    isActive,
    showOttOverlayControls,
    clearHideControlsTimer,
  ]);

  const handleOttScrimPress = useCallback(() => {
    if (!showOttOverlayControls || !isActive || isLocked) return;
    if (!controlsVisible) {
      setControlsVisible(true);
      return;
    }
    togglePlayback();
  }, [showOttOverlayControls, isActive, isLocked, controlsVisible, togglePlayback]);

  const handleOpenEpisodesOrReturn = useCallback(() => {
    if (onReturnToDramaSheet) {
      onReturnToDramaSheet(item, 'episodes');
      return;
    }
    onWatchAll?.(item);
  }, [item, onReturnToDramaSheet, onWatchAll]);

  const handleTitlePress = useCallback(() => {
    if (onReturnToDramaSheet) {
      onReturnToDramaSheet(item, 'synopsis');
      return;
    }
    onOpenDetails?.(item);
  }, [item, onReturnToDramaSheet, onOpenDetails]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        title: item.show_title,
        message: `Watch "${item.show_title}" on 7K!\nhttps://ott.ventagenie.com/show/${item.show_id}/ep/${item.episode_num}`,
      });
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  }, [item.show_title, item.show_id, item.episode_num]);

  const topOverlay = renderTopOverlay
    ? renderTopOverlay({ insets, item })
    : showOttOverlayControls
      ? null
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
        showOttOverlayControls ? (
          console.log(`🎬 OTT MODE (showOttOverlayControls=true) - Episode: ${item.episode_num}, resizeMode: cover`),
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Video
              key={item.episode_id}
              ref={videoRef}
              source={{ uri: streamUrl }}
              style={[StyleSheet.absoluteFill, { opacity: firstFrameReady ? 1 : 0 }]}
              resizeMode="cover"
              paused={paused}
              rate={playbackRate}
              repeat={true}
              controls={false}
              progressUpdateInterval={500}
              onLoad={wrappedOnLoad}
              onProgress={onProgress}
              onReadyForDisplay={onReadyForDisplay}
              onError={(e) => {
                const msg = e?.error?.localizedDescription || e?.error?.code || 'Playback error';
                console.log(`❌ Video error - Episode: ${item.episode_num}, Error: ${msg}`);
                setVideoError(String(msg));
              }}
              allowsExternalPlayback={false}
            />
          </View>
        ) : (
          console.log(`🎬 NON-OTT MODE (showOttOverlayControls=false) - Episode: ${item.episode_num}, resizeMode: contain`),
          <TouchableWithoutFeedback onPress={togglePlayback}>
            <View style={StyleSheet.absoluteFill}>
              <Video
                key={item.episode_id}
                ref={videoRef}
                source={{ uri: streamUrl }}
                style={[StyleSheet.absoluteFill, { opacity: firstFrameReady ? 1 : 0 }]}
                resizeMode="contain"
                paused={paused}
                rate={playbackRate}
                repeat={true}
                controls={false}
                progressUpdateInterval={500}
                onLoad={wrappedOnLoad}
                onProgress={onProgress}
                onReadyForDisplay={onReadyForDisplay}
                onError={(e) => {
                  const msg = e?.error?.localizedDescription || e?.error?.code || 'Playback error';
                  console.log(`❌ Video error - Episode: ${item.episode_num}, Error: ${msg}`);
                  setVideoError(String(msg));
                }}
                allowsExternalPlayback={false}
              />
            </View>
          </TouchableWithoutFeedback>
        )
      ) : null}

      {/* Manual-pause overlay (non-OTT reels) */}
      {!showOttOverlayControls && isActive && manuallyPaused && !isLocked && firstFrameReady ? (
        <TouchableWithoutFeedback onPress={togglePlayback}>
          <View style={styles.pauseOverlay}>
            <View style={styles.pauseIconCircle}>
              <Ionicons name="play" size={40} color="#fff" />
            </View>
          </View>
        </TouchableWithoutFeedback>
      ) : null}

      {/* Non-OTT play/pause button (consistent with OTT controls) */}
      {!showOttOverlayControls && isActive && streamUrl && !isLocked && firstFrameReady ? (
        <View style={styles.ottChromeRoot} pointerEvents="box-none">
          {(controlsVisible || manuallyPaused) ? (
            <View style={styles.ottCenterWrap} pointerEvents="box-none">
              <Pressable
                style={styles.ottPlayPauseFab}
                onPress={() => setManualPaused(!manuallyPaused)}
                hitSlop={16}
              >
                <Ionicons
                  name={manuallyPaused ? 'play' : 'pause'}
                  size={44}
                  color="#fff"
                  style={manuallyPaused ? styles.playIconNudge : undefined}
                />
              </Pressable>
            </View>
          ) : null}
        </View>
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

      {isActive && streamUrl && !isLocked && videoError ? (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorOverlayText} numberOfLines={3}>{videoError}</Text>
        </View>
      ) : null}

      {/* OTT-style controls (For You / Show Player) */}
      {isActive && showOttOverlayControls && streamUrl && !isLocked && firstFrameReady ? (
        <View style={styles.ottChromeRoot} pointerEvents="box-none">
          <Pressable
            style={[
              styles.ottTapZone,
              {
                top: layoutHeight * 0.14,
                bottom: layoutHeight * 0.32,
                left: SCREEN_WIDTH * 0.06,
                right: SCREEN_WIDTH * 0.2,
              },
            ]}
            onPress={handleOttScrimPress}
          />
          {controlsVisible ? (
            <View style={styles.ottDim} pointerEvents="none" />
          ) : manuallyPaused ? (
            <View style={styles.ottDimPaused} pointerEvents="none" />
          ) : null}

          <View style={[styles.ottTopBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
            <View style={{ flex: 1 }} />
            {showPlaybackSpeedControl ? (
              <Pressable
                style={styles.speedChipTop}
                onPress={() => setSpeedModalVisible(true)}
                hitSlop={10}
              >
                <Text style={styles.speedChipText}>
                  {playbackRate === 1 ? '1x' : `${playbackRate}x`}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {(controlsVisible || manuallyPaused) ? (
            <View style={styles.ottCenterWrap} pointerEvents="box-none">
              <Pressable
                style={styles.ottPlayPauseFab}
                onPress={() => setManualPaused(!manuallyPaused)}
                hitSlop={16}
              >
                <Ionicons
                  name={manuallyPaused ? 'play' : 'pause'}
                  size={44}
                  color="#fff"
                  style={manuallyPaused ? styles.playIconNudge : undefined}
                />
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {isActive && showPlaybackSpeedControl && streamUrl && !isLocked && firstFrameReady && !showOttOverlayControls ? (
        <>
          <Pressable
            style={[styles.speedChip, { bottom: Math.max(insets.bottom, 12) + 56 }]}
            onPress={() => setSpeedModalVisible(true)}
            hitSlop={8}
          >
            <Text style={styles.speedChipText}>{playbackRate === 1 ? '1x' : `${playbackRate}x`}</Text>
          </Pressable>
        </>
      ) : null}

      {showPlaybackSpeedControl ? (
          <Modal
            visible={speedModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setSpeedModalVisible(false)}
          >
            <Pressable style={styles.speedModalBackdrop} onPress={() => setSpeedModalVisible(false)}>
              <Pressable style={styles.speedModalCard} onPress={(e) => e.stopPropagation()}>
                <Text style={styles.speedModalTitle}>Playback speed</Text>
                {speedOptions.map((opt) => (
                  <Pressable
                    key={String(opt)}
                    style={[
                      styles.speedRow,
                      playbackRate === opt && styles.speedRowActive,
                    ]}
                    onPress={() => {
                      setSpeed(opt);
                      setSpeedModalVisible(false);
                    }}
                  >
                    <Text style={[
                      styles.speedRowText,
                      playbackRate === opt && styles.speedRowTextActive,
                    ]}>
                      {opt === 1 ? 'Normal (1x)' : `${opt}x`}
                    </Text>
                    {playbackRate === opt ? (
                      <Ionicons name="checkmark" size={20} color={shortVideoTheme.crimson} />
                    ) : null}
                  </Pressable>
                ))}
              </Pressable>
            </Pressable>
          </Modal>
      ) : null}

      <View
        style={[
          styles.uiOverlay,
          { paddingBottom: itemHeight ? 10 : insets.bottom },
        ]}
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
            onPress={handleOpenEpisodesOrReturn}
          />
          <SideAction icon="share-social" label="Share" onPress={handleShare} />
        </View>

        <View style={styles.textContent}>
          <TouchableOpacity
            style={styles.titleRow}
            activeOpacity={0.8}
            onPress={handleTitlePress}
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
              format={showOttOverlayControls ? 'elapsedTotal' : 'remaining'}
            />
          ) : null}

          <TouchableOpacity
            style={styles.episodeStrip}
            onPress={handleOpenEpisodesOrReturn}
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
  const { openSignUp } = useGuestAuth();
  const isAuthenticated = !!accessToken;
  const coins = useSelector((s) => s.auth?.coins) ?? 0;
  const coinCost = item.coin_cost || 0;
  const canUnlock = coins >= coinCost;
  const isCoinLock =
    isAuthenticated &&
    (item.lock_reason === 'coins_or_membership' || !item.lock_reason);

  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState(null);

  const goToSignUp = useCallback(() => {
    openSignUp();
  }, [openSignUp]);

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
        <TouchableOpacity style={styles.lockButton} onPress={goToSignUp}>
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
