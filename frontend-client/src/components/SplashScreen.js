import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';

/**
 * SplashScreen Component
 * 
 * Shown while the app is initializing auth (checking stored tokens, refreshing if needed).
 * Prevents flashing between screens during app startup.
 */

const SplashScreen = () => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.crimson} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.deepBlack,
  },
});

export default SplashScreen;

