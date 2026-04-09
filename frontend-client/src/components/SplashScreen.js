import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

/**
 * SplashScreen Component
 * 
 * Shown while the app is initializing auth (checking stored tokens, refreshing if needed).
 * Prevents flashing between screens during app startup.
 */

const SplashScreen = () => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});

export default SplashScreen;
