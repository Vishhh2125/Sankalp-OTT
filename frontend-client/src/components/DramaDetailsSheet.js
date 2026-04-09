import React, { useMemo, useState } from 'react';
import {
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

import { theme } from '../constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.9);

function Tag({ label }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

function EpisodeCell({ number, locked }) {
  return (
    <View style={styles.episodeCell}>
      <Text style={styles.episodeNumber}>{number}</Text>
      {locked ? (
        <Ionicons
          name="lock-closed"
          size={14}
          color="rgba(255,255,255,0.7)"
          style={styles.lockIcon}
        />
      ) : null}
    </View>
  );
}

export default function DramaDetailsSheet({ visible, item, onClose }) {
  const [tab, setTab] = useState('synopsis'); // synopsis | episodes
  const [range, setRange] = useState('1-30'); // 1-30 | 31-57

  const synopsisText =
    item?.synopsis ||
    'In a world where loyalty clashes with temptation, a rebellious heir and his alluring new stepsister navigate dangerous power struggles, family betrayals, and a forbidden romance—risking everything to protect their secrets and each other.';

  const tags = item?.tags || ['Rebellious', 'Forbidden Love', 'Step-Siblings', 'Modern'];

  const episodes = useMemo(() => {
    const max = item?.episodeCount || 57;
    const start = range === '1-30' ? 1 : 31;
    const end = range === '1-30' ? Math.min(30, max) : max;
    const list = [];
    for (let i = start; i <= end; i++) list.push(i);
    return list;
  }, [item, range]);

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
          {/* Top area */}
          <View style={styles.topRow}>
            <View style={styles.posterRow}>
              <Image source={item.image} style={styles.poster} />
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
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={theme.white} />
            </Pressable>
          </View>

          {/* Tabs */}
          <View style={styles.tabsRow}>
            <Pressable onPress={() => setTab('synopsis')} style={styles.tabBtn}>
              <Text style={[styles.tabText, tab === 'synopsis' && styles.tabTextActive]}>
                Synopsis
              </Text>
              {tab === 'synopsis' ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
            <Pressable onPress={() => setTab('episodes')} style={styles.tabBtn}>
              <Text style={[styles.tabText, tab === 'episodes' && styles.tabTextActive]}>
                Episodes
              </Text>
              {tab === 'episodes' ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {tab === 'synopsis' ? (
              <>
                <Text style={styles.sectionTitle}>Synopsis</Text>
                <Text style={styles.synopsis}>{synopsisText}</Text>

                <View style={styles.tagsRow}>
                  {tags.map((t) => (
                    <Tag key={t} label={t} />
                  ))}
                </View>

                <Text style={styles.sectionTitle}>Cast</Text>
                <View style={styles.castRow}>
                  <View style={styles.castAvatar} />
                  <Text style={styles.castName}>Aliza Kate Barlow</Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.gray} />
                </View>
                <View style={styles.castRow}>
                  <View style={styles.castAvatar} />
                  <Text style={styles.castName}>Shayne Davis</Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.gray} />
                </View>
              </>
            ) : (
              <>
                <View style={styles.rangeRow}>
                  <Pressable onPress={() => setRange('1-30')}>
                    <Text style={[styles.rangeText, range === '1-30' && styles.rangeTextActive]}>
                      1-30
                    </Text>
                    {range === '1-30' ? <View style={styles.rangeUnderline} /> : null}
                  </Pressable>
                  <Pressable onPress={() => setRange('31-57')}>
                    <Text style={[styles.rangeText, range === '31-57' && styles.rangeTextActive]}>
                      31-57
                    </Text>
                    {range === '31-57' ? <View style={styles.rangeUnderline} /> : null}
                  </Pressable>
                </View>

                <View style={styles.episodesGrid}>
                  {episodes.map((n) => {
                    const unlockedUntil = item?.unlockedUntil ?? 2; // demo
                    const locked = n > unlockedUntil;
                    return <EpisodeCell key={n} number={n} locked={locked} />;
                  })}
                </View>
              </>
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
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: theme.deepBlack,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  posterRow: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  poster: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: theme.surface,
  },
  posterMeta: {
    flex: 1,
  },
  title: {
    color: theme.white,
    fontSize: 16,
    fontWeight: '800',
  },
  metaText: {
    marginTop: 3,
    color: theme.gray,
    fontSize: 12,
    fontWeight: '600',
  },
  ratingRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLink: {
    color: theme.white,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 6,
    marginBottom: 6,
  },
  tabBtn: {
    paddingVertical: 8,
  },
  tabText: {
    color: theme.gray,
    fontSize: 16,
    fontWeight: '800',
  },
  tabTextActive: {
    color: theme.white,
  },
  tabUnderline: {
    marginTop: 8,
    width: 34,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.white,
  },
  content: {
    paddingTop: 10,
    paddingBottom: 28,
  },
  sectionTitle: {
    color: theme.white,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 6,
    marginBottom: 10,
  },
  synopsis: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    lineHeight: 19,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    marginBottom: 18,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  tagText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '700',
  },
  castRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  castAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  castName: {
    flex: 1,
    color: theme.white,
    fontSize: 14,
    fontWeight: '700',
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 22,
    marginBottom: 14,
    marginTop: 4,
  },
  rangeText: {
    color: theme.gray,
    fontSize: 14,
    fontWeight: '800',
  },
  rangeTextActive: {
    color: theme.white,
  },
  rangeUnderline: {
    marginTop: 8,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.white,
  },
  episodesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  episodeCell: {
    width: '14.7%', // ~6 columns with gaps
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  episodeNumber: {
    color: theme.white,
    fontWeight: '900',
  },
  lockIcon: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
});

