import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import * as authService from '../../services/authService';
import { api } from '../../services/api';

const initialState = {
    name: null,
    email: null,
    role: null,
    plan: null,
    coins: null,
    accessToken: null,
    isInitializing: false,
    error: null,
    isLoading: false,
    status: 'idle', // idle | loading | succeeded | failed
  register: {
    status: 'idle', // idle | loading | succeeded | failed
    error: null,
    isLoading: false,
  },
  logout: {
    status: 'idle', // idle | loading | succeeded | failed
    error: null,
    isLoading: false,
  },
};

/**
 * NOTE: refreshToken is NEVER stored in Redux state
 * It is stored ONLY in SecureStore (secure device storage)
 * Only accessToken is kept in Redux for runtime use
 */

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      });

      // extract data safely
      console.log(response.data.data);
      const { accessToken, refreshToken, user } = response.data.data;

      // 🔥 save tokens using authService
      // Only refreshToken is saved to SecureStore (sensitive)
      // accessToken will be stored in Redux by reducer
      await authService.saveTokens(accessToken, refreshToken);

      // Return ONLY accessToken and user (refreshToken stays in SecureStore)
      return {
        user,
        accessToken,
      };

    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Login failed';

      return rejectWithValue(message);
    }
  }
);
export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async ({ name, email, password }, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/register', {
        name,
        email,
        password,
      });
      return response.data;
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Registration failed';
      return rejectWithValue(message);
    }
  }
);

/**
 * Initialize auth on app startup
 * Restores user session from stored refresh token
 */
export const initAuth = createAsyncThunk(
  'auth/initAuth',
  async (_, { rejectWithValue }) => {
    try {
      // Get refresh token from storage (SecureStore for mobile, cookie for web)
      const refreshTokenValue = await authService.getRefreshToken();

      if (!refreshTokenValue) {
        console.log('[initAuth] No refresh token found, staying logged out');
        return null;
      }

      // Call refresh endpoint to get new tokens
      const response = await api.get('/auth/refresh-token', {
        headers: {
          'x-client-type': authService.getClientType(),
          Authorization: `Bearer ${refreshTokenValue}`,
        },
      });

      const { accessToken, refreshToken: newRefreshToken } = response.data.data;

      // Save tokens
      // Only refreshToken goes to SecureStore (sensitive)
      await authService.saveTokens(accessToken, newRefreshToken);

      // Return ONLY accessToken to Redux (refreshToken stays in SecureStore)
      return {
        accessToken,
      };
    } catch (err) {
      console.error('[initAuth] Restore failed:', err?.message);
      // Silently fail - user will see login screen
      return rejectWithValue('Session restore failed');
    }
  }
);

/**
 * Logout user
 * 1. Call backend to invalidate refresh token
 * 2. Clear refresh token only on success
 */
export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { rejectWithValue }) => {
    try {
      // Call backend logout endpoint
      await api.post('/auth/logout', {});

      // Clear refresh token from SecureStore (only on success)
      await authService.clearTokens();

      return null;
    } catch (err) {
      // Always return generic message to user
      return rejectWithValue('Logout failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearRegisterState(state) {
      state.register.status = 'idle';
      state.register.error = null;
      state.register.isLoading = false;
    },
    clearLogoutState(state) {
      state.logout.status = 'idle';
      state.logout.error = null;
      state.logout.isLoading = false;
    },
    clearLogoutError(state) {
      state.logout.error = null;
    },
    /**
     * Set tokens (used by interceptor after refresh)
     * Only updates accessToken in Redux
     * refreshToken is managed by authService in SecureStore only
     */
    setTokens(state, action) {
      state.accessToken = action.payload.accessToken;
    },
    /**
     * Logout reducer (clears auth state)
     * refreshToken is cleared from SecureStore by authService
     */
    logout(state) {
      state.name = null;
      state.email = null;
      state.role = null;
      state.plan = null;
      state.coins = null;
      state.accessToken = null;
      state.error = null;
      state.status = 'idle';
      state.isLoading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(registerUser.pending, (state) => {
        state.register.status = 'loading';
        state.register.error = null;
        state.register.isLoading = true;
      })
      .addCase(registerUser.fulfilled, (state) => {
        state.register.status = 'succeeded';
        state.register.isLoading = false;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.register.status = 'failed';
        state.register.error = action.payload || 'Registration failed';
        state.register.isLoading = false;
      })
      // LOGIN FLOW
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
        state.isLoading = true;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        // refreshToken is in SecureStore only (never in Redux)
        state.name = action.payload.user.name;
        state.email = action.payload.user.email;
        state.role = action.payload.user.role;
        state.plan = action.payload.user.plan;
        state.coins = action.payload.user.coins;
        state.status = 'succeeded';
        state.isLoading = false;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Login failed';
        state.isLoading = false;
        state.isAuthenticated = false;
      })
      // INIT AUTH FLOW (App startup)
      .addCase(initAuth.pending, (state) => {
        state.isInitializing = true;
      })
      .addCase(initAuth.fulfilled, (state, action) => {
        state.isInitializing = false;
        if (action.payload) {
          state.accessToken = action.payload.accessToken;
          // refreshToken stays in SecureStore (never exposed in Redux)
        }
      })
      .addCase(initAuth.rejected, (state) => {
        state.isInitializing = false;
        // User stays logged out (no tokens)
      })
      // LOGOUT FLOW
      .addCase(logoutUser.pending, (state) => {
        state.logout.isLoading = true;
        state.logout.error = null;
        state.logout.status = 'loading';
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.name = null;
        state.email = null;
        state.role = null;
        state.plan = null;
        state.coins = null;
        state.accessToken = null;
        // refreshToken cleared from SecureStore by authService
        state.logout.error = null;
        state.logout.status = 'succeeded';
        state.logout.isLoading = false;
        state.status = 'idle';
      })
      .addCase(logoutUser.rejected, (state, action) => {
        // Backend logout failed - keep user logged in, only show error
        state.logout.error = action.payload || 'Logout failed';
        state.logout.status = 'failed';
        state.logout.isLoading = false;
      });
  },
});

export const { clearRegisterState, clearLogoutState, clearLogoutError, setTokens, logout } = authSlice.actions;

export default authSlice.reducer;

