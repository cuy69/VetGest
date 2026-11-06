import { useState } from 'react'
import { FlatList, RefreshControl, View } from 'react-native'
import { router } from 'expo-router'
import { Button, EmptyState, ErrorState, Header, Loading, PetAvatar, Pill, RowLink, Segmented, StageBadge, T } from '@/components/ui'
import { paymentLabel, splitAppointments, stageOf } from '@/lib/appointments'
import { updatedAgo, when } from '@/lib/format'
import { useAppointments, useNow, useRefetchOnFocus } from '@/lib/queries'
import type { Appointment } from '@/lib/types'
import { space, tabular, useTheme } from '@/theme'

type Segment = 'proximas' | 'anteriores'

function AppointmentRow({ a }: { a: Appointment }) {
  const stage = stageOf(a)
  const attended = stage === 'Atendida'
  return <RowLink onPress={() => router.push({ pathname: '/citas/[id]', params: { id: String(a.id) } })}
    accessibilityLabel={`${stage}. ${when(a.starts_at)}. ${a.pet.name}, ${a.service.name}, ${a.clinic.name}${attended ? `. ${paymentLabel(a)}` : ''}`}
    accessibilityHint="Ver detalle del turno">
    <StageBadge appointment={a} />
    <T variant="subheading" style={tabular}>{when(a.starts_at)}</T>
    <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
      <PetAvatar species={a.pet.species} size={40} />
      <View style={{ flex: 1 }}>
        <T style={{ fontWeight: '600' }}>{a.pet.name} · {a.service.name}</T>
        <T variant="small">{a.clinic.name}</T>
      </View>
    </View>
    {attended && <Pill label={paymentLabel(a)} tone={a.payment ? 'success' : 'neutral'} icon={a.payment ? 'paid' : 'wallet'} />}
  </RowLink>
}

export default function AppointmentList() {
  const theme = useTheme()
  const now = useNow()
  const appointments = useAppointments(true)
  useRefetchOnFocus(appointments.refetch)
  const [segment, setSegment] = useState<Segment>('proximas')
  const { upcoming, past } = splitAppointments(appointments.data ?? [])
  const data = segment === 'proximas' ? upcoming : past

  const header = <View style={{ gap: space.lg, marginBottom: space.lg }}>
    <Header eyebrow="Un cuidado a la vez" title="Mis citas" description="Sigue el estado de tus turnos en vivo." />
    <Button label="Pedir turno" icon="add" onPress={() => router.push('/citas/nueva')} />
    <Segmented label="Mostrar citas" value={segment} onChange={setSegment}
      options={[{ value: 'proximas', label: `Próximas${appointments.data ? ` (${upcoming.length})` : ''}` }, { value: 'anteriores', label: 'Anteriores' }]} />
    {appointments.isSuccess && <T variant="small">{updatedAgo(appointments.dataUpdatedAt, now)} · se actualiza cada 30 s</T>}
  </View>

  return <FlatList
    style={{ flex: 1, backgroundColor: theme.background }}
    contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl, gap: space.md }}
    data={appointments.isSuccess ? data : []}
    keyExtractor={a => String(a.id)}
    renderItem={({ item }) => <AppointmentRow a={item} />}
    ListHeaderComponent={header}
    ListEmptyComponent={appointments.isPending ? <Loading /> : appointments.isError
      ? <ErrorState error={appointments.error} retry={() => void appointments.refetch()} />
      : segment === 'proximas'
        ? <EmptyState icon="calendar" title="No tienes turnos próximos" action={<Button label="Pedir turno" icon="add" onPress={() => router.push('/citas/nueva')} />}>Elige una mascota, una veterinaria y el horario que te acomode.</EmptyState>
        : <EmptyState icon="calendar" title="Aún no tienes citas anteriores">Aquí verás las atenciones pasadas y canceladas.</EmptyState>}
    refreshControl={<RefreshControl refreshing={appointments.isRefetching} onRefresh={() => void appointments.refetch()} tintColor={theme.primary} colors={[theme.primary]} />}
  />
}
