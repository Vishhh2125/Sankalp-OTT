import axios from 'axios';

const API_BASE = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Create instance for long-running uploads (5 minute timeout)
const uploadApi = axios.create({
  baseURL: API_BASE,
  timeout: 300000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach admin JWT token to upload requests too
uploadApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Attach admin JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Categories ──
export const categoriesApi = {
  getAll: () => api.get('/content/categories'),
  create: (data) => api.post('/content/categories', data),
  update: (id, data) => api.put(`/content/categories/${id}`, data),
  delete: (id) => api.delete(`/content/categories/${id}`),
};

// ── Tags ──
export const tagsApi = {
  getAll: () => api.get('/content/tags'),
  create: (data) => api.post('/content/tags', data),
  update: (id, data) => api.put(`/content/tags/${id}`, data),
  delete: (id) => api.delete(`/content/tags/${id}`),
};

// ── Shows (Dramas) ──
export const showsApi = {
  getAll: (params) => api.get('/content/shows', { params }),
  getById: (id) => api.get(`/content/shows/${id}`),
  create: (data) => api.post('/content/shows', data),
  update: (id, data) => api.put(`/content/shows/${id}`, data),
  delete: (id) => api.delete(`/content/shows/${id}`),
  togglePublish: (id) => api.patch(`/content/shows/${id}/publish`),
  toggleFeatured: (id) => api.patch(`/content/shows/${id}/feature`),
};

// ── Episodes ──
export const episodesApi = {
  getByShow: (showId) => api.get(`/content/shows/${showId}/episodes`),
  create: (data) => api.post('/content/episodes', data),
  update: (id, data) => api.put(`/content/episodes/${id}`, data),
  delete: (id) => api.delete(`/content/episodes/${id}`),
};

// ── Media Upload ──
export const mediaApi = {
  getVideoUploadUrl: (showId, episodeId) =>
    api.post('/media/upload-url/video', { show_id: showId, episode_id: episodeId }),
  getImageUploadUrl: (type, entityId) =>
    api.post('/media/upload-url/image', { type, entity_id: entityId }),
  confirmVideo: (episodeId) =>
    api.post('/media/confirm/video', { episode_id: episodeId }),
  confirmImage: (type, entityId, objectName) =>
    api.post('/media/confirm/image', { type, entity_id: entityId, object_name: objectName }),
  uploadVideoFile: (showId, episodeId, file, onProgress) => {
    const formData = new FormData();
    formData.append('show_id', showId);
    formData.append('episode_id', episodeId);
    formData.append('video', file);

    // Use uploadApi with 5-minute timeout for video uploads
    return uploadApi.post('/media/upload/video', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
  },
};

export default api;
