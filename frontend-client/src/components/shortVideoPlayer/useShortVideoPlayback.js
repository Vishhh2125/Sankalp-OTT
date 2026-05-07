import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useShortVideoPlayback
 * Migrated from expo-video → react-native-video v6
 *
 * react-native-video v6 is declarative: playback is driven by the `paused` prop
 * on the <Video> component rather than an imperative player object.
 * Seeking is performed via a ref: videoRef.current.seek(seconds).
 *
 * Returned values
 * ───────────────
 * videoRef        – attach to <Video ref={videoRef} />
 * paused          – pass as <Video paused={paused} />
 * currentTime     – current playback position in seconds
 * duration        – total duration in seconds
 * firstFrameReady – true once the first frame has been rendered (onReadyForDisplay)
 * manuallyPaused  – whether the user intentionally paused
 * togglePlayback  – tap handler (same double-tap guard as before)
 * seekTo          – seek to an absolute position in seconds
 * onLoad          – pass to <Video onLoad={onLoad} />
 * onProgress      – pass to <Video onProgress={onProgress} />
 * onReadyForDisplay – pass to <Video onReadyForDisplay={onReadyForDisplay} />
 * setFirstFrameReady – kept for parity (lets the parent reset the flag if needed)
 */
export default function useShortVideoPlayback({
  streamUrl,
  isActive,
  isFocused,
  isLocked,
  itemKey,
  initialDuration = 0,
}) {
  const lastTapAtRef = useRef(0);
  const videoRef = useRef(null);

  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration);

  // Derive the single `paused` boolean that drives the <Video> prop.
  // The video plays only when: active slide, screen focused, not manually paused,
  // not locked, and a URL is available.
  const paused = !isActive || !isFocused || manuallyPaused || isLocked || !streamUrl;

  // Reset state whenever the item changes (user swiped to a new episode).
  useEffect(() => {
    setFirstFrameReady(false);
    setCurrentTime(0);
    setManuallyPaused(false);
    setDuration(initialDuration);
  }, [initialDuration, itemKey]);

  // ─── react-native-video v6 event callbacks ────────────────────────────────

  /**
   * onLoad – fires when the media is loaded and ready to play.
   * Payload: { duration, currentTime, ... }
   */
  const onLoad = useCallback((data) => {
    if (data.duration > 0) {
      setDuration(data.duration);
    }
  }, []);

  /**
   * onProgress – fires periodically with the current playback position.
   * Payload: { currentTime, playableDuration, seekableDuration }
   * Replaces the `timeUpdate` event listener from expo-video.
   */
  const onProgress = useCallback((data) => {
    setCurrentTime(data.currentTime);

    // Fallback: capture duration from seekableDuration if onLoad didn't fire it.
    if (duration === 0 && data.seekableDuration > 0) {
      setDuration(data.seekableDuration);
    }
  }, [duration]);

  /**
   * onReadyForDisplay – fires when the first video frame is rendered.
   * Replaces the onFirstFrameRender prop on expo-video's <VideoView>.
   */
  const onReadyForDisplay = useCallback(() => {
    setFirstFrameReady(true);
  }, []);

  // ─── Imperative controls ──────────────────────────────────────────────────

  /**
   * togglePlayback – mirrors the original logic exactly.
   * Guards against accidental double-taps (< 80 ms apart).
   */
  const togglePlayback = useCallback(() => {
    if (isLocked || !isActive) return;

    const now = Date.now();
    if (now - lastTapAtRef.current < 80) return;
    lastTapAtRef.current = now;

    setManuallyPaused((prev) => !prev);
  }, [isActive, isLocked]);

  /**
   * seekTo – seek to an absolute position (seconds).
   * Uses the ref-based `.seek()` method from react-native-video v6.
   */
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
    // Kept for parity with the original API surface so the parent component
    // can still call setFirstFrameReady(false) when needed.
    setFirstFrameReady,
  };
}