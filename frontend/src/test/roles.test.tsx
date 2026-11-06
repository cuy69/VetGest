import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import App from '../App'

const profile = { first_name: 'Rosa', last_name: 'Díaz', phone: '987111222' }
const reception = { id: 5, email: 'rosa@a.pe', role: 'staff', must_change_password: false, profile, membership: { clinic_id: 1, clinic_name: 'Huella Animal', role: 'reception' } }

function mockApi(user: unknown, extra: Record<string, unknown> = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const path = String(input).split('?')[0]
    const routes: Record<string, unknown> = {
      '/api/auth/me': user, '/api/clinic/summary': { today: {}, pending_requests: 2, my_today: 0 },
      '/api/clinic/appointments': [], '/api/clinic/payments/pending': [], ...extra,
    }
    if (!(path in routes)) throw new Error(`Unexpected request: ${path}`)
    return new Response(JSON.stringify(routes[path]), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
}
function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></QueryClientProvider>)
}
afterEach(() => vi.restoreAllMocks())

it('envía al personal de recepción a su espacio de veterinaria sin opciones de administrador', async () => {
  mockApi(reception)
  renderAt('/app')
  expect(await screen.findByText('Solicitudes por confirmar')).toBeVisible()
  expect(screen.getByRole('link', { name: 'Agenda' })).toBeVisible()
  expect(screen.queryByRole('link', { name: 'Equipo' })).toBeNull()
  expect(screen.getAllByText('Huella Animal').length).toBeGreaterThan(0)
})

it('impide que recepción abra la gestión del equipo', async () => {
  mockApi(reception)
  renderAt('/clinica/equipo')
  expect(await screen.findByText('Solicitudes por confirmar')).toBeVisible()
})

it('exige cambiar la contraseña temporal antes de usar la veterinaria', async () => {
  mockApi({ ...reception, must_change_password: true })
  renderAt('/clinica')
  expect(await screen.findByRole('heading', { name: 'Crea tu contraseña personal' })).toBeVisible()
  expect(screen.queryByText('Solicitudes por confirmar')).toBeNull()
})
