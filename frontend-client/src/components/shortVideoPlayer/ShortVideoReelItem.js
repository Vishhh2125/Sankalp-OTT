import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
// ─── Migration: expo-video → react-native-video v6 ───────────────────────────
// Removed:  import { VideoView } from 'expo-video';
// Added:    import Video from 'react-native-video';
import Video from 'react-native-video';

import ProgressBar from './ProgressBar';
import SideAction from './SideAction';
import { styles } from './styles';
import { shortVideoTheme } from './theme';
import useShortVideoPlayback from './useShortVideoPlayback';
import { formatCount } from './utils';
import { ROUTES } from '../../constants/routes';

function DefaultTopOverlay({ top, style }) {
  return (
    <TouchableOpacity style={[style, { top }]}>
      <Ionicons name="search" size={26} color="#fff" />
    </TouchableOpacity>
  );
}

export default function ShortVideoReelItem({
  item,
  isActive,
  isFocused,
  onWatchAll,
  onOpenDetails,
  renderTopOverlay,
  streamBase = '',
}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const accessToken = useSelector((state) => state.auth?.accessToken);
  
  let tabBarHeight = 0;
  try {
    tabBarHeight = useBottomTabBarHeight();
  } catch {
    tabBarHeight = 0;
  }
  const [saved, setSaved] = useState(false);

  const isLocked = item.is_locked;
  const streamUrl = !isLocked && item.hls_url ? `${streamBase}${item.hls_url}` : null;

  // ─── Migration notes ────────────────────────────────────────────────────────
  // expo-video returned: { player, firstFrameRendered, setFirstFrameRendered, ... }
  // react-native-video v6 returns: { videoRef, paused, firstFrameReady, ... }
  //
  // Key differences:
  //  • `player`            → gone; playback is driven by the `paused` prop on <Video>
  //  • `firstFrameRendered`→ renamed `firstFrameReady`; set via the `onReadyForDisplay` callback
  //  • `togglePlayback`    → same signature; internally just flips `manuallyPaused`
  //  • `seekTo`            → same signature; internally calls videoRef.current.seek()
  // ────────────────────────────────────────────────────────────────────────────
  const {
    videoRef,
    paused,
    currentTime,
    duration,
    firstFrameReady,
    manuallyPaused,
    togglePlayback,
    seekTo,
    onLoad,
    onProgress,
    onReadyForDisplay,
    setFirstFrameReady,
  } = useShortVideoPlayback({
    streamUrl,
    isActive,
    isFocused,
    isLocked,
    itemKey: item.episode_id,
    initialDuration: item.duration_sec || 0,
  });

  const topOverlay = renderTopOverlay
    ? renderTopOverlay({ insets, item })
    : <DefaultTopOverlay top={insets.top + 10} style={styles.topSearch} />;

  return (
    <View style={styles.reelContainer}>
      {/* Thumbnail / blurred placeholder – shown until first frame is ready */}
      {item.thumbnail_url ? (
        <Image
          source={{ uri: item.thumbnail_url }}
          style={[StyleSheet.absoluteFill, { opacity: firstFrameReady ? 0 : 1 }]}
          resizeMode="cover"
          blurRadius={isLocked ? 15 : 0}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0D0010' }]} />
      )}

      {/* ─── Video player ─────────────────────────────────────────────────────
          expo-video used a separate <VideoView> bound to an imperative `player`.
          react-native-video v6 uses a single self-contained <Video> component:
            • source        – replaces streamUrl passed to useVideoPlayer()
            • paused        – replaces player.play() / player.pause()
            • repeat        – replaces instance.loop = true
            • resizeMode    – replaces contentFit="cover"
            • controls      – replaces nativeControls={false}  (false = no native UI)
            • onLoad        – replaces the 'statusChange' event listener
            • onProgress    – replaces the 'timeUpdate' event listener
            • onReadyForDisplay – replaces onFirstFrameRender on <VideoView>
          ─────────────────────────────────────────────────────────────────── */}
      {streamUrl && !isLocked ? (
        <TouchableWithoutFeedback onPress={togglePlayback}>
          <View style={StyleSheet.absoluteFill}>
            <Video
              ref={videoRef}
              source={{ uri: streamUrl }}
              style={[StyleSheet.absoluteFill, { opacity: firstFrameReady ? 1 : 0 }]}
              resizeMode="cover"
              paused={paused}
              repeat={true}
              controls={false}
              progressUpdateInterval={500}   // ~matches timeUpdateEventInterval: 0.5
              onLoad={onLoad}
              onProgress={onProgress}
              onReadyForDisplay={onReadyForDisplay}
              allowsExternalPlayback={false} // replaces allowsPictureInPicture={false}
            />
          </View>
        </TouchableWithoutFeedback>
      ) : null}

      {/* Manual-pause overlay */}
      {isActive && manuallyPaused && !isLocked && firstFrameReady ? (
        <TouchableWithoutFeedback onPress={togglePlayback}>
          <View style={styles.pauseOverlay}>
            <View style={styles.pauseIconCircle}>
              <Ionicons name="play" size={40} color="#fff" />
            </View>
          </View>
        </TouchableWithoutFeedback>
      ) : null}

      {/* Locked-content overlay */}
      {isLocked ? (
        <LockOverlay
          item={item}
          accessToken={accessToken}
          navigation={navigation}
        />
      ) : null}

      {/* Buffering spinner – shown while video URL exists but first frame not yet ready */}
      {isActive && streamUrl && !isLocked && !firstFrameReady ? (
        <View style={styles.bufferingOverlay}>
          <ActivityIndicator size="large" color={shortVideoTheme.crimson} />
        </View>
      ) : null}

      <View
        style={[styles.uiOverlay, { paddingBottom: insets.bottom }]}
        pointerEvents="box-none"
      >
        <View style={styles.sideActionsColumn}>
          <SideAction
            icon={saved ? 'bookmark' : 'bookmark-outline'}
            label={item.view_count > 0 ? formatCount(item.view_count) : ''}
            color={saved ? shortVideoTheme.crimson : '#fff'}
            onPress={() => setSaved((prev) => !prev)}
          />
          <SideAction
            icon="list"
            label="Episodes"
            onPress={() => onWatchAll && onWatchAll(item)}
          />
          <SideAction icon="share-social" label="Share" />
        </View>

        <View style={styles.textContent}>
          <TouchableOpacity
            style={styles.titleRow}
            activeOpacity={0.8}
            onPress={() => onOpenDetails && onOpenDetails(item)}
          >
            <Text style={styles.reelTitle} numberOfLines={1}>{item.show_title}</Text>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </TouchableOpacity>

          <View style={styles.epBadge}>
            <Ionicons name="videocam" size={12} color={shortVideoTheme.crimson} />
            <Text style={styles.epBadgeText}>EP.{item.episode_num}</Text>
          </View>

          <View style={styles.tagsRow}>
            {(item.tags || []).slice(0, 4).map((tag) => (
              <View key={tag} style={styles.tagPill}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>

          {item.synopsis ? (
            <Text style={styles.descText} numberOfLines={2}>
              {item.synopsis}{' '}
              <Text style={{ fontWeight: 'bold', color: '#fff' }}>more</Text>
            </Text>
          ) : null}

          {!isLocked && firstFrameReady ? (
            <ProgressBar
              currentTime={currentTime}
              duration={duration}
              onSeek={seekTo}
            />
          ) : null}

          <TouchableOpacity
            style={styles.episodeStrip}
            onPress={() => onWatchAll && onWatchAll(item)}
          >
            <Ionicons name="play-circle" size={20} color={shortVideoTheme.crimson} />
            <Text style={styles.episodeText}>
              EP.{item.episode_num} / EP.{item.total_episodes}
            </Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.watchAllText}>Watch All</Text>
            <Ionicons name="chevron-forward" size={16} color={shortVideoTheme.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {topOverlay}
    </View>
  );
}

/**
 * LockOverlay component
 * Displays appropriate lock message and navigation based on authentication state and lock reason
 * 
 * Fix: Registered users should see "Unlock with coins" (navigate to Membership)
 *      Unauthenticated users should see "Sign Up" message only
 */
function LockOverlay({ item, accessToken, navigation }) {
  const isAuthenticated = !!accessToken;
  
  const handlePress = useCallback(() => {
    if (isAuthenticated) {
      // Authenticated user needs coins/membership → navigate to Membership
      navigation.navigate(ROUTES.MEMBERSHIP);
    } else {
      // Guest/Unauthenticated user → They can't access AuthNavigator from here
      // Show alert with guidance (in production, could implement modal auth screen)
      alert('Please sign up or log in to access this content');
    }
  }, [isAuthenticated, navigation]);
  
  const lockTitle = isAuthenticated
    ? `Unlock with ${item.coin_cost || 0} coins`
    : 'Sign up to watch';
  
  const buttonText = isAuthenticated
    ? 'Get Coins'
    : 'Sign Up';
  
  return (
    <View style={styles.lockOverlay}>
      <View style={styles.lockIconWrap}>
        <Ionicons name="lock-closed" size={32} color="#fff" />
      </View>
      <Text style={styles.lockTitle}>{lockTitle}</Text>
      <TouchableOpacity style={styles.lockButton} onPress={handlePress}>
        <Text style={styles.lockButtonText}>{buttonText}</Text>
      </TouchableOpacity>
    </View>
  );
}