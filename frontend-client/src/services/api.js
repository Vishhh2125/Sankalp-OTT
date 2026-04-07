import axios from 'axios';

import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../constants/config';

export const api = axios.create({
  baseURL: "http://172.31.56.30:5000/api/v1",
  headers: {
    'Content-Type': 'application/json',
    'x-client-type': 'mobile',
  },
});

// Example interceptor: you can extend this later with auth headers, logging, etc.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Keep error as-is; UI layer can convert it to a friendly message.
    return Promise.reject(error);
  }
);

