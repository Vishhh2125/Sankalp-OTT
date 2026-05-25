import axios from 'axios';

const API_BASE = '/api';

// const API_BASE = 'http://localhost:3000/api/v1/';
const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // Send cookies with requests
});

// Create instance for long-running uploads (5 minute timeout)
const uploadApi = axios.create({
  baseURL: API_BASE,
  timeout: 300000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // Send cookies with requests
});

// Flag to prevent multiple refresh attempts simultaneously
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  isRefreshing = false;
  failedQueue = [];
};

// Refresh token function
const refreshAccessToken = () => {
  return api.get('/v1/auth/refresh-token', {
    headers: { 'x-client-type': 'web' }
  }).then((response) => {
    const { data } = response.data;
    const newAccessToken = data.accessToken;
    
    // Update stored token
    localStorage.setItem('admin_token', newAccessToken);
    
    // Update default header for future requests
    api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
    uploadApi.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
    
    return newAccessToken;
  });
};

// Attach admin JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Attach admin JWT token to upload requests too
uploadApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor with token refresh logic
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const originalRequest = error.config;
    
    // Do NOT refresh on auth endpoints (login, register, refresh-token)
    const isAuthEndpoint = 
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/refresh-token');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch((err) => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      return refreshAccessToken()
        .then((token) => {
          processQueue(null, token);
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => {
          processQueue(err, null);
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_user');
          window.location.href = '/admin/';
          return Promise.reject(err);
        });
    }

    return Promise.reject(error);
  }
);

// Auto-logout on 401 for uploads too (with refresh token support)
uploadApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const originalRequest = error.config;

    // Do NOT refresh on auth endpoints
    const isAuthEndpoint = 
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/refresh-token');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return uploadApi(originalRequest);
        }).catch((err) => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      return refreshAccessToken()
        .then((token) => {
          processQueue(null, token);
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return uploadApi(originalRequest);
        })
        .catch((err) => {
          processQueue(err, null);
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_user');
          window.location.href = '/admin/';
          return Promise.reject(err);
        });
    }

    return Promise.reject(error);
  }
);

// ── Auth ──
export const authApi = {
  login: (email, password) => 
    api.post('/v1/auth/login', { email, password }, {
      headers: { 'x-client-type': 'web' }
    }),
  logout: () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
  }
};

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
  updateFeedPosition: (id, position) => api.patch(`/content/shows/${id}/feed-position`, { feed_position: position }),
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
  // Upload a file directly to MinIO using a presigned PUT URL
  uploadToMinio: (presignedUrl, file) =>
    fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    }).then((res) => {
      if (!res.ok) throw new Error(`MinIO upload failed: ${res.status} ${res.statusText}`);
      return res;
    }),

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

// ── Membership Plans ──
export const membershipApi = {
  getAll: () => api.get('/v1/admin/membership/plans'),
  getById: (planId) => api.get(`/v1/admin/membership/plans/${planId}`),
  create: (data) => api.post('/v1/admin/membership/plans', data),
  update: (planId, data) => api.patch(`/v1/admin/membership/plans/${planId}`, data),
  delete: (planId) => api.delete(`/v1/admin/membership/plans/${planId}`),
  toggle: (planId) => api.patch(`/v1/admin/membership/plans/${planId}/toggle`),
};

// ── Admin Users ──
export const usersApi = {
  getAll: () => api.get('/v1/admin/users'),
  getProfile: (userId) => api.get(`/v1/admin/users/${userId}/profile`),
  toggleStatus: (userId) => api.patch(`/v1/admin/users/${userId}/status`),
  adjustCoins: (userId, amount, reason) =>
    api.patch(`/v1/admin/users/${userId}/coins`, { amount, reason }),
};

// ── Coins Management ──
export const coinsApi = {
  getRules: () => api.get('/v1/admin/coins/rules'),
  saveRules: (rules) => api.put('/v1/admin/coins/rules', rules),
  getMetrics: () => api.get('/v1/admin/coins/metrics'),
  getTransactions: (params) => api.get('/v1/admin/coins/transactions', { params }),
};

// ── Banners ──
export const bannersApi = {
  getAll: () => api.get('/v1/admin/banners'),
  create: (data) => api.post('/v1/admin/banners', data),
  update: (id, data) => api.put(`/v1/admin/banners/${id}`, data),
  delete: (id) => api.delete(`/v1/admin/banners/${id}`),
  toggle: (id) => api.patch(`/v1/admin/banners/${id}/toggle`),
};