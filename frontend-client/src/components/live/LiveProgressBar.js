import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { theme } from '../../constants/theme';

export default function LiveProgressBar({ isLandscape }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <View style={[styles.container, isLandscape && styles.containerLandscape]}>
      <View style={styles.badgeContainer}>
        <Animated.View style={[styles.dot, { opacity: pulseAnim }]} />
        <Text style={styles.badgeText}>LIVE</Text>
      </View>
      <View style={styles.barContainer}>
        <View style={styles.bar} />
        <View style={styles.playhead} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 44,
    justifyContent: 'flex-end',
    paddingBottom: 2, // Space from bottom
  },
  containerLandscape: {
    bottom: 16,
    left: 44,
    right: 44,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginRight: 2,
    marginBottom: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.crimson,
    marginRight: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  barContainer: {
    width: '100%',
    height: 12, // Hit area
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: theme.crimson,
  },
  playhead: {
    position: 'absolute',
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.crimson,
  },
});
