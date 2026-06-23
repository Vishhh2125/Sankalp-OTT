import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { CardSkeleton } from './CardSkeleton';

const ListSkeleton = memo(({ count = 5 }) => {
  return (
    <View style={styles.container}>
      {[...Array(count)].map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
});

export default ListSkeleton;
