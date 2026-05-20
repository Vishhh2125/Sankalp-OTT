import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../constants/theme';
import { useGuestAuth } from '../context/GuestAuthContext';

/**
 * Shared guest CTA: sign in / sign up to access app features.
 */
export default function GuestAccessPrompt({
  title = 'Sign in to continue',
  subtitle = 'Create an account to unlock episodes, save your list, and use your wallet.',
  primaryLabel = 'Sign Up',
  onPrimaryPress,
  showLoginLink = true,
  compact = false,
}) {
  const { openSignUp, openLogin } = useGuestAuth();

  const handlePrimary = onPrimaryPress ?? openSignUp;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.iconCircle}>
        <Ionicons name="person-circle-outline" size={compact ? 48 : 64} color={theme.crimson} />
      </View>
      <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <Pressable
        style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
        onPress={handlePrimary}
      >
        <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
      </Pressable>
      {showLoginLink ? (
        <Pressable onPress={openLogin} hitSlop={8}>
          <Text style={styles.loginLink}>
            Already have an account? <Text style={styles.loginLinkBold}>Sign in</Text>
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 24,
    gap: 12,
  },
  wrapCompact: {
    paddingVertical: 16,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,45,85,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    color: theme.white,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 18,
  },
  subtitle: {
    color: theme.gray,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 4,
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: theme.crimson,
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 28,
    minWidth: 200,
    alignItems: 'center',
  },
  primaryBtnPressed: {
    opacity: 0.85,
  },
  primaryBtnText: {
    color: theme.white,
    fontSize: 16,
    fontWeight: '700',
  },
  loginLink: {
    color: theme.gray,
    fontSize: 13,
    marginTop: 8,
  },
  loginLinkBold: {
    color: theme.crimson,
    fontWeight: '700',
  },
});
