import { useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  loadDramas,
  createDrama  as createDramaThunk,
  updateDrama  as updateDramaThunk,
  deleteDrama  as deleteDramaThunk,
  togglePublish as togglePublishThunk,
  selectDramas,
  selectCategories,
  selectTags,
  selectLoading,
  selectError,
} from '../store/dramasSlice.js'

/**
 * useDramas — same public interface as before.
 * Dramas.jsx is completely unchanged.
 * Internally: reads from Redux, dispatches thunks.
 * Re-fetch-on-mount is preserved via useEffect.
 */
export function useDramas() {
  const dispatch   = useDispatch()
  const dramas     = useSelector(selectDramas)
  const categories = useSelector(selectCategories)
  const tags       = useSelector(selectTags)
  const loading    = useSelector(selectLoading)
  const error      = useSelector(selectError)

  // Re-fetch on mount — same behaviour as before
  const load = useCallback(() => {
    dispatch(loadDramas())
  }, [dispatch])

  useEffect(() => { load() }, [load])

  const createDrama = async (formData) => {
    const result = await dispatch(createDramaThunk(formData))
    if (createDramaThunk.rejected.match(result)) {
      throw new Error(result.payload || 'Failed to create drama')
    }
    return result.payload
  }

  const updateDrama = async (id, formData) => {
    const result = await dispatch(updateDramaThunk({ id, formData }))
    if (updateDramaThunk.rejected.match(result)) {
      throw new Error(result.payload || 'Failed to update drama')
    }
  }

  const deleteDrama = async (id) => {
    const result = await dispatch(deleteDramaThunk(id))
    if (deleteDramaThunk.rejected.match(result)) {
      throw new Error(result.payload || 'Failed to delete drama')
    }
  }

  const togglePublish = async (id) => {
    const result = await dispatch(togglePublishThunk(id))
    if (togglePublishThunk.rejected.match(result)) {
      throw new Error(result.payload || 'Failed to toggle publish')
    }
  }

  return {
    dramas, categories, tags, loading, error,
    createDrama, updateDrama, deleteDrama, togglePublish,
    reload: load,
  }
}

export default useDramas