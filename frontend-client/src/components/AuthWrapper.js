import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import AppNavigator from '../navigation/AppNavigator';
import AuthNavigator from '../navigation/AuthNavigator';
import SplashScreen from './SplashScreen';
import { initAuth } from '../redux/slices/authSlice';

export default function AuthWrapper() {
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const isInitializing = useSelector((state) => state.auth.isInitializing);

  /**
   * On app startup, restore auth session from stored refresh token
   */
  useEffect(() => {
    // Only initialize once
    dispatch(initAuth());
  }, [dispatch]);

  /**
   * While initializing, show splash screen
   */
  if (isInitializing) {
    return <SplashScreen />;
  }

  /**
   * After initialization, show appropriate navigator
   */
  return accessToken ? <AppNavigator /> : <AuthNavigator />;
}


