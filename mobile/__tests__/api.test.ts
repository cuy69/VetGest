import { api, ApiError, createApiClient, GENERIC_ERROR, NETWORK_ERROR, setSessionToken, setUnauthorizedHandler } from '@/lib/api'

type Call = { url: string; init: RequestInit }

function fakeFetch(status: number, body?: unknown) {
  const calls: Call[] = []
  const impl = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }) as unknown as typeof fetch
  return { impl, calls }
}
const headersOf = (call: Call) => call.init.headers as Record<string, string>

describe('cliente API', () => {
  it('envía el token como Authorization: Bearer y sin cookies', async () => {
    const { impl, calls } = fakeFetch(200, [{ id: 1 }])
    const client = createApiClient({ baseUrl: 'http://api.test/api', getToken: () => 'tok-123', fetchImpl: impl })
    await expect(client('/pets')).resolves.toEqual([{ id: 1 }])
    expect(calls[0].url).toBe('http://api.test/api/pets')
    expect(headersOf(calls[0]).Authorization).toBe('Bearer tok-123')
    expect(calls[0].init.credentials).toBe('omit')
  })

  it('serializa el cuerpo JSON y acepta 204', async () => {
    const { impl, calls } = fakeFetch(204)
    const client = createApiClient({ baseUrl: 'http://api.test/api', getToken: async () => 't', fetchImpl: impl })
    await expect(client('/pets/1', { method: 'DELETE' })).resolves.toBeUndefined()
    const post = fakeFetch(201, { id: 2 })
    const c2 = createApiClient({ baseUrl: 'http://api.test/api', getToken: () => 't', fetchImpl: post.impl })
    await c2('/pets', { method: 'POST', body: { name: 'Luna' } })
    expect(post.calls[0].init.body).toBe('{"name":"Luna"}')
    expect(headersOf(post.calls[0])['Content-Type']).toBe('application/json')
    expect(calls[0].init.method).toBe('DELETE')
  })

  it('no envía cabecera si no hay token', async () => {
    const { impl, calls } = fakeFetch(200, {})
    const client = createApiClient({ baseUrl: 'http://x/api', getToken: () => null, fetchImpl: impl })
    await client('/clinics')
    expect(headersOf(calls[0]).Authorization).toBeUndefined()
  })

  it('401 en una ruta privada avisa para volver al ingreso y propaga el mensaje', async () => {
    const onUnauthorized = jest.fn()
    const { impl } = fakeFetch(401, { error: { code: '401', message: 'Tu sesión expiró.' } })
    const client = createApiClient({ baseUrl: 'http://x/api', getToken: () => 'viejo', onUnauthorized, fetchImpl: impl })
    await expect(client('/appointments')).rejects.toMatchObject({ status: 401, message: 'Tu sesión expiró.' })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('401 o 403 en /auth/token no cierra sesión ni envía token: muestra el mensaje del servidor', async () => {
    const onUnauthorized = jest.fn()
    const staff = fakeFetch(403, { error: { code: '403', message: 'La app es para propietarios. El personal entra desde la web.' } })
    const client = createApiClient({ baseUrl: 'http://x/api', getToken: () => 'tok', onUnauthorized, fetchImpl: staff.impl })
    await expect(client('/auth/token', { method: 'POST', body: { email: 'a@b.pe', password: 'x' } }))
      .rejects.toEqual(new ApiError(403, 'La app es para propietarios. El personal entra desde la web.'))
    expect(headersOf(staff.calls[0]).Authorization).toBeUndefined()
    const wrong = fakeFetch(401, { error: { code: '401', message: 'Correo o contraseña incorrectos.' } })
    const c2 = createApiClient({ baseUrl: 'http://x/api', getToken: () => null, onUnauthorized, fetchImpl: wrong.impl })
    await expect(c2('/auth/token', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('usa mensajes genéricos si la respuesta no trae error o falla la red', async () => {
    const { impl } = fakeFetch(500)
    const client = createApiClient({ baseUrl: 'http://x/api', getToken: () => null, fetchImpl: impl })
    await expect(client('/pets')).rejects.toMatchObject({ status: 500, message: GENERIC_ERROR })
    const offline = createApiClient({ baseUrl: 'http://x/api', getToken: () => null, fetchImpl: (async () => { throw new TypeError('Network request failed') }) as unknown as typeof fetch })
    await expect(offline('/pets')).rejects.toMatchObject({ status: 0, message: NETWORK_ERROR })
  })

  it('409 de horario ocupado conserva código y mensaje', async () => {
    const { impl } = fakeFetch(409, { error: { code: '409', message: 'Ese horario ya no está disponible. Elige otro.' } })
    const client = createApiClient({ baseUrl: 'http://x/api', getToken: () => 't', fetchImpl: impl })
    await expect(client('/appointments', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 409, code: '409', message: 'Ese horario ya no está disponible. Elige otro.' })
  })

  it('el cliente por defecto usa el token de la sesión y el manejador de 401', async () => {
    const original = globalThis.fetch
    const { impl, calls } = fakeFetch(401, { error: { message: 'Sesión inválida.' } })
    globalThis.fetch = impl
    const handler = jest.fn()
    try {
      setSessionToken('abc'); setUnauthorizedHandler(handler)
      await expect(api('/auth/me')).rejects.toBeInstanceOf(ApiError)
      expect(calls[0].url).toBe('http://localhost:8000/api/auth/me')
      expect(headersOf(calls[0]).Authorization).toBe('Bearer abc')
      expect(handler).toHaveBeenCalledTimes(1)
    } finally {
      globalThis.fetch = original; setSessionToken(null); setUnauthorizedHandler(null)
    }
  })
})
