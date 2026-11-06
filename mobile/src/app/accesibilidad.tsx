import { View } from 'react-native'
import { Button, Card, Choice, Header, PetAvatar, Pill, Screen, T, Toggle } from '@/components/ui'
import { defaultPrefs, TEXT_SCALES, usePrefs, type Prefs, type TextScale, type ThemeChoice } from '@/lib/prefs'
import { space, useTheme } from '@/theme'

const themes: { value: ThemeChoice; label: string; hint: string }[] = [
  { value: 'system', label: 'Automático', hint: 'Como el teléfono' },
  { value: 'light', label: 'Claro', hint: 'Fondo crema' },
  { value: 'dark', label: 'Oscuro', hint: 'Menos brillo' },
]
const sizeNames: Record<TextScale, string> = { 1: 'Normal', 1.2: 'Grande', 1.4: 'Muy grande', 1.6: 'Máximo' }
const toggles: { key: 'contrast' | 'bold' | 'spacing' | 'motion'; label: string; hint: string }[] = [
  { key: 'contrast', label: 'Alto contraste', hint: 'Texto más oscuro, bordes marcados y colores más fuertes.' },
  { key: 'bold', label: 'Texto en negrita', hint: 'Letras más gruesas, más fáciles de distinguir.' },
  { key: 'spacing', label: 'Espaciado de lectura', hint: 'Más espacio entre líneas y letras.' },
  { key: 'motion', label: 'Reducir animaciones', hint: 'Cambia de pantalla sin deslizamientos.' },
]

/** Preferencias de lectura (como el menú «Accesibilidad» de la web). Se aplican al instante y se guardan en el teléfono. */
export default function AccessibilitySettings() {
  const theme = useTheme()
  const { prefs, setPrefs, system } = usePrefs()
  const update = (patch: Partial<Prefs>) => setPrefs({ ...prefs, ...patch })
  const changed = JSON.stringify(prefs) !== JSON.stringify(defaultPrefs)
  return <Screen>
    <Header title="Accesibilidad" description="Ajusta la app a tu medida. Los cambios se aplican al instante y se guardan en este teléfono." />

    <Card style={{ gap: space.md }} >
      <T variant="eyebrow">Vista previa</T>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <PetAvatar species="Perro" size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="subheading">Vacunación · Luna</T>
          <T variant="muted">vie 13 nov · 10:30</T>
        </View>
      </View>
      <Pill label="Confirmada" tone="success" icon="confirmed" />
    </Card>

    <Choice label="Tema" options={themes} value={prefs.theme} onChange={theme => update({ theme })} />
    <Choice label="Tamaño del texto" layout="list" value={prefs.text} onChange={text => update({ text })}
      options={TEXT_SCALES.map(v => ({ value: v, label: sizeNames[v], hint: `${Math.round(v * 100)} %` }))} />

    <Card style={{ gap: 0, paddingHorizontal: space.sm }}>
      {toggles.map(t => <Toggle key={t.key} label={t.label} hint={t.hint} value={prefs[t.key]} onChange={value => update({ [t.key]: value })} />)}
    </Card>

    {(system.bold || system.reduceMotion) && <T variant="small">
      Tu teléfono ya tiene activado {[system.bold && '«texto en negrita»', system.reduceMotion && '«reducir movimiento»'].filter(Boolean).join(' y ')}; la app lo respeta siempre.
    </T>}
    <T variant="small">El tamaño elegido se suma al tamaño de letra del teléfono (Ajustes → Pantalla). Si el texto queda demasiado grande, baja uno de los dos.</T>
    <Button label="Restablecer" icon="refresh" variant="secondary" disabled={!changed} onPress={() => setPrefs(defaultPrefs)}
      accessibilityHint="Vuelve a los ajustes originales" style={{ borderColor: theme.inputBorder }} />
  </Screen>
}
