import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../constants/theme';

export const HOME_ANNOUNCEMENT_BAR_HEIGHT = 76;

/**
 * Crimson announcement strip (over Home search bar).
 */
export default function HomeAnnouncementBar({ announcements, onDismiss }) {
  const [index, setIndex] = useState(0);
  const list = Array.isArray(announcements) ? announcements.slice(0, 3) : [];

  const listKey = list.map((a) => a.id).join(',');

  useEffect(() => {
    setIndex(0);
  }, [listKey]);

  useEffect(() => {
    if (list.length <= 1) return undefined;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % list.length);
    }, 6000);
    return () => clearInterval(id);
  }, [list.length, listKey]);

  if (list.length === 0) return null;

  const current = list[index] || list[0];
  const emoji = current.emoji || '📬';
  const title = (current.title || '').trim();
  const body = (current.body || '').trim();

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <Text style={styles.emoji}>{emoji}</Text>
        <View style={styles.textCol}>
          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {body ? (
            <Text style={styles.body} numberOfLines={2}>
              {body}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={onDismiss}
          hitSlop={12}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
        >
          <Ionicons name="close" size={20} color={theme.white} />
        </Pressable>
      </View>
      {list.length > 1 ? (
        <View style={styles.dots}>
          {list.map((item, i) => (
            <View
              key={item.id}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    zIndex: 1000,
    elevation: 24,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: HOME_ANNOUNCEMENT_BAR_HEIGHT - 12,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 14,
    backgroundColor: theme.crimson,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    gap: 12,
    shadowColor: theme.crimson,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  emoji: {
    fontSize: 26,
  },
  textCol: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: theme.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  body: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    marginTop: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: theme.white,
    width: 14,
  },
});
