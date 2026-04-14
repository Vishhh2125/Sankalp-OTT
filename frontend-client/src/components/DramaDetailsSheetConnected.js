import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatCount } from './shortVideoPlayer/utils';
import { theme } from '../constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.9);
const EPISODE_GAP = 6;
const EPISODES_PER_PAGE = 30;

function Tag({ label }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

function getRangeStart(episodeNum = 1) {
  return Math.floor((Math.max(episodeNum, 1) - 1) / EPISODES_PER_PAGE) * EPISODES_PER_PAGE + 1;
}

function buildRanges(totalEpisodes) {
  const ranges = [];
  const safeTotal = Math.max(totalEpisodes || 0, 0);

  for (let start = 1; start <= safeTotal; start += EPISODES_PER_PAGE) {
    const end = Math.min(start + EPISODES_PER_PAGE - 1, safeTotal);
    ranges.push({
      key: `${start}-${end}`,
      start,
      label: `${start}-${end}`,
    });
  }

  return ranges;
}

function EpisodeCell({ episode, isCurrentEpisode, onPress }) {
  if (!episode) return null;

  const locked = episode.is_locked;
  const isReady = episode.status === 'ready';

  return (
    <Pressable
      style={[
        styles.episodeCell,
        locked && styles.episodeCellLocked,
        isCurrentEpisode && styles.episodeCellActive,
        !isReady && styles.episodeCellPending,
      ]}
      onPress={() => onPress && onPress(episode)}
      disabled={!onPress}
    >
      <Text style={styles.episodeNumber}>{episode.episode_num}</Text>
      {locked ? (
        <Ionicons
          name="lock-closed"
          size={15}
          color="rgba(255,255,255,0.6)"
          style={styles.lockIcon}
        />
      ) : null}
    </Pressable>
  );
}

export default function DramaDetailsSheetConnected({
  visible,
  item,
  details = null,
  loading = false,
  error = null,
  initialTab = 'synopsis',
  onClose,
  onRangeChange,
  onEpisodePress,
}) {
  // All hooks must be called unconditionally, before any returns
  const [tab, setTab] = useState(initialTab);
  const [activeRangeStart, setActiveRangeStart] = useState(1);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!visible || !item) return;

    setTab(initialTab);
    setActiveRangeStart(getRangeStart(item.episode_num || 1));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [visible, initialTab, item]);

  // Move useMemo BEFORE the early return
  const posterSource = useMemo(() => {
    if (!item) return null;
    if (details?.show_id === item.show_id && details?.thumbnail_url) {
      return { uri: details.thumbnail_url };
    }
    if (item.thumbnail_url) return { uri: item.thumbnail_url };
    if (item.image) return item.image;
    return null;
  }, [details?.thumbnail_url, item?.thumbnail_url, item?.image, item?.show_id, details?.show_id]);

  // Now safe to return early if no item
  if (!item) return null;

  const showDetails = details?.show_id === item.show_id ? details : null;
  const title = showDetails?.show_title || item.show_title || item.title || 'Untitled drama';
  const synopsisText = showDetails?.synopsis || item.synopsis || 'Synopsis not available yet.';
  const tags = showDetails?.tags || item.tags || [];
  const totalEpisodes = showDetails?.total_episodes || item.total_episodes || item.episodeCount || 0;
  const ranges = buildRanges(totalEpisodes);
  const currentEpisode = item.episode_num || 1;
  const currentEpisodes = showDetails?.episodes || [];

  const viewCountValue = showDetails?.view_count ?? item.view_count ?? null;
  const ratingAvg = showDetails?.rating_avg ?? item.rating_avg ?? null;
  const ratingCount = showDetails?.rating_count ?? item.rating_count ?? null;

  const viewsLabel = item.views
    ? `${item.views} Views`
    : viewCountValue !== null
      ? `${formatCount(viewCountValue)} Views`
      : null;

  const ratingLabel = ratingAvg !== null && ratingCount !== null
    ? `${Number(ratingAvg).toFixed(1)}(${formatCount(ratingCount)})`
    : null;

  const handleRangePress = (rangeStart) => {
    setActiveRangeStart(rangeStart);
    scrollRef.current?.scrollTo({ y: 0, animated: true });

    if (rangeStart !== activeRangeStart) {
      onRangeChange && onRangeChange(rangeStart);
    }
  };

  const handleRetry = () => {
    onRangeChange && onRangeChange(activeRangeStart);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdropWrap}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.topRow}>
            <View style={styles.posterRow}>
              {posterSource ? (
                <Image source={posterSource} style={styles.poster} resizeMode="cover" />
              ) : (
                <View style={[styles.poster, styles.posterFallback]} />
              )}
              <View style={styles.posterMeta}>
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
                {viewsLabel ? (
                  <Text style={styles.metaText}>{viewsLabel}</Text>
                ) : null}
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={14} color={theme.gold} />
                  <Text style={styles.metaText}>{ratingLabel || 'Rate this drama'}</Text>
                  <Text style={styles.metaLink}>Rate {'>'}</Text>
                </View>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={15}>
              <Ionicons name="close" size={26} color={theme.white} />
            </Pressable>
          </View>

          <View style={styles.tabsRow}>
            <Pressable onPress={() => setTab('synopsis')} style={styles.tabBtn}>
              <Text style={[styles.tabText, tab === 'synopsis' && styles.tabTextActive]}>
                Synopsis
              </Text>
              {tab === 'synopsis' && <View style={styles.tabUnderline} />}
            </Pressable>
            <Pressable onPress={() => setTab('episodes')} style={styles.tabBtn}>
              <Text style={[styles.tabText, tab === 'episodes' && styles.tabTextActive]}>
                Episodes
              </Text>
              {tab === 'episodes' && <View style={styles.tabUnderline} />}
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            {tab === 'synopsis' ? (
              <View>
                <Text style={styles.sectionTitle}>Synopsis</Text>
                <Text style={styles.synopsis}>{synopsisText}</Text>
                {tags.length > 0 ? (
                  <View style={styles.tagsRow}>
                    {tags.map((tag) => (
                      <Tag key={tag} label={tag} />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : (
              <View>
                {ranges.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.rangeRow}
                  >
                    {ranges.map((range) => (
                      <Pressable key={range.key} onPress={() => handleRangePress(range.start)}>
                        <Text style={[styles.rangeText, activeRangeStart === range.start && styles.rangeTextActive]}>
                          {range.label}
                        </Text>
                        {activeRangeStart === range.start && <View style={styles.rangeUnderline} />}
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}

                {loading ? (
                  <View style={styles.stateBlock}>
                    <ActivityIndicator size="small" color={theme.white} />
                    <Text style={styles.stateText}>Loading episodes...</Text>
                  </View>
                ) : error ? (
                  <View style={styles.stateBlock}>
                    <Text style={styles.stateText}>{error}</Text>
                    <Pressable style={styles.retryButton} onPress={handleRetry}>
                      <Text style={styles.retryButtonText}>Try again</Text>
                    </Pressable>
                  </View>
                ) : currentEpisodes.length > 0 ? (
                  <View style={styles.episodesGrid}>
                    {currentEpisodes.map((episode) => (
                      <EpisodeCell
                        key={episode.episode_id}
                        episode={episode}
                        isCurrentEpisode={episode.episode_num === currentEpisode}
                        onPress={onEpisodePress}
                      />
                    ))}
                  </View>
                ) : (
                  <View style={styles.stateBlock}>
                    <Text style={styles.stateText}>No episodes available yet.</Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: theme.deepBlack,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  posterRow: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  poster: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: theme.surface,
  },
  posterFallback: {
    borderWidth: 1,
    borderColor: theme.border,
  },
  posterMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: theme.white,
    fontSize: 18,
    fontWeight: '800',
  },
  metaText: {
    color: theme.gray,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  metaLink: {
    color: theme.white,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tabBtn: {
    paddingVertical: 12,
  },
  tabText: {
    color: theme.gray,
    fontSize: 16,
    fontWeight: '700',
  },
  tabTextActive: {
    color: theme.white,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: theme.white,
    borderRadius: 2,
  },
  content: {
    paddingTop: 18,
    paddingBottom: 50,
  },
  sectionTitle: {
    color: theme.white,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  synopsis: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    lineHeight: 22,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  tagText: {
    color: theme.gray,
    fontSize: 11,
    fontWeight: '600',
  },
  rangeRow: {
    gap: 24,
    marginBottom: 16,
  },
  rangeText: {
    color: theme.gray,
    fontSize: 14,
    fontWeight: '700',
  },
  rangeTextActive: {
    color: theme.white,
  },
  rangeUnderline: {
    marginTop: 4,
    height: 2,
    backgroundColor: theme.white,
    width: '100%',
  },
  episodesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: EPISODE_GAP,
  },
  episodeCell: {
    width: '15.2%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  episodeCellLocked: {
    backgroundColor: '#23002A',
  },
  episodeCellActive: {
    borderColor: theme.crimson,
    shadowColor: theme.crimson,
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  episodeCellPending: {
    opacity: 0.65,
  },
  episodeNumber: {
    color: theme.white,
    fontWeight: '900',
    fontSize: 16,
  },
  lockIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  stateBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  stateText: {
    color: theme.gray,
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  retryButtonText: {
    color: theme.white,
    fontSize: 13,
    fontWeight: '700',
  },
});
