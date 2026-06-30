import axios, { AxiosError } from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const TOKEN_KEY = 'elbakri_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export class ApiError extends Error {
  status: number
  code: string
  details?: Record<string, unknown> | null
  constructor(message: string, status: number, code: string, details?: Record<string, unknown> | null) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

function normalizeError(err: unknown): ApiError {
  const ax = err as AxiosError<{ message?: string; error?: string; details?: Record<string, unknown> }>
  if (ax.response) {
    const d = ax.response.data || {}
    return new ApiError(d.message || 'حدث خطأ.', ax.response.status, d.error || 'error', d.details ?? null)
  }
  return new ApiError('تعذّر الاتصال بالخادم. تأكد من رفع مجلد /api وإعداد config.php.', 0, 'network')
}

/** Unwraps the backend { data } envelope. A null payload ({"data":null}) must
 *  return null (e.g. /auth/me when logged out) — NOT the envelope object. */
async function unwrap<T>(p: Promise<{ data: unknown }>): Promise<T> {
  try {
    const res = await p
    const body = res.data
    if (body && typeof body === 'object' && 'data' in (body as Record<string, unknown>)) {
      return (body as { data: T }).data
    }
    return body as T
  } catch (e) {
    throw normalizeError(e)
  }
}

export const api = {
  get: <T>(url: string, params?: Record<string, unknown>) => unwrap<T>(http.get(url, { params })),
  post: <T>(url: string, body?: unknown) => unwrap<T>(http.post(url, body)),
  put: <T>(url: string, body?: unknown) => unwrap<T>(http.put(url, body)),
  patch: <T>(url: string, body?: unknown) => unwrap<T>(http.patch(url, body)),
  del: <T>(url: string, params?: Record<string, unknown>) => unwrap<T>(http.delete(url, { params })),
  /** Raw axios for file/blob downloads. */
  raw: http,
  base: API_BASE,
}
