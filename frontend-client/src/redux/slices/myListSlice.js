import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../constants/config';

// ─────────────────────────────────────────────────────────────────
// Axios instance pointing at /api/user (not /api/v1)
// Token is injected per-request from the thunk using getState
// ─────────────────────────────────────────────────────────────────
const userApi = axios.create({
  baseURL: `${API_BASE_URL}/api/user`,
  headers: { 'Content-Type': 'application/json' },
});

// Helper to build auth header
const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

// ─────────────────────────────────────────────────────────────────
// THUNKS
// ─────────────────────────────────────────────────────────────────

/**
 * Fetch all bookmarks for the logged-in user.
 * Stores bookmarks array + builds bookmarkedShowIds lookup map.
 */
export const fetchBookmarks = createAsyncThunk(
  'myList/fetchBookmarks',
  async (_, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth?.accessToken;
      const res = await userApi.get('/bookmarks', { headers: authHeader(token) });
      return res.data.data.items;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch bookmarks');
    }
  }
);

/**
 * Toggle bookmark for a show.
 * Payload: { showId, episodeId, progressSec, showData? }
 *
 * showData (optional): Full show metadata { show_id, show_title, thumbnail_url, episode_id, 
 * episode_num, duration_sec, category, total_episodes } for optimistic local update.
 * If provided, bookmarks array updates immediately without re-fetch.
 *
 * Smart toggle logic (handled by backend):
 * - Same episode tapped again → remove bookmark
 * - Different episode of same show → update bookmark
 * - No existing bookmark → create bookmark
 */
export const toggleBookmark = createAsyncThunk(
  'myList/toggleBookmark',
  async ({ showId, episodeId, progressSec, showData }, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth?.accessToken;
      const res = await userApi.post(
        `/bookmarks/${showId}`,
        { episode_id: episodeId, progress_sec: Math.floor(progressSec || 0) },
        { headers: authHeader(token) }
      );
      return { ...res.data.data, showData }; // Pass through showData for local update
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to toggle bookmark');
    }
  }
);

/**
 * Fetch recent watch history for the logged-in user.
 * Deduplicated by show on the backend — one entry per show.
 */
export const fetchWatchHistory = createAsyncThunk(
  'myList/fetchWatchHistory',
  async (_, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth?.accessToken;
      const res = await userApi.get('/watch-history', { headers: authHeader(token) });
      return res.data.data.items;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch watch history');
    }
  }
);

/**
 * Upsert a watch history entry.
 * Payload: { episodeId, progressSec, showId, showTitle, thumbnailUrl, category, episodeNum, durationSec }
 *
 * Makes the API call and optimistically updates local Redux state
 * so MyListScreen reflects changes immediately without a re-fetch.
 */
export const upsertWatchHistory = createAsyncThunk(
  'myList/upsertWatchHistory',
  async (
    { episodeId, progressSec, showId, showTitle, thumbnailUrl, category, episodeNum, durationSec },
    { getState, rejectWithValue }
  ) => {
    try {
      const token = getState().auth?.accessToken;
      await userApi.post(
        '/watch-history',
        { episode_id: episodeId, progress_sec: Math.floor(progressSec || 0) },
        { headers: authHeader(token) }
      );
      // Return all fields needed to update Redux state locally
      return {
        episodeId,
        progressSec: Math.floor(progressSec || 0),
        showId,
        showTitle,
        thumbnailUrl,
        category,
        episodeNum,
        durationSec,
        lastWatched: new Date().toISOString(),
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update watch history');
    }
  }
);

// ─────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────

const myListSlice = createSlice({
  name: 'myList',
  initialState: {
    // Bookmarks
    bookmarks: [],               // full bookmark objects from API
    bookmarkedShowIds: {},       // { [show_id]: { episode_id, progress_sec } } for O(1) lookup
    bookmarksLoading: false,
    bookmarksLoaded: false,      // prevents redundant fetches
    bookmarksError: null,

    // Watch History
    watchHistory: [],            // deduplicated by show, ordered by last_watched desc
    watchHistoryLoading: false,
    watchHistoryLoaded: false,
    watchHistoryError: null,
  },

  reducers: {
    // Call this on logout to clear all myList state
    clearMyList: (state) => {
      state.bookmarks = [];
      state.bookmarkedShowIds = {};
      state.bookmarksLoaded = false;
      state.watchHistory = [];
      state.watchHistoryLoaded = false;
    },
  },

  extraReducers: (builder) => {
    // ── fetchBookmarks ──────────────────────────────────────────
    builder
      .addCase(fetchBookmarks.pending, (state) => {
        state.bookmarksLoading = true;
        state.bookmarksError = null;
      })
      .addCase(fetchBookmarks.fulfilled, (state, action) => {
        state.bookmarksLoading = false;
        state.bookmarksLoaded = true;
        state.bookmarks = action.payload;

        // Build O(1) lookup map: { show_id: { episode_id, progress_sec } }
        const map = {};
        for (const b of action.payload) {
          map[b.show_id] = {
            episode_id: b.episode_id,
            progress_sec: b.progress_sec,
          };
        }
        state.bookmarkedShowIds = map;
      })
      .addCase(fetchBookmarks.rejected, (state, action) => {
        state.bookmarksLoading = false;
        state.bookmarksError = action.payload;
      });

    // ── toggleBookmark ──────────────────────────────────────────
    builder
      .addCase(toggleBookmark.fulfilled, (state, action) => {
        const { bookmarked, show_id, episode_id, progress_sec, showData } = action.payload;

        if (bookmarked) {
          // Add or update in bookmarkedShowIds
          state.bookmarkedShowIds[show_id] = { episode_id, progress_sec };

          // If showData provided (optimistic local update), immediately update bookmarks array
          if (showData) {
            const existingIdx = state.bookmarks.findIndex(b => b.show_id === show_id);
            const bookmarkEntry = {
              bookmark_id: `bm_${show_id}_${Date.now()}`, // Temp ID until server confirms
              show_id: showData.show_id,
              show_title: showData.show_title,
              thumbnail_url: showData.thumbnail_url,
              category: showData.category || null,
              episode_id: episode_id,
              episode_num: showData.episode_num,
              duration_sec: showData.duration_sec || 0,
              progress_sec: progress_sec,
              total_episodes: showData.total_episodes || 1,
            };

            if (existingIdx !== -1) {
              // Update existing bookmark entry
              state.bookmarks[existingIdx] = bookmarkEntry;
            } else {
              // New bookmark — prepend to front
              state.bookmarks.unshift(bookmarkEntry);
            }
          }
        } else {
          // Remove from bookmarkedShowIds
          delete state.bookmarkedShowIds[show_id];
          // Remove from bookmarks array
          state.bookmarks = state.bookmarks.filter(b => b.show_id !== show_id);
        }
      });

    // ── fetchWatchHistory ───────────────────────────────────────
    builder
      .addCase(fetchWatchHistory.pending, (state) => {
        state.watchHistoryLoading = true;
        state.watchHistoryError = null;
      })
      .addCase(fetchWatchHistory.fulfilled, (state, action) => {
        state.watchHistoryLoading = false;
        state.watchHistoryLoaded = true;
        state.watchHistory = action.payload;
      })
      .addCase(fetchWatchHistory.rejected, (state, action) => {
        state.watchHistoryLoading = false;
        state.watchHistoryError = action.payload;
      });

    // ── upsertWatchHistory ──────────────────────────────────────
    builder
      .addCase(upsertWatchHistory.fulfilled, (state, action) => {
        const {
          episodeId, progressSec, showId, showTitle,
          thumbnailUrl, category, episodeNum, durationSec, lastWatched,
        } = action.payload;

        // Find existing entry for this show in watchHistory
        const existingShowIdx = state.watchHistory.findIndex(h => h.show_id === showId);

        const updatedEntry = {
          history_id: state.watchHistory[existingShowIdx]?.history_id || null,
          show_id: showId,
          show_title: showTitle || '',
          thumbnail_url: thumbnailUrl || null,
          category: category || null,
          episode_id: episodeId,
          episode_num: episodeNum || 1,
          duration_sec: durationSec || 0,
          progress_sec: progressSec,
          last_watched: lastWatched,
        };

        if (existingShowIdx !== -1) {
          // Update existing show entry
          state.watchHistory[existingShowIdx] = updatedEntry;
          // Move to front since it's now most recent
          const entry = state.watchHistory.splice(existingShowIdx, 1)[0];
          state.watchHistory.unshift(entry);
        } else {
          // New show — prepend to front
          state.watchHistory.unshift(updatedEntry);
          // Keep max 20 shows
          if (state.watchHistory.length > 20) {
            state.watchHistory = state.watchHistory.slice(0, 20);
          }
        }

        // Mirror the same "move to front" behaviour in the Saved/bookmarks list.
        // If the watched show is bookmarked, bubble it up to position 0
        // so the Saved tab stays sorted by recent activity — same as Continue Watching.
        const bookmarkIdx = state.bookmarks.findIndex(b => b.show_id === showId);
        if (bookmarkIdx > 0) {
          const bm = state.bookmarks.splice(bookmarkIdx, 1)[0];
          state.bookmarks.unshift(bm);
        }
      });
  },
});

export const { clearMyList } = myListSlice.actions;

// ─────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────

export const selectBookmarks = (state) => state.myList.bookmarks;
export const selectWatchHistory = (state) => state.myList.watchHistory;
export const selectBookmarkedShowIds = (state) => state.myList.bookmarkedShowIds;
export const selectBookmarksLoaded = (state) => state.myList.bookmarksLoaded;
export const selectWatchHistoryLoaded = (state) => state.myList.watchHistoryLoaded;
export const selectBookmarksLoading = (state) => state.myList.bookmarksLoading;
export const selectWatchHistoryLoading = (state) => state.myList.watchHistoryLoading;

// Returns true/false — is this show bookmarked?
export const selectIsBookmarked = (showId) => (state) =>
  !!state.myList.bookmarkedShowIds[showId];

// Returns { episode_id, progress_sec } for a bookmarked show, or null
export const selectBookmarkEntry = (showId) => (state) =>
  state.myList.bookmarkedShowIds[showId] || null;

export default myListSlice.reducer;