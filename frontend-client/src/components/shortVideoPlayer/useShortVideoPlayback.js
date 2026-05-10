import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useShortVideoPlayback
 * Migrated from expo-video → react-native-video v6
 *
 * Optional params
 * ───────────────
 * onProgressUpdate(progressSec) – called every 15 seconds of actual playback.
 *   Use this to persist watch progress (e.g. upsertWatchHistory).
 *   Only fires when the video is actually playing (not paused, not locked).
 */
export default function useShortVideoPlayback({
  streamUrl,
  isActive,
  isFocused,
  isLocked,
  itemKey,
  initialDuration = 0,
  onProgressUpdate = null,
}) {
  const lastTapAtRef = useRef(0);
  const videoRef = useRef(null);
  const lastProgressUpdateRef = useRef(0); // tracks last progress_sec we reported

  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration);

  const paused = !isActive || !isFocused || manuallyPaused || isLocked || !streamUrl;

  // Reset state whenever the item changes
  useEffect(() => {
    setFirstFrameReady(false);
    setCurrentTime(0);
    setManuallyPaused(false);
    setDuration(initialDuration);
    lastProgressUpdateRef.current = 0; // reset progress tracker on item change
  }, [initialDuration, itemKey]);

  const onLoad = useCallback((data) => {
    if (data.duration > 0) {
      setDuration(data.duration);
    }
  }, []);

  const onProgress = useCallback((data) => {
    setCurrentTime(data.currentTime);

    if (duration === 0 && data.seekableDuration > 0) {
      setDuration(data.seekableDuration);
    }

    // Fire onProgressUpdate every 15 seconds while actually playing
    if (
      onProgressUpdate &&
      !paused &&
      data.currentTime - lastProgressUpdateRef.current >= 15
    ) {
      lastProgressUpdateRef.current = data.currentTime;
      onProgressUpdate(Math.floor(data.currentTime));
    }
  }, [duration, onProgressUpdate, paused]);

  const onReadyForDisplay = useCallback(() => {
    setFirstFrameReady(true);
  }, []);

  const togglePlayback = useCallback(() => {
    if (isLocked || !isActive) return;

    const now = Date.now();
    if (now - lastTapAtRef.current < 80) return;
    lastTapAtRef.current = now;

    setManuallyPaused((prev) => !prev);
  }, [isActive, isLocked]);

  const seekTo = useCallback((time) => {
    if (!videoRef.current) return;
    videoRef.current.seek(time);
    setCurrentTime(time);
  }, []);

  return {
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
  };
}