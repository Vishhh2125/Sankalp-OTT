import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../constants/theme';
import { ROUTES } from '../constants/routes';

// ✅ REDUX IMPORTS
import { useDispatch, useSelector } from 'react-redux';
import { loginUser } from '../redux/slices/authSlice'; // adjust path if needed

export default function LoginScreen({ navigation, onGuestAccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ✅ REDUX HOOKS
  const dispatch = useDispatch();
  const { isLoading, error, status, accessToken } = useSelector((state) => state.auth);

  useEffect(() => {
    // Navigate after redux marks login as succeeded.
    if (status === 'succeeded' && accessToken) {
      console.log('Login successful');
      navigation.reset({
        index: 0,
        routes: [{ name: ROUTES.MAIN_TABS }],
      });
    }
  }, [accessToken, navigation, status]);

  // ✅ UPDATED LOGIN FUNCTION (NO NAVIGATION)
  const handleSignIn = async () => {
    try {
      await dispatch(loginUser({ email, password })).unwrap();
    } catch (err) {
      // ❌ error already handled in redux
      console.log(err);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="always"
    >
      {/* Logo */}
      <View style={styles.logoRow}>
        <View style={styles.logoIcon}>
          <Ionicons name="play" size={16} color={theme.white} />
        </View>
        <Text style={styles.logoText}>
          7<Text style={styles.logoCrimson}>K</Text>
        </Text>
      </View>

      {/* Title */}
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>
        Sign in to continue watching your dramas
      </Text>

      {/* Email */}
      <Text style={styles.label}>EMAIL</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="user@example.com"
        style={[styles.input, email.length > 0 && styles.inputActive]}
        placeholderTextColor={theme.darkGray}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      {/* Password */}
      <Text style={[styles.label, { marginTop: 20 }]}>PASSWORD</Text>
      <View style={styles.passwordWrap}>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          style={[styles.input, styles.passwordInput]}
          placeholderTextColor={theme.darkGray}
          secureTextEntry={!showPassword}
        />
        <Pressable
          style={styles.eyeBtn}
          onPress={() => setShowPassword((p) => !p)}
        >
          <Ionicons
            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={theme.gray}
          />
        </Pressable>
      </View>

      {/* Forgot Password */}
      <Pressable
        style={styles.forgotRow}
        onPress={() => navigation.navigate(ROUTES.FORGOT_PASSWORD)}
      >
        <Text style={styles.forgotText}>Forgot password?</Text>
      </Pressable>

      {/* Sign In Button */}
      <Pressable
        disabled={isLoading}
        style={({ pressed }) => [
          styles.actionBtn,
          pressed && styles.actionBtnPressed,
          isLoading && { opacity: 0.6 },
        ]}
        onPress={handleSignIn}
      >
        <Text style={styles.actionBtnText}>
          {isLoading ? 'Signing in...' : 'Sign in'}
        </Text>
      </Pressable>

      {/* ✅ ERROR DISPLAY */}
      {error && (
        <Text style={{ color: 'red', marginTop: 10, textAlign: 'center' }}>
          {error}
        </Text>
      )}

      {/* Sign Up Link */}
      <View style={styles.bottomRow}>
        <Text style={styles.bottomText}>New here? </Text>
        <Pressable onPress={() => navigation.navigate(ROUTES.SIGNUP)}>
          <Text style={styles.bottomLink}>Create account</Text>
        </Pressable>
      </View>

      {/* Guest Access */}
      {onGuestAccess && (
        <Pressable onPress={onGuestAccess} style={styles.guestButton}>
          <Text style={styles.guestText}>Continue as Guest</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  guestButton: {
    marginTop: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  guestText: {
    color: '#8E8E93',
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
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
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: 12,
  },
  forgotText: {
    color: theme.crimson,
    fontSize: 13,
    fontWeight: '600',
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
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  bottomText: {
    color: theme.gray,
    fontSize: 14,
  },
  bottomLink: {
    color: theme.crimson,
    fontWeight: '700',
    fontSize: 14,
  },
});
