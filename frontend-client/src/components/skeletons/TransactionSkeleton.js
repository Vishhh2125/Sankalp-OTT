import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox, SkeletonCircle } from './BaseSkeleton';
import { theme } from '../../constants/theme';

const TransactionSkeleton = memo(({ count = 5 }) => {
  return (
    <View style={styles.container}>
      <SkeletonBox width={120} height={16} radius={4} />
      <View style={{ height: 16 }} />
      {[...Array(count)].map((_, i) => (
        <View key={i} style={styles.row}>
          <SkeletonCircle size={44} />
          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <SkeletonBox width={120} height={16} radius={4} />
              <SkeletonBox width={40} height={16} radius={4} />
            </View>
            <View style={{ height: 8 }} />
            <SkeletonBox width={180} height={12} radius={4} />
            <View style={{ height: 12 }} />
            <View style={styles.rowFooter}>
              <SkeletonBox width={60} height={12} radius={4} />
              <SkeletonBox width={60} height={18} radius={4} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  rowBody: {
    flex: 1,
    marginLeft: 12,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});

export default TransactionSkeleton;
