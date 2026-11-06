import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, expect, it } from 'vitest'
import { A11yMenu } from '../components/A11yMenu'
import { loadPrefs } from '../lib/a11y'

beforeAll(() => {
  // jsdom lacks <dialog> methods.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => { localStorage.clear(); for (const key of Object.keys(document.documentElement.dataset)) delete document.documentElement.dataset[key] })

it('aplica y recuerda el tamaño de texto y el alto contraste, y se puede restablecer', async () => {
  const user = userEvent.setup()
  render(<A11yMenu />)
  await user.click(screen.getByRole('button', { name: 'Accesibilidad' }))
  await user.click(screen.getByRole('radio', { name: /Muy grande/ }))
  await user.click(screen.getByRole('switch', { name: /Alto contraste/ }))
  expect(document.documentElement.dataset.text).toBe('1.5')
  expect(document.documentElement.dataset.contrast).toBe('on')
  expect(loadPrefs()).toMatchObject({ text: '1.5', contrast: true })
  await user.click(screen.getByRole('button', { name: /Restablecer/ }))
  expect(document.documentElement.dataset.text).toBe('1')
  expect(document.documentElement.dataset.contrast).toBeUndefined()
})

it('ignora preferencias guardadas manipuladas', () => {
  localStorage.setItem('vetgest:a11y', JSON.stringify({ text: '9', contrast: 'yes' }))
  expect(loadPrefs()).toMatchObject({ text: '1', contrast: false })
})
