import React, { useState } from 'react';
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

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  function handleSignIn() {
    // TODO: Add real authentication logic
    navigation.reset({
      index: 0,
      routes: [{ name: ROUTES.MAIN_TABS }],
    });
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
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
        placeholder="priya@example.com"
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
      <Pressable style={styles.forgotRow}>
        <Text style={styles.forgotText}>Forgot password?</Text>
      </Pressable>

      {/* Sign In Button */}
      <Pressable
        style={({ pressed }) => [
          styles.actionBtn,
          pressed && styles.actionBtnPressed,
        ]}
        onPress={handleSignIn}
      >
        <Text style={styles.actionBtnText}>Sign in</Text>
      </Pressable>



      {/* Sign Up Link */}
      <View style={styles.bottomRow}>
        <Text style={styles.bottomText}>New here? </Text>
        <Pressable onPress={() => navigation.navigate(ROUTES.SIGNUP)}>
          <Text style={styles.bottomLink}>Create account</Text>
        </Pressable>
      </View>
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.border,
  },
  dividerText: {
    color: theme.gray,
    fontSize: 13,
    marginHorizontal: 14,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingVertical: 14,
  },
  socialBtnPressed: {
    opacity: 0.8,
  },
  socialBtnText: {
    color: theme.white,
    fontSize: 14,
    fontWeight: '600',
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
