import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox, SkeletonCircle } from './BaseSkeleton';
import { theme } from '../../constants/theme';

const ProfileSkeleton = memo(() => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <SkeletonCircle size={50} />
          <View>
            <SkeletonBox width={120} height={20} radius={4} />
            <View style={{ height: 6 }} />
            <SkeletonBox width={80} height={14} radius={4} />
          </View>
        </View>
        <SkeletonBox width={60} height={28} radius={14} />
      </View>

      <View style={styles.banner}>
        <SkeletonBox width="100%" height={100} radius={16} />
      </View>

      <View style={styles.menuCard}>
        {[...Array(4)].map((_, i) => (
          <View key={i} style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <SkeletonCircle size={20} />
              <SkeletonBox width={100} height={16} radius={4} />
            </View>
            <SkeletonBox width={16} height={16} radius={4} />
          </View>
        ))}
      </View>

      <View style={styles.menuCard}>
        {[...Array(2)].map((_, i) => (
          <View key={i} style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <SkeletonCircle size={20} />
              <SkeletonBox width={100} height={16} radius={4} />
            </View>
            <SkeletonBox width={16} height={16} radius={4} />
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  banner: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  menuCard: {
    marginHorizontal: 16,
    backgroundColor: theme.surface,
    borderRadius: 16,
    paddingVertical: 4,
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});

export default ProfileSkeleton;
