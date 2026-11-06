import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { todayLima } from '../lib/schemas'
import { appointment, mockApi, renderAt, staffUser } from './mock-api'

const summary = { today: {}, pending_requests: 0, my_today: 0, waiting: 0, in_consult: 0 }
const today = () => `${todayLima()}T23:30:00-05:00`

it('recepción registra la llegada y el paciente pasa a la sala de espera, sin poder iniciar la consulta', async () => {
  const user = userEvent.setup()
  let arrived = false
  const calls = mockApi((key, call) => {
    if (key === 'GET /auth/me') return staffUser(5, 'reception', 'Rosa')
    if (key === 'GET /clinic/summary') return { ...summary, waiting: arrived ? 1 : 0 }
    if (key === 'GET /clinic/payments/pending') return []
    if (key === 'GET /clinic/appointments' && call.search.get('status') === 'Pendiente') return []
    if (key === 'GET /clinic/appointments') return [appointment(1, { starts_at: today(), ...(arrived ? { arrived_at: new Date().toISOString(), stage: 'En sala de espera' } : {}) })]
    if (key === 'POST /clinic/appointments/1/arrival') { arrived = true; return appointment(1, { starts_at: today(), arrived_at: new Date().toISOString(), stage: 'En sala de espera' }) }
  })
  renderAt('/clinica')
  await user.click(await screen.findByRole('button', { name: 'Registrar llegada de Luna' }))
  expect(calls.some(c => c.method === 'POST' && c.path === '/clinic/appointments/1/arrival')).toBe(true)
  expect(await screen.findByText('Llegada registrada · Luna')).toBeVisible()
  const waiting = await screen.findByRole('list', { name: 'Pacientes en sala de espera' })
  expect(within(waiting).getByText('Luna')).toBeVisible()
  expect(within(waiting).getByText(/Espera 0 min/)).toBeVisible()
  expect(screen.queryByRole('button', { name: /Iniciar consulta/ })).toBeNull()
})

it('el veterinario solo puede iniciar la consulta de sus pacientes que ya llegaron', async () => {
  const user = userEvent.setup()
  const vet = staffUser(7, 'vet', 'Marco')
  const arrivedAt = new Date(Date.now() - 12 * 60_000).toISOString()
  const mine = appointment(1, { starts_at: today(), arrived_at: arrivedAt, stage: 'En sala de espera', vet: { id: 7, profile: vet.profile } })
  const other = appointment(2, { petName: 'Toby', starts_at: today(), arrived_at: new Date(Date.now() - 32 * 60_000).toISOString(), stage: 'En sala de espera', vet: { id: 8, profile: { first_name: 'Eva', last_name: 'Ríos', phone: '' } } })
  const calls = mockApi(key => {
    if (key === 'GET /auth/me') return vet
    if (key === 'GET /clinic/summary') return summary
    if (key === 'GET /clinic/appointments') return [mine, other]
    if (key === 'POST /clinic/appointments/1/start') return { ...mine, started_at: new Date().toISOString(), stage: 'En consulta' }
  })
  renderAt('/clinica')
  // Su siguiente paciente aparece arriba y en el tablero; el de otro veterinario muestra la demora con texto.
  expect(await screen.findByRole('heading', { name: 'Luna · Consulta general' })).toBeVisible()
  expect(screen.getAllByText(/Espera 12 min/)).toHaveLength(2)
  expect(screen.getByText(/Espera 32 min/)).toHaveClass('late')
  expect(screen.getByText('· demora')).toBeVisible()
  expect(screen.queryByRole('button', { name: /Registrar llegada/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Iniciar consulta de Toby' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Iniciar consulta de Luna' }))
  await waitFor(() => expect(calls.some(c => c.method === 'POST' && c.path === '/clinic/appointments/1/start')).toBe(true))
})

it('caja cobra una atención con monto editable y suma los cobros del día por método', async () => {
  const user = userEvent.setup()
  let paid: Record<string, unknown> | null = null
  const attended = appointment(4, { status: 'Atendida', stage: 'Atendida', has_record: true })
  const calls = mockApi((key, call) => {
    if (key === 'GET /auth/me') return staffUser(5, 'reception', 'Rosa')
    if (key === 'GET /clinic/payments/pending') return paid ? [] : [attended]
    if (key === 'GET /clinic/payments') {
      expect(call.search.get('date_from')).toBe(todayLima())
      return paid ? [{ id: 30, appointment_id: 4, amount: 75.5, method: 'Yape', notes: '', paid_at: new Date().toISOString(), received_by: 'Rosa Díaz', pet_name: 'Luna', owner_name: 'Ana Torres', service_name: 'Consulta general', voided_at: null, void_reason: null }] : []
    }
    if (key === 'POST /clinic/payments') { paid = call.body as Record<string, unknown>; return [201, { id: 30, ...paid, paid_at: new Date().toISOString() }] }
  })
  renderAt('/clinica/caja')
  const amount = await screen.findByLabelText('Monto (S/)')
  expect(amount).toHaveValue(80)
  await user.clear(amount)
  await user.click(screen.getByRole('button', { name: 'Yape' }))
  await user.click(screen.getByRole('button', { name: 'Cobrar' }))
  expect(await screen.findByText('El monto debe ser mayor que cero.')).toBeVisible()
  await user.type(amount, '75.50')
  expect(screen.getByRole('button', { name: 'Yape' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(screen.getByRole('button', { name: /Cobrar S\/\s?75\.50 con Yape/ }))
  // Confirmación dentro de la página con el resumen.
  const dialog = screen.getByRole('dialog', { name: /¿Cobrar S\/\s?75\.50 con Yape\?/ })
  expect(within(dialog).getByText('Ana Torres')).toBeVisible()
  expect(calls.some(c => c.method === 'POST')).toBe(false)
  await user.click(within(dialog).getByRole('button', { name: 'Confirmar cobro' }))
  expect(await screen.findByText(/Cobro registrado: S\/\s?75\.50 con Yape · Luna\./)).toBeVisible()
  expect(paid).toEqual({ appointment_id: 4, amount: 75.5, method: 'Yape', notes: '' })
  expect(await screen.findByText('Todo cobrado')).toBeVisible()
  const totals = screen.getByLabelText('Totales del día')
  await waitFor(() => expect(within(totals).getByText('Total cobrado · 1 cobros').nextSibling).toHaveTextContent(/75\.50/))
  expect(within(totals).getByText(/Yape · 1/).nextSibling).toHaveTextContent(/75\.50/)
  // Recepción no anula cobros.
  expect(screen.queryByRole('button', { name: /Anular cobro de/ })).toBeNull()
})

it('el administrador anula un cobro solo con motivo, dentro de la página', async () => {
  const user = userEvent.setup()
  let voided: unknown = null
  const payment = { id: 30, appointment_id: 4, amount: 80, method: 'Efectivo', notes: '', paid_at: new Date().toISOString(), received_by: 'Rosa Díaz', pet_name: 'Luna', owner_name: 'Ana Torres', service_name: 'Consulta general', voided_at: null, void_reason: null }
  mockApi((key, call) => {
    if (key === 'GET /auth/me') return staffUser(2, 'admin', 'Lucía')
    if (key === 'GET /clinic/payments/pending') return []
    if (key === 'GET /clinic/payments') return [voided ? { ...payment, voided_at: new Date().toISOString(), void_reason: 'Monto equivocado' } : payment]
    if (key === 'POST /clinic/payments/30/void') { voided = call.body; return { ...payment, voided_at: new Date().toISOString(), void_reason: 'Monto equivocado' } }
  })
  renderAt('/clinica/caja')
  await user.click(await screen.findByRole('button', { name: 'Anular cobro de Luna' }))
  const dialog = screen.getByRole('dialog', { name: '¿Anular el cobro de Luna?' })
  await user.click(within(dialog).getByRole('button', { name: 'Anular cobro' }))
  expect(within(dialog).getByText('Usa al menos 3 caracteres.')).toBeVisible()
  expect(voided).toBeNull()
  await user.type(within(dialog).getByLabelText('Motivo de la anulación'), 'Monto equivocado')
  await user.click(within(dialog).getByRole('button', { name: 'Anular cobro' }))
  expect(await screen.findByText(/Cobro de Luna anulado/)).toBeVisible()
  expect(voided).toEqual({ reason: 'Monto equivocado' })
  expect(await screen.findByText('Anulado')).toBeVisible()
})

it('el administrador da de alta un producto y ve resaltado el stock bajo', async () => {
  const user = userEvent.setup()
  const items: Record<string, unknown>[] = [{ id: 1, name: 'Antipulgas pipeta', category: 'Antiparasitario', unit: 'pipeta', stock: 1, min_stock: 3, is_active: true, low_stock: true }]
  let created: Record<string, unknown> | null = null
  mockApi((key, call) => {
    if (key === 'GET /auth/me') return staffUser(2, 'admin', 'Lucía')
    if (key === 'GET /clinic/inventory') return items
    if (key === 'POST /clinic/inventory') {
      created = call.body as Record<string, unknown>
      const item = { id: 2, name: created.name, category: created.category, unit: created.unit, stock: created.initial_stock, min_stock: created.min_stock, is_active: true, low_stock: false }
      items.push(item); return [201, item]
    }
  })
  renderAt('/clinica/inventario')
  const low = (await screen.findByText('Antipulgas pipeta', { selector: 'strong' })).closest('tr')
  expect(low).toHaveClass('low-stock')
  expect(within(low as HTMLElement).getByText('Stock bajo')).toBeVisible()
  expect(screen.getByText('Antipulgas pipeta tiene stock bajo.')).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Nuevo producto' }))
  await user.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(await screen.findByText('Usa al menos 2 caracteres.')).toBeVisible()
  expect(created).toBeNull()
  await user.type(screen.getByLabelText('Nombre del producto'), 'Vacuna séxtuple')
  await user.selectOptions(screen.getByLabelText('Categoría'), 'Vacuna')
  await user.clear(screen.getByLabelText('Unidad'))
  await user.type(screen.getByLabelText('Unidad'), 'dosis')
  await user.clear(screen.getByLabelText('Stock mínimo (alerta)'))
  await user.type(screen.getByLabelText('Stock mínimo (alerta)'), '2')
  await user.clear(screen.getByLabelText('Stock inicial'))
  await user.type(screen.getByLabelText('Stock inicial'), '10')
  await user.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(await screen.findByText('Vacuna séxtuple agregado al inventario.')).toBeVisible()
  expect(created).toEqual({ name: 'Vacuna séxtuple', category: 'Vacuna', unit: 'dosis', min_stock: 2, initial_stock: 10 })
  const row = (await screen.findByText('Vacuna séxtuple', { selector: 'strong' })).closest('tr') as HTMLElement
  expect(row).not.toHaveClass('low-stock')
  expect(within(row).getByText('10')).toBeVisible()
})

it('recepción ve Caja pero no Inventario ni Ingresos, y no puede abrirlos por URL', async () => {
  mockApi(key => {
    if (key === 'GET /auth/me') return staffUser(5, 'reception', 'Rosa')
    if (key === 'GET /clinic/summary') return summary
    if (key === 'GET /clinic/appointments') return []
    if (key === 'GET /clinic/payments/pending') return []
  })
  renderAt('/clinica/inventario')
  expect(await screen.findByText('Solicitudes por confirmar')).toBeVisible()
  const nav = screen.getByRole('navigation', { name: 'Navegación principal' })
  expect(within(nav).getByRole('link', { name: 'Caja' })).toBeVisible()
  expect(within(nav).queryByRole('link', { name: 'Inventario' })).toBeNull()
  expect(within(nav).queryByRole('link', { name: 'Ingresos' })).toBeNull()
})

it('recepción tampoco abre el reporte de ingresos por URL', async () => {
  mockApi(key => {
    if (key === 'GET /auth/me') return staffUser(5, 'reception', 'Rosa')
    if (key === 'GET /clinic/summary') return summary
    if (key === 'GET /clinic/appointments') return []
    if (key === 'GET /clinic/payments/pending') return []
  })
  renderAt('/clinica/ingresos')
  expect(await screen.findByText('Solicitudes por confirmar')).toBeVisible()
  expect(screen.queryByRole('heading', { name: 'Reporte de ingresos' })).toBeNull()
})

it('el administrador ve Caja, Inventario e Ingresos en el menú', async () => {
  mockApi(key => {
    if (key === 'GET /auth/me') return staffUser(2, 'admin', 'Lucía')
    if (key === 'GET /clinic/summary') return summary
    if (key === 'GET /clinic/appointments') return []
    if (key === 'GET /clinic/payments/pending') return []
  })
  renderAt('/clinica')
  const nav = await screen.findByRole('navigation', { name: 'Navegación principal' })
  for (const name of ['Caja', 'Inventario', 'Ingresos']) expect(within(nav).getByRole('link', { name })).toBeVisible()
})

it('el reporte de ingresos muestra total, desgloses y pendiente de cobro', async () => {
  const calls = mockApi(key => {
    if (key === 'GET /auth/me') return staffUser(2, 'admin', 'Lucía')
    if (key === 'GET /clinic/reports/income') return {
      date_from: '2026-10-07', date_to: '2026-11-05', total: 230, count: 3,
      by_method: { Efectivo: 80, Yape: 150, Tarjeta: 0 },
      by_day: [{ key: '2026-11-04', total: 150, count: 2 }, { key: '2026-11-05', total: 80, count: 1 }],
      by_service: [{ key: 'Consulta general', total: 230, count: 3 }],
      pending: { key: 'pending', total: 45, count: 1 }, average_ticket: 76.67,
      appointments: { Atendida: 3, 'No asistió': 1, Cancelada: 0 },
    }
    if (key === 'GET /clinic/inventory') return [{ id: 1, name: 'Antirrábica', category: 'Vacuna', unit: 'dosis', stock: 1, min_stock: 2, is_active: true, low_stock: true }]
  })
  renderAt('/clinica/ingresos')
  expect(await screen.findByRole('heading', { name: 'Reporte de ingresos' })).toBeVisible()
  expect(await screen.findByText('Consulta general')).toBeVisible()
  expect(screen.getByText('Por cobrar · 1 atenciones').nextSibling).toHaveTextContent(/45\.00/)
  expect(screen.getByText('Ingresos · 3 cobros').nextSibling).toHaveTextContent(/230\.00/)
  expect(screen.getByText('Ticket promedio').nextSibling).toHaveTextContent(/76\.67/)
  expect(screen.getByText('Inasistencias · 1 de 4 citas').nextSibling).toHaveTextContent('25 %')
  expect(await screen.findByText('Productos bajo mínimo')).toBeVisible()
  await waitFor(() => expect(screen.getByText('Productos bajo mínimo').nextSibling).toHaveTextContent('1'))
  expect(screen.getByText('Yape').closest('tr')).toHaveTextContent(/150\.00/)
  expect(screen.getByText(/4 de noviembre de 2026/)).toBeVisible()
  const request = calls.find(c => c.path === '/clinic/reports/income')
  expect(request?.search.get('date_to')).toBe(todayLima())
})
