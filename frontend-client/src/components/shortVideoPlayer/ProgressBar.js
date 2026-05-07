import React from 'react';
import { Text, TouchableWithoutFeedback, View } from 'react-native';

import { SCREEN_WIDTH } from './constants';
import { styles } from './styles';
import { formatTime } from './utils';

export default function ProgressBar({ currentTime, duration, onSeek }) {
  const progress = duration > 0 ? currentTime / duration : 0;
  const remaining = duration - currentTime;

  const handlePress = (e) => {
    const touchX = e.nativeEvent.locationX;
    const barWidth = SCREEN_WIDTH - 32;
    const seekRatio = Math.max(0, Math.min(1, touchX / barWidth));
    const seekTime = seekRatio * duration;

    if (onSeek) {
      onSeek(seekTime);
    }
  };

  return (
    <View style={styles.progressContainer}>
      <TouchableWithoutFeedback onPress={handlePress}>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
          <View style={[styles.scrubberDot, { left: `${progress * 100}%` }]} />
        </View>
      </TouchableWithoutFeedback>

      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
        <Text style={styles.timeText}>-{formatTime(remaining)}</Text>
      </View>
    </View>
  );
}
