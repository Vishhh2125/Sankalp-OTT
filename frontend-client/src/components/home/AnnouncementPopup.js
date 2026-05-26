import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../constants/theme';

const CARD_WIDTH = Math.min(Dimensions.get('window').width - 40, 360);

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

  const renderItem = ({ item }) => {
    const t = (item.title || '').trim();
    const b = (item.body || '').trim();
    return (
      <View style={[styles.card, { width: CARD_WIDTH }]}>
        <Pressable style={styles.closeBtn} onPress={onDismiss} hitSlop={12}>
          <Ionicons name="close" size={22} color={theme.white} />
        </Pressable>
        <View style={styles.iconCircle}>
          <Text style={styles.emojiLarge}>{item.emoji || '📬'}</Text>
        </View>
        <Text style={styles.headline}>Notification</Text>
        {t ? (
          <Text style={styles.title} numberOfLines={2}>
            {t}
          </Text>
        ) : null}
        {b ? (
          <Text style={styles.body} numberOfLines={4}>
            {b}
          </Text>
        ) : null}
        <Pressable style={styles.okBtn} onPress={onDismiss}>
          <Text style={styles.okBtnText}>Got it</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        {list.length > 1 ? (
          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
              setIndex(i);
            }}
            getItemLayout={(_, i) => ({
              length: CARD_WIDTH,
              offset: CARD_WIDTH * i,
              index: i,
            })}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <View style={styles.listContent}>
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
            </View>
          </View>
        )}
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
  listContent: { alignItems: 'center' },
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
    marginTop: 16,
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
