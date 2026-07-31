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

// Refresh token function — also exported so App.jsx can call it on mount
export const refreshAccessToken = () => {
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
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/register') ||
      originalRequest?.url?.includes('/auth/refresh-token');

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
  login: (email, password, { adminPanel = false } = {}) =>
    api.post('/v1/auth/login', { email, password }, {
      headers: {
        'x-client-type': 'web',
        ...(adminPanel ? { 'x-admin-panel': 'true' } : {}),
      },
    }),
  getAdminProfile: () => api.get('/v1/admin/me'),
  updateTeacherProfile: (data) => api.put('/v1/teacher/profile', data),
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
  getStats: (showId) => api.get(`/v1/admin/shows/${showId}/stats`),
  getAll: (params) => api.get('/content/shows', { params }),
  list: (params) => api.get('/content/shows', { params }),
  getById: (id) => api.get(`/content/shows/${id}`),
  create: (data) => api.post('/content/shows', data),
  update: (id, data) => api.put(`/content/shows/${id}`, data),
  delete: (id) => api.delete(`/content/shows/${id}`),
  togglePublish: (id) => api.patch(`/content/shows/${id}/publish`),
  updateFeedPosition: (id, position) => api.patch(`/content/shows/${id}/feed-position`, { feed_position: position }),
  adjustViewCount: (id, data) => api.post(`/v1/admin/shows/${id}/view-count-adjust`, data),
};
export const dramasApi = showsApi;

// ── Episodes ──
export const episodesApi = {
  getByShow: (showId) => api.get(`/content/shows/${showId}/episodes`),
  create: (data) => api.post('/content/episodes', data),
  update: (id, data) => api.put(`/content/episodes/${id}`, data),
  delete: (id) => api.delete(`/content/episodes/${id}`),
};

// ── Media Upload ──
export const mediaApi = {
  getDownloadUrl: (episodeId) => api.get(`/media/download-url/${episodeId}`),
  getVideoUploadUrl: (showId, episodeId) =>
    api.post('/media/upload-url/video', { show_id: showId, episode_id: episodeId }),
  getImageUploadUrl: (type, entityId) =>
    api.post('/media/upload-url/image', { type, entity_id: entityId }),
  confirmVideo: (episodeId) =>
    api.post('/media/confirm/video', { episode_id: episodeId }),
  confirmImage: (type, entityId, objectName) =>
    api.post('/media/confirm/image', { type, entity_id: entityId, object_name: objectName }),
  uploadImageFile: (type, entityId, file) => {
    const formData = new FormData();
    formData.append('type', type);
    formData.append('entity_id', entityId);
    formData.append('image', file);

    return uploadApi.post('/media/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
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
  getStats: () => api.get('/v1/admin/membership/stats'),
  getHistory: (page = 1, limit = 50) => api.get(`/v1/admin/membership/history?page=${page}&limit=${limit}`),
  create: (data) => api.post('/v1/admin/membership/plans', data),
  update: (planId, data) => api.patch(`/v1/admin/membership/plans/${planId}`, data),
  delete: (planId) => api.delete(`/v1/admin/membership/plans/${planId}`),
  toggle: (planId) => api.patch(`/v1/admin/membership/plans/${planId}/toggle`),
};

// ── Top-Up Plans ──
export const topupApi = {
  getAll: () => api.get('/v1/admin/topup/plans'),
  getById: (planId) => api.get(`/v1/admin/topup/plans/${planId}`),
  create: (data) => api.post('/v1/admin/topup/plans', data),
  update: (planId, data) => api.patch(`/v1/admin/topup/plans/${planId}`, data),
  delete: (planId) => api.delete(`/v1/admin/topup/plans/${planId}`),
  toggle: (planId) => api.patch(`/v1/admin/topup/plans/${planId}/toggle`),
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

// ── Sub-admins & permissions (main admin only) ──
export const subAdminApi = {
  list: () => api.get('/v1/admin/sub-admins'),
  create: (data) => api.post('/v1/admin/sub-admins', data),
  update: (id, data) => api.patch(`/v1/admin/sub-admins/${id}`, data),
  delete: (id) => api.delete(`/v1/admin/sub-admins/${id}`),
  activityLogs: (limit = 50) => api.get('/v1/admin/activity-logs', { params: { limit } }),
};

// ── Teachers (main admin only) ──
export const teachersApi = {
  list: () => api.get('/v1/admin/teachers'),
  create: (data) => api.post('/v1/admin/teachers', data),
  toggleStatus: (id) => api.patch(`/v1/admin/teachers/${id}/status`),
  getProfile: (id) => api.get(`/v1/admin/teachers/${id}/profile`),
  saveProfile: (id, data) => api.put(`/v1/admin/teachers/${id}/profile`, data),
};

// ── Banners ──
export const bannersApi = {
  getAll: () => api.get('/v1/admin/banners'),
  create: (data) => api.post('/v1/admin/banners', data),
  update: (id, data) => api.put(`/v1/admin/banners/${id}`, data),
  delete: (id) => api.delete(`/v1/admin/banners/${id}`),
  toggle: (id) => api.patch(`/v1/admin/banners/${id}/toggle`),
};

// ── Hero Section Banners ──
export const heroBannersApi = {
  getAll: () => api.get('/v1/admin/hero-banners'),
  create: (data) => api.post('/v1/admin/hero-banners', data),
  update: (id, data) => api.put(`/v1/admin/hero-banners/${id}`, data),
  delete: (id) => api.delete(`/v1/admin/hero-banners/${id}`),
  toggle: (id) => api.patch(`/v1/admin/hero-banners/${id}/toggle`),
  reorder: (orderedIds) => api.put('/v1/admin/hero-banners/reorder', { ordered_ids: orderedIds }),
};

// ── Live streaming ──
export const liveApi = {
  create: (data) => api.post('/live/streams', data),
  getAll: (endedPeriod = '7d') => api.get('/live/streams', { params: { _t: Date.now(), ended_period: endedPeriod } }),
  getById: (id) => api.get(`/live/streams/${id}`, { params: { _t: Date.now() } }),
  end: (id) => api.delete(`/live/streams/${id}`),
  goLive: (id) => api.post(`/live/streams/${id}/go-live`),
  markLive: (streamKey, protocol = 'webrtc') =>
    api.post('/live/webhook/on-live', {
      path: `live/${streamKey}`,
      source_type: protocol,
      protocol,
    }),
  markEnded: (streamKey) =>
    api.post('/live/webhook/on-ended', {
      path: `live/${streamKey}`,
    }),
  getActive: () => api.get('/live/active'),
  getPlayUrl: (id) => api.get(`/live/${id}/play`),
  getViewers: (id) => api.get(`/live/${id}/viewers`),
  exportViewers: (id) => api.get(`/live/streams/${id}/export-viewers`),
};

// ── Coursework API ──
export const courseworkApi = {
  // Assignments
  getAssignments: (showId) => api.get(`/content/shows/${showId}/assignments`),
  createAssignment: (showId, data) => api.post(`/content/shows/${showId}/assignments`, data),
  updateAssignment: (id, data) => api.put(`/content/assignments/${id}`, data),
  deleteAssignment: (id) => api.delete(`/content/assignments/${id}`),

  // Materials
  getMaterials: (showId) => api.get(`/content/shows/${showId}/materials`),
  createMaterial: (showId, formData) =>
    uploadApi.post(`/content/shows/${showId}/materials`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateMaterial: (id, data) => api.put(`/content/materials/${id}`, data),
  deleteMaterial: (id) => api.delete(`/content/materials/${id}`),

  // Quizzes
  getQuizzes: (showId) => api.get(`/content/shows/${showId}/quizzes`),
  createQuiz: (showId, data) => api.post(`/content/shows/${showId}/quizzes`, data),
  updateQuiz: (id, data) => api.put(`/content/quizzes/${id}`, data),
  deleteQuiz: (id) => api.delete(`/content/quizzes/${id}`),

  // Quiz Questions
  getQuizQuestions: (quizId) => api.get(`/content/quizzes/${quizId}/questions`),
  createQuizQuestion: (quizId, data) => api.post(`/content/quizzes/${quizId}/questions`, data),
  deleteQuizQuestion: (questionId) => api.delete(`/content/quizzes/questions/${questionId}`),

  // Submissions & Grading
  getSubmissions: (params) => api.get('/content/admin/submissions', { params }),
  gradeSubmission: (id, data) => api.post(`/content/admin/submissions/${id}/grade`, data),

  // Certificate Config
  getCertificateConfig: (showId) => api.get(`/shows/${showId}/certificate-config`),
  updateCertificateConfig: (showId, data) => api.put(`/shows/${showId}/certificate-config`, data),
};

// ── Certificate API ──
export const certificateApi = {
  getConfig: (showId) => api.get(`/shows/${showId}/certificate-config`),
  updateConfig: (showId, data) => api.put(`/shows/${showId}/certificate-config`, data),
};

// ── Packages API ──
export const packagesApi = {
  list: () => api.get('/content/admin/packages'),
  getById: (id) => api.get(`/content/admin/packages/${id}`),
  create: (data) => api.post('/content/admin/packages', data),
  update: (id, data) => api.put(`/content/admin/packages/${id}`, data),
  delete: (id) => api.delete(`/content/admin/packages/${id}`),
};

// ── Approvals API ──
export const approvalsApi = {
  list: () => api.get('/v1/admin/approvals'),
  act: (type, id, action) => {
    const path = type === 'show' ? `/v1/admin/approvals/shows/${id}` : `/v1/admin/approvals/episodes/${id}`;
    return api.patch(path, { action });
  }
};

// ── Geo API ──
export const geoApi = {
  getCountries: () => api.get('/v1/geo/countries'),
  getStates: (countryCode) => api.get('/v1/geo/states', { params: { country: countryCode } }),
  getCities: (countryCode, stateCode) => api.get('/v1/geo/cities', { params: { country: countryCode, state: stateCode } }),
};

// ── Student Onboarding & Course Assignment API ──
export const studentsApi = {
  list: (params) => api.get('/v1/admin/students', { params }),
  onboard: (data) => api.post('/v1/admin/students', data),
  assignCourses: (userId, showIds) => api.post(`/v1/admin/students/${userId}/courses`, { show_ids: showIds }),
  revokeCourse: (userId, showId) => api.delete(`/v1/admin/students/${userId}/courses/${showId}`),
};

// ── CMS Pages API ──
export const cmsApi = {
  list: () => api.get('/v1/admin/cms'),
  getById: (id) => api.get(`/v1/admin/cms/${id}`),
  create: (data) => api.post('/v1/admin/cms', data),
  update: (id, data) => api.put(`/v1/admin/cms/${id}`, data),
  updateStatus: (id, status) => api.patch(`/v1/admin/cms/${id}/status`, { status }),
  delete: (id) => api.delete(`/v1/admin/cms/${id}`),
};

// ── Account Deletions API ──
export const accountDeletionsApi = {
  list: (params) => api.get('/v1/admin/account-deletions', { params }),
  exportCSV: (params) => api.get('/v1/admin/account-deletions/export', { params, responseType: 'blob' }),
};
