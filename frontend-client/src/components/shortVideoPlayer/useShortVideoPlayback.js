import { useCallback, useEffect, useRef, useState } from 'react';
import { recordView } from './viewCountApi';

// Minimum cumulative active watch time before a view is counted.
// Matches backend default: min_view_duration_seconds = 30.
const MIN_VIEW_DURATION_SEC = 30;

/**
 * useShortVideoPlayback
 * Migrated from expo-video → react-native-video v6
 *
 * Optional params
 * ───────────────
 * onProgressUpdate(progressSec) – called every 15 seconds of actual playback.
 *   Use this to persist watch progress (e.g. upsertWatchHistory).
 *   Only fires when the video is actually playing (not paused, not locked).
 *
 * showId / episodeId – when provided, fires the view-count API once the user
 *   has accumulated MIN_VIEW_DURATION_SEC of active (non-paused) playback time.
 */
// UUID v4 generator - no external dependency needed.
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export default function useShortVideoPlayback({
  streamUrl,
  isActive,
  isFocused,
  isLocked,
  itemKey,
  initialDuration = 0,
  onProgressUpdate = null,
  showId = null,
  episodeId = null,
  accessToken = null,
}) {
  const lastTapAtRef = useRef(0);
  const videoRef = useRef(null);
  const lastProgressUpdateRef = useRef(0); // tracks last progress_sec we reported
  const pendingSeekRef = useRef(null);
  const currentTimeRef = useRef(0);

  // ── View count refs (no re-renders needed) ──────────────────────
  // sessionIdRef:      new UUID v4 each time itemKey changes (new episode/session).
  // elapsedPlayRef:    cumulative active playback seconds (NOT seek position).
  // viewFiredRef:      true once the API call has been fired this session.
  // lastTickRef:       wall-clock ms of last onProgress tick, to measure real elapsed.
  const sessionIdRef = useRef(null);
  const elapsedPlayRef = useRef(0);
  const viewFiredRef = useRef(false);
  const lastTickRef = useRef(null);

  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration);

  const paused = !isActive || !isFocused || manuallyPaused || isLocked || !streamUrl;

  // Reset state whenever the item changes
  useEffect(() => {
    setFirstFrameReady(false);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    setManuallyPaused(false);
    setDuration(initialDuration);
    lastProgressUpdateRef.current = 0; // reset progress tracker on item change
    pendingSeekRef.current = null;
    // Reset view count tracking for the new session
    sessionIdRef.current = generateUUID();
    elapsedPlayRef.current = 0;
    viewFiredRef.current = false;
    lastTickRef.current = null;
  }, [initialDuration, itemKey]);

  const onLoad = useCallback((data) => {
    //console.log(`✅ [useShortVideoPlayback] Video loaded - itemKey: ${itemKey}, duration: ${data.duration}s`);
    if (data.duration > 0) {
      setDuration(data.duration);
    }
  }, [itemKey]);

  const onProgress = useCallback((data) => {
    const nextTime = data.currentTime || 0;
    const pendingSeek = pendingSeekRef.current;
    if (pendingSeek) {
      const elapsedMs = Date.now() - pendingSeek.startedAt;
      const seekingForward = pendingSeek.time >= pendingSeek.previousTime;
      const reachedTarget = seekingForward
        ? nextTime >= pendingSeek.time - 0.75
        : nextTime <= pendingSeek.time + 0.75;

      if (!reachedTarget && elapsedMs < 3000) {
        return;
      }

      pendingSeekRef.current = null;
    }

    const knownDuration = data.seekableDuration || duration;
    const previousTime = currentTimeRef.current;
    const loopedToStart = knownDuration > 0 && previousTime > knownDuration - 1 && nextTime < 1.5;
    const tinyBackwardJitter = nextTime + 0.35 < previousTime;

    if (tinyBackwardJitter && !loopedToStart) {
      return;
    }

    currentTimeRef.current = nextTime;
    setCurrentTime(nextTime);

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
      console.log(`⏱️ Progress update: ${Math.floor(data.currentTime)}s / ${Math.floor(data.seekableDuration)}s`);
      onProgressUpdate(Math.floor(data.currentTime));
    }

    // View count: accumulate active play time, fire API once at threshold.
    // Uses wall-clock delta between onProgress ticks (5Gs interval).
    // Pausing resets the tick clock so paused time is never counted.
    // Cap per-tick delta at 1s to guard against background/resume spikes.
    if (!paused && showId && !viewFiredRef.current) {
      const now = Date.now();
      if (lastTickRef.current !== null) {
        const deltaSec = Math.min((now - lastTickRef.current) / 1000, 1);
        elapsedPlayRef.current += deltaSec;
        if (elapsedPlayRef.current >= MIN_VIEW_DURATION_SEC) {
          viewFiredRef.current = true;
          console.log(`[viewCount] ${elapsedPlayRef.current.toFixed(1)}s reached -- firing for show: ${showId}`);
          recordView({
            showId,
            sessionId: sessionIdRef.current,
            episodeId: episodeId ?? null,
            watchDurationSec: elapsedPlayRef.current,
            accessToken,
          });
        }
      }
      lastTickRef.current = now;
    } else if (paused) {
      lastTickRef.current = null;
    }

  }, [duration, onProgressUpdate, paused, showId, episodeId, accessToken]);

  const onReadyForDisplay = useCallback(() => {
    //console.log(`🎬 [useShortVideoPlayback] First frame ready, itemKey: ${itemKey}`);
    setFirstFrameReady(true);
  }, [itemKey]);

  const togglePlayback = useCallback(() => {
    if (isLocked || !isActive) return;

    const now = Date.now();
    if (now - lastTapAtRef.current < 80) return;
    lastTapAtRef.current = now;

    setManuallyPaused((prev) => !prev);
  }, [isActive, isLocked]);

  /** Explicit play/pause for overlay controls (avoids double-tap debounce). */
  const setManualPaused = useCallback(
    (nextPaused) => {
      if (isLocked || !isActive) return;
      setManuallyPaused(!!nextPaused);
    },
    [isActive, isLocked]
  );

  const seekTo = useCallback((time) => {
    if (!videoRef.current) return;
    pendingSeekRef.current = {
      time,
      previousTime: currentTimeRef.current,
      startedAt: Date.now(),
    };
    videoRef.current.seek(time);
    currentTimeRef.current = time;
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
    setManualPaused,
    seekTo,
    onLoad,
    onProgress,
    onReadyForDisplay,
    setFirstFrameReady,
  };
}