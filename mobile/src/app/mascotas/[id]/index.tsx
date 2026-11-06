import { useState } from 'react'
import { View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Icon } from '@/components/Icon'
import { Button, Card, ConfirmSheet, EmptyState, ErrorState, Loading, Notice, PetAvatar, Pill, Screen, Segmented, T } from '@/components/ui'
import { api } from '@/lib/api'
import { age, dateTime, doseStatus, fullName, longDate } from '@/lib/format'
import { usePet, usePetHistory } from '@/lib/queries'
import { space, tabular, useTheme } from '@/theme'
import { group } from '@/lib/a11y'

type Tab = 'historia' | 'cuidados'
const doseTone = { 'Al día': 'success', 'Por vencer': 'warning', Vencida: 'danger' } as const
const doseIcon = { 'Al día': 'attended', 'Por vencer': 'clock', Vencida: 'alert' } as const

export default function PetDetail() {
  const { id, guardada } = useLocalSearchParams<{ id: string; guardada?: string }>()
  const theme = useTheme()
  const pet = usePet(id)
  const history = usePetHistory(id)
  const client = useQueryClient()
  const [tab, setTab] = useState<Tab>('historia')
  const [confirm, setConfirm] = useState(false)
  const remove = useMutation({
    mutationFn: () => api(`/pets/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setConfirm(false)
      await client.invalidateQueries({ queryKey: ['pets'] })
      router.dismissTo({ pathname: '/mascotas', params: { eliminada: '1' } })
    },
  })

  if (pet.isPending) return <Screen><Loading /></Screen>
  if (pet.isError) return <Screen><ErrorState error={pet.error} retry={() => void pet.refetch()} /></Screen>
  const p = pet.data

  return <Screen onRefresh={() => { void pet.refetch(); void history.refetch() }} refreshing={pet.isRefetching || history.isRefetching}>
    <Stack.Screen options={{ title: p.name }} />
    {guardada === '1' && <Notice>Los datos de {p.name} se guardaron correctamente.</Notice>}

    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <PetAvatar species={p.species} size={72} />
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="title">{p.name}</T>
          <T variant="muted">{p.species} · {p.breed} · {p.sex}</T>
          <T style={[{ fontWeight: '600' }, tabular]}>{age(p.birth_date)} · {p.weight} kg</T>
        </View>
      </View>
      {!!p.notes && <View style={{ borderLeftWidth: 4, borderLeftColor: theme.danger, backgroundColor: theme.dangerSoft, borderRadius: 10, padding: space.md, gap: 4 }}
        {...group(`Notas importantes: ${p.notes}`)}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><Icon name="alert" size={16} color={theme.danger} /><T variant="small" color={theme.danger} style={{ fontWeight: '700' }}>Notas importantes</T></View>
        <T color={theme.text}>{p.notes}</T>
      </View>}
      <Button label="Pedir turno" icon="calendar" onPress={() => router.push({ pathname: '/citas/nueva', params: { pet: String(p.id) } })} />
      <Button label="Editar datos" icon="edit" variant="secondary" onPress={() => router.push({ pathname: '/mascotas/[id]/editar', params: { id: String(p.id) } })} />
    </Card>

    <Segmented label="Secciones de la mascota" value={tab} onChange={setTab}
      options={[{ value: 'historia', label: 'Historia' }, { value: 'cuidados', label: 'Vacunas y cuidados' }]} />

    {history.isPending ? <Loading label="Cargando historia clínica…" /> : history.isError ? <ErrorState error={history.error} retry={() => void history.refetch()} />
      : tab === 'historia' ? (history.data.records.length ? history.data.records.map(r => <Card key={r.id}>
        <T variant="small" style={tabular}>{dateTime(r.attended_at)} · {r.clinic.name}</T>
        <T variant="small">Dr(a). {fullName(r.vet.profile)}</T>
        <T variant="subheading">{r.reason}</T>
        <T><T style={{ fontWeight: '700' }}>Diagnóstico: </T>{r.diagnosis}</T>
        {!!r.indications && <T><T style={{ fontWeight: '700' }}>Indicaciones: </T>{r.indications}</T>}
        {(!!r.weight || !!r.next_visit_on) && <T variant="small">{[r.weight ? `Peso: ${r.weight} kg` : '', r.next_visit_on ? `Próximo control: ${longDate(r.next_visit_on)}` : ''].filter(Boolean).join(' · ')}</T>}
      </Card>) : <EmptyState icon="stethoscope" title="Sin atenciones registradas">Cuando una veterinaria atienda a {p.name}, verás aquí el diagnóstico y las indicaciones.</EmptyState>)
      : (history.data.care.length ? history.data.care.map(c => {
        const status = c.next_due_on ? doseStatus(c.next_due_on) : null
        return <Card key={c.id}>
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
            <View style={{ paddingTop: 2 }}><Icon name={c.kind === 'Tratamiento' ? 'stethoscope' : 'vaccine'} size={20} color={theme.primary} /></View>
            <View style={{ flex: 1 }}>
              <T variant="subheading">{c.name}{c.dose ? ` · ${c.dose}` : ''}</T>
              <T variant="small">{c.kind} · aplicada el {longDate(c.applied_on)} · {c.clinic.name}</T>
            </View>
          </View>
          {!!c.notes && <T variant="small">{c.notes}</T>}
          {c.next_due_on && status && <Pill label={`${status} · próxima ${longDate(c.next_due_on)}`} tone={doseTone[status]} icon={doseIcon[status]} />}
        </Card>
      }) : <EmptyState icon="vaccine" title="Sin vacunas ni cuidados">Aquí aparecerá el carnet de {p.name}.</EmptyState>)}

    <Button label="Eliminar mascota" icon="trash" variant="ghost" onPress={() => { remove.reset(); setConfirm(true) }} accessibilityHint="Abre una confirmación antes de eliminar" />
    <ConfirmSheet open={confirm} title={`¿Eliminar a ${p.name} de tu lista?`} confirmLabel="Eliminar mascota" cancelLabel="Mantener" pending={remove.isPending} error={remove.error}
      onCancel={() => setConfirm(false)} onConfirm={() => remove.mutate()}>
      Dejará de aparecer en tus mascotas. Su historia clínica se conserva. Si tiene turnos por confirmar o confirmados, primero deberás cancelarlos.
    </ConfirmSheet>
  </Screen>
}
