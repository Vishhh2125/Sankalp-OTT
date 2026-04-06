import React, { useState, useMemo } from 'react';
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

function getPasswordStrength(password) {
  if (!password) return { level: 0, label: '', color: theme.border };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: 'Weak', color: theme.red };
  if (score === 2)
    return { level: 2, label: 'Medium strength', color: theme.orange };
  if (score === 3) return { level: 3, label: 'Strong', color: theme.green };
  return { level: 4, label: 'Very strong', color: theme.green };
}

export default function SignUpScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps={true}
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
      <Text style={styles.title}>Join the drama</Text>
      <Text style={styles.subtitle}>Create your free account</Text>

      {/* Photo Upload */}
      <View style={styles.photoContainer}>
        <View style={styles.photoCircle}>
          <Ionicons name="add" size={28} color={theme.crimson} />
          <Text style={styles.photoText}>Photo</Text>
        </View>
      </View>

      {/* Name */}
      <Text style={styles.label}>YOUR NAME</Text>
      <TextInput
        value={fullName}
        onChangeText={setFullName}
        placeholder="Priya Sharma"
        style={styles.input}
        placeholderTextColor={theme.darkGray}
      />

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
      <Text style={[styles.label, { marginTop: 16 }]}>PASSWORD</Text>
      <View style={styles.passwordWrap}>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Min. 8 characters"
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

      {/* Strength Bars */}
      {password.length > 0 && (
        <>
          <View style={styles.strengthBars}>
            {[1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.strengthBar,
                  {
                    backgroundColor:
                      i <= strength.level ? strength.color : theme.border,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.strengthLabel, { color: strength.color }]}>
            {strength.label}
          </Text>
        </>
      )}

      {/* Terms */}
      <Text style={styles.terms}>
        By signing up you agree to our{' '}
        <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
        <Text style={styles.termsLink}>Privacy Policy</Text>
      </Text>

      {/* Create Account Button */}
      <Pressable
        style={({ pressed }) => [
          styles.actionBtn,
          pressed && styles.actionBtnPressed,
        ]}
        onPress={() => navigation.navigate(ROUTES.LOGIN)}
      >
        <Text style={styles.actionBtnText}>Create account</Text>
      </Pressable>

      {/* Guest Account Button */}
      <Pressable
        style={({ pressed }) => [
          styles.guestBtn,
          pressed && styles.guestBtnPressed,
        ]}
        onPress={() => navigation.reset({
          index: 0,
          routes: [{ name: ROUTES.MAIN_TABS }],
        })}
      >
        <Text style={styles.guestBtnText}>Continue as Guest Account</Text>
      </Pressable>

      {/* Sign In Link */}
      <View style={styles.bottomRow}>
        <Text style={styles.bottomText}>Already have an account? </Text>
        <Pressable onPress={() => navigation.navigate(ROUTES.LOGIN)}>
          <Text style={styles.bottomLink}>Sign in</Text>
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
  photoContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  photoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: theme.crimson,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoText: {
    color: theme.crimson,
    fontSize: 12,
    marginTop: 2,
  },
  // (nameRow/nameField removed - using single full name field)
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
  strengthBars: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  terms: {
    fontSize: 13,
    color: theme.gray,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  termsLink: {
    color: theme.white,
    fontWeight: '700',
  },
  actionBtn: {
    backgroundColor: theme.crimson,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  actionBtnPressed: {
    opacity: 0.85,
  },
  actionBtnText: {
    color: theme.white,
    fontSize: 17,
    fontWeight: '700',
  },
  guestBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  guestBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  guestBtnText: {
    color: theme.white,
    fontSize: 15,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
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
