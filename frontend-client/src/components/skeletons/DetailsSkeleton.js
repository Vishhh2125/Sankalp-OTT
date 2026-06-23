import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox } from './BaseSkeleton';

const DetailsSkeleton = memo(() => {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.poster}>
          <SkeletonBox width={100} height={140} radius={8} />
        </View>
        <View style={styles.heroInfo}>
          <SkeletonBox width="80%" height={24} radius={4} />
          <View style={{ height: 8 }} />
          <SkeletonBox width="60%" height={16} radius={4} />
          <View style={{ height: 16 }} />
          <SkeletonBox width="90%" height={12} radius={4} />
          <View style={{ height: 4 }} />
          <SkeletonBox width="85%" height={12} radius={4} />
          <View style={{ height: 4 }} />
          <SkeletonBox width="40%" height={12} radius={4} />
        </View>
      </View>

      <View style={styles.tabs}>
        <SkeletonBox width={100} height={32} radius={16} />
        <View style={{ width: 12 }} />
        <SkeletonBox width={100} height={32} radius={16} />
      </View>

      <View style={styles.episodes}>
        {[...Array(5)].map((_, i) => (
          <View key={i} style={styles.episodeRow}>
            <SkeletonBox width={40} height={40} radius={8} />
            <View style={styles.episodeInfo}>
              <SkeletonBox width={120} height={16} radius={4} />
              <View style={{ height: 6 }} />
              <SkeletonBox width={60} height={12} radius={4} />
            </View>
            <SkeletonBox width={24} height={24} radius={12} />
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  hero: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  poster: {
    marginRight: 16,
  },
  heroInfo: {
    flex: 1,
    paddingTop: 8,
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  episodes: {
    gap: 16,
  },
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  episodeInfo: {
    flex: 1,
    marginLeft: 12,
  },
});

export default DetailsSkeleton;
