import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox } from './BaseSkeleton';

export const CardSkeleton = memo(() => {
  return (
    <View style={styles.cardContainer}>
      <SkeletonBox width={140} height={200} radius={12} />
      <View style={styles.content}>
        <SkeletonBox width="80%" height={16} radius={4} />
        <View style={{ height: 12 }} />
        <SkeletonBox width="60%" height={12} radius={4} />
        <View style={{ height: 8 }} />
        <SkeletonBox width="50%" height={12} radius={4} />
        <View style={{ height: 16 }} />
        <SkeletonBox width={80} height={28} radius={14} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 16,
  },
  content: {
    flex: 1,
    paddingVertical: 12,
  },
});
