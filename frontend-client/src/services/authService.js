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
 * Save user profile data to SecureStore
 * @param {object} user - User object with name, email, role, plan, coins
 * @returns {Promise<void>}
 */
export const saveUserData = async (user) => {
  try {
    if (user) {
      await SecureStore.setItemAsync('userData', JSON.stringify(user));
      console.log('[authService] User data saved to SecureStore');
    }
  } catch (error) {
    console.error('[authService] Error saving user data:', error);
    throw error;
  }
};

/**
 * Get user profile data from SecureStore
 * @returns {Promise<object|null>} user object or null
 */
export const getUserData = async () => {
  try {
    const userData = await SecureStore.getItemAsync('userData');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('[authService] Error getting user data:', error);
    return null;
  }
};

/**
 * Merge partial fields into stored user JSON (e.g. coins after wallet top-up).
 */
export const patchUserDataInStore = async (partial) => {
  try {
    const existing = await getUserData();
    if (!existing) return;
    await saveUserData({ ...existing, ...partial });
  } catch (error) {
    console.error('[authService] Error patching user data:', error);
    throw error;
  }
};

/**
 * Clear all tokens from SecureStore
 * @returns {Promise<void>}
 */
export const clearTokens = async () => {
  try {
    // Mobile: remove refreshToken and userData from SecureStore
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('userData');
    console.log('[authService] Refresh token and user data removed from SecureStore');
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

