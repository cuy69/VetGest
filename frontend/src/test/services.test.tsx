import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { clinic, mockApi, renderAt, staffUser } from './mock-api'

test('Nuevo servicio abre el formulario', async () => {
  mockApi(key => ({ 'GET /auth/me': staffUser(1, 'admin', 'Carla'), 'GET /clinic/services': [], 'GET /clinic': clinic, 'GET /clinic/summary': { today: {}, pending_requests: 0, my_today: 0, waiting: 0, in_consult: 0 } } as Record<string, unknown>)[key])
  renderAt('/clinica/servicios')
  await userEvent.click(await screen.findByRole('button', { name: /Nuevo servicio/ }))
  expect(await screen.findByLabelText('Nombre')).toBeInTheDocument()
})
