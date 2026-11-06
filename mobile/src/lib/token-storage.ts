// iOS/Android: el token vive en el llavero (Keychain / Keystore) mediante expo-secure-store.
import * as SecureStore from 'expo-secure-store'

const KEY = 'vetgest.access_token'

export const tokenStorage = {
  get: () => SecureStore.getItemAsync(KEY),
  set: (token: string) => SecureStore.setItemAsync(KEY, token),
  clear: () => SecureStore.deleteItemAsync(KEY),
}
