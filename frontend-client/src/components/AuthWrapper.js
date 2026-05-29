import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';

import AppNavigator from '../navigation/AppNavigator';
import AuthNavigator from '../navigation/AuthNavigator';
import PromoFlowGate from './promo/PromoFlowGate';
import SplashScreen from './SplashScreen';
import { GuestAuthProvider } from '../context/GuestAuthContext';
import { ROUTES } from '../constants/routes';
import { initAuth } from '../redux/slices/authSlice';

export default function AuthWrapper({ onDeepLink }) {
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const isInitializing = useSelector((state) => state.auth.isInitializing);
  const pendingRegistration = useSelector((state) => state.auth.pendingRegistration);
  const pendingPasswordReset = useSelector((state) => state.auth.pendingPasswordReset);
  const [guestMode, setGuestMode] = useState(false);
  const [authEntryRoute, setAuthEntryRoute] = useState(ROUTES.LOGIN);

  const coldStartHandled = useRef(false);

  useEffect(() => {
    dispatch(initAuth());
  }, [dispatch]);



  // Cold-start deep link
  useEffect(() => {
    if (isInitializing) return;
    if (coldStartHandled.current) return;
    if (!onDeepLink) return;

    coldStartHandled.current = true;

    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          try {
            onDeepLink({ url });
          } catch (error) {
            console.error('Error handling deep link:', error);
          }
        }
      })
      .catch((error) => {
        console.error('Error retrieving initial URL:', error);
      });
  }, [isInitializing, onDeepLink]);

  // Warm-start deep link
  useEffect(() => {
    if (!onDeepLink) return;

    const handleUrl = ({ url }) => {
      try {
        onDeepLink({ url });
      } catch (error) {
        console.error('Error handling deep link:', error);
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);
    return () => {
      if (subscription) subscription.remove();
    };
  }, [onDeepLink]);

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

  useEffect(() => {
    if (pendingRegistration?.sessionId) {
      setAuthEntryRoute(ROUTES.OTP);
      return;
    }
    if (pendingPasswordReset?.sessionId) {
      setAuthEntryRoute(ROUTES.RESET_PASSWORD);
      return;
    }
    setAuthEntryRoute(ROUTES.LOGIN);
  }, [pendingPasswordReset, pendingRegistration]);

  if (isInitializing) {
    return <SplashScreen />;
  }

  if (accessToken) {
    return (
      <PromoFlowGate>
        <AppNavigator />
      </PromoFlowGate>
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
      otpInitialParams={pendingRegistration || undefined}
      resetPasswordInitialParams={pendingPasswordReset || undefined}
    />
  );
}