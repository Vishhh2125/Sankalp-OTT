import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox, SkeletonCircle } from './BaseSkeleton';
import { theme } from '../../constants/theme';

const PlanCardSkeleton = memo(({ count = 3 }) => {
  return (
    <View style={styles.container}>
      {[...Array(count)].map((_, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.left}>
            <SkeletonCircle size={44} />
            <View style={styles.info}>
              <SkeletonBox width={140} height={18} radius={4} />
              <View style={{ height: 8 }} />
              <SkeletonBox width={100} height={14} radius={4} />
              <View style={{ height: 8 }} />
              <SkeletonBox width={80} height={12} radius={4} />
            </View>
          </View>
          <View style={styles.right}>
            <SkeletonBox width={24} height={24} radius={12} />
          </View>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  info: {
    marginLeft: 12,
  },
  right: {
    alignItems: 'flex-end',
  },
});

export default PlanCardSkeleton;
