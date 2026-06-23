import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Video from 'react-native-video';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../constants/theme';
import { fetchLivePlayUrl, joinStream, leaveStream } from '../components/live/liveApi';

export default function LiveViewerScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { streamId, title } = route.params || {};

  const [hlsUrl, setHlsUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [videoError, setVideoError] = useState(null);

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

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={theme.white} />
        </Pressable>
        <View style={styles.titleWrap}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.livePillText}>LIVE</Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>{title || 'Live stream'}</Text>
        </View>
      </View>

      <View style={styles.playerWrap}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.crimson} />
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
            controls
            paused={false}
            onError={(e) => {
              setVideoError(e?.error?.errorString || e?.error?.localizedDescription || 'Playback failed');
            }}
          />
        ) : null}
        {videoError ? (
          <Text style={styles.videoError}>{videoError}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.deepBlack },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  backBtn: { padding: 4 },
  titleWrap: { flex: 1, marginLeft: 4 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.crimson },
  livePillText: { color: theme.crimson, fontSize: 11, fontWeight: '800' },
  title: { color: theme.white, fontSize: 16, fontWeight: '700' },
  playerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  video: { width: '100%', height: '100%' },
  messageBox: { alignItems: 'center', padding: 24 },
  messageText: { color: theme.gray, fontSize: 14, marginTop: 12, textAlign: 'center' },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: theme.crimson,
    borderRadius: 8,
  },
  retryText: { color: theme.white, fontWeight: '600' },
  videoError: { color: '#ff6b6b', fontSize: 12, padding: 12, textAlign: 'center' },
});
