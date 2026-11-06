import { useEffect, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, RefreshControl, View } from 'react-native'
import { router } from 'expo-router'
import { Button, EmptyState, ErrorState, Field, Header, InfoLine, Loading, RowLink, T } from '@/components/ui'
import { useClinics } from '@/lib/queries'
import { space, useTheme } from '@/theme'

export default function ClinicList() {
  const theme = useTheme()
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  // Espera a que el usuario deje de escribir para no consultar en cada tecla.
  useEffect(() => { const t = setTimeout(() => setTerm(search.trim()), 350); return () => clearTimeout(t) }, [search])
  const clinics = useClinics(term)
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <FlatList
      contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl, gap: space.md }}
      keyboardShouldPersistTaps="handled"
      data={clinics.isSuccess ? clinics.data : []}
      keyExtractor={c => String(c.id)}
      ListHeaderComponent={<View style={{ gap: space.lg, marginBottom: space.lg }}>
        <Header eyebrow="El siguiente paso en su cuidado" title="Encuentra su veterinaria" description="Compara servicios y precios antes de pedir turno." />
        <Field label="Buscar veterinaria por nombre" value={search} onChangeText={setSearch} placeholder="Buscar veterinaria por nombre…" maxLength={120}
          autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" accessibilityRole="search" />
      </View>}
      renderItem={({ item: c }) => <RowLink onPress={() => router.push({ pathname: '/veterinaria/[id]', params: { id: String(c.id) } })}
        accessibilityLabel={`${c.name}. ${c.address}. ${c.opening_hours}`} accessibilityHint="Ver servicios y precios">
        <T variant="heading">{c.name}</T>
        <T variant="muted">{c.description}</T>
        <InfoLine icon="pin">{c.address}</InfoLine>
        <InfoLine icon="clock">{c.opening_hours}</InfoLine>
      </RowLink>}
      ListEmptyComponent={clinics.isPending ? <Loading label="Buscando veterinarias…" /> : clinics.isError ? <ErrorState error={clinics.error} retry={() => void clinics.refetch()} />
        : <EmptyState icon="search" title="No encontramos coincidencias" action={<Button label="Limpiar búsqueda" variant="secondary" onPress={() => setSearch('')} />}>Prueba con otro nombre de veterinaria.</EmptyState>}
      ListFooterComponent={<T variant="small" style={{ marginTop: space.lg }}>Las veterinarias, direcciones, teléfonos y precios son datos ficticios para explorar VetGest. No representan establecimientos reales.</T>}
      refreshControl={<RefreshControl refreshing={clinics.isRefetching} onRefresh={() => void clinics.refetch()} tintColor={theme.primary} colors={[theme.primary]} />}
    />
  </KeyboardAvoidingView>
}
