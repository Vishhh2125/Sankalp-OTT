import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

// Central place for app configuration.
// For Expo, you can set values at build time via `EXPO_PUBLIC_*` environment variables.
//
// Note about localhost:
// - Android emulator: use http://10.0.2.2:<port>
// - iOS simulator / Web: http://localhost:<port> usually works
function getDevMachineIpFromExpo() {
  // Expo often exposes the dev machine address in `hostUri`, e.g. "192.168.0.128:8081"
  const hostUri =
    Constants?.expoConfig?.hostUri ||
    Constants?.expoGoConfig?.hostUri ||
    Constants?.manifest2?.extra?.expoClient?.hostUri ||
    Constants?.manifest?.hostUri;

  if (typeof hostUri !== 'string') return null;

  const host = hostUri.split('/')[0]; // just in case
  const ip = host.split(':')[0];
  // Very lightweight IP check
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return null;
  return ip;
}

const DEV_MACHINE_IP = getDevMachineIpFromExpo();

const DEFAULT_LOCAL_API_BASE_URL = (() => {
  // Android:
  // - Emulator: use 10.0.2.2
  // - Real phone: use dev machine IP (same Wi-Fi)
  if (Platform.OS === 'android') {
    // if (Device.isDevice) {
    //   return DEV_MACHINE_IP
    //     ? `http://${DEV_MACHINE_IP}:5000/api/v1`
    //     : 'http://localhost:5000/api/v1';
    // }
    // return 'http://10.0.2.2:5000/api/v1';
    return 'http://localhost:5000/api/v1';
  }

  // iOS / others:
  // - Simulator: localhost works
  // - Real device: use dev machine IP (same Wi-Fi)
  if (Device.isDevice && DEV_MACHINE_IP) return `http://${DEV_MACHINE_IP}:5000/api/v1`;
  return 'http://localhost:5000/api/v1';
})();

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_LOCAL_API_BASE_URL;

export const REQUEST_TIMEOUT_MS = 15000;

