import { API_URL } from './config'

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); this.name = 'ApiError' }
}

export const NETWORK_ERROR = 'No pudimos conectar con VetGest. Revisa tu conexión e inténtalo nuevamente.'
export const GENERIC_ERROR = 'No pudimos completar la solicitud. Inténtalo nuevamente.'

/** Rutas públicas: un 401 aquí es «credenciales incorrectas», no «sesión vencida». */
const PUBLIC_PATHS = ['/auth/token', '/auth/register']

export interface RequestOptions { method?: string; body?: unknown; signal?: AbortSignal }
export interface ApiClientOptions {
  baseUrl: string
  getToken: () => string | null | Promise<string | null>
  onUnauthorized?: () => void
  fetchImpl?: typeof fetch
  timeoutMs?: number
  /** Se llama con +1 cuando una petición supera `slowAfterMs` y con -1 cuando termina. */
  onSlow?: (delta: 1 | -1) => void
  slowAfterMs?: number
}
export type ApiClient = <T>(path: string, options?: RequestOptions) => Promise<T>

// Render gratis duerme la API: la primera petición puede tardar cerca de un minuto.
export function createApiClient({ baseUrl, getToken, onUnauthorized, fetchImpl, timeoutMs = 90_000, onSlow, slowAfterMs = 4_000 }: ApiClientOptions): ApiClient {
  return async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const isPublic = PUBLIC_PATHS.includes(path)
    const token = isPublic ? null : await getToken()
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Bearer ${token}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let slow = false
    const slowTimer = onSlow ? setTimeout(() => { slow = true; onSlow(1) }, slowAfterMs) : undefined
    options.signal?.addEventListener('abort', () => controller.abort())
    let response: Response
    try {
      response = await (fetchImpl ?? fetch)(`${baseUrl}${path}`, {
        method: options.method ?? 'GET', headers, signal: controller.signal,
        // Sin cookies: la app se identifica solo con el token Bearer.
        credentials: 'omit',
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      })
    } catch {
      throw new ApiError(0, NETWORK_ERROR)
    } finally {
      clearTimeout(timer)
      clearTimeout(slowTimer)
      if (slow) onSlow?.(-1)
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null
      if (response.status === 401 && !isPublic) onUnauthorized?.()
      throw new ApiError(response.status, body?.error?.message ?? GENERIC_ERROR, body?.error?.code)
    }
    if (response.status === 204) return undefined as T
    return await response.json().catch(() => undefined) as T
  }
}

/** Sesión en memoria del cliente por defecto. AuthProvider la carga desde el almacenamiento seguro. */
const session: { token: string | null; onUnauthorized: (() => void) | null } = { token: null, onUnauthorized: null }
export const setSessionToken = (token: string | null) => { session.token = token }
export const setUnauthorizedHandler = (handler: (() => void) | null) => { session.onUnauthorized = handler }

/** Peticiones lentas en curso (para «Despertando el servidor…»). */
let slowCount = 0
const slowListeners = new Set<() => void>()
export const serverWake = {
  subscribe: (listener: () => void) => { slowListeners.add(listener); return () => { slowListeners.delete(listener) } },
  isWaking: () => slowCount > 0,
}

export const api = createApiClient({
  baseUrl: API_URL,
  getToken: () => session.token,
  onUnauthorized: () => session.onUnauthorized?.(),
  onSlow: delta => { slowCount = Math.max(0, slowCount + delta); slowListeners.forEach(l => l()) },
})

export const errorMessage = (error: unknown) => error instanceof Error && error.message ? error.message : GENERIC_ERROR
