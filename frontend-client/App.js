import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { CaptureProtectionProvider } from 'react-native-capture-protection';
import { LogBox } from 'react-native';

LogBox.ignoreLogs(['Network Error', 'Network error']);
import RootStackNavigator from './src/navigation/RootStackNavigator';
import { PlaybackSpeedProvider } from './src/context/PlaybackSpeedContext';
import { PlaybackVolumeProvider } from './src/context/PlaybackVolumeContext';
import { VideoQualityProvider } from './src/context/VideoQualityContext';
import { LandscapePlaybackProvider } from './src/context/LandscapePlaybackContext';
import { store } from './src/redux';
import { setStore, setAuthActions } from './src/services/api';
import { setTokens, logout } from './src/redux/slices/authSlice';
import { setFeedStore } from './src/redux/slices/reelsSlice';
import { setShowPlayerStore } from './src/redux/slices/showPlayerSlice';
import { NetworkProvider } from './src/context/NetworkContext';

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
    <NetworkProvider>
      <CaptureProtectionProvider>
        <Provider store={store}>
        <PlaybackSpeedProvider>
          <PlaybackVolumeProvider>
            <VideoQualityProvider>
              <LandscapePlaybackProvider>
              {/* "light" keeps status bar text/icons white on the dark app background */}
              <StatusBar style="light" />
              <RootStackNavigator />
              </LandscapePlaybackProvider>
            </VideoQualityProvider>
          </PlaybackVolumeProvider>
        </PlaybackSpeedProvider>
      </Provider>
    </CaptureProtectionProvider>
    </NetworkProvider>
  );
}
