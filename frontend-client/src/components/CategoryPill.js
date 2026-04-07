import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { theme } from '../constants/theme';

export default function CategoryPill({ label, selected = false, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        selected && styles.pillSelected,
        pressed && !selected && styles.pillPressed,
      ]}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
  },
  pillSelected: {
    borderColor: theme.crimson,
    backgroundColor: theme.border,
  },
  pillPressed: {
    opacity: 0.85,
  },
  text: {
    color: theme.white,
    fontWeight: '700',
    fontSize: 13,
  },
  textSelected: {
    color: theme.blush,
  },
});

