import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import App from '../App'

export interface Call { method: string; path: string; search: URLSearchParams; body: unknown }
type Reply = unknown | [number, unknown]
/** Simula la API: `routes` recibe "MÉTODO /ruta" (sin /api ni query) y devuelve el cuerpo o [estado, cuerpo]. */
export function mockApi(routes: (key: string, call: Call) => Reply) {
  const calls: Call[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://localhost')
    const method = init?.method ?? 'GET'
    const call: Call = { method, path: url.pathname.replace(/^\/api/, ''), search: url.searchParams, body: init?.body ? JSON.parse(String(init.body)) : undefined }
    calls.push(call)
    const reply = routes(`${method} ${call.path}`, call)
    if (reply === undefined) throw new Error(`Unexpected request: ${method} ${url.pathname}${url.search}`)
    const [status, body] = Array.isArray(reply) && typeof reply[0] === 'number' && reply.length === 2 ? reply as [number, unknown] : [200, reply]
    return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  })
  return calls
}
export function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></QueryClientProvider>)
  return client
}

const profile = (first_name: string, last_name: string) => ({ first_name, last_name, phone: '987111222' })
export const staffUser = (id: number, role: 'admin' | 'vet' | 'reception', first: string) => ({ id, email: `${first.toLowerCase()}@huella.pe`, role: 'staff', must_change_password: false, profile: profile(first, 'Díaz'), membership: { clinic_id: 1, clinic_name: 'Huella Animal', role } })
export const ownerUser = { id: 1, email: 'ana@example.com', role: 'owner', must_change_password: false, membership: null, profile: profile('Ana', 'Torres') }
export const clinic = { id: 1, name: 'Huella Animal', address: 'Av. Pardo 123', phone: '043123456', opening_hours: 'Todos los días', description: 'Veterinaria de barrio.', opens_at: '09:00', closes_at: '18:00', open_days: [1, 2, 3, 4, 5, 6, 7] }
export const service = { id: 3, clinic_id: 1, name: 'Consulta general', description: 'Revisión completa.', duration_minutes: 30, price: 80, is_active: true }
export const pet = { id: 10, name: 'Luna', species: 'Gato', breed: 'Mestizo', sex: 'Hembra', birth_date: '2022-03-12', weight: 4.5, color: 'Gris', notes: '', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }
export function appointment(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id, pet: { ...pet, id: 10 + id, name: overrides.petName ?? pet.name }, clinic, service, starts_at: '2099-01-10T10:00:00-05:00', reason: '', status: 'Confirmada',
    vet: null, has_record: false, arrived_at: null, started_at: null, stage: 'Confirmada', payment: null,
    created_at: '2026-11-01T10:00:00-05:00', updated_at: '2026-11-01T10:00:00-05:00', owner: profile('Ana', 'Torres'), staff_notes: '', ...overrides,
  }
}
