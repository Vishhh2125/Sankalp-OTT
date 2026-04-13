import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { showsApi, episodesApi, categoriesApi, tagsApi, mediaApi } from '../services/api.js'

// ─────────────────────────────────────────
// Helpers (pure functions, no Redux needed)
// ─────────────────────────────────────────

function parseDuration(str) {
  if (!str) return 0
  const parts = str.split(':')
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1])
  return parseInt(str) || 0
}

async function uploadEpisodeVideo(showId, episodeId, file) {
  await mediaApi.uploadVideoFile(showId, episodeId, file)
}

async function createNewEpisodes(showId, episodes, existingEpisodeIds) {
  for (let i = 0; i < episodes.length; i++) {
    const ep = episodes[i]
    if (ep.id && existingEpisodeIds.includes(ep.id)) continue

    console.log(`Creating episode ${ep.ep || i + 1}: "${ep.title}" for show ${showId}`)
    try {
      const epRes = await episodesApi.create({
        show_id:      showId,
        episode_num:  ep.ep || i + 1,
        title:        ep.title,
        is_free:      ep.is_free ?? true,
        coin_cost:    ep.coin_cost || 0,
        duration_sec: parseDuration(ep.duration),
      })
      console.log('Episode created:', epRes.data.id)

      if (ep.videoFile) {
        try {
          await uploadEpisodeVideo(showId, epRes.data.id, ep.videoFile)
          console.log('Video uploaded for episode:', epRes.data.id)
        } catch (uploadErr) {
          console.error('Video upload failed. Deleting episode:', uploadErr)
          try {
            await episodesApi.delete(epRes.data.id)
            console.log('Episode deleted due to failed upload:', epRes.data.id)
          } catch (deleteErr) {
            console.error('Failed to rollback episode deletion:', deleteErr)
          }
          throw new Error(`Video upload failed for episode "${ep.title}": ${uploadErr.message}`)
        }
      }
    } catch (epErr) {
      console.error(`Episode "${ep.title}" failed:`, epErr.response?.data || epErr.message)
      alert(
        `Episode "${ep.title}" failed: ${
          epErr.response?.data?.error ||
          epErr.response?.data?.details?.map(d => d.message).join(', ') ||
          epErr.message
        }`
      )
    }
  }
}

// ─────────────────────────────────────────
// Async Thunks
// ─────────────────────────────────────────

// Load all dramas + categories + tags (re-fetch-on-mount preserved in useDramas)
export const loadDramas = createAsyncThunk(
  'dramas/load',
  async (_, { rejectWithValue }) => {
    try {
      const [showsRes, catsRes, tagsRes] = await Promise.all([
        showsApi.getAll(),
        categoriesApi.getAll(),
        tagsApi.getAll(),
      ])

      const categories = catsRes.data
      const tags       = tagsRes.data
      const showItems  = showsRes.data.items || showsRes.data || []

      const withEpisodes = await Promise.all(
        (Array.isArray(showItems) ? showItems : []).map(async (show) => {
          try {
            const epRes = await episodesApi.getByShow(show.id)
            return {
              ...show,
              episodes: (epRes.data || []).map((ep) => ({
                id:        ep.id,
                title:     ep.title,
                ep:        ep.episode_num,
                duration:  ep.duration_sec
                  ? `${Math.floor(ep.duration_sec / 60)}:${String(ep.duration_sec % 60).padStart(2, '0')}`
                  : '—',
                is_free:   ep.is_free,
                coin_cost: ep.coin_cost,
                status:    ep.status,
                views:     0,
              })),
            }
          } catch {
            return { ...show, episodes: [] }
          }
        })
      )

      return { dramas: withEpisodes, categories, tags }
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to load dramas')
    }
  }
)

export const createDrama = createAsyncThunk(
  'dramas/create',
  async (formData, { getState, dispatch, rejectWithValue }) => {
    try {
      const { categories, tags } = getState().dramas

      const cat = categories.find((c) => c.name === formData.category)
      if (!cat) throw new Error('Category not found. Select a valid category.')

      const tagIds = (formData.tags || [])
        .map((name) => tags.find((t) => t.name === name)?.id)
        .filter(Boolean)

      console.log('Creating show:', formData.title, 'category:', cat.id)
      const showRes = await showsApi.create({
        title:               formData.title,
        synopsis:            formData.synopsis || '',
        category_id:         cat.id,
        tag_ids:             tagIds,
        feed_position: parseInt(formData.feed_position) || 0,
        is_active: true,
      })

      const show = showRes.data
      console.log('Show created:', show.id)

      if (formData.thumbnailFile) {
        try {
          console.log('Uploading thumbnail for show:', show.id)
          const { data: urlData } = await mediaApi.getImageUploadUrl('thumbnail', show.id)
          await mediaApi.uploadToMinio(urlData.upload_url, formData.thumbnailFile)
          await mediaApi.confirmImage('thumbnail', show.id, urlData.object_name)
          console.log('Thumbnail uploaded successfully')
        } catch (thumbErr) {
          console.error('Thumbnail upload failed:', thumbErr)
        }
      }

      if (formData.bannerFile) {
        try {
          console.log('Uploading banner for show:', show.id)
          const { data: urlData } = await mediaApi.getImageUploadUrl('banner', show.id)
          await mediaApi.uploadToMinio(urlData.upload_url, formData.bannerFile)
          await mediaApi.confirmImage('banner', show.id, urlData.object_name)
          console.log('Banner uploaded successfully')
        } catch (bannerErr) {
          console.error('Banner upload failed:', bannerErr)
        }
      }

      await createNewEpisodes(show.id, formData.episodes || [], [])

      // Reload to get fresh data from server
      await dispatch(loadDramas())
      return show
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || err.message)
    }
  }
)

export const updateDrama = createAsyncThunk(
  'dramas/update',
  async ({ id, formData }, { getState, dispatch, rejectWithValue }) => {
    try {
      const { categories, tags, dramas } = getState().dramas

      const cat    = categories.find((c) => c.name === formData.category)
      const tagIds = (formData.tags || [])
        .map((name) => tags.find((t) => t.name === name)?.id)
        .filter(Boolean)

      await showsApi.update(id, {
        title:               formData.title,
        synopsis:            formData.synopsis || '',
        category_id:         cat?.id,
        tag_ids:             tagIds,
        feed_position: parseInt(formData.feed_position) || 0,
        is_active: true,
      })

      if (formData.thumbnailFile) {
        try {
          console.log('Uploading thumbnail for show:', id)
          const { data: urlData } = await mediaApi.getImageUploadUrl('thumbnail', id)
          await mediaApi.uploadToMinio(urlData.upload_url, formData.thumbnailFile)
          await mediaApi.confirmImage('thumbnail', id, urlData.object_name)
          console.log('Thumbnail uploaded successfully')
        } catch (thumbErr) {
          console.error('Thumbnail upload failed:', thumbErr)
        }
      }

      if (formData.bannerFile) {
        try {
          console.log('Uploading banner for show:', id)
          const { data: urlData } = await mediaApi.getImageUploadUrl('banner', id)
          await mediaApi.uploadToMinio(urlData.upload_url, formData.bannerFile)
          await mediaApi.confirmImage('banner', id, urlData.object_name)
          console.log('Banner uploaded successfully')
        } catch (bannerErr) {
          console.error('Banner upload failed:', bannerErr)
        }
      }

      const existingDrama = dramas.find(d => d.id === id)
      const existingEpIds = (existingDrama?.episodes || []).map(e => e.id)
      const formEpIds     = (formData.episodes || []).map(e => e.id)

      // Delete removed episodes
      const deletedEpIds = existingEpIds.filter(epId => !formEpIds.includes(epId))
      for (const epId of deletedEpIds) {
        try {
          await episodesApi.delete(epId)
          console.log('Deleted episode:', epId)
        } catch (err) {
          console.error('Failed to delete episode:', epId, err.response?.data || err.message)
        }
      }

      // Create new episodes
      const newEpisodes = (formData.episodes || []).filter(ep => !existingEpIds.includes(ep.id))
      if (newEpisodes.length > 0) {
        console.log(`Creating ${newEpisodes.length} new episodes for show ${id}`)
        await createNewEpisodes(id, newEpisodes, existingEpIds)
      }

      await dispatch(loadDramas())
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || err.message)
    }
  }
)

export const deleteDrama = createAsyncThunk(
  'dramas/delete',
  async (id, { rejectWithValue }) => {
    try {
      await showsApi.delete(id)
      return id   // return id so reducer can filter it out instantly
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || err.message)
    }
  }
)

export const togglePublish = createAsyncThunk(
  'dramas/togglePublish',
  async (id, { rejectWithValue }) => {
    try {
      await showsApi.togglePublish(id)
      return id   // return id so reducer can flip status instantly
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || err.message)
    }
  }
)

// ─────────────────────────────────────────
// Slice
// ─────────────────────────────────────────

const dramasSlice = createSlice({
  name: 'dramas',
  initialState: {
    dramas:     [],
    categories: [],
    tags:       [],
    loading:    false,
    error:      null,
  },
  reducers: {},
  extraReducers: (builder) => {
    // loadDramas
    builder
      .addCase(loadDramas.pending, (state) => {
        state.loading = true
        state.error   = null
      })
      .addCase(loadDramas.fulfilled, (state, action) => {
        state.loading    = false
        state.dramas     = action.payload.dramas
        state.categories = action.payload.categories
        state.tags       = action.payload.tags
      })
      .addCase(loadDramas.rejected, (state, action) => {
        state.loading = false
        state.error   = action.payload
      })

    // deleteDrama — optimistic: remove from list immediately
    builder.addCase(deleteDrama.fulfilled, (state, action) => {
      state.dramas = state.dramas.filter(d => d.id !== action.payload)
    })

    // togglePublish — optimistic: flip status immediately
    builder.addCase(togglePublish.fulfilled, (state, action) => {
      const drama = state.dramas.find(d => d.id === action.payload)
      if (drama) {
        drama.status = drama.status === 'Published' ? 'Draft' : 'Published'
      }
    })
  },
})

export default dramasSlice.reducer

// Selectors
export const selectDramas     = (state) => state.dramas.dramas
export const selectCategories = (state) => state.dramas.categories
export const selectTags       = (state) => state.dramas.tags
export const selectLoading    = (state) => state.dramas.loading
export const selectError      = (state) => state.dramas.error
