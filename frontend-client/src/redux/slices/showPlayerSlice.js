import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../constants/config';

const feedApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

let _store = null;
export const setShowPlayerStore = (store) => { _store = store; };
feedApi.interceptors.request.use((config) => {
  if (_store) {
    const token = _store.getState().auth?.accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const PLAYER_PAGE_SIZE = 30;

export const fetchShowPlayerPage = createAsyncThunk(
  'showPlayer/fetchPage',
  async ({ showId, fromEp, limit = PLAYER_PAGE_SIZE }, { rejectWithValue }) => {
    try {
      const response = await feedApi.get(
        `/api/feed/show/${showId}?from_ep=${fromEp}&limit=${limit}`
      );
      return { data: response.data, fromEp };
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || err.message || 'Failed to load episodes');
    }
  }
);

const showPlayerSlice = createSlice({
  name: 'showPlayer',
  initialState: {
    showId: null,
    showTitle: null,
    thumbnailUrl: null,
    totalEpisodes: 0,
    episodes: [],
    loadedUpTo: 0,
    hasMore: true,
    loading: false,
    error: null,
    startIndex: 0,
    startEpisodeNum: 0, // Track the target episode number across sorts
    startProgressSec: 0, // NEW — seek position for the starting episode
  },
  reducers: {
    initShowPlayer(state, action) {
      const {
        showId,
        showTitle,
        thumbnailUrl,
        totalEpisodes,
        seedEpisodes = [],
        startEpisodeNum = 1,
        streamBase = '',
        startProgressSec = 0, // NEW
      } = action.payload;

      state.showId = showId;
      state.showTitle = showTitle;
      state.thumbnailUrl = thumbnailUrl;
      state.totalEpisodes = totalEpisodes;
      state.hasMore = seedEpisodes.length < totalEpisodes;
      state.loading = false;
      state.error = null;
      state.startProgressSec = startProgressSec; // NEW
      state.startEpisodeNum = startEpisodeNum; // Store target episode for use after sorting

      state.episodes = seedEpisodes.map((ep) =>
        mapEpisode(ep, showId, showTitle, thumbnailUrl, streamBase, totalEpisodes)
      );

      state.loadedUpTo = seedEpisodes.length > 0
        ? Math.max(...seedEpisodes.map((e) => e.episode_num))
        : 0;

      const idx = state.episodes.findIndex((e) => e.episode_num === startEpisodeNum);
      state.startIndex = idx >= 0 ? idx : 0;
    },

    clearShowPlayer(state) {
      state.showId = null;
      state.showTitle = null;
      state.thumbnailUrl = null;
      state.totalEpisodes = 0;
      state.episodes = [];
      state.loadedUpTo = 0;
      state.hasMore = true;
      state.loading = false;
      state.error = null;
      state.startIndex = 0;
      state.startEpisodeNum = 0;
      state.startProgressSec = 0; // NEW
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchShowPlayerPage.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchShowPlayerPage.fulfilled, (state, action) => {
        state.loading = false;
        const { data } = action.payload;
        // FIX: must use API_BASE_URL (not '') so the stored hls_url is absolute.
        // react-native-video requires a full URL; a relative path like
        // "/api/media/hls/..." silently fails. initShowPlayer already receives
        // streamBase from callers (ForYou passes API_BASE_URL), but this thunk
        // was always hardcoding '' which broke MyList navigation and pagination.
        const streamBase = API_BASE_URL;

        const newEps = (data.episodes || []).map((ep) =>
          mapEpisode(ep, state.showId, state.showTitle, state.thumbnailUrl, streamBase, state.totalEpisodes)
        );

        // Build a lookup map of the incoming episodes by ID
        const newEpsById = new Map(newEps.map((e) => [e.episode_id, e]));

        // FIX: Update existing seed episodes that have hls_url: null with real data
        // from the API response. This happens when navigating from MyList, where
        // bookmarks/watch-history entries have no HLS URL and rely on this fetch
        // to backfill it. The old "skip duplicates" logic silently dropped those
        // updates, leaving the seed's hls_url as null forever → video never played.
        state.episodes = state.episodes.map((e) => {
          if (!e.hls_url && newEpsById.has(e.episode_id)) {
            // Merge real API data onto the placeholder seed episode
            return { ...e, ...newEpsById.get(e.episode_id) };
          }
          return e;
        });

        // Append genuinely new episodes (not already in the list)
        const existingIds = new Set(state.episodes.map((e) => e.episode_id));
        const fresh = newEps.filter((e) => !existingIds.has(e.episode_id));
        state.episodes = [...state.episodes, ...fresh];

        // Sort episodes chronologically by episode_num to ensure correct ordering
        // (e.g., EP1, EP2, EP3) regardless of fetch order
        state.episodes.sort((a, b) => a.episode_num - b.episode_num);

        // Recalculate startIndex after sorting using the stored startEpisodeNum
        if (state.startEpisodeNum > 0) {
          const idx = state.episodes.findIndex((e) => e.episode_num === state.startEpisodeNum);
          state.startIndex = idx >= 0 ? idx : 0;
        }

        // Update loadedUpTo whenever episodes changed (including seed updates)
        if (newEps.length > 0) {
          state.loadedUpTo = Math.max(...state.episodes.map((e) => e.episode_num));
        }

        state.hasMore = data.has_more ?? false;
        state.totalEpisodes = data.total_episodes ?? state.totalEpisodes;
      })
      .addCase(fetchShowPlayerPage.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

function mapEpisode(ep, showId, showTitle, thumbnailUrl, streamBase, totalEpisodes) {
  const hlsUrl = ep.hls_url
    ? (streamBase ? `${streamBase}${ep.hls_url}` : ep.hls_url)
    : null;

  return {
    show_id: showId,
    show_title: showTitle,
    episode_id: ep.episode_id,
    episode_num: ep.episode_num,
    thumbnail_url: thumbnailUrl,
    hls_url: hlsUrl,
    duration_sec: ep.duration_sec,
    synopsis: ep.title || null,
    is_locked: ep.is_locked,
    lock_reason: ep.lock_reason,
    is_free: ep.is_free,
    coin_cost: ep.coin_cost,
    status: ep.status,
    tags: [],
    view_count: 0,
    total_episodes: totalEpisodes || 0,
  };
}

export const { initShowPlayer, clearShowPlayer } = showPlayerSlice.actions;
export default showPlayerSlice.reducer;

// Selectors
export const selectShowPlayerEpisodes = (state) => state.showPlayer.episodes;
export const selectShowPlayerLoading = (state) => state.showPlayer.loading;
export const selectShowPlayerHasMore = (state) => state.showPlayer.hasMore;
export const selectShowPlayerLoadedUpTo = (state) => state.showPlayer.loadedUpTo;
export const selectShowPlayerStartIndex = (state) => state.showPlayer.startIndex;
export const selectShowPlayerShowId = (state) => state.showPlayer.showId;
export const selectShowPlayerTotalEpisodes = (state) => state.showPlayer.totalEpisodes;
export const selectShowPlayerStartProgressSec = (state) => state.showPlayer.startProgressSec; // NEW