import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { groupSlots, isSelectable, limaParts, type DayOption } from '@/lib/slots'
import type { Slot } from '@/lib/types'
import { controlRadius, radius, space, tabular, touch, useTheme, useType } from '@/theme'
import { T } from './ui'

/** Tira horizontal de días; los cerrados se muestran deshabilitados. */
export function DayStrip({ days, value, onChange }: { days: DayOption[]; value: string; onChange: (date: string) => void }) {
  const theme = useTheme()
  const type = useType()
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: 2 }}
    accessibilityRole="radiogroup" accessibilityLabel="Día de la cita">
    {days.map(d => {
      const selected = d.date === value
      return <Pressable key={d.date} testID={`day-${d.date}`} onPress={() => onChange(d.date)} disabled={!d.open} android_ripple={{ color: theme.soft }}
        accessibilityRole="radio" accessibilityLabel={d.label} accessibilityState={{ checked: selected, disabled: !d.open }} aria-checked={selected} aria-disabled={!d.open}
        style={({ pressed }) => [styles.day, {
          backgroundColor: selected ? theme.primary : theme.card, borderColor: selected ? theme.primary : theme.inputBorder,
          opacity: !d.open ? 0.4 : pressed ? 0.85 : 1,
        }]}>
        <Text style={[type(12, 700, 16), { color: selected ? theme.onPrimary : theme.textSecondary }]}>{d.weekday}</Text>
        <Text style={[type(22, 800, 28), tabular, { color: selected ? theme.onPrimary : theme.text }]}>{d.day}</Text>
        <Text style={[type(12, 700, 16), { color: selected ? theme.onPrimary : theme.textSecondary }]}>{d.open ? d.month : 'Cerrado'}</Text>
      </Pressable>
    })}
  </ScrollView>
}

/** Turnos del día. Los no disponibles (ocupados o pasados) no se pueden tocar. */
export function SlotPicker({ slots, value, onChange, now }: { slots: Slot[]; value: string | null; onChange: (startsAt: string) => void; now?: Date }) {
  const theme = useTheme()
  const type = useType()
  const groups = groupSlots(slots)
  if (!groups.length) return <T variant="muted">La veterinaria no atiende este día. Elige otra fecha.</T>
  const anyFree = slots.some(s => isSelectable(s, now))
  return <View style={{ gap: space.md }}>
    {!anyFree && <T variant="muted">No quedan turnos libres este día. Prueba con otra fecha.</T>}
    {groups.map(group => <View key={group.title} style={{ gap: space.sm }}>
      <T variant="eyebrow">{group.title}</T>
      <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={`Turnos de la ${group.title.toLowerCase()}`}>
        {group.slots.map(slot => {
          const time = limaParts(slot.starts_at).time
          const free = isSelectable(slot, now)
          const selected = slot.starts_at === value
          return <Pressable key={slot.starts_at} testID={`slot-${time}`} onPress={() => onChange(slot.starts_at)} disabled={!free} android_ripple={{ color: theme.soft }}
            accessibilityRole="radio" accessibilityLabel={free ? `${time}, disponible` : `${time}, no disponible`}
            accessibilityState={{ checked: selected, disabled: !free }} aria-checked={selected} aria-disabled={!free}
            style={({ pressed }) => [styles.slot, {
              backgroundColor: selected ? theme.primary : free ? theme.card : theme.soft,
              borderColor: selected ? theme.primary : free ? theme.inputBorder : theme.border, opacity: free ? (pressed ? 0.85 : 1) : 0.5,
            }]}>
            <Text style={[type(16, 700, 22), tabular, { color: selected ? theme.onPrimary : free ? theme.text : theme.textSecondary, textDecorationLine: free ? 'none' : 'line-through' }]}>{time}</Text>
          </Pressable>
        })}
      </View>
    </View>)}
  </View>
}

const styles = StyleSheet.create({
  day: { minWidth: 72, minHeight: 84, paddingHorizontal: space.sm, paddingVertical: space.sm, borderRadius: radius, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  slot: { minWidth: 84, minHeight: touch, borderRadius: controlRadius, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
})
