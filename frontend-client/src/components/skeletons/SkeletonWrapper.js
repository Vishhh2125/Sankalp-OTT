import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { theme } from '../../constants/theme';

export default function SkeletonWrapper({ 
  loading, 
  error, 
  skeleton, 
  children, 
  onRetry 
}) {
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        {onRetry && (
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // If loading and we have a skeleton, show the skeleton.
  // Note: If you want to keep showing existing content during background refresh,
  // you should pass `loading={false}` when `isRefreshing={true}` in the screen.
  if (loading) {
    return skeleton;
  }

  return children;
}

const styles = StyleSheet.create({
  errorContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: theme.crimson,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
  },
});
