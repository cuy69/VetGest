import { useEffect, useState } from 'react'

/** Reloj que avanza cada `ms` para mostrar minutos de espera en vivo. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), ms); return () => window.clearInterval(t) }, [ms])
  return now
}
