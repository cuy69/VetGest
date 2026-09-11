import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ApiError } from './lib/api'
import './styles.css'

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1 }, mutations: { retry: false } } })
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('VetGest: fallo de interfaz', error.name, info.componentStack) }
  render() {
    return this.state.failed ? <div className="standalone"><h1>No pudimos mostrar esta página.</h1><p>Recarga para volver a intentarlo. Tus datos guardados se conservan.</p><button className="button" onClick={() => window.location.reload()}>Recargar página</button></div> : this.props.children
  }
}
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><QueryClientProvider client={client}><BrowserRouter><App /></BrowserRouter></QueryClientProvider></ErrorBoundary></StrictMode>)
