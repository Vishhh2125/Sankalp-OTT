import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableWithoutFeedback,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Video from 'react-native-video';
import YoutubePlayer from 'react-native-youtube-iframe';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../constants/theme';
import { fetchLivePlayUrl, joinStream, leaveStream } from '../components/live/liveApi';
import LiveProgressBar from '../components/live/LiveProgressBar';
import useLandscapePlayback from '../components/shortVideoPlayer/useLandscapePlayback';

export default function LiveViewerScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { streamId, title } = route.params || {};

  const [playData, setPlayData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [videoError, setVideoError] = useState(null);
  
  const [controlsVisible, setControlsVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const hideControlsTimerRef = useRef(null);

  const videoRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const { isLandscapeActive, enterLandscape, exitLandscape } = useLandscapePlayback({
    isActive: true,
    enabled: true,
  });

  // Viewer tracking session
  const viewerSessionId = useRef(null);

  const hlsUrl = playData?.hls_url || null;
  const videoSource = playData?.video_source || 'MEDIAMTX';
  const youtubeVideoId = playData?.youtube_video_id || null;

  const loadPlayUrl = useCallback(async () => {
    if (!streamId) {
      setError('Missing stream');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await fetchLivePlayUrl(streamId);
      setPlayData(data);
      if (data?.video_source === 'YOUTUBE') {
        if (!data?.youtube_video_id) setError('YouTube Stream Video ID not available');
      } else {
        if (!data?.hls_url) setError('Playback URL not available');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Stream unavailable');
      setPlayData(null);
    } finally {
      setLoading(false);
    }
  }, [streamId]);

  useEffect(() => {
    loadPlayUrl();
  }, [loadPlayUrl]);

  // Join stream after Play data is loaded, leave on unmount
  useEffect(() => {
    if (!playData || !streamId) return;

    let sessionId = null;

    const doJoin = async () => {
      try {
        const data = await joinStream(streamId);
        if (data?.session_id) {
          sessionId = data.session_id;
          viewerSessionId.current = sessionId;
        }
      } catch {
        // Viewer tracking is non-critical — don't block playback
      }
    };

    doJoin();

    return () => {
      // Leave stream on unmount
      const sid = sessionId || viewerSessionId.current;
      if (sid) {
        leaveStream(sid).catch(() => {});
        viewerSessionId.current = null;
      }
    };
  }, [playData, streamId]);

  // ─── Controls show/hide logic (matches OTT player) ───
  const clearHideControlsTimer = useCallback(() => {
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
  }, []);

  // Animate controls opacity to match controlsVisible state
  useEffect(() => {
    Animated.timing(controlsOpacity, {
      toValue: (controlsVisible || paused) ? 1 : 0,
      duration: (controlsVisible || paused) ? 180 : 240,
      useNativeDriver: true,
    }).start();
  }, [controlsOpacity, controlsVisible, paused]);

  // Auto-hide controls after 3 seconds (matching OTT 3s delay)
  useEffect(() => {
    clearHideControlsTimer();
    if (!controlsVisible || paused) return undefined;

    hideControlsTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 3000);

    return clearHideControlsTimer;
  }, [controlsVisible, paused, clearHideControlsTimer]);

  // Cleanup timer on unmount
  useEffect(() => {
    return clearHideControlsTimer;
  }, [clearHideControlsTimer]);

  const handleVideoPress = useCallback(() => {
    setControlsVisible(true);
  }, []);

  const togglePlayPause = useCallback(() => {
    setPaused((p) => !p);
    setControlsVisible(true);
  }, []);

  const handleSkipBack = useCallback(() => {
    if (videoRef.current) {
      const target = Math.max(0, currentTime - 10);
      videoRef.current.seek(target);
      setCurrentTime(target);
    }
    setControlsVisible(true);
  }, [currentTime]);

  const handleSkipForward = useCallback(() => {
    if (videoRef.current) {
      const target = Math.min(duration, currentTime + 10);
      videoRef.current.seek(target);
      setCurrentTime(target);
    }
    setControlsVisible(true);
  }, [currentTime, duration]);

  const showMainOverlay = controlsVisible || paused;

  return (
    <View style={styles.screen}>
      {!isLandscapeActive && (
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={theme.white} />
          </Pressable>
          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={1}>{title || 'Live stream'}</Text>
          </View>
        </View>
      )}

      <TouchableWithoutFeedback onPress={handleVideoPress} disabled={videoSource === 'YOUTUBE'}>
        <View style={styles.playerWrap}>
          {loading ? (
            <View style={styles.loadingShimmer}>
              <Animated.View style={styles.shimmerBox} />
            </View>
          ) : error ? (
            <View style={styles.messageBox}>
              <Ionicons name="alert-circle-outline" size={40} color={theme.gray} />
              <Text style={styles.messageText}>{error}</Text>
              <Pressable style={styles.retryBtn} onPress={loadPlayUrl}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : videoSource === 'YOUTUBE' ? (
            <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }]} pointerEvents="auto">
              <YoutubePlayer
                height={isLandscapeActive ? windowHeight : windowWidth * (9 / 16)}
                width={isLandscapeActive ? windowWidth : windowWidth}
                videoId={youtubeVideoId}
                play={true}
                initialPlayerParams={{
                  controls: true,
                  rel: false,
                  modestbranding: true,
                }}
                webViewProps={{
                  nestedScrollEnabled: true,
                }}
                webViewStyle={{ opacity: 0.99 }}
              />
            </View>
          ) : hlsUrl ? (
            <Video
              ref={videoRef}
              source={{ uri: hlsUrl }}
              style={styles.video}
              resizeMode="contain"
              controls={false}
              paused={paused}
              progressUpdateInterval={500}
              onProgress={(data) => {
                setCurrentTime(data.currentTime);
                if (data.seekableDuration > duration) {
                  setDuration(data.seekableDuration);
                }
              }}
              onLoad={(data) => {
                setDuration(data.duration || data.seekableDuration || 0);
              }}
              onError={(e) => {
                setVideoError(e?.error?.errorString || e?.error?.localizedDescription || 'Playback failed');
              }}
            />
          ) : null}

          {videoError ? (
            <Text style={styles.videoError}>{videoError}</Text>
          ) : null}

          {/* Custom Overlay Controls */}
          {(!loading && !error && (hlsUrl || youtubeVideoId)) && (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

              {/* Only show dim overlay and tapZone for HLS stream */}
              {videoSource !== 'YOUTUBE' && (
                <>
                  {controlsVisible ? (
                    <Animated.View
                      style={[styles.dimOverlay, { opacity: controlsOpacity }]}
                      pointerEvents="none"
                    />
                  ) : paused ? (
                    <View style={styles.dimOverlayPaused} pointerEvents="none" />
                  ) : null}

                  <Pressable
                    style={styles.tapZone}
                    onPress={handleVideoPress}
                  />
                </>
              )}

              {/* Landscape top bar (back + title) — only in landscape, fades with controls for HLS, always visible for YouTube */}
              {isLandscapeActive && (videoSource === 'YOUTUBE' || showMainOverlay) ? (
                <Animated.View
                  style={[
                    styles.landscapeTopBar,
                    { 
                      paddingTop: Math.max(insets.left, insets.right, 16), 
                      opacity: videoSource === 'YOUTUBE' ? 1 : controlsOpacity 
                    },
                  ]}
                >
                  <Pressable style={styles.landscapeBackBtn} onPress={videoSource === 'YOUTUBE' ? exitLandscape : exitLandscape} hitSlop={12}>
                    <Ionicons name="chevron-back" size={26} color={theme.white} />
                  </Pressable>
                  <Text style={styles.landscapeTitle} numberOfLines={1}>{title || 'Live stream'}</Text>
                </Animated.View>
              ) : null}

              {/* Center controls (seek ±10 + play/pause) — show on tap, hide after 3s — ONLY HLS */}
              {videoSource !== 'YOUTUBE' && showMainOverlay ? (
                <Animated.View
                  style={[styles.centerControlsWrap, { opacity: controlsOpacity }]}
                  pointerEvents={showMainOverlay ? 'box-none' : 'none'}
                >
                  <View style={styles.centerControls}>
                    <Pressable style={styles.ottSeekBtn} onPress={handleSkipBack} hitSlop={12}>
                      <MaterialCommunityIcons name="rewind" size={18} color="#fff" />
                      <Text style={styles.ottSeekText}>10</Text>
                    </Pressable>
                    <Pressable
                      style={styles.ottPlayPauseFab}
                      onPress={togglePlayPause}
                      hitSlop={16}
                    >
                      <Ionicons
                        name={paused ? 'play' : 'pause'}
                        size={38}
                        color="#fff"
                        style={paused ? styles.playIconNudge : undefined}
                      />
                    </Pressable>
                    <Pressable style={styles.ottSeekBtn} onPress={handleSkipForward} hitSlop={12}>
                      <Text style={styles.ottSeekText}>10</Text>
                      <MaterialCommunityIcons name="fast-forward" size={18} color="#fff" />
                    </Pressable>
                  </View>
                </Animated.View>
              ) : null}

              {/* Fullscreen button — ALWAYS visible, top-right */}
              <View
                style={[
                  styles.fullscreenBtnWrap,
                  isLandscapeActive
                    ? {
                        top: Math.max(insets.left, insets.right, 16),
                        right: Math.max(insets.right, 24),
                      }
                    : {
                        top: 4,
                        right: 12,
                      },
                ]}
              >
                <Pressable
                  style={styles.fullscreenBtn}
                  onPress={isLandscapeActive ? exitLandscape : enterLandscape}
                  hitSlop={12}
                >
                  <MaterialCommunityIcons
                    name={isLandscapeActive ? "fullscreen-exit" : "fullscreen"}
                    size={24}
                    color="#fff"
                  />
                </Pressable>
              </View>

              {/* Live progress bar — ALWAYS visible, raised above safe area — ONLY HLS */}
              {videoSource !== 'YOUTUBE' && (
                <View
                  style={[
                    styles.progressBarWrap,
                    isLandscapeActive
                      ? styles.progressBarWrapLandscape
                      : { bottom: Math.max(insets.bottom, 10) + 20 },
                  ]}
                  pointerEvents="box-none"
                >
                  <LiveProgressBar
                    isLandscape={isLandscapeActive}
                    currentTime={currentTime}
                    duration={duration}
                    paused={paused}
                    onSeek={(t) => {
                      if (videoRef.current) {
                        videoRef.current.seek(t);
                        setCurrentTime(t);
                      }
                    }}
                  />
                </View>
              )}
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.deepBlack },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  backBtn: { padding: 4 },
  titleWrap: { flex: 1, marginLeft: 8 },
  title: { color: theme.white, fontSize: 16, fontWeight: '700' },
  playerWrap: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  video: { width: '100%', height: '100%' },
  messageBox: { alignItems: 'center', justifyContent: 'center', flex: 1, padding: 24 },
  messageText: { color: theme.gray, fontSize: 14, marginTop: 12, textAlign: 'center' },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: theme.crimson,
    borderRadius: 8,
  },
  retryText: { color: theme.white, fontWeight: '600' },
  videoError: { position: 'absolute', top: 60, alignSelf: 'center', color: '#ff6b6b', fontSize: 12, padding: 12, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 8 },
  loadingShimmer: { flex: 1, backgroundColor: '#1A0020' },
  shimmerBox: { flex: 1, backgroundColor: '#2A0038', opacity: 0.5 },

  // Dim overlay (matches ottDim from ShortVideoReelItem)
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 1,
  },
  dimOverlayPaused: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
    zIndex: 1,
  },

  // Tap zone for toggling controls visibility
  tapZone: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },

  // Landscape top bar
  landscapeTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    zIndex: 10,
  },
  landscapeBackBtn: { padding: 4, marginRight: 12 },
  landscapeTitle: { color: theme.white, fontSize: 18, fontWeight: '700', flex: 1 },

  // Center controls wrapper (absolutely centered)
  centerControlsWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  centerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  ottSeekBtn: {
    minWidth: 58,
    height: 34,
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.26)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  ottSeekText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  ottPlayPauseFab: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  playIconNudge: {
    paddingLeft: 2,
  },

  // Fullscreen button — always visible, positioned top-right
  fullscreenBtnWrap: {
    position: 'absolute',
    zIndex: 20,
  },
  fullscreenBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },

  // Progress bar wrapper — always visible, raised above safe area
  progressBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
  },
  progressBarWrapLandscape: {
    bottom: 26,
    left: 44,
    right: 44,
  },
});
