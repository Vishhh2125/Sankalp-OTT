import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, Pressable } from 'react-native';
import { theme } from '../../constants/theme';

/**
 * Live-aware seekable progress bar — jitter-proof.
 *
 * For live HLS, seekableDuration constantly jumps when new segments arrive,
 * causing currentTime/seekableDuration to fluctuate wildly. To fix this:
 *
 *  1. When playing (not paused, not scrubbing) → ALWAYS pin to 100%.
 *     The user is watching live — the bar stays steady at the end.
 *
 *  2. When paused → show the real ratio so the user can see they're
 *     falling behind the live edge.
 *
 *  3. When scrubbing → show the scrub position.
 *
 *  4. Tapping "LIVE" badge → seeks to live edge + resumes.
 */

export default function LiveProgressBar({
  isLandscape,
  currentTime = 0,
  duration = 0,   // seekableDuration for live
  paused = false,
  onSeek,
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Pulse animation for LIVE dot ──
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  // ── Scrubbing state ──
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubFraction, setScrubFraction] = useState(0);

  const hitAreaRef = useRef(null);
  const trackWidthRef = useRef(300);
  const trackLeftRef = useRef(0);
  const activePageXRef = useRef(0);

  const durationRef = useRef(duration);
  const onSeekRef = useRef(onSeek);
  durationRef.current = duration;
  onSeekRef.current = onSeek;

  // ── Smoothed progress for paused state ──
  // When paused, capture a stable ratio once and only update it if
  // the change is significant (> 2%), preventing micro-jitter.
  const lastStableRatio = useRef(1);

  const rawRatio = duration > 0
    ? Math.max(0, Math.min(currentTime / duration, 1))
    : 1;

  if (paused) {
    const diff = Math.abs(rawRatio - lastStableRatio.current);
    // Only update if the change is meaningful (> 2% of the bar)
    if (diff > 0.02) {
      lastStableRatio.current = rawRatio;
    }
  } else {
    // When playing, keep the stable ratio synced to 1 (live edge)
    lastStableRatio.current = 1;
  }

  // ── Display progress logic ──
  // Scrubbing → show scrub position
  // Playing → always 100% (pinned, no jitter)
  // Paused → show smoothed real position
  const displayProgress = scrubbing
    ? scrubFraction
    : paused
      ? lastStableRatio.current
      : 1;

  const isAtLiveEdge = displayProgress > 0.97;

  // ── Measure track for gesture math ──
  const measureTrack = useCallback(() => {
    hitAreaRef.current?.measureInWindow((x, _y, width) => {
      if (width > 0) {
        trackLeftRef.current = x;
        trackWidthRef.current = width;
      }
    });
  }, []);

  const fractionFromPageX = useCallback((pageX) => {
    const w = trackWidthRef.current || 300;
    return Math.max(0, Math.min(1, (pageX - trackLeftRef.current) / w));
  }, []);

  // ── PanResponder for scrubbing ──
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => durationRef.current > 0,
      onMoveShouldSetPanResponder: () => durationRef.current > 0,
      onPanResponderGrant: (evt) => {
        measureTrack();
        activePageXRef.current = evt.nativeEvent.pageX;
        const frac = fractionFromPageX(activePageXRef.current);
        setScrubbing(true);
        setScrubFraction(frac);
      },
      onPanResponderMove: (_evt, gs) => {
        const pageX = gs.moveX || activePageXRef.current + gs.dx;
        activePageXRef.current = pageX;
        setScrubFraction(fractionFromPageX(pageX));
      },
      onPanResponderRelease: (_evt, gs) => {
        const pageX = gs.moveX || activePageXRef.current;
        const frac = fractionFromPageX(pageX);
        const seekTime = frac * durationRef.current;
        setScrubbing(false);
        onSeekRef.current?.(seekTime);
      },
      onPanResponderTerminate: () => {
        setScrubbing(false);
      },
    })
  ).current;

  // ── Jump to live edge ──
  const handleLivePress = useCallback(() => {
    if (durationRef.current > 0) {
      onSeekRef.current?.(durationRef.current);
    }
  }, []);

  return (
    <View style={[styles.container, isLandscape && styles.containerLandscape]}>
      {/* LIVE badge — tappable to jump to live when behind */}
      <Pressable
        style={styles.badgeContainer}
        onPress={handleLivePress}
        disabled={isAtLiveEdge && !paused}
        hitSlop={8}
      >
        <Animated.View
          style={[
            styles.dot,
            {
              backgroundColor: isAtLiveEdge ? theme.crimson : '#888',
              opacity: isAtLiveEdge ? pulseAnim : 1,
            },
          ]}
        />
        <Text style={[styles.badgeText, { color: isAtLiveEdge ? '#fff' : '#aaa' }]}>
          LIVE
        </Text>
      </Pressable>

      {/* Seekable track */}
      <View
        ref={hitAreaRef}
        style={styles.barContainer}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) trackWidthRef.current = w;
          measureTrack();
        }}
        {...panResponder.panHandlers}
      >
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${displayProgress * 100}%` }]} />
          <View
            style={[
              styles.playhead,
              { left: `${displayProgress * 100}%` },
              scrubbing && styles.playheadActive,
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    left: 0,
    right: 0,
    height: 44,
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  containerLandscape: {},
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginRight: 2,
    marginBottom: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  barContainer: {
    width: '100%',
    height: 16,
    justifyContent: 'center',
  },
  barTrack: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 1,
    position: 'relative',
    width: '100%',
  },
  barFill: {
    height: '100%',
    backgroundColor: theme.crimson,
    borderRadius: 1,
  },
  playhead: {
    position: 'absolute',
    top: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.crimson,
    marginLeft: -4,
  },
  playheadActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
    top: -5,
    marginLeft: -6,
  },
});
