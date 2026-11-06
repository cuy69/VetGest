import { useEffect } from 'react'

/** Título de pestaña por pantalla (WCAG 2.4.2). */
export function usePageTitle(title: string) {
  useEffect(() => { document.title = `${title} · VetGest` }, [title])
}
