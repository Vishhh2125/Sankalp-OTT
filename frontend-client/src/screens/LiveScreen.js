import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../constants/theme';
import { ROUTES } from '../constants/routes';
import { fetchActiveLiveStreams } from '../components/live/liveApi';
import { useNetwork } from '../context/NetworkContext';

const POLL_MS = 15000;

export default function LiveScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { isOffline } = useNetwork();
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const data = await fetchActiveLiveStreams();
      setStreams(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load live streams');
      setStreams([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isFocused) return;

    load();
    const t = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(t);
  }, [isFocused, load]);

  const openViewer = (stream) => {
    navigation.navigate(ROUTES.LIVE_VIEWER, {
      streamId: stream.id,
      title: stream.title,
    });
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Live</Text>
          <Text style={styles.headerSub}>Watch streams happening now</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.crimson} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live</Text>
        <Text style={styles.headerSub}>Watch streams happening now</Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{isOffline ? 'You are offline' : error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={streams}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.crimson} />
        }
        contentContainerStyle={streams.length === 0 ? styles.emptyWrap : styles.list}
        ListEmptyComponent={
          !error ? (
            <View style={styles.empty}>
              <Ionicons name={isOffline ? "cloud-offline-outline" : "radio-outline"} size={48} color={theme.gray} />
              <Text style={styles.emptyTitle}>{isOffline ? 'You are offline' : 'No live streams right now'}</Text>
              <Text style={styles.emptySub}>{isOffline ? 'Check your internet connection and try again.' : 'Check back soon — new shows go live from the admin panel.'}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => openViewer(item)}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.creator?.name ? (
              <Text style={styles.cardSub}>Hosted by {item.creator.name}</Text>
            ) : null}
            <View style={styles.watchRow}>
              <Text style={styles.watchText}>Watch now</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.crimson} />
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.deepBlack },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  headerTitle: { color: theme.white, fontSize: 26, fontWeight: '800' },
  headerSub: { color: theme.gray, fontSize: 13, marginTop: 4, marginBottom: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { color: theme.white, fontSize: 17, fontWeight: '700', marginTop: 12 },
  emptySub: { color: theme.gray, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,45,85,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
    gap: 6,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.crimson },
  liveBadgeText: { color: theme.crimson, fontSize: 11, fontWeight: '800' },
  cardTitle: { color: theme.white, fontSize: 17, fontWeight: '700' },
  cardSub: { color: theme.gray, fontSize: 12, marginTop: 4 },
  watchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  watchText: { color: theme.crimson, fontWeight: '700', fontSize: 14 },
  errorBox: { padding: 16, alignItems: 'center' },
  errorText: { color: theme.white, fontSize: 14, textAlign: 'center' },
  retryBtn: { marginTop: 10, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.crimson, borderRadius: 8 },
  retryText: { color: theme.white, fontWeight: '600' },
});
