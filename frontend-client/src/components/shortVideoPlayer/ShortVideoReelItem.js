import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import Video from 'react-native-video';
import YoutubePlayer from 'react-native-youtube-iframe';
import { CaptureProtection, useCaptureProtection } from 'react-native-capture-protection';

import ProgressBar from './ProgressBar';
import SideAction from './SideAction';
import LandscapePlayerChrome from './LandscapePlayerChrome';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './constants';
import { styles } from './styles';
import { shortVideoTheme } from './theme';
import useShortVideoPlayback from './useShortVideoPlayback';
import useLandscapePlayback from './useLandscapePlayback';
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
import { usePlaybackVolume } from '../../context/PlaybackVolumeContext';
import { useVideoQuality } from '../../context/VideoQualityContext';
import { useGuestAuth } from '../../context/GuestAuthContext';
import { isDownloaded, startDownload, removeDownload } from '../../services/downloadManager';

const STARTUP_VIDEO_TRACK = { type: 'resolution', value: 480 };
const AUTO_VIDEO_TRACK = { type: 'auto' };

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
  walletReturnParams = null,
  showEpisodeStrip = true,
  showViewsAction = false,
  repeatPlayback = true,
  shouldPreload = false,
  autoAdvanceOnEnd = true,
  onPlaybackEnd = null,
  enableLandscapeMode = true,
}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const landscapeWidth = Math.max(windowWidth, windowHeight);
  const landscapeHeight = Math.min(windowWidth, windowHeight);

  const { status } = useCaptureProtection();

  const accessToken = useSelector((state) => state.auth?.accessToken);
  const isBookmarked = useSelector(selectIsBookmarked(item.show_id));
  const bookmarksLoaded = useSelector(selectBookmarksLoaded);
  const { speed: playbackRate, setSpeed, speeds: speedOptions } = usePlaybackSpeed();
  const {
    volume,
    muted,
    setVolume,
    toggleMuted,
  } = usePlaybackVolume();
  const {
    quality,
    setQuality,
    options: qualityOptions,
    maxBitRate,
    activeLabel: qualityLabel,
  } = useVideoQuality();
  const [speedModalVisible, setSpeedModalVisible] = useState(false);
  const [qualityModalVisible, setQualityModalVisible] = useState(false);
  const [volumePanelVisible, setVolumePanelVisible] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [controlsInteractionTick, setControlsInteractionTick] = useState(0);
  
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [synopsisTruncated, setSynopsisTruncated] = useState(false);

  useEffect(() => {
    setSynopsisExpanded(false);
    setSynopsisTruncated(false);
  }, [item.episode_id]);

  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const hideControlsTimerRef = useRef(null);
  const layoutHeight = itemHeight || windowHeight;
  const hideControlsDelay = showOttOverlayControls ? 2000 : 3000;
  const bottomControlsPadding = showOttOverlayControls
    ? (itemHeight ? 10 : insets.bottom)
    : itemHeight
      ? Math.max(insets.bottom + 34, 44)
      : Math.max(insets.bottom + 18, 24);
  const dramaVideoMaxHeight = Math.max(layoutHeight - insets.top - bottomControlsPadding - 24, 0);
  const dramaVideoHeight = Math.min(windowWidth * (16 / 9), dramaVideoMaxHeight);
  const dramaVideoTop = Math.max(insets.top + 12, (layoutHeight - dramaVideoHeight) / 2);

  useEffect(() => {
    if (accessToken && !bookmarksLoaded) {
      dispatch(fetchBookmarks());
    }
  }, [accessToken, bookmarksLoaded, dispatch]);

  const [downloadState, setDownloadState] = useState('none');
  const [downloadProgress, setDownloadProgress] = useState(0);

  const isYouTube = item.video_source === 'YOUTUBE';
  const hasYouTubeVideo = isYouTube && Boolean(item.youtube_video_id);
  const isLocked = item.localVideoPath ? false : item.is_locked;
  const streamUrl = item.localVideoPath || (!isLocked && item.hls_url ? `${streamBase}${item.hls_url}` : null);

  useEffect(() => {
    if (isYouTube) return;
    if (item.localVideoPath) {
      setDownloadState('downloaded');
      return;
    }
    isDownloaded(item.episode_id).then(downloaded => {
      if (downloaded) setDownloadState('downloaded');
      else setDownloadState('none');
    });
  }, [item.episode_id, item.localVideoPath]);

  const handleDownloadPress = async () => {
    console.log(`[Download] Download button pressed for episode: ${item.episode_id}, current state: ${downloadState}`);
    if (!accessToken) {
      console.log('[Download] No access token, navigating to LOGIN');
      navigation.navigate(ROUTES.LOGIN);
      return;
    }
    
    if (downloadState === 'downloaded') {
      Alert.alert(
        'Remove Download',
        'Do you want to remove this episode from your device?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Remove', 
            style: 'destructive',
            onPress: async () => {
              console.log(`[Download] Removing downloaded episode: ${item.episode_id}`);
              await removeDownload(item.episode_id);
              setDownloadState('none');
            }
          }
        ]
      );
    } else if (downloadState === 'none') {
      try {
        console.log(`[Download] Starting download for episode: ${item.episode_id}`);
        setDownloadState('downloading');
        setDownloadProgress(0);
        await startDownload(item.episode_id, (progress) => {
          setDownloadProgress(progress);
        });
        console.log(`[Download] Successfully completed download for episode: ${item.episode_id}`);
        setDownloadState('downloaded');
      } catch (e) {
        console.error('[Download] Error during download process:', e);
        setDownloadState('none');
        if (!e.isOfflineError) {
          Alert.alert('Download Failed', e?.response?.data?.message || e.message || 'Something went wrong');
        }
      }
    }
  };
  
  useEffect(() => {
    CaptureProtection.prevent({
      screenshot: true,
      record: true,
      appSwitcher: true,
    });
    return () => {
      CaptureProtection.allow();
    };
  }, []);

  const isBeingRecorded = Platform.OS === 'ios' && status?.record === true;

  // Log streamUrl setup for debugging
  useEffect(() => {
    //console.log(`📺 ShortVideoReelItem mounted - Episode: ${item.episode_num}, Locked: ${isLocked}, URL: ${streamUrl?.substring(0, 80)}...`);
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
    showId: item.show_id,
    episodeId: item.episode_id,
    accessToken,
  });
  const shouldRenderVideo = Boolean((isActive || shouldPreload) && isFocused && !isLocked && (streamUrl || hasYouTubeVideo));
  const videoIsVisible = isActive && shouldRenderVideo && firstFrameReady;
  const showActiveBuffering = isActive && shouldRenderVideo && !firstFrameReady;
  const {
    isLandscapeActive,
    enterLandscape,
    exitLandscape,
  } = useLandscapePlayback({
    isActive: isActive && !isLocked && firstFrameReady,
    enabled: enableLandscapeMode,
  });
  // For downloaded videos, we use 'contain' so horizontal (16:9) videos are letterboxed correctly
  // and not stretched to fill the vertical dimensions, copying the behavior of the normal players.
  // Regular short reels will continue to use 'cover'.
  const videoResizeMode = item.localVideoPath ? 'contain' : 'cover';
  const showPortraitChrome = !isLandscapeActive;
  const showLandscapeToggle = enableLandscapeMode
    && showPortraitChrome
    && isActive
    && !isLocked
    && !isYouTube
    && firstFrameReady;
  const showMainOverlay = showOttOverlayControls || controlsVisible || manuallyPaused;
  const effectiveMuted = muted || volume <= 0;
  const youtubePortraitHeight = Math.min(windowWidth * (9 / 16), layoutHeight);
  const youtubePortraitTop = Math.max(
    insets.top,
    (layoutHeight - bottomControlsPadding - youtubePortraitHeight) / 2
  );
  const youtubeHintTop = Math.max(insets.top + 44, youtubePortraitTop - 38);
  const youtubeFrameStyle = isLandscapeActive
    ? [StyleSheet.absoluteFill, { backgroundColor: '#000' }]
    : [
        styles.youtubeVideoFrame,
        { top: youtubePortraitTop, height: youtubePortraitHeight },
      ];

  useEffect(() => {
    if (isBeingRecorded) {
      if (!paused && !manuallyPaused) {
        setManualPaused(true);
      }
    }
  }, [isBeingRecorded, paused, manuallyPaused, setManualPaused]);

  useEffect(() => {
    if (shouldRenderVideo) return;
    setFirstFrameReady(false);
    setVideoError(null);
  }, [shouldRenderVideo, setFirstFrameReady]);

  useEffect(() => {
    Animated.timing(controlsOpacity, {
      toValue: showMainOverlay ? 1 : 0,
      duration: showMainOverlay ? 180 : 240,
      useNativeDriver: true,
    }).start();
  }, [controlsOpacity, showMainOverlay]);

  // Wrap onLoad to seek to initialSeekSec after video metadata is loaded
  const wrappedOnLoad = useCallback((data) => {
    //console.log(`✅ Video loaded - Episode: ${item.episode_num}, Duration: ${data.duration}s`);
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
    //console.log(`🎬 First frame ready - Episode: ${item.episode_num}`);
    originalOnReadyForDisplay();
    if (onFirstFrameReady) {
      onFirstFrameReady();
    }
  }, [originalOnReadyForDisplay, onFirstFrameReady, item.episode_num]);

  const handleYouTubeReady = useCallback(() => {
    setFirstFrameReady(true);
    originalOnReadyForDisplay();
    if (onFirstFrameReady) {
      onFirstFrameReady();
    }
  }, [onFirstFrameReady, originalOnReadyForDisplay, setFirstFrameReady]);

  const handleSkipBack = useCallback(() => {
    seekTo(Math.max(0, (currentTime || 0) - 10));
  }, [seekTo, currentTime]);

  const handleSkipForward = useCallback(() => {
    const max = duration || item.duration_sec || 0;
    seekTo(Math.min(max, (currentTime || 0) + 10));
  }, [seekTo, currentTime, duration, item.duration_sec]);

  const handlePlaybackEnd = useCallback(() => {
    setControlsVisible(true);
    onPlaybackEnd?.(item);
  }, [item, onPlaybackEnd]);

  const renderSeekControls = () => (
    <View style={styles.ottSeekRow}>
      <Pressable style={styles.ottSeekBtn} onPress={handleSkipBack} hitSlop={12}>
        <MaterialCommunityIcons name="rewind" size={18} color="#fff" />
        <Text style={styles.ottSeekText}>10</Text>
      </Pressable>
      <Pressable
        style={styles.ottPlayPauseFab}
        onPress={handlePlayPausePress}
        hitSlop={16}
      >
        <Ionicons
          name={manuallyPaused ? 'play' : 'pause'}
          size={38}
          color="#fff"
          style={manuallyPaused ? styles.playIconNudge : undefined}
        />
      </Pressable>
      <Pressable style={styles.ottSeekBtn} onPress={handleSkipForward} hitSlop={12}>
        <Text style={styles.ottSeekText}>10</Text>
        <MaterialCommunityIcons name="fast-forward" size={18} color="#fff" />
      </Pressable>
    </View>
  );

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
    return () => {
      clearHideControlsTimer();
      if (showOttOverlayControls) {
        StatusBar.setHidden(false);
      }
    };
  }, [showOttOverlayControls, clearHideControlsTimer]);

  useEffect(() => {
    if (!showOttOverlayControls || !isActive) return;
    StatusBar.setHidden(false);
  }, [isActive, showOttOverlayControls]);

  useEffect(() => {
    clearHideControlsTimer();
    setControlsVisible(true);
  }, [item.episode_id, clearHideControlsTimer]);

  useEffect(() => {
    if (!isActive || isLocked || !streamUrl) return undefined;
    clearHideControlsTimer();
    if (!firstFrameReady || manuallyPaused || !controlsVisible) return undefined;
    hideControlsTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, hideControlsDelay);
    return clearHideControlsTimer;
  }, [
    controlsVisible,
    controlsInteractionTick,
    hideControlsDelay,
    isLocked,
    manuallyPaused,
    firstFrameReady,
    isActive,
    streamUrl,
    clearHideControlsTimer,
  ]);

  const handleOttScrimPress = useCallback(() => {
    if ((!showOttOverlayControls && !isLandscapeActive) || !isActive || isLocked) return;
    setControlsVisible(true);
    setControlsInteractionTick((tick) => tick + 1);
  }, [showOttOverlayControls, isLandscapeActive, isActive, isLocked]);

  const handleNonOttVideoPress = useCallback(() => {
    if (showOttOverlayControls || !isActive || isLocked) return;
    setControlsVisible(true);
    setControlsInteractionTick((tick) => tick + 1);
  }, [showOttOverlayControls, isActive, isLocked]);

  const handlePlayPausePress = useCallback(() => {
    setControlsVisible(true);
    setManualPaused(!manuallyPaused);
  }, [manuallyPaused, setManualPaused]);

  const handleScrubStart = useCallback(() => {
    clearHideControlsTimer();
    setControlsVisible(true);
  }, [clearHideControlsTimer]);

  const handleScrubEnd = useCallback(() => {
    setControlsVisible(true);
    setControlsInteractionTick((tick) => tick + 1);
  }, []);

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

  const renderVolumeControl = () => (
    <VolumeControl
      muted={effectiveMuted}
      volume={volume}
      setVolume={setVolume}
      toggleMuted={toggleMuted}
      visible={volumePanelVisible}
      setVisible={setVolumePanelVisible}
    />
  );

  const topOverlay = renderTopOverlay
    ? renderTopOverlay({ insets, item })
    : showOttOverlayControls
      ? null
      : <DefaultTopOverlay top={insets.top + 10} style={styles.topSearch} />;

  return (
    <View style={[
      styles.reelContainer,
      isLandscapeActive
        ? { width: landscapeWidth, height: landscapeHeight, backgroundColor: '#000' }
        : [
            { width: windowWidth },
            itemHeight ? { height: itemHeight } : { height: layoutHeight },
          ],
    ]}>
      {/* Thumbnail / blurred placeholder */}
      {item.thumbnail_url ? (
        <Image
          source={{ uri: item.thumbnail_url }}
          style={[StyleSheet.absoluteFill, { opacity: videoIsVisible ? 0 : 1 }]}
          resizeMode="cover"
          blurRadius={isLocked ? 15 : 0}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0D0010' }]} />
      )}

      {/* Video player */}
      {shouldRenderVideo ? (
        showOttOverlayControls ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {isYouTube && !isLocked ? (
              <View style={[youtubeFrameStyle, { opacity: videoIsVisible ? 1 : 0.01 }]} pointerEvents="auto">
                <YoutubePlayer
                  height={youtubePortraitHeight}
                  width={windowWidth}
                  videoId={item.youtube_video_id}
                  play={isActive && isFocused && !isLocked}
                  onReady={handleYouTubeReady}
                  onChangeState={(state) => {
                    if (state === 'ended') {
                      handlePlaybackEnd();
                    }
                  }}
                  initialPlayerParams={{
                    controls: true,
                    rel: false,
                    modestbranding: true,
                  }}
                  webViewProps={{
                    nestedScrollEnabled: true,
                  }}
                  webViewStyle={{ opacity: 0.99 }}
                  volume={effectiveMuted ? 0 : volume * 100}
                />
              </View>
            ) : (
              <Video
                key={item.episode_id}
                ref={videoRef}
                source={{ uri: streamUrl }}
                style={[StyleSheet.absoluteFill, { opacity: videoIsVisible ? 1 : 0 }]}
                resizeMode={videoResizeMode}
                paused={paused}
                rate={playbackRate}
                repeat={repeatPlayback && !autoAdvanceOnEnd}
                muted={effectiveMuted}
                volume={volume}
                controls={false}
                selectedVideoTrack={firstFrameReady ? AUTO_VIDEO_TRACK : STARTUP_VIDEO_TRACK}
                maxBitRate={maxBitRate}
                progressUpdateInterval={500}
                onLoad={wrappedOnLoad}
                onProgress={onProgress}
                onEnd={handlePlaybackEnd}
                onReadyForDisplay={onReadyForDisplay}
                onError={(e) => {
                  const msg = e?.error?.localizedDescription || e?.error?.code || 'Playback error';
                  console.log(`❌ Video error - Episode: ${item.episode_num}, Error: ${msg}`);
                  setVideoError(String(msg));
                }}
                allowsExternalPlayback={false}
                preventsDisplaySleepDuringVideoPlayback={true}
              />
            )}
          </View>
        ) : (
          //console.log(`🎬 NON-OTT MODE (showOttOverlayControls=false) - Episode: ${item.episode_num}, resizeMode: contain`),
          isYouTube && !isLocked ? (
            <View style={[youtubeFrameStyle, { opacity: videoIsVisible ? 1 : 0.01 }]} pointerEvents="auto">
              <YoutubePlayer
                height={isLandscapeActive ? landscapeHeight : youtubePortraitHeight}
                width={isLandscapeActive ? landscapeWidth : windowWidth}
                videoId={item.youtube_video_id}
                play={isActive && isFocused && !isLocked}
                onReady={handleYouTubeReady}
                onChangeState={(state) => {
                  if (state === 'ended') {
                    handlePlaybackEnd();
                  }
                }}
                initialPlayerParams={{
                  controls: true,
                  rel: false,
                  modestbranding: true,
                }}
                webViewProps={{
                  nestedScrollEnabled: true,
                }}
                webViewStyle={{ opacity: 0.99 }}
                volume={effectiveMuted ? 0 : volume * 100}
              />
            </View>
          ) : (
            <TouchableWithoutFeedback onPress={handleNonOttVideoPress}>
              <View
                style={
                  isLandscapeActive
                    ? [StyleSheet.absoluteFill, { backgroundColor: '#000' }]
                    : [
                        styles.dramaVideoFrame,
                        { top: dramaVideoTop, height: dramaVideoHeight },
                      ]
                }
              >
                <Video
                  key={item.episode_id}
                  ref={videoRef}
                  source={{ uri: streamUrl }}
                  style={[StyleSheet.absoluteFill, { opacity: videoIsVisible ? 1 : 0 }]}
                  resizeMode={videoResizeMode}
                  paused={paused}
                  rate={playbackRate}
                  repeat={repeatPlayback && !autoAdvanceOnEnd}
                  muted={effectiveMuted}
                  volume={volume}
                  controls={false}
                  selectedVideoTrack={firstFrameReady ? AUTO_VIDEO_TRACK : STARTUP_VIDEO_TRACK}
                  maxBitRate={maxBitRate}
                  progressUpdateInterval={500}
                  onLoad={wrappedOnLoad}
                  onProgress={onProgress}
                  onEnd={handlePlaybackEnd}
                  onReadyForDisplay={onReadyForDisplay}
                  onError={(e) => {
                    const msg = e?.error?.localizedDescription || e?.error?.code || 'Playback error';
                    console.log(`❌ Video error - Episode: ${item.episode_num}, Error: ${msg}`);
                    setVideoError(String(msg));
                  }}
                  allowsExternalPlayback={false}
                  preventsDisplaySleepDuringVideoPlayback={true}
                />
              </View>
            </TouchableWithoutFeedback>
          )
        )
      ) : null}

      {!showOttOverlayControls && showPortraitChrome && isActive && streamUrl && !isLocked && firstFrameReady ? (
        <Pressable
          style={styles.nonOttTapZone}
          onPress={handleNonOttVideoPress}
        />
      ) : null}

      {/* Manual-pause overlay (non-OTT reels) */}
      {!showOttOverlayControls && showPortraitChrome && isActive && manuallyPaused && !isLocked && firstFrameReady ? (
        <TouchableWithoutFeedback onPress={handleNonOttVideoPress}>
          <View style={styles.pauseOverlay}>
            <View style={styles.pauseIconCircle}>
              <Ionicons name="play" size={40} color="#fff" />
            </View>
          </View>
        </TouchableWithoutFeedback>
      ) : null}

      {/* Non-OTT play/pause button (consistent with OTT controls) */}
      {!showOttOverlayControls && showPortraitChrome && isActive && streamUrl && !isLocked && firstFrameReady ? (
        <View style={styles.ottChromeRoot} pointerEvents="box-none">
          <View style={[styles.ottTopBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
            <View style={{ flex: 1 }} />
            {renderVolumeControl()}
            <Pressable
              style={[styles.speedChipTop, styles.qualityChipTop]}
              onPress={() => setQualityModalVisible(true)}
              hitSlop={10}
            >
              <Text style={styles.speedChipText}>{qualityLabel}</Text>
            </Pressable>
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

          <Animated.View
            style={[styles.ottCenterWrap, { opacity: controlsOpacity }]}
            pointerEvents={showMainOverlay ? 'box-none' : 'none'}
          >
            {renderSeekControls()}
          </Animated.View>
        </View>
      ) : null}

      {/* Locked-content overlay */}
      {isLocked ? (
        <LockOverlay
          item={item}
          accessToken={accessToken}
          navigation={navigation}
          dispatch={dispatch}
          walletReturnParams={walletReturnParams}
        />
      ) : null}

      {/* Buffering spinner */}
      {showActiveBuffering ? (
        <View style={styles.bufferingOverlay}>
          <ActivityIndicator size="large" color={shortVideoTheme.crimson} />
        </View>
      ) : null}

      {isActive && shouldRenderVideo && videoError ? (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorOverlayText} numberOfLines={3}>{videoError}</Text>
        </View>
      ) : null}

      {showPortraitChrome && isActive && hasYouTubeVideo && !isLocked && firstFrameReady ? (
        <View
          style={[styles.youtubeFullscreenHint, { top: youtubeHintTop }]}
          pointerEvents="none"
        >
          <MaterialCommunityIcons name="fullscreen" size={15} color="#fff" />
          <Text style={styles.youtubeFullscreenHintText} numberOfLines={1}>
            Tap YouTube fullscreen for best view
          </Text>
        </View>
      ) : null}

      {/* OTT-style controls (For You / Show Player) */}
      {isActive && showOttOverlayControls && showPortraitChrome && streamUrl && !isLocked && firstFrameReady ? (
        <View style={styles.ottChromeRoot} pointerEvents="box-none">
          <Pressable
            style={[
              styles.ottTapZone,
              {
                top: layoutHeight * 0.14,
                bottom: layoutHeight * 0.32,
                left: windowWidth * 0.06,
                right: windowWidth * 0.2,
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
            {renderVolumeControl()}
            <Pressable
              style={[styles.speedChipTop, styles.qualityChipTop]}
              onPress={() => setQualityModalVisible(true)}
              hitSlop={10}
            >
              <Text style={styles.speedChipText}>{qualityLabel}</Text>
            </Pressable>
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
              {renderSeekControls()}
            </View>
          ) : null}
        </View>
      ) : null}

      {isLandscapeActive && isActive && streamUrl && !isLocked && firstFrameReady ? (
        <LandscapePlayerChrome
          insets={insets}
          item={item}
          controlsOpacity={controlsOpacity}
          showMainOverlay={showMainOverlay}
          controlsVisible={controlsVisible}
          manuallyPaused={manuallyPaused}
          currentTime={currentTime}
          duration={duration}
          seekTo={seekTo}
          handleScrubStart={handleScrubStart}
          handleScrubEnd={handleScrubEnd}
          handleOttScrimPress={handleOttScrimPress}
          handlePlayPausePress={handlePlayPausePress}
          handleSkipBack={handleSkipBack}
          handleSkipForward={handleSkipForward}
          renderVolumeControl={renderVolumeControl}
          qualityLabel={qualityLabel}
          onQualityPress={() => setQualityModalVisible(true)}
          playbackRate={playbackRate}
          showPlaybackSpeedControl={showPlaybackSpeedControl}
          onSpeedPress={() => setSpeedModalVisible(true)}
          onExitLandscape={exitLandscape}
        />
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

      <Modal
        visible={qualityModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQualityModalVisible(false)}
      >
        <Pressable style={styles.speedModalBackdrop} onPress={() => setQualityModalVisible(false)}>
          <Pressable style={styles.speedModalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.speedModalTitle}>Video quality</Text>
            {qualityOptions.map((opt) => (
              <Pressable
                key={opt.id}
                style={[
                  styles.speedRow,
                  quality === opt.id && styles.speedRowActive,
                ]}
                onPress={() => {
                  setQuality(opt.id);
                  setQualityModalVisible(false);
                }}
              >
                <View style={styles.qualityRowTextWrap}>
                  <Text style={[
                    styles.speedRowText,
                    quality === opt.id && styles.speedRowTextActive,
                  ]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.qualityRowDescription}>
                    {opt.description}
                  </Text>
                </View>
                {quality === opt.id ? (
                  <Ionicons name="checkmark" size={20} color={shortVideoTheme.crimson} />
                ) : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {showPortraitChrome ? (
      <Animated.View
          style={[
            styles.uiOverlay,
            { paddingBottom: bottomControlsPadding },
            { opacity: controlsOpacity },
          ]}
          pointerEvents={showMainOverlay ? 'box-none' : 'none'}
        >
          <View style={styles.sideActionsColumn}>
            <SideAction
              icon={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              label="Save"
              color={isBookmarked ? shortVideoTheme.crimson : '#fff'}
              onPress={handleBookmarkPress}
            />
            <SideAction
              icon="list"
              label="Episodes"
              onPress={handleOpenEpisodesOrReturn}
            />
            {!isYouTube && (
              <SideAction
                icon={
                  downloadState === 'downloaded' ? 'checkmark-circle' :
                  downloadState === 'downloading' ? 'cloud-download' : 'download-outline'
                }
                label={downloadState === 'downloading' ? `${Math.round(downloadProgress * 100)}%` : 'Download'}
                color={downloadState === 'downloaded' ? shortVideoTheme.crimson : '#fff'}
                onPress={handleDownloadPress}
              />
            )}
            <SideAction icon="paper-plane-outline" label="Share" onPress={handleShare} />
            {showViewsAction ? (
              <SideAction
                icon="eye-outline"
                label={item.view_count > 0 ? formatCount(item.view_count) : ''}
              />
            ) : null}
          </View>

          <View style={styles.textContent}>
            <View style={styles.bottomMetaRow}>
              <View style={styles.bottomMetaTextCol}>
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
              <View style={styles.synopsisContainer}>
                {!synopsisTruncated && (
                  <Text
                    style={[styles.descText, { position: 'absolute', opacity: 0, zIndex: -1000 }]}
                    onTextLayout={(e) => {
                      if (e.nativeEvent.lines.length > 2) {
                        setSynopsisTruncated(true);
                      }
                    }}
                  >
                    {item.synopsis}
                  </Text>
                )}
                <Text
                  style={[styles.descText, synopsisTruncated && { marginBottom: 2 }]}
                  numberOfLines={synopsisExpanded ? undefined : 2}
                >
                  {item.synopsis}
                </Text>
                {synopsisTruncated && (
                  <TouchableOpacity
                    onPress={() => setSynopsisExpanded(!synopsisExpanded)}
                    style={styles.moreLessButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.moreLessText}>
                      {synopsisExpanded ? 'less' : 'more'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
              </View>

              {showLandscapeToggle ? (
                <Pressable
                  style={styles.landscapeToggleBtn}
                  onPress={enterLandscape}
                  hitSlop={10}
                  accessibilityLabel="Switch to landscape view"
                >
                  <MaterialCommunityIcons name="phone-rotate-landscape" size={20} color="#fff" />
                </Pressable>
              ) : null}
            </View>

            {!isLocked && firstFrameReady && !isYouTube ? (
              <ProgressBar
                currentTime={currentTime}
                duration={duration}
                onSeek={seekTo}
                format={showOttOverlayControls ? 'elapsedTotal' : 'remaining'}
                onScrubStart={handleScrubStart}
                onScrubEnd={handleScrubEnd}
              />
            ) : null}

            {showEpisodeStrip ? (
              <TouchableOpacity
                style={styles.episodeStrip}
                onPress={handleOpenEpisodesOrReturn}
              >
                <Ionicons
                  name="play-circle"
                  size={20}
                  color={shortVideoTheme.crimson}
                />
                <Text style={styles.episodeText}>
                  EP.{item.episode_num} / EP.{item.total_episodes}
                </Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.watchAllText}>Watch All</Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={shortVideoTheme.muted}
                />
              </TouchableOpacity>
            ) : null}
          </View>
      </Animated.View>
      ) : null}

      {/* iOS screen recording overlay */}
      {isBeingRecorded ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }]} pointerEvents="auto">
          <Ionicons name="videocam-off" size={64} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 16 }}>
            Screen recording is not allowed
          </Text>
        </View>
      ) : null}

      {topOverlay}
    </View>
  );
}

function VolumeControl({ muted, volume, setVolume, toggleMuted, visible, setVisible }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const iconName = muted
    ? 'volume-mute'
    : volume < 0.45
      ? 'volume-low'
      : 'volume-high';

  const updateVolumeFromPress = useCallback((event) => {
    if (!trackWidth) return;
    const next = event.nativeEvent.locationX / trackWidth;
    setVolume(next);
  }, [setVolume, trackWidth]);

  return (
    <View style={styles.volumeControlWrap}>
      <Pressable
        style={[styles.volumeIconButton, visible && styles.volumeIconButtonActive]}
        onPress={() => setVisible((current) => !current)}
        hitSlop={10}
      >
        <Ionicons name={iconName} size={18} color="#fff" />
      </Pressable>

      {visible ? (
        <View style={styles.volumePanel}>
          <Pressable style={styles.volumeMuteButton} onPress={toggleMuted} hitSlop={8}>
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={17} color="#fff" />
          </Pressable>
          <Pressable
            style={styles.volumeTrackHit}
            onPress={updateVolumeFromPress}
            onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
          >
            <View style={styles.volumeTrack}>
              <View style={[styles.volumeFill, { width: `${Math.round(volume * 100)}%` }]} />
              <View style={[styles.volumeThumb, { left: `${Math.round(volume * 100)}%` }]} />
            </View>
          </Pressable>
          <Text style={styles.volumeText}>{muted ? '0' : Math.round(volume * 100)}%</Text>
        </View>
      ) : null}
    </View>
  );
}

function LockOverlay({ item, accessToken, navigation, dispatch, walletReturnParams }) {
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

  const goToTopUp = useCallback(() => {
    navigation.navigate(ROUTES.TOP_UP, {
      returnToShowPlayer: true,
      ...(walletReturnParams || {}),
    });
  }, [navigation, walletReturnParams]);

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
      <TouchableOpacity style={styles.lockSecondaryButton} onPress={goToTopUp}>
        <Text style={styles.lockSecondaryText}>Get Coins</Text>
      </TouchableOpacity>
    </View>
  );
}