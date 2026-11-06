// Pedir turno en 4 pasos (design-system/vetgest/pages/app-propietario.md).
import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { DayStrip, SlotPicker } from '@/components/SlotPicker'
import { Button, Card, Choice, EmptyState, ErrorState, Field, FieldError, InfoLine, Loading, Screen, StageBadgeFor, T } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { lastClinicId, suggestServiceId } from '@/lib/appointments'
import { money, when } from '@/lib/format'
import { useAppointments, useAvailability, useClinic, useClinics, usePets, useServices } from '@/lib/queries'
import { appointmentSchema, validate, type AppointmentValues, type FieldErrors } from '@/lib/schemas'
import { firstFree, limaParts, nextDays } from '@/lib/slots'
import type { Appointment, Availability } from '@/lib/types'
import { space, tabular, useTheme } from '@/theme'
import { group } from '@/lib/a11y'

type Step = 1 | 2 | 3 | 4
const toId = (value: string | undefined) => { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : 0 }
const STEP_TITLES: Record<Step, string> = { 1: '¿Para quién es el turno?', 2: 'Veterinaria y servicio', 3: 'Día y hora', 4: 'Revisa y confirma' }

function Progress({ step }: { step: Step }) {
  const theme = useTheme()
  return <View style={{ gap: space.sm }} {...group(`Paso ${step} de 4: ${STEP_TITLES[step]}`)}>
    <T variant="eyebrow">Paso {step} de 4</T>
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4].map(i => <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? theme.primary : theme.border }} />)}
    </View>
    <T variant="title">{STEP_TITLES[step]}</T>
  </View>
}

export default function NewAppointment() {
  const params = useLocalSearchParams<{ pet?: string; clinic?: string; service?: string; sugerido?: string }>()
  const client = useQueryClient()
  const theme = useTheme()
  const pets = usePets()
  const clinics = useClinics()
  const appointments = useAppointments()

  const [step, setStep] = useState<Step | null>(null)
  const [petPick, setPetPick] = useState(toId(params.pet))
  const [clinicPick, setClinicPick] = useState<number | null>(toId(params.clinic) || null)
  const [servicePick, setServicePick] = useState(toId(params.service))
  const [datePick, setDatePick] = useState('')
  const [slot, setSlot] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<FieldErrors<AppointmentValues>>({})
  const [conflict, setConflict] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchMsg, setSearchMsg] = useState<string | null>(null)
  const [created, setCreated] = useState<Appointment | null>(null)

  // Valores efectivos: lo elegido o, si no, lo preseleccionado (única mascota, última veterinaria, servicio sugerido).
  const petId = petPick || (pets.data?.length === 1 ? pets.data[0].id : 0)
  const remembered = lastClinicId(appointments.data)
  const clinicId = clinicPick ?? (clinics.data?.some(c => c.id === remembered) ? remembered : 0)
  const services = useServices(clinicId || undefined)
  const serviceId = servicePick || (services.data ? suggestServiceId(services.data, params.sugerido) : 0)
  const service = services.data?.find(s => s.id === serviceId)
  const clinic = useClinic(clinicId || undefined)
  const days = useMemo(() => nextDays(clinic.data, 14), [clinic.data])
  const date = datePick || days.find(d => d.open)?.date || ''
  const availability = useAvailability(clinicId, service ? serviceId : 0, date)
  const pet = pets.data?.find(p => p.id === petId)
  const currentStep: Step = step ?? (petId ? 2 : 1)

  const mutation = useMutation({
    mutationFn: (values: AppointmentValues) => {
      const { date: d, time, ...rest } = values
      return api<Appointment>('/appointments', { method: 'POST', body: { ...rest, starts_at: `${d}T${time}:00-05:00` } })
    },
    onSuccess: async data => {
      setCreated(data)
      await client.invalidateQueries({ queryKey: ['appointments'] })
    },
    onError: error => {
      // 409: el turno se ocupó. Volver al paso 3 con los turnos recargados, sin perder lo demás.
      if (error instanceof ApiError && error.status === 409) {
        setSlot(null)
        setConflict('Ese horario se acaba de ocupar. Elige otro turno.')
        setStep(3)
        void client.invalidateQueries({ queryKey: ['availability', clinicId, serviceId, date] })
      }
    },
  })

  async function findFirstFree() {
    if (!service) return
    setSearching(true); setSearchMsg(null); setConflict(null)
    try {
      for (const d of days.filter(x => x.open && x.date >= date)) {
        const data = await client.fetchQuery({
          queryKey: ['availability', clinicId, serviceId, d.date],
          queryFn: () => api<Availability>(`/clinics/${clinicId}/availability?service_id=${serviceId}&date=${d.date}`),
        })
        const free = firstFree(data.slots)
        if (free) { setDatePick(d.date); setSlot(free.starts_at); return }
      }
      setSearchMsg('No encontramos turnos libres en los próximos 14 días. Prueba con otra veterinaria.')
    } catch (e) {
      setSearchMsg(e instanceof Error ? e.message : null)
    } finally { setSearching(false) }
  }

  function canContinue(s: Step) {
    if (s === 1) return !!petId
    if (s === 2) return !!clinicId && !!service
    if (s === 3) return !!slot
    return true
  }

  function submit() {
    const time = slot ? limaParts(slot).time : ''
    const result = validate(appointmentSchema, { pet_id: petId, clinic_id: clinicId, service_id: serviceId, date, time, reason })
    if (!result.ok) {
      setErrors(result.errors)
      const e = result.errors
      setStep(e.pet_id ? 1 : e.clinic_id || e.service_id ? 2 : e.date || e.time ? 3 : 4)
      return
    }
    setErrors({}); setConflict(null)
    mutation.mutate(result.data)
  }

  if (pets.isPending || clinics.isPending) return <Screen><Loading /></Screen>
  if (pets.isError || clinics.isError) return <Screen><ErrorState error={pets.error ?? clinics.error} retry={() => { void pets.refetch(); void clinics.refetch() }} /></Screen>
  if (!pets.data.length) return <Screen><EmptyState title="Agrega a tu mascota para pedir su primer turno" action={<Button label="Agregar mascota" icon="add" onPress={() => router.replace('/mascotas/nueva')} />}>Necesitamos conocer a tu compañero para asociar el turno a tu cuenta.</EmptyState></Screen>
  if (!clinics.data.length) return <Screen><EmptyState icon="clinic" title="No hay veterinarias disponibles">Vuelve a consultar el catálogo más adelante.</EmptyState></Screen>

  // Éxito: el turno queda «Por confirmar».
  if (created) return <Screen footer={<>
    <Button label="Ver mi turno" onPress={() => router.replace({ pathname: '/citas/[id]', params: { id: String(created.id) } })} />
    <Button label="Ir al inicio" variant="secondary" onPress={() => router.dismissTo('/')} />
  </>}>
    <Stack.Screen options={{ title: 'Turno solicitado', headerBackVisible: false, gestureEnabled: false }} />
    <Card style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
      <StageBadgeFor stage="Por confirmar" />
      <T variant="title" style={{ textAlign: 'center' }}>¡Listo, {created.pet.name} tiene turno pedido!</T>
      <T style={{ textAlign: 'center' }}>La veterinaria confirmará tu turno. Revisa su estado aquí.</T>
      <T variant="subheading" style={[{ textAlign: 'center' }, tabular]}>{when(created.starts_at)}</T>
      <T variant="muted" style={{ textAlign: 'center' }}>{created.service.name} · {created.clinic.name}</T>
    </Card>
  </Screen>

  const s = currentStep
  const footer = <View style={{ flexDirection: 'row', gap: space.sm }}>
    {s > 1 && <Button label="Atrás" icon="back" variant="secondary" style={{ flex: 1 }} disabled={mutation.isPending} onPress={() => setStep((s - 1) as Step)} />}
    {s < 4
      ? <Button label="Continuar" style={{ flex: 2 }} disabled={!canContinue(s)} onPress={() => { setConflict(null); setStep((s + 1) as Step) }} />
      : <Button label="Solicitar turno" icon="check" style={{ flex: 2 }} onPress={submit} loading={mutation.isPending} loadingLabel="Enviando…" />}
  </View>

  return <Screen footer={footer}>
    <Progress step={s} />

    {s === 1 && <Choice label="Mascota" layout="list" value={petId} error={errors.pet_id} onChange={id => { setPetPick(id); setErrors({}) }}
      options={pets.data.map(p => ({ value: p.id, label: p.name, hint: `${p.species} · ${p.breed}`, icon: p.species === 'Perro' ? 'dog' : p.species === 'Gato' ? 'cat' : p.species === 'Ave' ? 'bird' : p.species === 'Conejo' ? 'rabbit' : 'pets' }))} />}

    {s === 2 && <>
      <Choice label="Veterinaria" layout="list" value={clinicId} error={errors.clinic_id}
        onChange={id => { setClinicPick(id); setServicePick(0); setDatePick(''); setSlot(null) }}
        options={clinics.data.map(c => ({ value: c.id, label: c.name, hint: c.id === remembered ? `${c.address} · La última que usaste` : c.address, icon: 'clinic' as const }))} />
      {!clinicId ? <T variant="muted">Elige una veterinaria para ver sus servicios y precios.</T>
        : services.isPending ? <Loading label="Cargando servicios…" />
        : services.isError ? <ErrorState error={services.error} retry={() => void services.refetch()} />
        : !services.data.length ? <T variant="muted">Esta veterinaria todavía no tiene servicios disponibles.</T>
        : <Choice label="Servicio" layout="list" value={serviceId} error={errors.service_id}
            onChange={id => { setServicePick(id); setSlot(null) }}
            options={services.data.map(x => ({ value: x.id, label: x.name, hint: `${x.duration_minutes} min · ${money(x.price)}` }))} />}
      {service && <InfoLine icon="stethoscope">{service.description}</InfoLine>}
    </>}

    {s === 3 && service && <>
      {conflict && <FieldError>{conflict}</FieldError>}
      <T variant="muted">{service.name} · {clinic.data?.name}{clinic.data?.opening_hours ? `\n${clinic.data.opening_hours}` : ''}</T>
      <Button label="Primer turno libre" icon="zap" variant="accent" onPress={() => void findFirstFree()} loading={searching} loadingLabel="Buscando el primer turno libre…"
        accessibilityHint="Elige automáticamente el turno libre más cercano" />
      {searchMsg && <T variant="muted">{searchMsg}</T>}
      <DayStrip days={days} value={date} onChange={d => { setDatePick(d); setSlot(null); setConflict(null) }} />
      {errors.date && <FieldError>{errors.date}</FieldError>}
      {availability.isPending ? <Loading label="Buscando turnos…" />
        : availability.isError ? <ErrorState error={availability.error} retry={() => void availability.refetch()} />
        : <SlotPicker slots={availability.data.slots} value={slot} onChange={x => { setSlot(x); setConflict(null) }} />}
      {errors.time && <FieldError>{errors.time}</FieldError>}
      <Button label="Actualizar turnos" icon="refresh" variant="ghost" compact onPress={() => void availability.refetch()} disabled={availability.isFetching} />
    </>}

    {s === 4 && <>
      <Card style={{ gap: space.sm }}>
        <InfoLine icon="pets">{pet?.name} · {pet?.species}</InfoLine>
        <InfoLine icon="stethoscope">{service?.name} · {service?.duration_minutes} min</InfoLine>
        <InfoLine icon="clinic">{clinic.data?.name}</InfoLine>
        <InfoLine icon="calendar">{slot ? when(slot) : '—'} · hora de Lima</InfoLine>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.border, paddingTop: space.sm }}>
          <T variant="muted">Precio referencial</T><T style={[{ fontWeight: '700' }, tabular]}>{service ? money(service.price) : ''}</T>
        </View>
      </Card>
      <Field label="Motivo (opcional)" value={reason} onChangeText={setReason} error={errors.reason}
        hint="¿Qué le pasa? Ayuda a preparar la consulta." placeholder="Ej. Le toca su vacuna anual" multiline maxLength={2000} />
      {mutation.isError && !(mutation.error instanceof ApiError && mutation.error.status === 409) && <ErrorState error={mutation.error} />}
      <T variant="small">El turno quedará «Por confirmar» hasta que la veterinaria lo confirme. El pago se hace en la veterinaria.</T>
    </>}
  </Screen>
}
