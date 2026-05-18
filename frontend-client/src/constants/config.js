import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

// Auto-detect dev machine IP from Expo
function getDevMachineIpFromExpo() {
  const hostUri =
    Constants?.expoConfig?.hostUri ||
    Constants?.expoGoConfig?.hostUri ||
    Constants?.manifest2?.extra?.expoClient?.hostUri ||
    Constants?.manifest?.hostUri;

  if (typeof hostUri !== 'string') return null;
  const ip = hostUri.split('/')[0].split(':')[0];
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return null;
  return ip;
}

const DEV_MACHINE_IP = getDevMachineIpFromExpo();

// Backend runs on port 3000
// Auth routes: /api/v1/auth/...
// Feed routes: /api/feed/...
// Media routes: /api/media/...
// So base URL should NOT have /api/v1 — each service adds its own prefix

const BACKEND_PORT = 3000;

const DEFAULT_LOCAL_API_BASE_URL = (() => {
  if (Platform.OS === 'android') {
    if (Device.isDevice && DEV_MACHINE_IP) {
      return `http://${DEV_MACHINE_IP}:${BACKEND_PORT}`;
    }
    // Android emulator → host machine localhost
    return `http://10.0.2.2:${BACKEND_PORT}`;
  }

  // iOS / web
  if (Device.isDevice && DEV_MACHINE_IP) {
    return `http://${DEV_MACHINE_IP}:${BACKEND_PORT}`;
  }
  return `http://localhost:${BACKEND_PORT}`;
})();

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_LOCAL_API_BASE_URL;

console.log('API_BASE_URL', API_BASE_URL);

export const REQUEST_TIMEOUT_MS = 15000;
