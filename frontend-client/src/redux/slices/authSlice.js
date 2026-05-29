import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import * as authService from '../../services/authService';
import { api } from '../../services/api';

const initialState = {
    userId: null,
    name: null,
    email: null,
    role: null,
    plan: null,
    coins: null,
    membership: null,
    accessToken: null,
    isInitializing: false,
    error: null,
    isLoading: false,
    status: 'idle', // idle | loading | succeeded | failed
  register: {
    status: 'idle', // idle | loading | succeeded | failed
    error: null,
    isLoading: false,
    data: null,
  },
  otp: {
    status: 'idle', // idle | loading | succeeded | failed
    error: null,
    isLoading: false,
    resendStatus: 'idle',
    resendError: null,
    isResending: false,
    data: null,
  },
  forgotPassword: {
    status: 'idle',
    error: null,
    isLoading: false,
    data: null,
  },
  passwordReset: {
    status: 'idle',
    error: null,
    isLoading: false,
    resendStatus: 'idle',
    resendError: null,
    isResending: false,
    data: null,
  },
  pendingPasswordReset: null,
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
      
      // Save user data to SecureStore for later restoration
      await authService.saveUserData(user);

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
      const registrationData = response.data?.data || null;
      await authService.savePendingRegistration(registrationData);
      return registrationData;
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

export const verifyOtp = createAsyncThunk(
  'auth/verifyOtp',
  async ({ sessionId, otp }, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/verify-otp', {
        sessionId,
        otp,
      });

      await authService.clearPendingRegistration();

      return {
        user: response.data?.data || null,
        message: response.data?.message || 'Email verified successfully',
      };
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'OTP verification failed';

      return rejectWithValue(message);
    }
  }
);

export const requestForgotPassword = createAsyncThunk(
  'auth/requestForgotPassword',
  async ({ email }, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/forgot-password', { email });
      const resetData = response.data?.data || null;
      await authService.savePendingPasswordReset(resetData);
      return resetData;
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to send reset code';
      return rejectWithValue(message);
    }
  }
);

export const resetPasswordWithOtp = createAsyncThunk(
  'auth/resetPasswordWithOtp',
  async ({ sessionId, otp, newPassword }, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/reset-password', {
        sessionId,
        otp,
        newPassword,
      });

      await authService.clearPendingPasswordReset();

      return {
        message: response.data?.message || 'Password reset successfully',
      };
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Password reset failed';
      return rejectWithValue(message);
    }
  }
);

export const resendForgotOtp = createAsyncThunk(
  'auth/resendForgotOtp',
  async ({ sessionId }, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/resend-forgot-otp', { sessionId });
      const data = response.data?.data || null;
      const pendingReset = await authService.getPendingPasswordReset();

      if (pendingReset && data) {
        await authService.savePendingPasswordReset({
          ...pendingReset,
          ...data,
        });
      }

      return data;
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to resend OTP';
      return rejectWithValue(message);
    }
  }
);

export const resendOtp = createAsyncThunk(
  'auth/resendOtp',
  async ({ sessionId }, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/resend-otp', {
        sessionId,
      });

      const data = response.data?.data || null;
      const pendingRegistration = await authService.getPendingRegistration();

      if (pendingRegistration && data) {
        await authService.savePendingRegistration({
          ...pendingRegistration,
          ...data,
        });
      }

      return data;
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to resend OTP';

      return rejectWithValue(message);
    }
  }
);

/**
 * Initialize auth on app startup
 * Restores user session from stored refresh token and user data
 */
export const initAuth = createAsyncThunk(
  'auth/initAuth',
  async (_, { rejectWithValue }) => {
    try {
      // Get refresh token from storage (SecureStore for mobile, cookie for web)
      const refreshTokenValue = await authService.getRefreshToken();
      const pendingRegistration = await authService.getPendingRegistration();
      const pendingPasswordReset = await authService.getPendingPasswordReset();

      if (!refreshTokenValue) {
        if (pendingRegistration) {
          console.log('[initAuth] Pending registration found, restoring OTP flow');
          return { pendingRegistration, pendingPasswordReset };
        }

        if (pendingPasswordReset) {
          console.log('[initAuth] Pending password reset found, restoring reset flow');
          return { pendingPasswordReset };
        }

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

      // Restore user data from SecureStore (no extra API call needed)
      const user = await authService.getUserData();

      if (!user) {
        console.log('[initAuth] No user data found in storage');
        if (pendingRegistration) {
          return { pendingRegistration, pendingPasswordReset };
        }
        if (pendingPasswordReset) {
          return { pendingPasswordReset };
        }
        return null;
      }

      // Return accessToken AND user data to Redux
      return {
        accessToken,
        user,
        pendingRegistration,
        pendingPasswordReset,
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
      state.register.data = null;
    },
    clearOtpState(state) {
      state.otp.status = 'idle';
      state.otp.error = null;
      state.otp.isLoading = false;
      state.otp.resendStatus = 'idle';
      state.otp.resendError = null;
      state.otp.isResending = false;
      state.otp.data = null;
    },
    clearForgotPasswordState(state) {
      state.forgotPassword.status = 'idle';
      state.forgotPassword.error = null;
      state.forgotPassword.isLoading = false;
      state.forgotPassword.data = null;
    },
    clearPasswordResetState(state) {
      state.passwordReset.status = 'idle';
      state.passwordReset.error = null;
      state.passwordReset.isLoading = false;
      state.passwordReset.resendStatus = 'idle';
      state.passwordReset.resendError = null;
      state.passwordReset.isResending = false;
      state.passwordReset.data = null;
      state.pendingPasswordReset = null;
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
    setCoins(state, action) {
      state.coins = action.payload;
    },
    setPlan(state, action) {
      state.plan = action.payload;
    },
    patchUserProfile(state, action) {
      const { plan, coins, membership } = action.payload || {};
      if (plan !== undefined) state.plan = plan;
      if (coins !== undefined) state.coins = coins;
      if (membership !== undefined) state.membership = membership;
    },
    setPendingRegistration(state, action) {
      state.pendingRegistration = action.payload || null;
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
      state.membership = null;
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
        state.register.data = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.register.status = 'succeeded';
        state.register.isLoading = false;
        state.register.data = action.payload;
        state.pendingRegistration = action.payload;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.register.status = 'failed';
        state.register.error = action.payload || 'Registration failed';
        state.register.isLoading = false;
      })
      .addCase(verifyOtp.pending, (state) => {
        state.otp.status = 'loading';
        state.otp.error = null;
        state.otp.isLoading = true;
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.otp.status = 'succeeded';
        state.otp.isLoading = false;
        state.otp.data = action.payload;
        state.pendingRegistration = null;
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.otp.status = 'failed';
        state.otp.error = action.payload || 'OTP verification failed';
        state.otp.isLoading = false;
      })
      .addCase(resendOtp.pending, (state) => {
        state.otp.resendStatus = 'loading';
        state.otp.resendError = null;
        state.otp.isResending = true;
      })
      .addCase(resendOtp.fulfilled, (state, action) => {
        state.otp.resendStatus = 'succeeded';
        state.otp.isResending = false;
        state.otp.data = action.payload;
        state.pendingRegistration = {
          ...(state.pendingRegistration || {}),
          ...(action.payload || {}),
        };
      })
      .addCase(resendOtp.rejected, (state, action) => {
        state.otp.resendStatus = 'failed';
        state.otp.resendError = action.payload || 'Failed to resend OTP';
        state.otp.isResending = false;
      })
      .addCase(requestForgotPassword.pending, (state) => {
        state.forgotPassword.status = 'loading';
        state.forgotPassword.error = null;
        state.forgotPassword.isLoading = true;
        state.forgotPassword.data = null;
      })
      .addCase(requestForgotPassword.fulfilled, (state, action) => {
        state.forgotPassword.status = 'succeeded';
        state.forgotPassword.isLoading = false;
        state.forgotPassword.data = action.payload;
        state.pendingPasswordReset = action.payload;
      })
      .addCase(requestForgotPassword.rejected, (state, action) => {
        state.forgotPassword.status = 'failed';
        state.forgotPassword.error = action.payload || 'Failed to send reset code';
        state.forgotPassword.isLoading = false;
      })
      .addCase(resetPasswordWithOtp.pending, (state) => {
        state.passwordReset.status = 'loading';
        state.passwordReset.error = null;
        state.passwordReset.isLoading = true;
      })
      .addCase(resetPasswordWithOtp.fulfilled, (state, action) => {
        state.passwordReset.status = 'succeeded';
        state.passwordReset.isLoading = false;
        state.passwordReset.data = action.payload;
        state.pendingPasswordReset = null;
      })
      .addCase(resetPasswordWithOtp.rejected, (state, action) => {
        state.passwordReset.status = 'failed';
        state.passwordReset.error = action.payload || 'Password reset failed';
        state.passwordReset.isLoading = false;
      })
      .addCase(resendForgotOtp.pending, (state) => {
        state.passwordReset.resendStatus = 'loading';
        state.passwordReset.resendError = null;
        state.passwordReset.isResending = true;
      })
      .addCase(resendForgotOtp.fulfilled, (state, action) => {
        state.passwordReset.resendStatus = 'succeeded';
        state.passwordReset.isResending = false;
        state.passwordReset.data = action.payload;
        state.pendingPasswordReset = {
          ...(state.pendingPasswordReset || {}),
          ...(action.payload || {}),
        };
      })
      .addCase(resendForgotOtp.rejected, (state, action) => {
        state.passwordReset.resendStatus = 'failed';
        state.passwordReset.resendError = action.payload || 'Failed to resend OTP';
        state.passwordReset.isResending = false;
      })
      // LOGIN FLOW
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
        state.isLoading = true;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        state.userId = action.payload.user?.id ?? null;
        // refreshToken is in SecureStore only (never in Redux)
        state.name = action.payload.user.name;
        state.email = action.payload.user.email;
        state.role = action.payload.user.role;
        state.plan = action.payload.user.plan;
        state.coins = action.payload.user.coins;
        state.membership = action.payload.user.membership ?? null;
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
          if (action.payload.accessToken) {
            state.accessToken = action.payload.accessToken;
            state.userId = action.payload.user?.id ?? null;
            
            // Restore user data from payload
            state.name = action.payload.user.name;
            state.email = action.payload.user.email;
            state.role = action.payload.user.role;
            state.plan = action.payload.user.plan;
            state.coins = action.payload.user.coins;
            state.membership = action.payload.user.membership ?? null;
          }
          if (action.payload.pendingRegistration) {
            state.pendingRegistration = action.payload.pendingRegistration;
          }
          if (action.payload.pendingPasswordReset) {
            state.pendingPasswordReset = action.payload.pendingPasswordReset;
          }
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
        state.userId = null;
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

export const {
  clearRegisterState,
  clearOtpState,
  clearForgotPasswordState,
  clearPasswordResetState,
  clearLogoutState,
  clearLogoutError,
  setTokens,
  setCoins,
  setPlan,
  patchUserProfile,
  setPendingRegistration,
  logout,
} = authSlice.actions;

export default authSlice.reducer;

