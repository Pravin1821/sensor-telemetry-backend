import { API_BASE_URL } from './config';

let authToken = null;
let onUnauthorized = null;

export const setToken = (t) => { authToken = t; };
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000); // give up after 8 s

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your Wi-Fi and the API address.', 0);
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Token expired or invalid while logged in: send the user back to the login screen
    if (res.status === 401 && authToken && onUnauthorized) onUnauthorized();
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  }
  return data;
}

export const api = {
  login: (username, password) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  getDevices: () => request('/api/devices'),
  getDevice: (id) => request(`/api/devices/${id}`),

  async getHourReadings(id, to) {
    const from = to - 3600;
    let all = [];
    for (let page = 1; ; page++) {
      const r = await request(`/api/devices/${id}/readings?from=${from}&to=${to}&limit=200&page=${page}`);
      all = all.concat(r.data);
      if (all.length >= r.total || r.data.length === 0) break;
    }
    return all;
  },

  acknowledge: (alertId) => request(`/api/alerts/${alertId}`, { method: 'PATCH' }),
};