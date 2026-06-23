import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Video from 'react-native-video';
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
  const { streamId, title } = route.params || {};

  const [hlsUrl, setHlsUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [videoError, setVideoError] = useState(null);
  
  const [controlsVisible, setControlsVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const hideControlsTimerRef = useRef(null);

  const { isLandscapeActive, enterLandscape, exitLandscape } = useLandscapePlayback({
    isActive: true,
    enabled: true,
  });

  // Viewer tracking session
  const viewerSessionId = useRef(null);

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
      setHlsUrl(data?.hls_url || null);
      if (!data?.hls_url) setError('Playback URL not available');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Stream unavailable');
      setHlsUrl(null);
    } finally {
      setLoading(false);
    }
  }, [streamId]);

  useEffect(() => {
    loadPlayUrl();
  }, [loadPlayUrl]);

  // Join stream after HLS URL is loaded, leave on unmount
  useEffect(() => {
    if (!hlsUrl || !streamId) return;

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
  }, [hlsUrl, streamId]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    Animated.timing(controlsOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }

    if (!paused) {
      hideControlsTimerRef.current = setTimeout(() => {
        Animated.timing(controlsOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setControlsVisible(false);
        });
      }, 3000);
    }
  }, [controlsOpacity, paused]);

  useEffect(() => {
    showControls();
    return () => {
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    };
  }, [showControls]);

  const handleVideoPress = () => {
    if (controlsVisible) {
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setControlsVisible(false);
      });
    } else {
      showControls();
    }
  };

  const togglePlayPause = () => {
    setPaused((p) => !p);
    showControls();
  };

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

      <TouchableWithoutFeedback onPress={handleVideoPress}>
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
          ) : hlsUrl ? (
            <Video
              source={{ uri: hlsUrl }}
              style={styles.video}
              resizeMode="contain"
              controls={false}
              paused={paused}
              onError={(e) => {
                setVideoError(e?.error?.errorString || e?.error?.localizedDescription || 'Playback failed');
              }}
            />
          ) : null}

          {videoError ? (
            <Text style={styles.videoError}>{videoError}</Text>
          ) : null}

          {/* Custom Overlay Controls */}
          {(!loading && !error && hlsUrl) && (
            <Animated.View 
              style={[
                styles.controlsOverlay, 
                { opacity: controlsOpacity },
                !controlsVisible && { pointerEvents: 'none' }
              ]}
            >
              {isLandscapeActive && (
                <View style={[styles.landscapeTopBar, { paddingTop: Math.max(insets.left, insets.right, 16) }]}>
                  <Pressable style={styles.landscapeBackBtn} onPress={exitLandscape} hitSlop={12}>
                    <Ionicons name="chevron-back" size={26} color={theme.white} />
                  </Pressable>
                  <Text style={styles.landscapeTitle} numberOfLines={1}>{title || 'Live stream'}</Text>
                </View>
              )}

              <View style={styles.centerControls}>
                <Pressable onPress={togglePlayPause} hitSlop={20} style={styles.playPauseBtn}>
                  <Ionicons name={paused ? "play" : "pause"} size={48} color="#fff" />
                </Pressable>
              </View>

              <View style={[styles.bottomControls, isLandscapeActive && styles.bottomControlsLandscape]}>
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
              
              <LiveProgressBar isLandscape={isLandscapeActive} />
            </Animated.View>
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
  
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  landscapeTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  landscapeBackBtn: { padding: 4, marginRight: 12 },
  landscapeTitle: { color: theme.white, fontSize: 18, fontWeight: '700', flex: 1 },
  centerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 48, // Above the progress bar
    right: 16,
  },
  bottomControlsLandscape: {
    bottom: 40,
    right: 44,
  },
  fullscreenBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
