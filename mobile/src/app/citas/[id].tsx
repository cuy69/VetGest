import { useState } from 'react'
import { View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, ConfirmSheet, ErrorState, InfoLine, Loading, Notice, PetAvatar, Pill, Screen, StageBadge, StageTimeline, T } from '@/components/ui'
import { api } from '@/lib/api'
import { canCancel, ownerText, paymentLabel, stageOf } from '@/lib/appointments'
import { fullName, money, relativeDay, timeOnly, updatedAgo, when } from '@/lib/format'
import { useAppointment, useNow, useRefetchOnFocus } from '@/lib/queries'
import type { Appointment } from '@/lib/types'
import { space, tabular, useTheme } from '@/theme'
import { group } from '@/lib/a11y'

/** «de hoy», «de mañana» o «del jue 12 nov». */
const dayPhrase = (iso: string) => { const d = relativeDay(iso); return d === 'Hoy' || d === 'Mañana' || d === 'Ayer' ? `de ${d.toLowerCase()}` : `del ${d}` }

export default function AppointmentDetail() {
  const { id, creada } = useLocalSearchParams<{ id: string; creada?: string }>()
  const theme = useTheme()
  const now = useNow()
  const appointment = useAppointment(id)
  useRefetchOnFocus(appointment.refetch)
  const client = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const cancel = useMutation({
    mutationFn: () => api<Appointment>(`/appointments/${id}/cancel`, { method: 'PATCH' }),
    onSuccess: async data => {
      client.setQueryData(['appointments', id], data)
      setConfirm(false); setCancelled(true)
      await client.invalidateQueries({ queryKey: ['appointments'] })
    },
  })

  if (appointment.isPending) return <Screen><Loading /></Screen>
  if (appointment.isError) return <Screen><ErrorState error={appointment.error} retry={() => void appointment.refetch()} /></Screen>
  const a = appointment.data
  const stage = stageOf(a)
  const rows: [string, string][] = [
    ['Precio referencial', money(a.service.price)],
    ['Duración estimada', `${a.service.duration_minutes} min`],
    ['Veterinario', a.vet ? fullName(a.vet.profile) : 'Por asignar'],
    ['Teléfono de la veterinaria', a.clinic.phone],
  ]
  if (stage === 'Atendida') rows.unshift(['Pago', paymentLabel(a)])

  return <Screen onRefresh={() => void appointment.refetch()} refreshing={appointment.isRefetching}>
    {creada === '1' && !cancelled && <Notice>Turno solicitado. La veterinaria confirmará tu turno. Revisa su estado aquí.</Notice>}
    {cancelled && <Notice>Cancelaste el turno. El horario quedó libre.</Notice>}
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <PetAvatar species={a.pet.species} size={56} />
        <View style={{ flex: 1 }}>
          <T variant="eyebrow">Para {a.pet.name}</T>
          <T variant="heading">{a.service.name}</T>
          <T variant="small">Solicitud #{String(a.id).padStart(4, '0')}</T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <StageBadge appointment={a} />
        {stage === 'Atendida' && <Pill label={paymentLabel(a)} tone={a.payment ? 'success' : 'neutral'} icon={a.payment ? 'paid' : 'wallet'} />}
      </View>
      <View style={{ backgroundColor: theme.soft, borderRadius: 14, padding: space.md }}>
        <T style={{ fontWeight: '700' }} accessibilityLiveRegion="polite">{ownerText(a)}</T>
      </View>
      <StageTimeline appointment={a} />
      <T variant="small">{updatedAgo(appointment.dataUpdatedAt, now)} · se actualiza cada 30 s</T>
    </Card>
    <Card>
      <InfoLine icon="calendar"><T style={[{ fontWeight: '700' }, tabular]}>{when(a.starts_at)}</T> · hora de Lima</InfoLine>
      <InfoLine icon="pin">{a.clinic.name}{'\n'}{a.clinic.address}</InfoLine>
    </Card>
    <Card>
      {rows.map(([label, value]) => <View key={label} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 2 }} {...group(`${label}: ${value}`)}>
        <T variant="small">{label}</T><T style={[{ fontWeight: '600' }, tabular]}>{value}</T>
      </View>)}
      <T variant="subheading" style={{ marginTop: space.sm }}>Motivo o comentario</T>
      <T variant="muted">{a.reason || 'No añadiste un comentario para esta visita.'}</T>
    </Card>
    {a.has_record && <Card>
      <T>Esta atención ya está en la historia clínica de {a.pet.name}.</T>
      <Button label="Ver su historia" variant="secondary" onPress={() => router.push({ pathname: '/mascotas/[id]', params: { id: String(a.pet.id) } })} />
    </Card>}
    {canCancel(a) && !cancelled && <Button label="Cancelar turno" icon="close" variant="secondary" onPress={() => { cancel.reset(); setConfirm(true) }}
      accessibilityHint="Abre una confirmación antes de cancelar" />}
    <ConfirmSheet open={confirm} title={`¿Cancelar el turno de ${a.pet.name} ${dayPhrase(a.starts_at)} a las ${timeOnly(a.starts_at)}?`}
      confirmLabel="Cancelar turno" cancelLabel="Mantener" pending={cancel.isPending} error={cancel.error}
      onCancel={() => setConfirm(false)} onConfirm={() => cancel.mutate()}>
      El horario quedará libre para otra mascota. Si necesitas otra fecha, podrás pedir un turno nuevo.
    </ConfirmSheet>
  </Screen>
}
