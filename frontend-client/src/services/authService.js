/**
 * Auth Service - Handles token management for mobile (iOS/Android)
 * 
 * Mobile (React Native Expo):
 *   - Uses expo-secure-store for persistent storage
 *   - accessToken: stored in Redux (runtime)
 *   - refreshToken: stored in SecureStore (persistent)
 * 
 * Backend handles:
 *   - Web cookies (set by backend for web clients)
 *   - Token rotation on refresh
 */

import * as SecureStore from 'expo-secure-store';

/**
 * Get refresh token from SecureStore
 * @returns {Promise<string|null>} refreshToken or null
 */
export const getRefreshToken = async () => {
  try {
    const token = await SecureStore.getItemAsync('refreshToken');
    return token || null;
  } catch (error) {
    console.error('[authService] Error getting refresh token:', error);
    return null;
  }
};

/**
 * Get access token from Redux store (passed as parameter)
 * @param {object} store - Redux store
 * @returns {string|null} accessToken or null
 */
export const getAccessToken = (store) => {
  try {
    return store?.auth?.accessToken || null;
  } catch (error) {
    console.error('[authService] Error getting access token:', error);
    return null;
  }
};

/**
 * Save tokens to SecureStore and Redux state
 * @param {string} accessToken - Access token (stored in Redux)
 * @param {string} refreshToken - Refresh token (stored in SecureStore)
 * @returns {Promise<void>}
 */
export const saveTokens = async (accessToken, refreshToken) => {
  try {
    // Mobile: save refreshToken to SecureStore
    if (refreshToken) {
      await SecureStore.setItemAsync('refreshToken', refreshToken);
    }
    console.log('[authService] Tokens saved to SecureStore');
  } catch (error) {
    console.error('[authService] Error saving tokens:', error);
    throw error;
  }
};

/**
 * Clear all tokens from SecureStore
 * @returns {Promise<void>}
 */
export const clearTokens = async () => {
  try {
    // Mobile: remove refreshToken from SecureStore
    await SecureStore.deleteItemAsync('refreshToken');
    console.log('[authService] Refresh token removed from SecureStore');
  } catch (error) {
    console.error('[authService] Error clearing tokens:', error);
    throw error;
  }
};

/**
 * Get client type header value (always mobile for this app)
 * @returns {string} 'mobile'
 */
export const getClientType = () => {
  return 'mobile';
};

/**
 * Check if user is authenticated
 * @param {object} store - Redux store
 * @returns {boolean} true if accessToken exists
 */
export const isAuthenticated = (store) => {
  return !!getAccessToken(store);
};

