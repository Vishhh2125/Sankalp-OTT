import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../constants/config';

// Feed API uses /api/feed/... (no /v1 prefix)
// Auth API uses /api/v1/auth/... (with /v1)
// So we create a separate instance for feed calls
const feedApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Inject auth token if available
let _store = null;
export const setFeedStore = (store) => { _store = store; };
feedApi.interceptors.request.use((config) => {
  if (_store) {
    const token = _store.getState().auth?.accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const PAGE_SIZE = 10;

// Fetch For You feed
export const fetchForYouFeed = createAsyncThunk(
  'reels/fetchForYou',
  async ({ offset = 0, refresh = false }, { rejectWithValue }) => {
    try {
      const url = `/api/feed/for-you?limit=${PAGE_SIZE}&offset=${offset}`;
      console.log('[reelsSlice] fetchForYouFeed request', {
        baseURL: API_BASE_URL,
        url,
        offset,
        refresh,
      });

      const response = await feedApi.get(url);
      console.log('[reelsSlice] fetchForYouFeed success', {
        status: response.status,
        itemCount: response?.data?.items?.length ?? null,
        data: response.data,
      });

      return { items: response.data.items || [], offset, refresh };
    } catch (err) {
      console.log('[reelsSlice] fetchForYouFeed error', {
        message: err.message,
        code: err.code,
        status: err.response?.status,
        data: err.response?.data,
      });
      return rejectWithValue(err.response?.data?.error || err.message || 'Failed to load feed');
    }
  }
);

// Fetch show episodes (show mode)
export const fetchShowEpisodes = createAsyncThunk(
  'reels/fetchShowEpisodes',
  async ({ showId, fromEp = 1, limit = 30 }, { rejectWithValue }) => {
    try {
      const response = await feedApi.get(`/api/feed/show/${showId}?from_ep=${fromEp}&limit=${limit}`);
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || err.message || 'Failed to load episodes');
    }
  }
);

const reelsSlice = createSlice({
  name: 'reels',
  initialState: {
    // For You feed
    forYouItems: [],
    forYouLoading: false,
    forYouError: null,
    forYouOffset: 0,
    forYouHasMore: true,

    // Show mode (episode list for a specific drama)
    showMode: null, // { show_id, show_title, episodes, total_episodes, has_more }
    showModeLoading: false,
    showModeError: null,
  },
  reducers: {
    clearShowMode(state) {
      state.showMode = null;
      state.showModeError = null;
    },
  },
  extraReducers: (builder) => {
    // For You feed
    builder
      .addCase(fetchForYouFeed.pending, (state, action) => {
        if (action.meta.arg.refresh) {
          state.forYouLoading = true;
        }
        state.forYouError = null;
      })
      .addCase(fetchForYouFeed.fulfilled, (state, action) => {
        const { items, offset, refresh } = action.payload;
        if (refresh || offset === 0) {
          state.forYouItems = items;
        } else {
          // Append new items, deduplicate by episode_id
          const existingIds = new Set(state.forYouItems.map(i => i.episode_id));
          const newItems = items.filter(i => !existingIds.has(i.episode_id));
          state.forYouItems = [...state.forYouItems, ...newItems];
        }
        state.forYouOffset = offset + items.length;
        state.forYouHasMore = items.length === PAGE_SIZE;
        state.forYouLoading = false;
      })
      .addCase(fetchForYouFeed.rejected, (state, action) => {
        state.forYouLoading = false;
        state.forYouError = action.payload;
      });

    // Show mode
    builder
      .addCase(fetchShowEpisodes.pending, (state) => {
        state.showModeLoading = true;
        state.showModeError = null;
        state.showMode = null;
      })
      .addCase(fetchShowEpisodes.fulfilled, (state, action) => {
        state.showModeLoading = false;
        state.showMode = action.payload;
      })
      .addCase(fetchShowEpisodes.rejected, (state, action) => {
        state.showModeLoading = false;
        state.showModeError = action.payload;
      });
  },
});

export const { clearShowMode } = reelsSlice.actions;
export default reelsSlice.reducer;

// Selectors
export const selectForYouItems = (state) => state.reels.forYouItems;
export const selectForYouLoading = (state) => state.reels.forYouLoading;
export const selectForYouHasMore = (state) => state.reels.forYouHasMore;
export const selectForYouOffset = (state) => state.reels.forYouOffset;
export const selectShowMode = (state) => state.reels.showMode;
export const selectShowModeLoading = (state) => state.reels.showModeLoading;
export const selectShowModeError = (state) => state.reels.showModeError;
