import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { addDays, relativeDate } from '../lib/format'
import { todayLima } from '../lib/schemas'
import { appointment, clinic, mockApi, ownerUser, pet, renderAt, service } from './mock-api'

const day = addDays(todayLima(), 3)
const slot = (time: string, available: boolean) => ({ starts_at: `${day}T${time}:00-05:00`, available })
const base = (key: string) => {
  if (key === 'GET /auth/me') return ownerUser
  if (key === 'GET /pets') return [pet]
  if (key === 'GET /clinics') return [clinic]
  if (key === 'GET /services') return [service]
  if (key === 'GET /appointments') return []
}

it('pide turno en 4 pasos: turnos ocupados no se pueden elegir y un 409 vuelve al paso 3 sin perder lo demás', async () => {
  const user = userEvent.setup()
  let posted = 0
  const calls = mockApi((key, call) => {
    if (key === 'GET /clinics/1/availability') {
      expect(call.search.get('service_id')).toBe('3')
      // Tras el 409 el turno de las 10:30 ya figura ocupado.
      return { date: call.search.get('date'), slots: call.search.get('date') === day ? [slot('10:00', false), slot('10:30', posted === 0), slot('11:00', true)] : [] }
    }
    if (key === 'POST /appointments') { posted++; return [409, { error: { code: '409', message: 'Ese horario ya no está disponible. Elige otro.' } }] }
    return base(key)
  })
  renderAt('/app/citas/nueva')
  expect(await screen.findByText('Paso 1 de 4')).toBeVisible()
  // Única mascota: queda preseleccionada.
  expect(screen.getByRole('button', { name: /Luna/ })).toHaveAttribute('aria-pressed', 'true')
  await user.click(screen.getByRole('button', { name: /Continuar/ }))

  expect(await screen.findByText('Paso 2 de 4')).toBeVisible()
  await user.selectOptions(screen.getByLabelText('Veterinaria'), String(clinic.id))
  const serviceCard = await screen.findByRole('button', { name: /Consulta general.*30 min.*S\/ 80\.00/ })
  await user.click(serviceCard)
  await user.click(screen.getByRole('button', { name: /Continuar/ }))

  expect(await screen.findByText('Paso 3 de 4')).toBeVisible()
  await user.click(screen.getByRole('button', { name: relativeDate(day) }))
  const group = await screen.findByRole('group', { name: 'Horario disponible' })
  const taken = within(group).getByRole('button', { name: /10:00.*no disponible/ })
  expect(taken).toBeDisabled()
  await user.click(taken)
  expect(taken).toHaveAttribute('aria-pressed', 'false')
  expect(within(group).queryAllByRole('button', { pressed: true })).toHaveLength(0)
  const free = within(group).getByRole('button', { name: /10:30/ })
  await user.click(free)
  expect(free).toHaveAttribute('aria-pressed', 'true')
  await user.click(screen.getByRole('button', { name: /Continuar/ }))

  expect(await screen.findByText('Paso 4 de 4')).toBeVisible()
  expect(screen.getByText('S/ 80.00', { selector: 'dd' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Solicitar turno' }))

  expect(await screen.findByText('Ese horario se acaba de ocupar')).toBeVisible()
  expect(screen.getByText('Paso 3 de 4')).toBeVisible()
  const post = calls.find(c => c.method === 'POST')
  expect(post?.body).toEqual({ pet_id: pet.id, clinic_id: clinic.id, service_id: service.id, starts_at: `${day}T10:30:00-05:00`, reason: '' })
  await waitFor(() => expect(screen.getByRole('button', { name: /10:30.*no disponible/ })).toBeDisabled())
  expect(screen.getByRole('group', { name: 'Horario disponible' }).querySelector('[aria-pressed="true"]')).toBeNull()
  // Lo demás se mantiene: la veterinaria y el servicio siguen elegidos.
  await user.click(screen.getByRole('button', { name: /Atrás/ }))
  expect(await screen.findByRole('button', { name: /Consulta general/ })).toHaveAttribute('aria-pressed', 'true')
})

it('«Primer turno libre» salta al primer día con turnos y no avanza sin turno elegido', async () => {
  const user = userEvent.setup()
  const calls = mockApi((key, call) => {
    if (key === 'GET /clinics/1/availability') return { date: call.search.get('date'), slots: call.search.get('date') === day ? [slot('09:00', false), slot('09:30', true)] : [slot('09:00', false)] }
    if (key === 'POST /appointments') return [201, { id: 77 }]
    return base(key)
  })
  renderAt(`/app/citas/nueva?pet=${pet.id}&clinic=${clinic.id}&service=${service.id}`)
  await user.click(await screen.findByRole('button', { name: /Continuar/ }))
  await screen.findByRole('button', { name: /Consulta general/ })
  await user.click(screen.getByRole('button', { name: /Continuar/ }))
  expect(await screen.findByText('Paso 3 de 4')).toBeVisible()
  await user.click(screen.getByRole('button', { name: /Continuar/ }))
  expect(await screen.findByText('Paso 3 de 4')).toBeVisible()
  await user.click(screen.getByRole('button', { name: /Primer turno libre/ }))
  const group = await screen.findByRole('group', { name: 'Horario disponible' })
  await waitFor(() => expect(within(group).getByRole('button', { name: /09:30/ })).toHaveAttribute('aria-pressed', 'true'))
  expect(screen.getByRole('button', { name: relativeDate(day) })).toHaveAttribute('aria-pressed', 'true')
  expect(calls.some(c => c.method === 'POST')).toBe(false)
})

it('el inicio muestra la próxima cita con su línea de 5 pasos y los recordatorios vencidos con «Agendar»', async () => {
  const next = appointment(5, { starts_at: `${day}T10:00:00-05:00`, stage: 'Confirmada' })
  mockApi(key => {
    if (key === 'GET /reminders') return [{ kind: 'Vacuna', title: 'Antirrábica', pet_id: pet.id, pet_name: 'Luna', due: '2026-10-01', overdue: true, clinic_name: clinic.name }]
    if (key === 'GET /appointments') return [next]
    return base(key)
  })
  renderAt('/app')
  const timeline = await screen.findByRole('list', { name: 'Recorrido de la cita' })
  const current = within(timeline).getByText('Estado actual').closest('li')
  expect(current).toHaveAttribute('aria-current', 'step')
  expect(current).toHaveTextContent('Confirmada')
  expect(screen.getByText(/Te esperamos .* a las 10:00\./)).toBeVisible()
  const book = screen.getByRole('link', { name: 'Agendar Antirrábica de Luna' })
  const url = new URL(book.getAttribute('href') ?? '', 'http://x')
  expect(url.pathname).toBe('/app/citas/nueva')
  expect(Object.fromEntries(url.searchParams)).toEqual({ pet: String(pet.id), clinic_name: clinic.name, kind: 'Vacuna' })
})
