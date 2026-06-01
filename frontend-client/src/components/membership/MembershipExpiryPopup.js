import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../constants/theme';

const CARD_WIDTH = Math.min(Dimensions.get('window').width - 80, 320);

export default function MembershipExpiryPopup({
  visible,
  reminder,
  onExtend,
  onDismiss,
}) {
  if (!visible || !reminder) return null;

  const title = (reminder.title || '').trim();
  const body = (reminder.body || '').trim();
  const cta = reminder.cta || 'Extend now';

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { width: CARD_WIDTH }]}>
          <Pressable style={styles.closeBtn} onPress={onDismiss} hitSlop={12}>
            <Ionicons name="close" size={22} color={theme.white} />
          </Pressable>

          <View style={styles.iconCircle}>
            <Ionicons name="star" size={32} color={theme.gold} />
          </View>

          <Text style={styles.headline}>Membership</Text>

          {title ? (
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          ) : null}

          {body ? (
            <Text style={styles.body} numberOfLines={5}>
              {body}
            </Text>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.extendBtn, pressed && styles.extendBtnPressed]}
            onPress={onExtend}
          >
            <Text style={styles.extendBtnText}>{cta}</Text>
          </Pressable>

          <Pressable style={styles.laterBtn} onPress={onDismiss}>
            <Text style={styles.laterBtnText}>Maybe later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 20,
    padding: 22,
    paddingBottom: 18,
    backgroundColor: theme.crimson,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    marginTop: 8,
  },
  headline: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: theme.white,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  extendBtn: {
    backgroundColor: theme.white,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 40,
    minWidth: '75%',
    alignItems: 'center',
    marginBottom: 10,
  },
  extendBtnPressed: { opacity: 0.9 },
  extendBtnText: {
    color: theme.crimson,
    fontSize: 16,
    fontWeight: '800',
  },
  laterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  laterBtnText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '600',
  },
});
