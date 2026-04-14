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

export default function DramaDetailsSheet({
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
  const [tab, setTab] = useState(initialTab);
  const [activeRangeStart, setActiveRangeStart] = useState(1);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!visible || !item) return;

    setTab(initialTab);
    setActiveRangeStart(getRangeStart(item.episode_num || 1));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [visible, initialTab, item]);

  const synopsisText =
    item?.synopsis ||
    'In a world where loyalty clashes with temptation, a rebellious heir and his alluring new stepsister navigate dangerous power struggles, family betrayals, and a forbidden romance—risking everything to protect their secrets and each other.';

  const tags = item?.tags || ['Rebellious', 'Forbidden Love', 'Step-Siblings', 'Modern'];

  const allEpisodes = useMemo(() => {
    const max = item?.episodeCount || 57;
    const list = [];
    for (let i = 1; i <= max; i++) list.push(i);
    return list;
  }, [item]);

  const scrollToRange = (rangeKey) => {
    setRange(rangeKey);
    if (rangeKey === '1-30') {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      // 30 episodes / 6 columns = 5 full rows.
      // Each row is approx 65px (cell height + gap)
      scrollRef.current?.scrollTo({ y: 320, animated: true }); 
    }
  };

  if (!item) return null;

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
          {/* Header */}
          <View style={styles.topRow}>
            <View style={styles.posterRow}>
              <Image source={item.image} style={styles.poster} resizeMode="cover" />
              <View style={styles.posterMeta}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.metaText}>{item.views} Views</Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={14} color={theme.gold} />
                  <Text style={styles.metaText}>4.8(20.1K)</Text>
                  <Text style={styles.metaLink}>Rate {'>'}</Text>
                </View>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={15}>
              <Ionicons name="close" size={26} color={theme.white} />
            </Pressable>
          </View>

          {/* Tabs */}
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
                <View style={styles.tagsRow}>
                  {tags.map((t) => (
                    <Tag key={t} label={t} />
                  ))}
                </View>
              </View>
            ) : (
              <View>
                <View style={styles.rangeRow}>
                  <Pressable onPress={() => scrollToRange('1-30')}>
                    <Text style={[styles.rangeText, range === '1-30' && styles.rangeTextActive]}>
                      1-30
                    </Text>
                    {range === '1-30' && <View style={styles.rangeUnderline} />}
                  </Pressable>
                  <Pressable onPress={() => scrollToRange('31-57')}>
                    <Text style={[styles.rangeText, range === '31-57' && styles.rangeTextActive]}>
                      31-57
                    </Text>
                    {range === '31-57' && <View style={styles.rangeUnderline} />}
                  </Pressable>
                </View>

                <View style={styles.episodesGrid}>
                  {allEpisodes.map((n) => {
                    const unlockedUntil = item?.unlockedUntil ?? 2;
                    const locked = n > unlockedUntil;
                    return <EpisodeCell key={n} number={n} locked={locked} />;
                  })}
                </View>
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
    paddingHorizontal: 16, // Reduced slightly for more grid space
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
    flexDirection: 'row',
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
    gap: EPISODE_GAP, // Very thin margin
  },
  episodeCell: {
    width: '15.2%', // Fits exactly 6 per row with 6px gaps
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2, // Vertical gap
  },
  episodeNumber: {
    color: theme.white,
    fontWeight: '900',
    fontSize: 16, // Bigger text
  },
  lockIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
});
