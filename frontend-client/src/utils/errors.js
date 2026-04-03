export function getErrorMessage(error, fallback = 'Something went wrong') {
  if (!error) return fallback;

  // Axios error shape: error.response?.data, error.message, etc.
  if (typeof error === 'string') return error;

  if (error?.response?.data) {
    const data = error.response.data;
    if (typeof data === 'string') return data;
    if (data?.message) return String(data.message);
  }

  if (error?.message) return String(error.message);
  return fallback;
}

