import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';

import AppNavigator from '../navigation/AppNavigator';
import AuthNavigator from '../navigation/AuthNavigator';
import DailyCheckinGate from './rewards/DailyCheckinGate';
import SplashScreen from './SplashScreen';
import { GuestAuthProvider } from '../context/GuestAuthContext';
import { ROUTES } from '../constants/routes';
import { initAuth } from '../redux/slices/authSlice';
import { fetchPendingNotifications } from '../redux/slices/notificationSlice'; // NEW

export default function AuthWrapper({ onDeepLink }) {
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const isInitializing = useSelector((state) => state.auth.isInitializing);
  const [guestMode, setGuestMode] = useState(false);
  const [authEntryRoute, setAuthEntryRoute] = useState(ROUTES.LOGIN);

  const coldStartHandled = useRef(false);

  useEffect(() => {
    dispatch(initAuth());
  }, [dispatch]);

  // NEW: Fetch pending notifications when user logs in
  React.useEffect(() => {
    if (accessToken && !guestMode) {
      dispatch(fetchPendingNotifications());
    }
  }, [accessToken, guestMode, dispatch]);

  const onGuestAccess = useCallback(() => {
    setGuestMode(true);
  }, []);

  const openSignUp = useCallback(() => {
    setGuestMode(false);
    setAuthEntryRoute(ROUTES.SIGNUP);
  }, []);

  const openLogin = useCallback(() => {
    setGuestMode(false);
    setAuthEntryRoute(ROUTES.LOGIN);
  }, []);

  if (isInitializing) {
    return <SplashScreen />;
  }

  if (accessToken) {
    return (
      <DailyCheckinGate>
        <AppNavigator />
      </DailyCheckinGate>
    );
  }

  if (guestMode) {
    return (
      <GuestAuthProvider onOpenSignUp={openSignUp} onOpenLogin={openLogin}>
        <AppNavigator />
      </GuestAuthProvider>
    );
  }

  return (
    <AuthNavigator
      key={authEntryRoute}
      initialRouteName={authEntryRoute}
      onGuestAccess={onGuestAccess}
    />
  );
}