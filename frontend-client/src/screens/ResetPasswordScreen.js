import React, { useEffect, useMemo, useState } from 'react';
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
  clearPasswordResetState,
  resendForgotOtp,
  resetPasswordWithOtp,
} from '../redux/slices/authSlice';

function formatCountdown(targetValue, fallbackNow = Date.now()) {
  if (!targetValue) return '';

  const target = new Date(targetValue).getTime();
  const remaining = target - fallbackNow;

  if (Number.isNaN(target) || remaining <= 0) {
    return 'Expired';
  }

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }

  return `${seconds}s`;
}

export default function ResetPasswordScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const resetState = useSelector((state) => state.auth.passwordReset);
  const pendingPasswordReset = useSelector(
    (state) => state.auth.pendingPasswordReset
  );

  const sessionData = {
    ...(route?.params || {}),
    ...(pendingPasswordReset || {}),
  };

  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [now, setNow] = useState(Date.now());

  const sessionId = sessionData.sessionId;
  const email = sessionData.email || '';
  const otpExpiresAt = sessionData.otpExpiresAt || sessionData.otp_expires_at;
  const expiresAt = sessionData.expiresAt || sessionData.expires_at;
  const nextResendAt = sessionData.nextResendAt || sessionData.next_resend_at;
  const remainingResends =
    sessionData.remainingResends ?? sessionData.remaining_resends;

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      navigation.navigate(ROUTES.FORGOT_PASSWORD);
    }
  }, [navigation, sessionId]);

  useEffect(() => {
    if (resetState.status === 'succeeded') {
      dispatch(clearPasswordResetState());
      navigation.reset({
        index: 0,
        routes: [{ name: ROUTES.LOGIN }],
      });
    }
  }, [dispatch, navigation, resetState.status]);

  const otpExpiryLabel = useMemo(
    () => formatCountdown(otpExpiresAt, now),
    [now, otpExpiresAt]
  );

  const sessionExpiryLabel = useMemo(
    () => formatCountdown(expiresAt, now),
    [expiresAt, now]
  );

  const resendCooldownLabel = useMemo(() => {
    if (!nextResendAt) return '';
    const target = new Date(nextResendAt).getTime();
    const remaining = target - now;
    if (Number.isNaN(target) || remaining <= 0) return '';

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    if (minutes > 0) {
      return `Resend available in ${minutes}m ${String(seconds).padStart(2, '0')}s`;
    }

    return `Resend available in ${seconds}s`;
  }, [nextResendAt, now]);

  const isResendLocked = useMemo(() => {
    if (!nextResendAt) return false;
    return new Date(nextResendAt).getTime() > now;
  }, [nextResendAt, now]);

  const handleReset = () => {
    const trimmedOtp = otp.trim();

    if (!sessionId) {
      setLocalError('Reset session missing. Please start again.');
      return;
    }

    if (!trimmedOtp || trimmedOtp.length !== 6 || !/^\d+$/.test(trimmedOtp)) {
      setLocalError('Please enter a valid 6-digit code.');
      return;
    }

    if (!newPassword) {
      setLocalError('Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    setLocalError('');
    dispatch(
      resetPasswordWithOtp({
        sessionId,
        otp: trimmedOtp,
        newPassword,
      })
    );
  };

  const handleResend = () => {
    if (!sessionId) {
      setLocalError('Reset session missing. Please start again.');
      return;
    }

    if (isResendLocked) return;

    setLocalError('');
    dispatch(resendForgotOtp({ sessionId }));
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

      <Text style={styles.title}>Set new password</Text>
      <Text style={styles.subtitle}>
        Enter the 6-digit code sent to {email || 'your email'} and choose a new password.
      </Text>

      <Text style={styles.label}>OTP CODE</Text>
      <TextInput
        value={otp}
        onChangeText={(value) => {
          setOtp(value.replace(/\D/g, '').slice(0, 6));
          if (localError) setLocalError('');
        }}
        placeholder="000000"
        style={[styles.input, styles.otpInput]}
        placeholderTextColor={theme.darkGray}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
      />

      <Text style={[styles.label, { marginTop: 20 }]}>NEW PASSWORD</Text>
      <View style={styles.passwordWrap}>
        <TextInput
          value={newPassword}
          onChangeText={(value) => {
            setNewPassword(value);
            if (localError) setLocalError('');
          }}
          placeholder="••••••••"
          style={[styles.input, styles.passwordInput]}
          placeholderTextColor={theme.darkGray}
          secureTextEntry={!showPassword}
        />
        <Pressable
          style={styles.eyeBtn}
          onPress={() => setShowPassword((prev) => !prev)}
        >
          <Ionicons
            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={theme.gray}
          />
        </Pressable>
      </View>

      <Text style={[styles.label, { marginTop: 20 }]}>CONFIRM PASSWORD</Text>
      <TextInput
        value={confirmPassword}
        onChangeText={(value) => {
          setConfirmPassword(value);
          if (localError) setLocalError('');
        }}
        placeholder="••••••••"
        style={styles.input}
        placeholderTextColor={theme.darkGray}
        secureTextEntry={!showPassword}
      />

      <View style={styles.metaBlock}>
        {!!otpExpiresAt && (
          <Text style={styles.metaText}>Code expires in {otpExpiryLabel}</Text>
        )}
        {!!expiresAt && (
          <Text style={styles.metaText}>Session expires in {sessionExpiryLabel}</Text>
        )}
        {remainingResends !== undefined && remainingResends !== null && (
          <Text style={styles.metaText}>Remaining resends: {remainingResends}</Text>
        )}
        {!!resendCooldownLabel && (
          <Text style={styles.metaText}>{resendCooldownLabel}</Text>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.actionBtn,
          pressed && styles.actionBtnPressed,
          resetState.isLoading && { opacity: 0.6 },
        ]}
        onPress={handleReset}
        disabled={resetState.isLoading}
      >
        <Text style={styles.actionBtnText}>
          {resetState.isLoading ? 'Updating password...' : 'Reset password'}
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.secondaryBtn,
          pressed && styles.secondaryBtnPressed,
          (resetState.isResending || isResendLocked) && { opacity: 0.6 },
        ]}
        onPress={handleResend}
        disabled={resetState.isResending || isResendLocked}
      >
        <Text style={styles.secondaryBtnText}>
          {resetState.isResending ? 'Sending new code...' : 'Resend code'}
        </Text>
      </Pressable>

      {!!localError && <Text style={styles.errorText}>{localError}</Text>}
      {!!resetState.error && <Text style={styles.errorText}>{resetState.error}</Text>}
      {!!resetState.resendError && (
        <Text style={styles.errorText}>{resetState.resendError}</Text>
      )}

      <Pressable
        style={styles.backLink}
        onPress={() => navigation.navigate(ROUTES.FORGOT_PASSWORD)}
      >
        <Text style={styles.backLinkText}>Use a different email</Text>
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
    marginBottom: 28,
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
    marginBottom: 24,
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
  otpInput: {
    letterSpacing: 8,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
  },
  passwordWrap: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeBtn: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  metaBlock: {
    marginTop: 14,
  },
  metaText: {
    color: theme.gray,
    fontSize: 13,
    marginTop: 6,
  },
  actionBtn: {
    backgroundColor: theme.crimson,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  actionBtnPressed: {
    opacity: 0.85,
  },
  actionBtnText: {
    color: theme.white,
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: 30,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  secondaryBtnPressed: {
    opacity: 0.9,
  },
  secondaryBtnText: {
    color: theme.white,
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    color: theme.red,
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  backLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  backLinkText: {
    color: theme.crimson,
    fontSize: 14,
    fontWeight: '700',
  },
});
