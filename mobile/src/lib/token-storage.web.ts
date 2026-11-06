// Web: expo-secure-store no existe en el navegador. El token se guarda solo en memoria
// (nunca en localStorage ni sessionStorage); al recargar la pestaña hay que ingresar de nuevo.
let token: string | null = null

export const tokenStorage = {
  get: async () => token,
  set: async (value: string) => { token = value },
  clear: async () => { token = null },
}
