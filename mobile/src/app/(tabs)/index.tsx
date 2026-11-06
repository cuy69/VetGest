import { FlatList, Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { Icon } from '@/components/Icon'
import { Button, Card, EmptyState, ErrorState, Hero, InfoLine, Loading, PetAvatar, Pill, Screen, SectionTitle, StageTimeline, T } from '@/components/ui'
import { isLive, nextAppointment, ownerText } from '@/lib/appointments'
import { useAuth } from '@/lib/auth'
import { longDate, updatedAgo, when } from '@/lib/format'
import { useAppointments, useClinics, useNow, usePets, useRefetchOnFocus, useReminders } from '@/lib/queries'
import type { Reminder } from '@/lib/types'
import { radius, space, tabular, touch, useTheme } from '@/theme'

export default function Home() {
  const { user } = useAuth()
  const theme = useTheme()
  const now = useNow()
  const appointments = useAppointments(true)
  const reminders = useReminders()
  const pets = usePets()
  const clinics = useClinics()
  useRefetchOnFocus(appointments.refetch)
  const next = appointments.data ? nextAppointment(appointments.data) : undefined
  // Vencidos primero; luego por fecha.
  const care = (reminders.data ?? []).filter(r => r.kind !== 'Cita')
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.due.localeCompare(b.due))
  const refreshing = appointments.isRefetching || reminders.isRefetching
  const refresh = () => { void appointments.refetch(); void reminders.refetch(); void pets.refetch() }

  function schedule(r: Reminder) {
    const clinic = clinics.data?.find(c => c.name === r.clinic_name)
    router.push({ pathname: '/citas/nueva', params: { pet: String(r.pet_id), ...(clinic ? { clinic: String(clinic.id) } : {}), sugerido: r.kind } })
  }

  return <Screen onRefresh={refresh} refreshing={refreshing}>
    <Hero eyebrow="Cada día, un poco más de cuidado" title={`Hola, ${user?.profile.first_name ?? ''}`} description="Qué pasa con tus mascotas, de un vistazo.">
      <Button label="Pedir turno" icon="add" variant="accent" onPress={() => router.push('/citas/nueva')} style={{ marginTop: space.sm }} />
    </Hero>

    {/* 1. Próxima cita */}
    <SectionTitle title="Próxima cita" action={<Button label="Mis citas" variant="ghost" compact onPress={() => router.navigate('/citas')} />} />
    {appointments.isPending ? <Loading /> : appointments.isError ? <ErrorState error={appointments.error} retry={() => void appointments.refetch()} /> : next ? (
      <Card highlight={isLive(next)} style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <PetAvatar species={next.pet.species} size={52} />
          <View style={{ flex: 1 }}>
            <T variant="eyebrow">Para {next.pet.name}</T>
            <T variant="heading">{next.service.name}</T>
          </View>
        </View>
        <T variant="subheading" style={tabular}>{when(next.starts_at)}</T>
        <InfoLine icon="pin">{next.clinic.name}</InfoLine>
        <View style={{ backgroundColor: theme.accentSoft, borderRadius: 14, padding: space.md }}>
          <T color={theme.onAccentSoft} style={{ fontWeight: '700' }} accessibilityLiveRegion="polite">{ownerText(next)}</T>
        </View>
        <StageTimeline appointment={next} />
        <T variant="small">{updatedAgo(appointments.dataUpdatedAt, now)} · se actualiza cada 30 s</T>
        <Button label="Ver mi turno" variant="secondary" onPress={() => router.push({ pathname: '/citas/[id]', params: { id: String(next.id) } })} />
      </Card>
    ) : <EmptyState icon="calendar" title="No tienes turnos próximos">Pide un turno con el botón de arriba y sigue aquí su estado en vivo.</EmptyState>}

    {/* 2. Recordatorios: la palanca de retorno */}
    <SectionTitle title="Recordatorios" />
    {reminders.isPending ? <Loading label="Cargando recordatorios…" /> : reminders.isError ? <ErrorState error={reminders.error} retry={() => void reminders.refetch()} /> : care.length ? care.map(r =>
      <Card key={`${r.kind}-${r.pet_id}-${r.title}-${r.due}`} style={{ borderColor: r.overdue ? theme.danger : theme.border }}>
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
          <View style={{ paddingTop: 2 }}><Icon name={r.overdue ? 'alert' : r.kind === 'Vacuna' ? 'vaccine' : 'stethoscope'} size={20} color={r.overdue ? theme.danger : theme.primary} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="subheading">{r.title} · {r.pet_name}</T>
            {!!r.clinic_name && <T variant="small">{r.clinic_name}</T>}
          </View>
        </View>
        <Pill label={r.overdue ? `Vencido · ${longDate(r.due)}` : `Vence el ${longDate(r.due)}`} tone={r.overdue ? 'danger' : 'warning'} icon={r.overdue ? 'alert' : 'clock'} />
        <Button label="Agendar" icon="calendar" variant={r.overdue ? 'primary' : 'secondary'} accessibilityHint={`Pide un turno para ${r.pet_name}`} onPress={() => schedule(r)} />
      </Card>) : <EmptyState icon="bell" title="Sin recordatorios por ahora">Cuando una veterinaria registre vacunas o controles, verás aquí las próximas fechas.</EmptyState>}

    {/* 3. Mis mascotas en fila horizontal */}
    <SectionTitle title="Mis mascotas" action={<Button label="Ver todas" variant="ghost" compact onPress={() => router.navigate('/mascotas')} />} />
    {pets.isPending ? <Loading /> : pets.isError ? <ErrorState error={pets.error} retry={() => void pets.refetch()} /> : pets.data.length ? (
      <FlatList horizontal data={pets.data} keyExtractor={p => String(p.id)} showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.sm }}
        renderItem={({ item: p }) => <Pressable onPress={() => router.push({ pathname: '/mascotas/[id]', params: { id: String(p.id) } })}
          accessibilityRole="button" accessibilityLabel={`${p.name}, ${p.species}`} accessibilityHint="Ver su historia clínica"
          android_ripple={{ color: theme.soft }}
          style={({ pressed }) => ({ minWidth: 112, minHeight: touch * 2, padding: space.md, borderRadius: radius, borderWidth: 1, borderColor: theme.border, backgroundColor: pressed ? theme.soft : theme.card, alignItems: 'center', gap: space.xs })}>
          <PetAvatar species={p.species} size={52} />
          <T variant="subheading" style={{ textAlign: 'center' }}>{p.name}</T>
          <T variant="small">{p.species}</T>
        </Pressable>}
        ListFooterComponent={<Pressable onPress={() => router.push('/mascotas/nueva')} accessibilityRole="button" accessibilityLabel="Agregar mascota"
          style={({ pressed }) => ({ minWidth: 112, minHeight: touch * 2, padding: space.md, borderRadius: radius, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.border, alignItems: 'center', justifyContent: 'center', gap: space.xs, opacity: pressed ? 0.7 : 1 })}>
          <Icon name="add" color={theme.primary} /><T variant="small" color={theme.primary} style={{ fontWeight: '700' }}>Agregar</T>
        </Pressable>} />
    ) : <EmptyState title="Agrega a tu mascota para pedir su primer turno" action={<Button label="Agregar mascota" icon="add" onPress={() => router.push('/mascotas/nueva')} />} />}

    <Button label="Explorar veterinarias" icon="clinic" variant="ghost" onPress={() => router.push('/veterinarias')} />
  </Screen>
}
