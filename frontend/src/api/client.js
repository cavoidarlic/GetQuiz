/* ── API Base Client ───────────────────────────────────────── */

const BASE = import.meta.env.VITE_API_URL?.trim() || '';

/**
 * Injected by Dashboard (and any other component that has access to Clerk's
 * getToken). Call setTokenGetter(getToken) once on mount.
 */
let _getToken = null;
export function setTokenGetter(fn) { _getToken = fn; }

async function getAuthHeaders(isFormData = false) {
  const headers = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (_getToken) {
    try {
      const token = await _getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch { /* silent — backend degrades gracefully */ }
  }
  return headers;
}

/**
 * apiFetch(path, options?)
 * Returns { ok: boolean, data: any, error: string|null }
 */
export async function apiFetch(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(await getAuthHeaders(isFormData)),
    ...(options.headers ?? {}),
  };

  try {
    const res = await fetch(`${BASE}${path}`, { ...options, headers });

    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }

    if (!res.ok) {
      const message =
        (data && (data.detail || data.message || data.error)) ||
        `HTTP ${res.status}`;
      return { ok: false, data: null, error: String(message) };
    }

    return { ok: true, data, error: null };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, data: null, error: 'AbortError', isAborted: true };
    }
    return { ok: false, data: null, error: err.message ?? 'Network error' };
  }
}
