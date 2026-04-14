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

// Load a page of episodes for the drama player
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
    // Identity of the show currently loaded in the player
    showId: null,
    showTitle: null,
    thumbnailUrl: null,
    totalEpisodes: 0,

    // The flat list of episode items ready for playback
    // Each item is shaped like a ForYou feed item so ShortVideoReelItem can render it
    episodes: [],

    // Pagination
    loadedUpTo: 0,       // highest episode_num we've fetched
    hasMore: true,
    loading: false,
    error: null,

    // Which episode index the player should start at
    startIndex: 0,
  },
  reducers: {
    // Call this before navigating to ShowPlayerScreen.
    // `seedEpisodes` are the episodes[] already loaded in DramaDetailsSheet (the tapped page).
    // `startEpisodeNum` is the tapped episode's number.
    initShowPlayer(state, action) {
      const {
        showId,
        showTitle,
        thumbnailUrl,
        totalEpisodes,
        seedEpisodes = [],  // episode objects from showMode
        startEpisodeNum = 1,
        streamBase = '',
      } = action.payload;

      state.showId = showId;
      state.showTitle = showTitle;
      state.thumbnailUrl = thumbnailUrl;
      state.totalEpisodes = totalEpisodes;
      state.hasMore = seedEpisodes.length < totalEpisodes;
      state.loading = false;
      state.error = null;

      // Map seed episodes to the shape ShortVideoReelItem expects
      state.episodes = seedEpisodes.map((ep) => mapEpisode(ep, showId, showTitle, thumbnailUrl, streamBase, totalEpisodes));

      // Highest episode number already loaded
      state.loadedUpTo = seedEpisodes.length > 0
        ? Math.max(...seedEpisodes.map((e) => e.episode_num))
        : 0;

      // Find the index to start the FlatList at
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
        const streamBase = ''; // populated at init time; pages just append

        const newEps = (data.episodes || []).map((ep) =>
          mapEpisode(ep, state.showId, state.showTitle, state.thumbnailUrl, streamBase, state.totalEpisodes)
        );

        // Deduplicate by episode_id
        const existingIds = new Set(state.episodes.map((e) => e.episode_id));
        const fresh = newEps.filter((e) => !existingIds.has(e.episode_id));
        state.episodes = [...state.episodes, ...fresh];

        if (fresh.length > 0) {
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

// Map a show-API episode object to the shape ShortVideoReelItem expects
function mapEpisode(ep, showId, showTitle, thumbnailUrl, streamBase, totalEpisodes) {
  const hlsUrl = ep.hls_url
    ? (streamBase ? `${streamBase}${ep.hls_url}` : ep.hls_url)
    : null;

  return {
    // Identity
    show_id: showId,
    show_title: showTitle,
    episode_id: ep.episode_id,
    episode_num: ep.episode_num,

    // Media
    thumbnail_url: thumbnailUrl,   // show-level thumbnail (episode doesn't have its own)
    hls_url: hlsUrl,
    duration_sec: ep.duration_sec,
    synopsis: ep.title || null,

    // Lock
    is_locked: ep.is_locked,
    lock_reason: ep.lock_reason,
    is_free: ep.is_free,
    coin_cost: ep.coin_cost,

    // Status
    status: ep.status,

    // Extras the player UI uses
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