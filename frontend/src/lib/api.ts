export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'ApiError' }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...options, credentials: 'include',
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    })
  } catch {
    throw new ApiError(0, 'No pudimos conectar con VetGest. Revisa tu conexión e inténtalo nuevamente.')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    if (response.status === 401 && path !== '/auth/login' && path !== '/auth/me') {
      window.dispatchEvent(new Event('vetgest:session-expired'))
    }
    throw new ApiError(response.status, body?.error?.message ?? 'No pudimos completar la solicitud. Inténtalo nuevamente.')
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

export const json = (method: string, data?: unknown): RequestInit => ({ method, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) })
