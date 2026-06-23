import React, { memo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { SkeletonBox } from './BaseSkeleton';

const GridSkeleton = memo(() => {
  const { width } = useWindowDimensions();
  const numColumns = 3;
  const padding = 16;
  const gap = 12;
  const availableWidth = width - padding * 2 - gap * (numColumns - 1);
  const cardWidth = Math.floor(availableWidth / numColumns);
  const cardHeight = cardWidth * 1.5;

  const renderCell = (index) => (
    <View key={index} style={styles.card}>
      <SkeletonBox width={cardWidth} height={cardHeight} radius={8} />
      <View style={styles.textContainer}>
        <SkeletonBox width={cardWidth * 0.8} height={12} radius={4} />
        <View style={{ height: 6 }} />
        <SkeletonBox width={cardWidth * 0.5} height={10} radius={4} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {[...Array(9)].map((_, i) => renderCell(i))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  card: {
    marginBottom: 8,
  },
  textContainer: {
    marginTop: 8,
  },
});

export default GridSkeleton;
