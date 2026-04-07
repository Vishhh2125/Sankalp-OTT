import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import * as SecureStore from 'expo-secure-store';
import { api } from '../../services/api';

const initialState = {
    name: null,
    email: null,
    role: null,
    plan: null,
    coins: null,
    accessToken: null,
    error: null,
    isLoading: false,
    status: 'idle', // idle | loading | succeeded | failed
  register: {
    status: 'idle', // idle | loading | succeeded | failed
    error: null,
    isLoading: false,
  },
};

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

      // 🔥 store refresh token securely (persistent)
      await SecureStore.setItemAsync('refreshToken', refreshToken);

      // return full response OR clean object (both fine)
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

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearRegisterState(state) {
      state.register.status = 'idle';
      state.register.error = null;
      state.register.isLoading = false;
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
      });
  },
});

export const { clearRegisterState } = authSlice.actions;

export default authSlice.reducer;

