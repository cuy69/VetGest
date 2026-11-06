import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, ApiError, setSessionToken, setUnauthorizedHandler } from './api'
import { tokenStorage } from './token-storage'
import type { LoginValues } from './schemas'
import type { TokenResponse, User } from './types'

type Status = 'loading' | 'signedOut' | 'signedIn'
interface AuthValue {
  status: Status
  user: User | null
  /** Mensaje para la pantalla de ingreso (p. ej., la sesión venció). */
  notice: string | null
  signIn: (values: LoginValues) => Promise<void>
  signOut: () => Promise<void>
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const [status, setStatus] = useState<Status>('loading')
  const [user, setUserState] = useState<User | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const dropSession = useCallback(async (message: string | null) => {
    setSessionToken(null)
    await tokenStorage.clear().catch(() => undefined)
    client.clear()
    setUserState(null)
    setNotice(message)
    setStatus('signedOut')
  }, [client])

  // 401 en cualquier pantalla privada → volver al ingreso.
  useEffect(() => {
    setUnauthorizedHandler(() => { void dropSession('Tu sesión terminó. Ingresa nuevamente.') })
    return () => setUnauthorizedHandler(null)
  }, [dropSession])

  // Al abrir la app: si hay token guardado, validarlo con /auth/me.
  useEffect(() => {
    let active = true
    void (async () => {
      const saved = await tokenStorage.get().catch(() => null)
      if (!saved) { if (active) setStatus('signedOut'); return }
      setSessionToken(saved)
      try {
        const me = await api<User>('/auth/me')
        if (!active) return
        if (me.role !== 'owner') { await dropSession('La app es para propietarios. El personal entra desde la web.'); return }
        setUserState(me); setStatus('signedIn')
      } catch (e) {
        if (!active) return
        // Sin conexión: no se borra el token, pero hay que reintentar desde el ingreso.
        if (e instanceof ApiError && e.status === 401) return
        setSessionToken(null); setNotice(e instanceof Error ? e.message : null); setStatus('signedOut')
      }
    })()
    return () => { active = false }
  }, [dropSession])

  const signIn = useCallback(async (values: LoginValues) => {
    const data = await api<TokenResponse>('/auth/token', { method: 'POST', body: values })
    await tokenStorage.set(data.access_token)
    setSessionToken(data.access_token)
    client.clear()
    setNotice(null)
    setUserState(data.user)
    setStatus('signedIn')
  }, [client])

  const signOut = useCallback(async () => {
    // Revoca el token en el servidor; si falla (sin red o ya vencido), igual se cierra localmente.
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined)
    await dropSession(null)
  }, [dropSession])

  const value = useMemo<AuthValue>(() => ({ status, user, notice, signIn, signOut, setUser: setUserState }), [status, user, notice, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return value
}
