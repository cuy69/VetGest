import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { EmptyState, ErrorState, Loading } from '../components/ui'

it('anuncia que está cargando', () => { render(<Loading />); expect(screen.getByRole('status')).toHaveTextContent('Cargando tus datos') })
it('muestra el error y permite reintentar', async () => {
  const retry = vi.fn()
  render(<ErrorState error={new Error('Sin conexión')} retry={retry} />)
  expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión')
  await userEvent.click(screen.getByRole('button', { name: 'Volver a intentar' }))
  expect(retry).toHaveBeenCalledOnce()
})
it('explica una lista vacía y ofrece una acción', () => {
  render(<EmptyState title="Todavía no tienes mascotas" action={<button>Registrar mascota</button>}>Agrega a tu compañero.</EmptyState>)
  expect(screen.getByRole('heading', { name: 'Todavía no tienes mascotas' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Registrar mascota' })).toBeVisible()
})
