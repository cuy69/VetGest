import { useLocalSearchParams } from 'expo-router'
import { PetForm } from '@/components/PetForm'
import { ErrorState, Loading, Screen } from '@/components/ui'
import { usePet } from '@/lib/queries'

export default function EditPet() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const pet = usePet(id)
  return <Screen>
    {pet.isPending ? <Loading /> : pet.isError ? <ErrorState error={pet.error} retry={() => void pet.refetch()} /> : <PetForm key={pet.data.id} pet={pet.data} />}
  </Screen>
}
