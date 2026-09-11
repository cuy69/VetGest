import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => { cleanup(); vi.restoreAllMocks() })
Object.defineProperty(window, 'scrollTo', { value: vi.fn(), writable: true })
HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
