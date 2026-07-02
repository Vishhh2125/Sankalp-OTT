import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { patchUserProfile } from '../redux/slices/authSlice';
import * as authService from '../services/authService';
import { api } from '../services/api';

const SYNC_INTERVAL = 1800000; // 30 minutes (1,800,000 ms)

/**
 * useUserDataSync Hook
 * Periodically syncs user data (coins, plan, membership) from the backend.
 * This is the SINGLE authorised caller of GET /auth/me in the app — PromoFlowGate
 * reads plan/membership from the Redux state that this hook keeps fresh, so there
 * is no duplicate polling.
 *
 * Behaviour:
 * - Syncs immediately on mount (so UI is fresh right after login).
 * - Polls every 30 minutes while the app is in the foreground.
 * - Pauses the interval when the app goes to background (saves battery & server load).
 * - Fires one immediate sync when the app returns to foreground, then resumes interval.
 * - On 401, clears the interval and stops polling (user will be logged out by auth layer).
 * - Only runs while accessToken is present.
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
        const response = await api.get('/auth/me', {
          timeout: 5000,
        });

        const user = response.data?.data;

        const patch = {};
        if (typeof user?.coins === 'number') patch.coins = user.coins;
        if (user?.plan !== undefined) patch.plan = user.plan;
        if (user?.memberships !== undefined) patch.memberships = user.memberships;
        if (user?.has_all_access !== undefined) patch.has_all_access = user.has_all_access;

        if (Object.keys(patch).length > 0) {
          dispatch(patchUserProfile(patch));
          await authService.patchUserDataInStore(patch);
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

    // Sync immediately on mount, then start the interval
    syncUserData();
    intervalRef.current = setInterval(syncUserData, SYNC_INTERVAL);

    // ─────────────────────────────────────────────────────────────────
    // AppState listener: pause polling when app goes to background
    // ─────────────────────────────────────────────────────────────────
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const isActive = appStateRef.current.match(/inactive|background/) === null;
      const nextIsActive = nextAppState.match(/inactive|background/) === null;

      // App is returning to foreground
      if (!isActive && nextIsActive) {
        console.log('[useUserDataSync] App in foreground - resuming polling');
        syncUserData();
        if (!intervalRef.current) {
          intervalRef.current = setInterval(syncUserData, SYNC_INTERVAL);
        }
      }
      // App is going to background
      else if (isActive && !nextIsActive) {
        console.log('[useUserDataSync] App in background - pausing polling');
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