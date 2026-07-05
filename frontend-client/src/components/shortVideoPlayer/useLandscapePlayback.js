import { useCallback, useEffect, useRef } from 'react';
import { StatusBar, BackHandler } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

import { useLandscapePlaybackContext } from '../../context/LandscapePlaybackContext';

export default function useLandscapePlayback({ isActive, enabled = true }) {
  const { isLandscape, setIsLandscape } = useLandscapePlaybackContext();
  const ownedLandscapeRef = useRef(false);

  const enterLandscape = useCallback(async () => {
    if (!enabled || !isActive) return;
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      StatusBar.setHidden(true, 'fade');
      ownedLandscapeRef.current = true;
      setIsLandscape(true);
    } catch (error) {
      console.warn('Failed to enter landscape playback', error);
    }
  }, [enabled, isActive, setIsLandscape]);

  const exitLandscape = useCallback(async () => {
    if (!ownedLandscapeRef.current && !isLandscape) return;
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } catch (error) {
      console.warn('Failed to restore portrait orientation', error);
    } finally {
      StatusBar.setHidden(false, 'fade');
      ownedLandscapeRef.current = false;
      setIsLandscape(false);
    }
  }, [isLandscape, setIsLandscape]);

  useEffect(() => {
    if (!isActive && ownedLandscapeRef.current) {
      exitLandscape();
    }
  }, [isActive, exitLandscape]);

  useEffect(() => () => {
    if (ownedLandscapeRef.current) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      StatusBar.setHidden(false, 'fade');
      setIsLandscape(false);
      ownedLandscapeRef.current = false;
    }
  }, [setIsLandscape]);

  const isLandscapeActive = isLandscape && isActive;

  useEffect(() => {
    if (!isLandscapeActive) return undefined;

    const onBackPress = () => {
      exitLandscape();
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    return () => {
      subscription.remove();
    };
  }, [isLandscapeActive, exitLandscape]);

  return {
    isLandscape,
    isLandscapeActive,
    enterLandscape,
    exitLandscape,
  };
}
