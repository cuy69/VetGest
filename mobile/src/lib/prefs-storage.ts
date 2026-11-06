// iOS/Android: preferencias de lectura en el almacenamiento del dispositivo (no son secretas, pero
// expo-secure-store ya está instalado y persiste entre aperturas).
import * as SecureStore from 'expo-secure-store'

const KEY = 'vetgest.a11y'

export const prefsStorage = {
  get: () => SecureStore.getItemAsync(KEY),
  set: (value: string) => SecureStore.setItemAsync(KEY, value),
}
