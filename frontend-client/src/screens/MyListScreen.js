import React from 'react';
import { FlatList, StyleSheet, Text, View, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

const { width } = Dimensions.get('window');

const MOCK_SAVED = [
  { id: '1', title: 'The Silent Shadows', duration: '24:15', category: 'Action' },
  { id: '2', title: 'Eternal Summer', duration: '18:40', category: 'Romance' },
  { id: '3', title: 'Midnight Mystery', duration: '12:05', category: 'Thriller' },
];

export default function MyListScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>My List</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{MOCK_SAVED.length} Videos</Text>
        </View>
      </View>
      
      <Text style={styles.subtitle}>Continue watching your favorite series</Text>

      <FlatList
        data={MOCK_SAVED}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable style={({ pressed }) => [
            styles.card,
            pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
          ]}>
            {/* Thumbnail Placeholder */}
            <View style={styles.thumbnail}>
              <View style={styles.playOverlay}>
                <Ionicons name="play" size={20} color={theme.white} />
              </View>
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>{item.duration}</Text>
              </View>
            </View>

            {/* Content Info */}
            <View style={styles.cardInfo}>
              <View>
                <Text style={styles.categoryText}>{item.category.toUpperCase()}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
              </View>
              
              <View style={styles.cardFooter}>
                <View style={styles.actionBtn}>
                  <Ionicons name="share-social-outline" size={18} color={theme.gray} />
                </View>
                <View style={styles.actionBtn}>
                  <Ionicons name="trash-outline" size={18} color={theme.crimson} />
                </View>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.deepBlack,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    color: theme.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countText: {
    color: theme.gray,
    fontSize: 12,
    fontWeight: '600',
  },
  subtitle: {
    color: theme.gray,
    fontSize: 14,
    marginBottom: 24,
    opacity: 0.8,
  },
  list: {
    gap: 16,
    paddingBottom: 30,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: 16,
    overflow: 'hidden',
    height: 100,
    // Add subtle border for depth
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  thumbnail: {
    width: 140,
    height: '100%',
    backgroundColor: '#2A2A2A', // Darker skeleton color
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  playOverlay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: theme.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  categoryText: {
    color: theme.crimson,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
  },
  cardTitle: {
    color: theme.white,
    fontSize: 16,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 15,
  },
  actionBtn: {
    opacity: 0.8,
  }
});