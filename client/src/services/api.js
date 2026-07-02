const configuredApiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const API_URL = configuredApiUrl.endsWith('/api') ? configuredApiUrl : `${configuredApiUrl}/api`;
let pendingRequests = 0;
const responseCache = new Map();
const inFlightGets = new Map();
const GET_CACHE_TTL_MS = 15000;
const requestListeners = new Set();
const notifyRequests = () => requestListeners.forEach((listener) => listener());
export const subscribePendingRequests = (listener) => { requestListeners.add(listener); return () => requestListeners.delete(listener); };
export const getPendingRequestCount = () => pendingRequests;

export async function api(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const token = localStorage.getItem('typepath_token');
  const cacheKey = `${token || 'public'}:${path}`;
  if (method === 'GET') {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
    if (inFlightGets.has(cacheKey)) return inFlightGets.get(cacheKey);
  } else {
    responseCache.clear();
  }

  const request = performRequest(path, options, token, method, cacheKey);
  if (method === 'GET') inFlightGets.set(cacheKey, request);
  try { return await request; }
  finally { if (method === 'GET') inFlightGets.delete(cacheKey); }
}

async function performRequest(path, options, token, method, cacheKey) {
  pendingRequests += 1;
  notifyRequests();
  try {
    let response;
    try {
      response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...options.headers }
      });
    } catch (error) {
      if (!navigator.onLine) throw new Error('You are offline. Check your internet connection and try again.');
      throw new Error('The service is temporarily unreachable. Please try again shortly.', { cause: error });
    }
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && token) {
        localStorage.removeItem('typepath_token');
        window.dispatchEvent(new Event('typepath:unauthorized'));
      }
      throw new Error(data.message || 'Something went wrong');
    }
    if (method === 'GET') responseCache.set(cacheKey, { data, expiresAt: Date.now() + GET_CACHE_TTL_MS });
    return data;
  } finally {
    pendingRequests = Math.max(0, pendingRequests - 1);
    notifyRequests();
  }
}
