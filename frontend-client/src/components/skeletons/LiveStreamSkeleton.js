import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox, SkeletonCircle } from './BaseSkeleton';
import { theme } from '../../constants/theme';

const LiveStreamSkeleton = memo(({ count = 3 }) => {
  return (
    <View style={styles.container}>
      {[...Array(count)].map((_, i) => (
        <View key={i} style={styles.card}>
          <SkeletonBox width={60} height={24} radius={6} />
          <View style={{ height: 10 }} />
          <SkeletonBox width="70%" height={20} radius={4} />
          <View style={{ height: 6 }} />
          <SkeletonBox width="40%" height={14} radius={4} />
          <View style={styles.watchRow}>
            <SkeletonBox width={80} height={16} radius={4} />
            <SkeletonCircle size={18} />
          </View>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  watchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
});

export default LiveStreamSkeleton;
