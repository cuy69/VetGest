// Props de accesibilidad que funcionan igual en iOS/Android y en web (react-native-web no
// entiende `accessible` ni `importantForAccessibility` y los pasaría al DOM).
import { Platform } from 'react-native'

const web = Platform.OS === 'web'

/** Agrupa un bloque para que el lector de pantalla lo lea como una sola frase. */
export const group = (label: string) => (web ? { role: 'group' as const, 'aria-label': label } : { accessible: true, accessibilityLabel: label })

/** Oculta un elemento decorativo (y sus hijos) al lector de pantalla. */
export const hidden = web
  ? { 'aria-hidden': true as const }
  : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const }
