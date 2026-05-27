import React, { useRef, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  Pressable,
  Image,
  Dimensions,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 48, 360);
const CARD_SPACING = 12;

export default function DramaBannerPopup({
  visible,
  banners,
  onClose,
  onStartWatching,
}) {
  const listRef = useRef(null);
  const [index, setIndex] = useState(0);

  if (!banners?.length) return null;

  const SNAP_WIDTH = CARD_WIDTH + CARD_SPACING;
  const onScrollEnd = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SNAP_WIDTH);
    setIndex(i);
  };

  const renderBanner = ({ item }) => (
    <View style={[styles.card, { width: CARD_WIDTH, marginHorizontal: CARD_SPACING / 2 }]}>
      <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
        <Ionicons name="close" size={22} color={theme.white} />
      </Pressable>

      <View style={styles.imageWrap}>
        <Image
          source={{ uri: item.image_url }}
          style={styles.bannerImage}
          resizeMode="cover"
        />
        <View style={styles.imageOverlay} />
        <Text style={styles.dramaTitleOnImage} numberOfLines={2}>
          {item.show_title || item.title}
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.headline}>{item.title}</Text>
        <Text style={styles.subheadline}>Perfect pick based on your taste!</Text>

        <Pressable
          style={({ pressed }) => [styles.watchBtn, pressed && styles.watchBtnPressed]}
          onPress={() => onStartWatching(item)}
        >
          <Ionicons name="play" size={18} color="#000" style={{ marginRight: 8 }} />
          <Text style={styles.watchBtnText}>Start Watching</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <FlatList
          ref={listRef}
          data={banners}
          keyExtractor={(item) => item.id}
          renderItem={renderBanner}
          horizontal
          pagingEnabled={false}
          snapToInterval={SNAP_WIDTH}
          snapToAlignment="center"
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          getItemLayout={(_, i) => ({
            length: SNAP_WIDTH,
            offset: SNAP_WIDTH * i,
            index: i,
          })}
          contentContainerStyle={styles.listContent}
        />
        {banners.length > 1 ? (
          <View style={styles.dots}>
            {banners.map((b, i) => (
              <View
                key={b.id}
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
  listContent: {
    paddingHorizontal: CARD_SPACING / 2,
    alignItems: 'center',
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#0a1628',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrap: {
    width: '100%',
    height: CARD_WIDTH * 1.15,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  dramaTitleOnImage: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    color: theme.white,
    fontSize: 26,
    fontWeight: '800',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
    backgroundColor: '#0a1628',
    alignItems: 'center',
  },
  headline: {
    color: theme.white,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  subheadline: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    marginBottom: 18,
    textAlign: 'center',
  },
  watchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.white,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minWidth: '85%',
  },
  watchBtnPressed: { opacity: 0.9 },
  watchBtnText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    marginBottom: 4,
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
