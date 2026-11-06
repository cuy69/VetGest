// Web: las preferencias de lectura (no los datos de la cuenta) pueden vivir en localStorage.
const KEY = 'vetgest:a11y'

export const prefsStorage = {
  get: async () => { try { return localStorage.getItem(KEY) } catch { return null } },
  set: async (value: string) => { try { localStorage.setItem(KEY, value) } catch { /* modo privado: duran esta visita */ } },
}
