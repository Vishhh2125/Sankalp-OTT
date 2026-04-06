import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const theme = {
  deepBlack: '#000000',
  crimson: '#FF2D55',
  white: '#FFFFFF',
  muted: 'rgba(255,255,255,0.6)',
};

const MOCK_REELS = [
  {
    id: '1',
    title: 'This Letter To You Is My Last',
    tags: ['Hot', 'All-Too-Late', 'Romance'],
    description: 'Ada, diagnosed with a terminal illness, spends the final moments of her life orchestrating...',
    episode: 'EP.1 / EP.61',
    saves: '363K',
    bgColor: '#1A0020',
  },
  {
    id: '2',
    title: 'The Mafia Boss\'s Baby',
    tags: ['New', 'Mafia', 'Action'],
    description: 'She thought it was a one-night stand, but the King of the underworld never lets go...',
    episode: 'EP.4 / EP.54',
    saves: '1.2M',
    bgColor: '#050505',
  },
];

function SideAction({ icon, label, color, onPress }) {
  return (
    <TouchableOpacity style={styles.sideAction} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={30} color={color || '#fff'} />
      <Text style={styles.sideLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ReelItem({ item }) {
  const insets = useSafeAreaInsets();
  const [saved, setSaved] = useState(false);

  return (
    <View style={styles.reelContainer}>
      {/* 1. FULL SCREEN BACKGROUND (VIDEO AREA) */}
      <View style={[styles.background, { backgroundColor: item.bgColor }]}>
        <Ionicons name="play" size={80} color="rgba(255,255,255,0.1)" />
      </View>

      {/* 2. UI LAYER */}
      <View style={[styles.uiOverlay, { paddingBottom: insets.bottom + 45 }]}>

        {/* RIGHT SIDE BUTTONS: Positioned above the text level */}
        <View style={styles.sideActionsColumn}>
          <SideAction
            icon={saved ? 'bookmark' : 'bookmark-outline'}
            label={item.saves}
            color={saved ? theme.crimson : '#fff'}
            onPress={() => setSaved(!saved)}
          />
          <SideAction icon="list" label="Episodes" />
          <SideAction icon="share-social" label="Share" />
        </View>

        {/* BOTTOM TEXT CONTENT: Starts after the buttons vertically or sits to the left */}
        <View style={styles.textContent}>
          <View style={styles.titleRow}>
            <Text style={styles.reelTitle} numberOfLines={1}>{item.title}</Text>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </View>

          <View style={styles.tagsRow}>
            {item.tags.map((tag) => (
              <View key={tag} style={[styles.tagPill, (tag === 'Hot' || tag === 'New') && styles.tagHot]}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.descText} numberOfLines={2}>
            {item.description} <Text style={{ fontWeight: 'bold', color: '#fff' }}>more</Text>
          </Text>

          {/* Episode Progress Strip */}
          <TouchableOpacity style={styles.episodeStrip}>
            <Ionicons name="play-circle" size={20} color={theme.crimson} />
            <Text style={styles.episodeText}>{item.episode}</Text>
            <View style={{ flex: 1 }} />
            <Ionicons name="chevron-forward" size={16} color={theme.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Top Search Overlay */}
      <TouchableOpacity style={[styles.topSearch, { top: insets.top + 10 }]}>
        <Ionicons name="search" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

export default function ForYouScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <FlatList
        data={MOCK_REELS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReelItem item={item} />}

        // REELS SCROLLING LOGIC
        pagingEnabled={true}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}

        // Performance optimization for full-screen lists
        removeClippedSubviews={true}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  reelContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uiOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },

  // Side buttons positioned on the right
  sideActionsColumn: {
    alignSelf: 'flex-end',
    alignItems: 'center',
    marginBottom: 20, // Gap between the last button (share) and the start of the title
    gap: 25,
    paddingRight: 4,
  },
  sideAction: {
    alignItems: 'center',
  },
  sideLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },

  // Text content anchored to bottom left
  textContent: {
    width: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  reelTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginRight: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  tagHot: {
    backgroundColor: theme.crimson,
  },
  tagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  descText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
    paddingRight: 40, // Don't let text go under the buttons area
  },
  episodeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  episodeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  topSearch: {
    position: 'absolute',
    right: 20,
    padding: 10,
  },
});