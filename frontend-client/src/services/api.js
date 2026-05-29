import axios from 'axios';
import { API_BASE_URL } from '../constants/config';
import * as authService from './authService';

/**
 * =====================================================
 * AUTH ACTION CREATORS (Prasen's pattern)
 * =====================================================
 * Stored here so the response interceptor can dispatch
 * proper Redux action creators instead of raw type strings.
 */
let authActions = null;

export const setAuthActions = (actions) => {
  authActions = actions;
};

/**
 * =====================================================
 * REQUEST QUEUE SYSTEM (Handle 401 Race Conditions)
 * =====================================================
 *
 * Prevents multiple simultaneous 401 requests from triggering
 * multiple refresh calls. Instead, queues them and retries all
 * once with the new token.
 */

class RequestQueue {
  constructor() {
    this.requests = [];
    this.isRefreshing = false;
  }

  add(request) {
    this.requests.push(request);
  }

  resolveAll(token) {
    this.requests.forEach((request) => {
      request.resolve(token);
    });
    this.requests = [];
    this.isRefreshing = false;
  }

  rejectAll(error) {
    this.requests.forEach((request) => {
      request.reject(error);
    });
    this.requests = [];
    this.isRefreshing = false;
  }
}

const requestQueue = new RequestQueue();

/**
 * =====================================================
 * CREATE AXIOS INSTANCE
 * =====================================================
 */

export const api = axios.create({
  baseURL: API_BASE_URL + '/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'x-client-type': authService.getClientType(),
  },
});

/**
 * =====================================================
 * REQUEST INTERCEPTOR
 * =====================================================
 *
 * Injects Authorization header with accessToken
 */

let store = null;

export const setStore = (reduxStore) => {
  store = reduxStore;
};

api.interceptors.request.use(
  (config) => {
    if (store) {
      const accessToken = store.getState().auth?.accessToken;
      // Only add authorization header if not already set
      // (allows custom headers like refreshToken for logout)
      if (accessToken && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * =====================================================
 * RESPONSE INTERCEPTOR
 * =====================================================
 *
 * Handles 401 errors by:
 * 1. Checking if already refreshing (queue system)
 * 2. If first 401: lock refresh, call /refresh, unlock, retry queue
 * 3. If concurrent 401: queue the request, wait for retry
 * 4. On success: retry original request with new token
 * 5. On fail: dispatch logout
 */

// Create a separate axios instance for refresh calls (bypass interceptors)
const refreshApi = axios.create({
  baseURL: API_BASE_URL + '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// api.interceptors.response.use(
//   (response) => {
//     return response;
//   },
//   async (error) => {
//     const originalRequest = error.config;

//     // Only try to refresh on 401
//     if (error.response?.status !== 401) {
//       return Promise.reject(error);
//     }

//     // Prevent infinite loops (mark retried requests)
//     if (originalRequest._retried) {
//       return Promise.reject(error);
//     }

//     /**
//      * If already refreshing, queue this request
//      */
//     if (requestQueue.isRefreshing) {
//       return new Promise((resolve, reject) => {
//         requestQueue.add({
//           resolve: (token) => {
//             originalRequest.headers.Authorization = `Bearer ${token}`;
//             resolve(api(originalRequest));
//           },
//           reject: (error) => {
//             reject(error);
//           },
//         });
//       });
//     }

//     /**
//      * First 401: attempt refresh
//      */
//     requestQueue.isRefreshing = true;

//     try {
//       const refreshTokenValue = await authService.getRefreshToken();

//       if (!refreshTokenValue) {
//         throw new Error('No refresh token available');
//       }

//       // Call refresh endpoint using separate instance (no interceptors)
//       const response = await refreshApi.get('/auth/refresh-token', {
//         headers: {
//           'x-client-type': authService.getClientType(),
//           Authorization: `Bearer ${refreshTokenValue}`,
//         },
//       });

//       const { accessToken, refreshToken: newRefreshToken } = response.data.data;

//       // Update tokens in storage and Redux
//       if (store) {
//         // Save tokens via authService (refreshToken goes to SecureStore)
//         await authService.saveTokens(accessToken, newRefreshToken);

//         if (authActions) {
//           // ✅ Dispatch Redux action using proper action creator (Prasen's pattern)
//           store.dispatch(authActions.setTokens({ accessToken }));
//         } else {
//           // Fallback: raw type string (Samyak's fallback)
//           store.dispatch({ type: 'auth/setTokens', payload: { accessToken } });
//         }
//       }

//       // Update original request with new token
//       originalRequest.headers.Authorization = `Bearer ${accessToken}`;
//       originalRequest._retried = true;

//       // Resolve all queued requests with new token
//       requestQueue.resolveAll(accessToken);

//       // Retry original request
//       return api(originalRequest);
//     } catch (refreshError) {
//       console.error('[API Interceptor] Token refresh failed:', refreshError);

//       // Logout user on refresh failure
//       if (store) {
//         if (authActions) {
//           // ✅ Dispatch Redux action using proper action creator (Prasen's pattern)
//           store.dispatch(authActions.logout());
//         } else {
//           store.dispatch({ type: 'auth/logout' });
//         }
//       }

//       // Reject all queued requests
//       requestQueue.rejectAll(refreshError);

//       return Promise.reject(refreshError);
//     }
//   }
// );
