import React, { useEffect, useState } from 'react';
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

export default function AnnouncementPopup({ visible, announcements, onDismiss }) {
  const [index, setIndex] = useState(0);
  const list = Array.isArray(announcements) ? announcements.slice(0, 3) : [];
  const listKey = list.map((a) => a.id).join(',');

  useEffect(() => {
    setIndex(0);
  }, [listKey]);

  if (!visible || list.length === 0) return null;

  const current = list[index] || list[0];
  const emoji = current.emoji || '📬';
  const title = (current.title || '').trim();
  const body = (current.body || '').trim();

  const goToPrev = () => {
    setIndex((i) => (i === 0 ? list.length - 1 : i - 1));
  };

  const goToNext = () => {
    setIndex((i) => (i === list.length - 1 ? 0 : i + 1));
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.cardWrapper}>
          {/* Card */}
          <View style={[styles.card, { width: CARD_WIDTH }]}>
            <Pressable style={styles.closeBtn} onPress={onDismiss} hitSlop={12}>
              <Ionicons name="close" size={22} color={theme.white} />
            </Pressable>
            <View style={styles.iconCircle}>
              <Text style={styles.emojiLarge}>{emoji}</Text>
            </View>
            <Text style={styles.headline}>Notification</Text>
            {title ? (
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
            ) : null}
            {body ? (
              <Text style={styles.body} numberOfLines={4}>
                {body}
              </Text>
            ) : null}
            <Pressable style={styles.okBtn} onPress={onDismiss}>
              <Text style={styles.okBtnText}>Got it</Text>
            </Pressable>

            {/* Left Arrow - Bottom Left */}
            {list.length > 1 && (
              <Pressable
                style={[styles.arrowBtn, styles.arrowBtnBottomLeft]}
                onPress={goToPrev}
                hitSlop={12}
              >
                <Ionicons name="chevron-back" size={24} color={theme.white} />
              </Pressable>
            )}

            {/* Right Arrow - Bottom Right */}
            {list.length > 1 && (
              <Pressable
                style={[styles.arrowBtn, styles.arrowBtnBottomRight]}
                onPress={goToNext}
                hitSlop={12}
              >
                <Ionicons name="chevron-forward" size={24} color={theme.white} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Dots Indicator */}
        {list.length > 1 && (
          <View style={styles.dots}>
            {list.map((item, i) => (
              <View
                key={item.id}
                style={[styles.dot, i === index && styles.dotActive]}
              />
            ))}
          </View>
        )}
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
  cardWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  arrowBtn: {
    position: 'absolute',
    bottom: -55,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  arrowBtnBottomLeft: {
    left: -12,
  },
  arrowBtnBottomRight: {
    right: -12,
  },
  card: {
    borderRadius: 20,
    padding: 22,
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
  emojiLarge: { fontSize: 30 },
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
  okBtn: {
    backgroundColor: theme.white,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 40,
    minWidth: '70%',
    alignItems: 'center',
  },
  okBtnText: { color: theme.crimson, fontSize: 16, fontWeight: '800' },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    backgroundColor: theme.white,
    width: 20,
  },
});
