import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { API_BASE_URL } from '../constants/config';
import { setCoins } from '../redux/slices/authSlice';
import * as authService from '../services/authService';

const SYNC_INTERVAL = 200000; // Sync every 200 seconds (only when app is active)

/**
 * useUserDataSync Hook
 * Periodically syncs user data (coins, plan, etc.) from backend
 * This ensures admin coin adjustments are reflected in real-time
 * 
 * Optimization: Only polls when app is in FOREGROUND
 * - Pauses polling when app goes to background
 * - Resumes polling when app returns to foreground
 * - Reduces server load and battery drain significantly
 * 
 * Features:
 * - Syncs immediately on mount
 * - Polls backend every 20 seconds (foreground only)
 * - AppState listener to pause/resume
 * - Silently handles errors (non-critical)
 * - Updates Redux and SecureStore
 * - Only runs when user is authenticated
 */
export function useUserDataSync() {
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.auth?.accessToken);
  const intervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    if (!accessToken) {
      // Clean up if logged out
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const syncUserData = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/v1/auth/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 5000,
        });

        const user = response.data?.data;
        
        // Update coins if available
        if (typeof user?.coins === 'number') {
          dispatch(setCoins(user.coins));
          // Also sync to SecureStore for persistence
          await authService.patchUserDataInStore({ coins: user.coins });
        }
      } catch (error) {
        if (error.response?.status === 401) {
          console.log('[useUserDataSync] User unauthorized, clearing interval');
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      }
    };

    // Start polling immediately on mount
    syncUserData();
    intervalRef.current = setInterval(syncUserData, SYNC_INTERVAL);

    // ─────────────────────────────────────────────────────────────────
    // AppState listener: Pause polling when app goes to background
    // ─────────────────────────────────────────────────────────────────
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const isActive = appStateRef.current.match(/inactive|background/) === null;
      const nextIsActive = nextAppState.match(/inactive|background/) === null;

      // App is going to foreground
      if (!isActive && nextIsActive) {
        console.log('[useUserDataSync] App in foreground - resuming polling');
        // Sync immediately when app comes to foreground
        syncUserData();
        // Resume polling
        if (!intervalRef.current) {
          intervalRef.current = setInterval(syncUserData, SYNC_INTERVAL);
        }
      }
      // App is going to background
      else if (isActive && !nextIsActive) {
        console.log('[useUserDataSync] App in background - pausing polling');
        // Clear interval to save battery and reduce API calls
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }

      appStateRef.current = nextAppState;
    });

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      subscription?.remove();
    };
  }, [accessToken, dispatch]);
}