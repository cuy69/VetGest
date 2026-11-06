import { useState } from 'react'
import { router } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { petSchema, todayLima, validate, type FieldErrors } from '@/lib/schemas'
import type { Pet } from '@/lib/types'
import { space } from '@/theme'
import { Button, Card, Choice, ErrorState, Field, Header } from './ui'

interface Draft { name: string; species: string; breed: string; sex: string; birth_date: string; weight: string; color: string; notes: string }
const SPECIES = ['Perro', 'Gato', 'Ave', 'Conejo', 'Otro'] as const

/** AAAA-MM-DD mientras se escribe (solo dígitos). */
export function maskDate(text: string) {
  const d = text.replace(/\D/g, '').slice(0, 8)
  return [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)].filter(Boolean).join('-')
}

export function PetForm({ pet }: { pet?: Pet }) {
  const client = useQueryClient()
  const [draft, setDraft] = useState<Draft>(pet
    ? { name: pet.name, species: pet.species, breed: pet.breed, sex: pet.sex, birth_date: pet.birth_date, weight: String(pet.weight), color: pet.color, notes: pet.notes }
    : { name: '', species: '', breed: '', sex: '', birth_date: '', weight: '', color: '', notes: '' })
  const [errors, setErrors] = useState<FieldErrors<Draft>>({})
  const set = (key: keyof Draft) => (value: string) => setDraft(d => ({ ...d, [key]: value }))
  const mutation = useMutation({
    mutationFn: (values: unknown) => api<Pet>(pet ? `/pets/${pet.id}` : '/pets', { method: pet ? 'PUT' : 'POST', body: values }),
    onSuccess: async data => {
      await client.invalidateQueries({ queryKey: ['pets'] })
      await client.invalidateQueries({ queryKey: ['appointments'] })
      if (pet) router.back()
      else router.replace({ pathname: '/mascotas/[id]', params: { id: String(data.id), guardada: '1' } })
    },
  })

  function submit() {
    // Igual que la web: el peso acepta coma o punto; vacío → error «Ingresa un peso válido.»
    const result = validate(petSchema, { ...draft, weight: draft.weight.trim() === '' ? undefined : draft.weight.replace(',', '.') })
    if (!result.ok) { setErrors(result.errors as FieldErrors<Draft>); return }
    setErrors({})
    mutation.mutate(result.data)
  }

  return <>
    <Header title={pet ? 'Editar mascota' : 'Un nuevo compañero'} description={pet ? 'Su información, siempre cerca de ti.' : 'Completa sus datos. Podrás actualizarlos cuando quieras.'} />
    <Card style={{ gap: space.lg }}>
      <Field label="Nombre" value={draft.name} onChangeText={set('name')} error={errors.name} placeholder="¿Cómo se llama tu mascota?" maxLength={80} />
      <Choice label="Especie" value={draft.species} onChange={set('species')} error={errors.species} options={SPECIES.map(s => ({ value: s, label: s }))} />
      <Field label="Raza" value={draft.breed} onChangeText={set('breed')} error={errors.breed} placeholder="Ej. Mestizo" hint="Si no la conoces, puedes indicar Mestizo o Desconocida." maxLength={80} />
      <Choice label="Sexo" value={draft.sex} onChange={set('sex')} error={errors.sex} options={[{ value: 'Macho', label: 'Macho' }, { value: 'Hembra', label: 'Hembra' }]} />
      <Field label="Fecha de nacimiento aproximada" value={draft.birth_date} onChangeText={t => set('birth_date')(maskDate(t))} error={errors.birth_date}
        placeholder={`AAAA-MM-DD (ej. ${todayLima().slice(0, 4)}-03-12)`} keyboardType="number-pad" maxLength={10} hint="Formato año-mes-día." />
      <Field label="Peso (kg)" value={draft.weight} onChangeText={set('weight')} error={errors.weight} placeholder="Ej. 8.5" keyboardType="decimal-pad" maxLength={7} />
      <Field label="Color" value={draft.color} onChangeText={set('color')} error={errors.color} placeholder="Ej. Blanco y café" maxLength={80} />
      <Field label="Observaciones (opcional)" value={draft.notes} onChangeText={set('notes')} error={errors.notes} placeholder="Algo que debamos saber sobre tu mascota…" multiline maxLength={2000} />
      {mutation.isError && <ErrorState error={mutation.error} />}
      <Button label={pet ? 'Guardar cambios' : 'Agregar mascota'} icon="check" onPress={submit} loading={mutation.isPending} loadingLabel="Guardando…" />
      <Button label="Volver" variant="secondary" onPress={() => router.back()} disabled={mutation.isPending} />
    </Card>
  </>
}
