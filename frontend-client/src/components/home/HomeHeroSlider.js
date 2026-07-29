import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';
import { API_BASE_URL } from '../../constants/config';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_HEIGHT = Math.round(SCREEN_HEIGHT * 0.48);
const HERO_WIDTH = SCREEN_WIDTH - 25;
const AUTO_ADVANCE_MS = 4500;

function resolveImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('file://')) {
    if (url.includes('/ott-media/')) return `${API_BASE_URL}${url.substring(url.indexOf('/ott-media/'))}`;
    if (url.includes('/uploads/')) return `${API_BASE_URL}${url.substring(url.indexOf('/uploads/'))}`;
    return url;
  }
  const separator = url.startsWith('/') ? '' : '/';
  return `${API_BASE_URL}${separator}${url}`;
}

export default function HomeHeroSlider({ banners = [], onBannerPress }) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const listRef = useRef(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (banners.length < 2) return undefined;

    const timer = setInterval(() => {
      setIndex((currentIndex) => {
        const nextIndex = (currentIndex + 1) % banners.length;
        listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        return nextIndex;
      });
    }, AUTO_ADVANCE_MS);

    return () => clearInterval(timer);
  }, [banners.length]);

  if (!banners.length) return null;

  const onScrollEnd = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / HERO_WIDTH);
    setIndex(i);
  };

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={listRef}
        data={banners}
        keyExtractor={(item, itemIndex) => `${item.id || item.show_id || 'banner'}-${itemIndex}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={HERO_WIDTH}
        snapToAlignment="start"
        decelerationRate="fast"
        onMomentumScrollEnd={onScrollEnd}
        contentContainerStyle={styles.listContent}
        getItemLayout={(_, itemIndex) => ({
          length: HERO_WIDTH,
          offset: HERO_WIDTH * itemIndex,
          index: itemIndex,
        })}
        onScrollToIndexFailed={({ index: failedIndex }) => {
          listRef.current?.scrollToOffset({
            offset: HERO_WIDTH * failedIndex,
            animated: true,
          });
        }}
        renderItem={({ item, index: itemIndex }) => {
          const uri = resolveImageUrl(item.image_url || item.show_thumbnail_url);
          const isActive = itemIndex === index;
          return (
            <Pressable
              style={[
                styles.slide,
                { width: HERO_WIDTH },
                !isActive && styles.slideInactive,
              ]}
              onPress={() => onBannerPress?.(item)}
            >
              {uri ? (
                <Image source={{ uri }} style={styles.image} resizeMode="cover" />
              ) : (
                <View style={[styles.image, styles.imageFallback]} />
              )}
              <View style={styles.overlay} />
              <View style={styles.caption}>
                <View style={styles.showNameRow}>
                  <Text style={styles.heroShowName} numberOfLines={2}>
                    {item.show_title || item.title}
                  </Text>
                </View>

                <View style={styles.heroPlayBtn}>
                  <Ionicons
                    name="play"
                    size={28}
                    color="#000"
                    style={styles.heroPlayIcon}
                  />
                </View>
              </View>
            </Pressable>
          );
        }}
      />
      {banners.length > 1 ? (
        <View style={styles.dots}>
          {banners.map((b, i) => (
            <View
              key={`${b.id || b.show_id || 'dot'}-${i}`}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = (theme) => StyleSheet.create({
  wrap: {
    marginBottom: 20,
  },
  listContent: {
    paddingRight: 0,
  },
  slide: {
    height: HERO_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  slideInactive: {
    opacity: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    backgroundColor: theme.surface,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  caption: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  showNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 84,
  },
  heroPlayBtn: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 56,      // was 28
    height: 56,     // was 28
    borderRadius: 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPlayIcon: {
    marginLeft: 3,
  },
  heroShowName: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    backgroundColor: theme.crimson,
    width: 18,
  },
});
