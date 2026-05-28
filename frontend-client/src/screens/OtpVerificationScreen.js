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
  clearOtpState,
  resendOtp,
  verifyOtp,
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

export default function OtpVerificationScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const otpState = useSelector((state) => state.auth.otp);
  const pendingRegistration = useSelector((state) => state.auth.pendingRegistration);

  const sessionData = {
    ...(route?.params || {}),
    ...(pendingRegistration || {}),
  };

  const [otp, setOtp] = useState('');
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
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      navigation.navigate(ROUTES.LOGIN);
    }
  }, [navigation, sessionId]);

  useEffect(() => {
    if (otpState.status === 'succeeded') {
      dispatch(clearOtpState());
      navigation.reset({
        index: 0,
        routes: [{ name: ROUTES.LOGIN }],
      });
    }
  }, [dispatch, navigation, otpState.status]);

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

  const handleVerify = () => {
    const trimmedOtp = otp.trim();

    if (!sessionId) {
      setLocalError('Registration session missing. Please sign up again.');
      return;
    }

    if (!trimmedOtp) {
      setLocalError('Please enter the 6-digit code.');
      return;
    }

    if (trimmedOtp.length !== 6 || !/^\d+$/.test(trimmedOtp)) {
      setLocalError('Please enter a valid 6-digit code.');
      return;
    }

    setLocalError('');
    dispatch(verifyOtp({ sessionId, otp: trimmedOtp }));
  };

  const handleResend = () => {
    if (!sessionId) {
      setLocalError('Registration session missing. Please sign up again.');
      return;
    }

    if (isResendLocked) {
      return;
    }

    setLocalError('');
    dispatch(resendOtp({ sessionId }));
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

      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.subtitle}>
        We sent a 6-digit code to {email || 'your email'}.
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
        {!!resendCooldownLabel && <Text style={styles.metaText}>{resendCooldownLabel}</Text>}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.actionBtn,
          pressed && styles.actionBtnPressed,
          otpState.isLoading && { opacity: 0.6 },
        ]}
        onPress={handleVerify}
        disabled={otpState.isLoading}
      >
        <Text style={styles.actionBtnText}>
          {otpState.isLoading ? 'Verifying...' : 'Verify code'}
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.secondaryBtn,
          pressed && styles.secondaryBtnPressed,
          (otpState.isResending || isResendLocked) && { opacity: 0.6 },
        ]}
        onPress={handleResend}
        disabled={otpState.isResending || isResendLocked}
      >
        <Text style={styles.secondaryBtnText}>
          {otpState.isResending ? 'Sending new code...' : 'Resend code'}
        </Text>
      </Pressable>

      {!!localError && <Text style={styles.errorText}>{localError}</Text>}
      {!!otpState.error && <Text style={styles.errorText}>{otpState.error}</Text>}
      {!!otpState.resendError && (
        <Text style={styles.errorText}>{otpState.resendError}</Text>
      )}

      <Pressable
        style={styles.backLink}
        onPress={() => navigation.navigate(ROUTES.SIGNUP)}
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
