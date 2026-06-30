import React, { createContext, useContext, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

const NetworkContext = createContext({
  isOffline: false,
});

export const NetworkProvider = ({ children }) => {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Initial fetch
    NetInfo.fetch().then((state) => {
      setIsOffline(state.isConnected === false);
    });

    // Subscribe to ongoing changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(state.isConnected === false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <NetworkContext.Provider value={{ isOffline }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => useContext(NetworkContext);
