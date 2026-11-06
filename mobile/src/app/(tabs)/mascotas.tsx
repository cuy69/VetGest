import { FlatList, RefreshControl, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Button, EmptyState, ErrorState, Header, Loading, Notice, PetAvatar, RowLink, T } from '@/components/ui'
import { age } from '@/lib/format'
import { usePets } from '@/lib/queries'
import { space, useTheme } from '@/theme'

export default function PetList() {
  const theme = useTheme()
  const pets = usePets()
  const params = useLocalSearchParams<{ eliminada?: string }>()
  return <FlatList
    style={{ flex: 1, backgroundColor: theme.background }}
    contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl, gap: space.md }}
    data={pets.isSuccess ? pets.data : []}
    keyExtractor={p => String(p.id)}
    ListHeaderComponent={<View style={{ gap: space.lg, marginBottom: space.lg }}>
      <Header eyebrow="Tu pequeña familia" title="Mis mascotas" description="Cada una es única. Su cuidado también." />
      <Button label="Agregar mascota" icon="add" variant="secondary" onPress={() => router.push('/mascotas/nueva')} />
      {params.eliminada === '1' && <Notice>La mascota se eliminó de tu lista.</Notice>}
    </View>}
    renderItem={({ item: p }) => <RowLink onPress={() => router.push({ pathname: '/mascotas/[id]', params: { id: String(p.id) } })}
      accessibilityLabel={`${p.name}, ${p.species}, ${age(p.birth_date)}, ${p.weight} kilos`} accessibilityHint="Ver su historia clínica y vacunas">
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <PetAvatar species={p.species} />
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="heading">{p.name}</T>
          <T variant="muted">{p.species} · {p.breed}</T>
          <T variant="small">{age(p.birth_date)} · {p.weight} kg</T>
        </View>
      </View>
    </RowLink>}
    ListEmptyComponent={pets.isPending ? <Loading /> : pets.isError ? <ErrorState error={pets.error} retry={() => void pets.refetch()} />
      : <EmptyState title="Agrega a tu mascota para pedir su primer turno" action={<Button label="Agregar mascota" icon="add" onPress={() => router.push('/mascotas/nueva')} />}>
          Cuéntanos sobre tu compañero para organizar sus cuidados.</EmptyState>}
    refreshControl={<RefreshControl refreshing={pets.isRefetching} onRefresh={() => void pets.refetch()} tintColor={theme.primary} colors={[theme.primary]} />}
  />
}
