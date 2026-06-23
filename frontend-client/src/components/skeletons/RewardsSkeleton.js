import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox, SkeletonCircle } from './BaseSkeleton';
import { theme } from '../../constants/theme';

const RewardsSkeleton = memo(() => {
  return (
    <View style={styles.container}>
      <View style={styles.balanceCard}>
        <SkeletonBox width={100} height={16} radius={4} />
        <View style={{ height: 12 }} />
        <View style={styles.balanceRow}>
          <SkeletonCircle size={28} />
          <SkeletonBox width={80} height={36} radius={8} />
          <SkeletonBox width={40} height={16} radius={4} />
        </View>
      </View>

      <SkeletonBox width={200} height={24} radius={6} />
      <View style={{ height: 12 }} />
      <SkeletonBox width="100%" height={16} radius={4} />
      <View style={{ height: 6 }} />
      <SkeletonBox width="80%" height={16} radius={4} />
      <View style={{ height: 24 }} />

      <View style={styles.grid}>
        {[...Array(7)].map((_, i) => (
          <View key={i} style={styles.dayCard}>
            <SkeletonBox width={40} height={12} radius={4} />
            <View style={{ height: 12 }} />
            <SkeletonBox width={50} height={20} radius={4} />
            <View style={{ height: 12 }} />
            <SkeletonCircle size={20} />
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
  balanceCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 24,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  dayCard: {
    width: '30%',
    minWidth: 100,
    flexGrow: 1,
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
  },
});

export default RewardsSkeleton;
