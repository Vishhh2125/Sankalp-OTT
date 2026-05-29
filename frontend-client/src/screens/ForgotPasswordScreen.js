import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';

import { theme } from '../constants/theme';
import { ROUTES } from '../constants/routes';
import {
  clearForgotPasswordState,
  requestForgotPassword,
} from '../redux/slices/authSlice';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [localError, setLocalError] = useState('');

  const dispatch = useDispatch();
  const forgotState = useSelector((state) => state.auth.forgotPassword);

  useEffect(() => {
    if (forgotState.status === 'succeeded' && forgotState.data?.sessionId) {
      navigation.navigate(ROUTES.RESET_PASSWORD, forgotState.data);
      dispatch(clearForgotPasswordState());
    }
  }, [dispatch, forgotState.data, forgotState.status, navigation]);

  const handleContinue = () => {
    const nextEmail = email.trim();

    if (!nextEmail) {
      setLocalError('Please enter your email.');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(nextEmail)) {
      setLocalError('Please enter a valid email address.');
      return;
    }

    setLocalError('');
    dispatch(requestForgotPassword({ email: nextEmail }));
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="always"
    >
      <View style={styles.logoRow}>
        <View style={styles.logoIcon}>
          <Ionicons name="play" size={16} color={theme.white} />
        </View>
        <Text style={styles.logoText}>
          7<Text style={styles.logoCrimson}>K</Text>
        </Text>
      </View>

      <Text style={styles.title}>Reset password</Text>
      <Text style={styles.subtitle}>
        Enter the email linked to your account. We will send you a verification code.
      </Text>

      <Text style={styles.label}>EMAIL</Text>
      <TextInput
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          if (localError) setLocalError('');
        }}
        placeholder="user@example.com"
        style={[styles.input, email.length > 0 && styles.inputActive]}
        placeholderTextColor={theme.darkGray}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Pressable
        style={({ pressed }) => [
          styles.actionBtn,
          pressed && styles.actionBtnPressed,
          forgotState.isLoading && { opacity: 0.6 },
        ]}
        onPress={handleContinue}
        disabled={forgotState.isLoading}
      >
        <Text style={styles.actionBtnText}>
          {forgotState.isLoading ? 'Sending code...' : 'Send verification code'}
        </Text>
      </Pressable>

      {!!localError && <Text style={styles.errorText}>{localError}</Text>}
      {!!forgotState.error && <Text style={styles.errorText}>{forgotState.error}</Text>}

      <Pressable style={styles.backLink} onPress={() => navigation.navigate(ROUTES.LOGIN)}>
        <Text style={styles.backLinkText}>Back to sign in</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: theme.deepBlack,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 36,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.crimson,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.white,
  },
  logoCrimson: {
    color: theme.crimson,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.white,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: theme.gray,
    marginBottom: 36,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.gray,
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: theme.white,
    fontSize: 15,
  },
  inputActive: {
    borderColor: theme.crimson,
  },
  actionBtn: {
    backgroundColor: theme.crimson,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  actionBtnPressed: {
    opacity: 0.85,
  },
  actionBtnText: {
    color: theme.white,
    fontSize: 17,
    fontWeight: '700',
  },
  errorText: {
    color: theme.red,
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  backLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  backLinkText: {
    color: theme.crimson,
    fontSize: 14,
    fontWeight: '700',
  },
});
