import React, { useCallback, useRef, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';

import { SCREEN_WIDTH } from './constants';
import { styles } from './styles';
import { formatTime } from './utils';

const DEFAULT_TRACK_WIDTH = SCREEN_WIDTH - 32;

export default function ProgressBar({ currentTime, duration, onSeek, format = 'remaining' }) {
  const trackWidthRef = useRef(DEFAULT_TRACK_WIDTH);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);

  const displayTime = scrubbing ? scrubTime : currentTime;
  const progress = duration > 0 ? displayTime / duration : 0;
  const remaining = duration - displayTime;

  const seekFromLocationX = useCallback(
    (locationX) => {
      const w = trackWidthRef.current || DEFAULT_TRACK_WIDTH;
      const ratio = Math.max(0, Math.min(1, locationX / w));
      return ratio * duration;
    },
    [duration]
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => duration > 0,
      onMoveShouldSetPanResponder: () => duration > 0,
      onPanResponderGrant: (evt) => {
        const t = seekFromLocationX(evt.nativeEvent.locationX);
        setScrubbing(true);
        setScrubTime(t);
      },
      onPanResponderMove: (evt) => {
        setScrubTime(seekFromLocationX(evt.nativeEvent.locationX));
      },
      onPanResponderRelease: (evt) => {
        const t = seekFromLocationX(evt.nativeEvent.locationX);
        setScrubbing(false);
        onSeek?.(t);
      },
      onPanResponderTerminate: () => {
        setScrubbing(false);
      },
    })
  ).current;

  return (
    <View style={styles.progressContainer}>
      <View
        style={styles.progressBarHitArea}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) trackWidthRef.current = w;
        }}
        {...panResponder.panHandlers}
      >
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
          <View style={[styles.scrubberDot, { left: `${progress * 100}%` }]} />
        </View>
      </View>

      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(displayTime)}</Text>
        {format === 'elapsedTotal' ? (
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        ) : (
          <Text style={styles.timeText}>-{formatTime(remaining)}</Text>
        )}
      </View>
    </View>
  );
}
