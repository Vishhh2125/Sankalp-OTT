import React, { createContext, useCallback, useContext, useMemo } from 'react';

import { ROUTES } from '../constants/routes';

const GuestAuthContext = createContext(null);

/**
 * Lets guest users leave the main app and open Login / Sign Up screens.
 * Provided by AuthWrapper while guestMode is active.
 */
export function GuestAuthProvider({ children, onOpenSignUp, onOpenLogin }) {
  const value = useMemo(
    () => ({
      isGuest: true,
      openSignUp: onOpenSignUp,
      openLogin: onOpenLogin,
    }),
    [onOpenSignUp, onOpenLogin]
  );

  return (
    <GuestAuthContext.Provider value={value}>{children}</GuestAuthContext.Provider>
  );
}

export function useGuestAuth() {
  const ctx = useContext(GuestAuthContext);
  return (
    ctx ?? {
      isGuest: false,
      openSignUp: () => {},
      openLogin: () => {},
    }
  );
}
