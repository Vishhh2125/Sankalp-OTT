import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';

import RootStackNavigator from './src/navigation/RootStackNavigator';
import { store } from './src/redux';
import { setStore, setAuthActions } from './src/services/api';
import { setTokens, logout } from './src/redux/slices/authSlice';
import { setFeedStore } from './src/redux/slices/reelsSlice';
import { setShowPlayerStore } from './src/redux/slices/showPlayerSlice';

// Pass Redux store to API interceptors (auth + feed)
setStore(store);

// Pass auth action creators to API service for proper Redux state updates
// when token refresh happens inside the response interceptor
setAuthActions({
  setTokens,
  logout,
});

// Pass store to feed slice so it can read state in async thunks
setFeedStore(store);
setShowPlayerStore(store);

export default function App() {
  return (
    <Provider store={store}>
      {/* "light" keeps status bar text/icons white on the dark app background */}
      <StatusBar style="light" />
      <RootStackNavigator />
    </Provider>
  );
}
