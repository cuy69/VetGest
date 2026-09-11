import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import App from '../App'

// Contract-level UI test. The separate Playwright flow uses the actual API/database.
it('registra al propietario, lo dirige al login y permite registrar su mascota', async () => {
  const user = userEvent.setup()
  const owner = { id: 1, email: 'ana@example.com', profile: { first_name: 'Ana', last_name: 'Torres', phone: '987654321' } }
  let registered = false
  let authenticated = false
  let pet: Record<string, unknown> | null = null
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = String(input)
    const method = init?.method ?? 'GET'
    let body: unknown = null
    let status = 200
    if (path === '/api/auth/register' && method === 'POST') { registered = true; body = owner; status = 201 }
    else if (path === '/api/auth/login') { expect(registered).toBe(true); authenticated = true; body = owner }
    else if (path === '/api/auth/me') { body = authenticated ? owner : { error: { message: 'Inicia sesión' } }; status = authenticated ? 200 : 401 }
    else if (path === '/api/pets' && method === 'POST') { expect(authenticated).toBe(true); pet = { ...JSON.parse(String(init?.body)), id: 10, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }; body = pet; status = 201 }
    else if (path === '/api/pets') body = pet ? [pet] : []
    else if (path === '/api/pets/10') body = pet
    else if (path === '/api/appointments') body = []
    else throw new Error(`Unexpected request: ${method} ${path}`)
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/registro']}><App /></MemoryRouter></QueryClientProvider>)
  await user.click(screen.getByRole('button', { name: 'Crear mi cuenta' }))
  expect(await screen.findAllByRole('alert')).not.toHaveLength(0)
  expect(fetchMock).not.toHaveBeenCalled()
  await user.type(screen.getByLabelText('Nombres'), 'Ana')
  await user.type(screen.getByLabelText('Apellidos'), 'Torres')
  await user.type(screen.getByLabelText('Correo electrónico'), 'ana@example.com')
  await user.type(screen.getByLabelText('Teléfono'), '987654321')
  await user.type(screen.getByLabelText('Contraseña', { exact: true }), 'Test-password-123')
  await user.type(screen.getByLabelText('Confirmar contraseña'), 'Test-password-123')
  await user.click(screen.getByRole('button', { name: 'Crear mi cuenta' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Tu cuenta está lista')
  await user.type(screen.getByLabelText('Correo electrónico'), 'ana@example.com')
  await user.type(screen.getByLabelText('Contraseña', { exact: true }), 'Test-password-123')
  await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
  expect(await screen.findByRole('heading', { name: 'Hola, Ana 👋' })).toBeVisible()
  await user.click(screen.getByRole('link', { name: 'Registrar mascota' }))
  await user.type(await screen.findByLabelText('Nombre'), 'Luna')
  await user.selectOptions(screen.getByLabelText('Especie'), 'Gato')
  await user.type(screen.getByLabelText('Raza'), 'Mestizo')
  await user.selectOptions(screen.getByLabelText('Sexo'), 'Hembra')
  await user.type(screen.getByLabelText('Fecha de nacimiento aproximada'), '2022-03-12')
  await user.type(screen.getByLabelText('Peso (kg)'), '4.5')
  await user.type(screen.getByLabelText('Color'), 'Gris')
  await user.click(screen.getByRole('button', { name: 'Registrar mascota' }))
  expect(await screen.findByRole('heading', { name: 'Conoce a Luna' })).toBeVisible()
  expect(screen.getByRole('status')).toHaveTextContent('se guardaron correctamente')
  expect(pet).toMatchObject({ name: 'Luna', weight: 4.5 })
  client.clear()
})
