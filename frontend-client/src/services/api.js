import axios from 'axios';
import { API_BASE_URL } from '../constants/config';
import * as authService from './authService';

let authActions = null;

export const setAuthActions = (actions) => {
  authActions = actions;
};

class RequestQueue {
  constructor() {
    this.requests = [];
    this.isRefreshing = false;
  }

  add(request) {
    this.requests.push(request);
  }

  resolveAll(token) {
    this.requests.forEach((request) => request.resolve(token));
    this.requests = [];
    this.isRefreshing = false;
  }

  rejectAll(error) {
    this.requests.forEach((request) => request.reject(error));
    this.requests = [];
    this.isRefreshing = false;
  }
}

const requestQueue = new RequestQueue();
let store = null;

export const setStore = (reduxStore) => {
  store = reduxStore;
};

const refreshApi = axios.create({
  baseURL: API_BASE_URL + '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

function isAuthEndpoint(url = '') {
  return url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/verify-otp') ||
    url.includes('/auth/forgot-password') ||
    url.includes('/auth/reset-password') ||
    url.includes('/auth/resend-otp') ||
    url.includes('/auth/resend-forgot-otp') ||
    url.includes('/auth/refresh-token');
}

function hasAuthorizationHeader(headers) {
  if (!headers) return false;
  if (typeof headers.has === 'function') {
    return headers.has('Authorization') || headers.has('authorization');
  }
  return Boolean(headers.Authorization || headers.authorization);
}

function setAuthorizationHeader(config, token) {
  config.headers = config.headers || {};
  if (typeof config.headers.set === 'function') {
    config.headers.set('Authorization', `Bearer ${token}`);
  } else {
    config.headers.Authorization = `Bearer ${token}`;
  }
}

function attachAuthInterceptors(client) {
  client.interceptors.request.use(
    (config) => {
      if (store) {
        const accessToken = store.getState().auth?.accessToken;
        if (accessToken && !hasAuthorizationHeader(config.headers)) {
          setAuthorizationHeader(config, accessToken);
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      // Flag network/offline errors so components can suppress alerts
      if (!error.response && error.message === 'Network Error') {
        error.isOfflineError = true;
        return Promise.reject(error);
      }

      const originalRequest = error.config;

      if (error.response?.status !== 401) {
        return Promise.reject(error);
      }

      if (!originalRequest || isAuthEndpoint(originalRequest.url) || originalRequest._skipAuthRefresh) {
        return Promise.reject(error);
      }

      if (originalRequest._retried) {
        return Promise.reject(error);
      }

      if (requestQueue.isRefreshing) {
        return new Promise((resolve, reject) => {
          requestQueue.add({
            resolve: (token) => {
              setAuthorizationHeader(originalRequest, token);
              resolve(client(originalRequest));
            },
            reject,
          });
        });
      }

      requestQueue.isRefreshing = true;

      try {
        const refreshTokenValue = await authService.getRefreshToken();

        if (!refreshTokenValue) {
          throw new Error('No refresh token available');
        }

        const response = await refreshApi.get('/auth/refresh-token', {
          headers: {
            'x-client-type': authService.getClientType(),
            Authorization: `Bearer ${refreshTokenValue}`,
          },
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        await authService.saveTokens(accessToken, newRefreshToken);

        if (store) {
          if (authActions) {
            store.dispatch(authActions.setTokens({ accessToken }));
          } else {
            store.dispatch({ type: 'auth/setTokens', payload: { accessToken } });
          }
        }

        setAuthorizationHeader(originalRequest, accessToken);
        originalRequest._retried = true;

        requestQueue.resolveAll(accessToken);

        return client(originalRequest);
      } catch (refreshError) {
        console.log('[API Interceptor] Token refresh failed:', refreshError?.message);

        await authService.clearTokens();

        if (store) {
          if (authActions) {
            store.dispatch(authActions.logout());
          } else {
            store.dispatch({ type: 'auth/logout' });
          }
        }

        requestQueue.rejectAll(refreshError);

        return Promise.reject(refreshError);
      }
    }
  );

  return client;
}

export const api = attachAuthInterceptors(axios.create({
  baseURL: API_BASE_URL + '/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'x-client-type': authService.getClientType(),
  },
}));

export function createAuthenticatedApi(config) {
  const { headers, ...restConfig } = config || {};

  return attachAuthInterceptors(axios.create({
    ...restConfig,
    headers: {
      'Content-Type': 'application/json',
      'x-client-type': authService.getClientType(),
      ...(headers || {}),
    },
  }));
}
