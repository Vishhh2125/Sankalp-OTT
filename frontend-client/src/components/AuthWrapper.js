import React, { useCallback, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import AppNavigator from '../navigation/AppNavigator';
import AuthNavigator from '../navigation/AuthNavigator';
import DailyCheckinGate from './rewards/DailyCheckinGate';
import SplashScreen from './SplashScreen';
import { GuestAuthProvider } from '../context/GuestAuthContext';
import { ROUTES } from '../constants/routes';
import { initAuth } from '../redux/slices/authSlice';

export default function AuthWrapper() {
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const isInitializing = useSelector((state) => state.auth.isInitializing);
  const [guestMode, setGuestMode] = useState(false);
  const [authEntryRoute, setAuthEntryRoute] = useState(ROUTES.LOGIN);

  React.useEffect(() => {
    dispatch(initAuth());
  }, [dispatch]);

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
