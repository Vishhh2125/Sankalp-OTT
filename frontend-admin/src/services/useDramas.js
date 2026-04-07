import { useState, useEffect, useCallback } from 'react'
import { showsApi, episodesApi, categoriesApi, tagsApi, mediaApi } from './api.js'

export function useDramas() {
  const [dramas, setDramas] = useState([])
  const [categories, setCategories] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [showsRes, catsRes, tagsRes] = await Promise.all([
        showsApi.getAll(),
        categoriesApi.getAll(),
        tagsApi.getAll(),
      ])

      setCategories(catsRes.data)
      setTags(tagsRes.data)

      const showItems = showsRes.data.items || showsRes.data || []
      const withEpisodes = await Promise.all(
        (Array.isArray(showItems) ? showItems : []).map(async (show) => {
          try {
            const epRes = await episodesApi.getByShow(show.id)
            return {
              ...show,
              episodes: (epRes.data || []).map((ep) => ({
                id: ep.id,
                title: ep.title,
                ep: ep.episode_num,
                duration: ep.duration_sec ? `${Math.floor(ep.duration_sec/60)}:${String(ep.duration_sec%60).padStart(2,'0')}` : '—',
                is_free: ep.is_free,
                coin_cost: ep.coin_cost,
                status: ep.status,
                views: 0,
              })),
            }
          } catch {
            return { ...show, episodes: [] }
          }
        })
      )
      setDramas(withEpisodes)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load dramas')
      console.error('Load failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Helper: create episodes that don't exist in DB yet
  async function createNewEpisodes(showId, episodes, existingEpisodeIds) {
    for (let i = 0; i < episodes.length; i++) {
      const ep = episodes[i]
      // Skip episodes that already have a real UUID (they exist in DB)
      if (ep.id && existingEpisodeIds.includes(ep.id)) continue

      console.log(`Creating episode ${ep.ep || i+1}: "${ep.title}" for show ${showId}`)
      try {
        const epRes = await episodesApi.create({
          show_id: showId,
          episode_num: ep.ep || i + 1,
          title: ep.title,
          is_free: ep.is_free ?? true,
          coin_cost: ep.coin_cost || 0,
          duration_sec: parseDuration(ep.duration),
        })
        console.log('Episode created:', epRes.data.id)

        if (ep.videoFile) {
          try {
            await uploadEpisodeVideo(showId, epRes.data.id, ep.videoFile)
            console.log('Video uploaded for episode:', epRes.data.id)
          } catch (uploadErr) {
            console.error('Video upload failed. Deleting episode:', uploadErr)
            // Rollback: delete the episode since video upload failed
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
        alert(`Episode "${ep.title}" failed: ${epErr.response?.data?.error || epErr.response?.data?.details?.map(d=>d.message).join(', ') || epErr.message}`)
      }
    }
  }

  const createDrama = async (formData) => {
    const cat = categories.find((c) => c.name === formData.category)
    if (!cat) throw new Error('Category not found. Select a valid category.')

    const tagIds = (formData.tags || [])
      .map((name) => tags.find((t) => t.name === name)?.id)
      .filter(Boolean)

    console.log('Creating show:', formData.title, 'category:', cat.id)
    const showRes = await showsApi.create({
      title: formData.title,
      synopsis: formData.synopsis || '',
      category_id: cat.id,
      tag_ids: tagIds,
      is_featured_for_you: formData.is_featured_for_you || false,
      is_active: formData.status === 'Published',
    })

    const show = showRes.data
    console.log('Show created:', show.id)

    // Create all episodes (none exist yet for a new show)
    await createNewEpisodes(show.id, formData.episodes || [], [])

    await load()
    return show
  }

  const updateDrama = async (id, formData) => {
    const cat = categories.find((c) => c.name === formData.category)
    const tagIds = (formData.tags || [])
      .map((name) => tags.find((t) => t.name === name)?.id)
      .filter(Boolean)

    // Update show metadata
    await showsApi.update(id, {
      title: formData.title,
      synopsis: formData.synopsis || '',
      category_id: cat?.id,
      tag_ids: tagIds,
      is_featured_for_you: formData.is_featured_for_you || false,
      is_active: formData.status === 'Published',
    })

    // Find which episodes already exist in DB vs which are new
    const existingDrama = dramas.find(d => d.id === id)
    const existingEpIds = (existingDrama?.episodes || []).map(e => e.id)
    const formEpIds = (formData.episodes || []).map(e => e.id)

    // DELETE episodes that were removed in the UI
    const deletedEpIds = existingEpIds.filter(epId => !formEpIds.includes(epId))
    for (const epId of deletedEpIds) {
      try {
        await episodesApi.delete(epId)
        console.log('Deleted episode:', epId)
      } catch (err) {
        console.error('Failed to delete episode:', epId, err.response?.data || err.message)
      }
    }

    // Create any NEW episodes (ones with temporary IDs like "E1712345678")
    const newEpisodes = (formData.episodes || []).filter(ep => !existingEpIds.includes(ep.id))
    if (newEpisodes.length > 0) {
      console.log(`Creating ${newEpisodes.length} new episodes for show ${id}`)
      await createNewEpisodes(id, newEpisodes, existingEpIds)
    }

    await load()
  }

  const deleteDrama = async (id) => {
    await showsApi.delete(id)
    setDramas((p) => p.filter((d) => d.id !== id))
  }

  const togglePublish = async (id) => {
    await showsApi.togglePublish(id)
    setDramas((p) => p.map((d) => d.id === id ? { ...d, status: d.status === 'Published' ? 'Draft' : 'Published' } : d))
  }

  return {
    dramas, categories, tags, loading, error,
    createDrama, updateDrama, deleteDrama, togglePublish,
    reload: load,
  }
}

async function uploadEpisodeVideo(showId, episodeId, file, onProgress) {
  await mediaApi.uploadVideoFile(showId, episodeId, file, onProgress)
}

function parseDuration(str) {
  if (!str) return 0
  const parts = str.split(':')
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1])
  return parseInt(str) || 0
}

export default useDramas
