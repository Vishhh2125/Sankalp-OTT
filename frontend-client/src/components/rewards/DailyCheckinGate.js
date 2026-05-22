import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Alert } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import DailyCheckinPopup from './DailyCheckinPopup';
import {
  fetchCheckinStatus,
  claimDailyCheckin,
  walletApiErrorMessage,
} from './dailyCheckinApi';
import {
  wasCheckinPopupDismissedToday,
  markCheckinPopupDismissedToday,
  clearCheckinPopupDismissed,
} from './dailyCheckinStorage';
import { setCoins } from '../../redux/slices/authSlice';
import * as authService from '../../services/authService';

/**
 * Shows daily check-in popup on first app open of the day (logged-in users only).
 */
export default function DailyCheckinGate({ children }) {
  const dispatch = useDispatch();
  const accessToken = useSelector((s) => s.auth?.accessToken);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const checkingRef = useRef(false);
  const appState = useRef(AppState.currentState);

  const tryShowPopup = useCallback(async () => {
    if (!accessToken || checkingRef.current) return;
    checkingRef.current = true;

    try {
      const dismissed = await wasCheckinPopupDismissedToday();
      if (dismissed) {
        setVisible(false);
        return;
      }

      const data = await fetchCheckinStatus(accessToken);
      setStatus(data);

      if (data?.claimed_today) {
        setVisible(false);
        await clearCheckinPopupDismissed();
        return;
      }

      setVisible(true);
    } catch {
      setVisible(false);
    } finally {
      checkingRef.current = false;
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) {
      const t = setTimeout(() => tryShowPopup(), 400);
      return () => clearTimeout(t);
    }
    setVisible(false);
    setStatus(null);
  }, [accessToken, tryShowPopup]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const prev = appState.current;
      appState.current = nextState;
      if (
        accessToken &&
        (prev === 'background' || prev === 'inactive') &&
        nextState === 'active'
      ) {
        tryShowPopup();
      }
    });
    return () => sub.remove();
  }, [accessToken, tryShowPopup]);

  const onDismiss = async () => {
    await markCheckinPopupDismissedToday();
    setVisible(false);
  };

  const onClaim = async () => {
    if (!accessToken) return;
    setClaiming(true);
    try {
      const data = await claimDailyCheckin(accessToken);
      dispatch(setCoins(data.coins));
      await authService.patchUserDataInStore({ coins: data.coins });
      await clearCheckinPopupDismissed();
      setVisible(false);
      setStatus((s) => (s ? { ...s, claimed_today: true, coins: data.coins } : s));
      Alert.alert(
        'Reward claimed',
        `You received ${data.coins_awarded} coins for Day ${data.streak_day}!`
      );
    } catch (err) {
      Alert.alert(
        'Check-in failed',
        walletApiErrorMessage(err, 'Could not claim reward')
      );
    } finally {
      setClaiming(false);
    }
  };

  return (
    <>
      {children}
      <DailyCheckinPopup
        visible={visible}
        status={status}
        claiming={claiming}
        onClaim={onClaim}
        onDismiss={onDismiss}
      />
    </>
  );
}
