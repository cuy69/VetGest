import { View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { Button, Card, EmptyState, ErrorState, Header, InfoLine, Loading, Screen, SectionTitle, T } from '@/components/ui'
import { money } from '@/lib/format'
import { useClinic, useServices } from '@/lib/queries'
import { space, tabular } from '@/theme'

export default function ClinicDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const clinic = useClinic(id)
  const services = useServices(id)
  if (clinic.isPending || services.isPending) return <Screen><Loading /></Screen>
  if (clinic.isError || services.isError) return <Screen><ErrorState error={clinic.error ?? services.error} retry={() => { void clinic.refetch(); void services.refetch() }} /></Screen>
  const c = clinic.data
  return <Screen onRefresh={() => { void clinic.refetch(); void services.refetch() }} refreshing={clinic.isRefetching || services.isRefetching}>
    <Stack.Screen options={{ title: c.name }} />
    <Header title={c.name} description={c.description} />
    <Card>
      <InfoLine icon="pin">{c.address}</InfoLine>
      <InfoLine icon="clock">{c.opening_hours}</InfoLine>
      <InfoLine icon="phone">{c.phone}</InfoLine>
    </Card>
    <SectionTitle title="Servicios disponibles" />
    <T variant="small">Precios referenciales en soles.</T>
    {services.data.length ? services.data.map(s => <Card key={s.id} style={{ gap: space.sm }}>
      <T variant="subheading">{s.name}</T>
      <T variant="muted">{s.description}</T>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <InfoLine icon="clock">{s.duration_minutes} min</InfoLine>
        <T style={[{ fontWeight: '700' }, tabular]}>{money(s.price)}</T>
      </View>
      <Button label="Pedir turno" variant="secondary" icon="calendar" accessibilityHint={`Pedir turno de ${s.name} en ${c.name}`}
        onPress={() => router.push({ pathname: '/citas/nueva', params: { clinic: String(c.id), service: String(s.id) } })} />
    </Card>) : <EmptyState title="Aún no hay servicios">Esta veterinaria todavía no tiene servicios publicados.</EmptyState>}
    <T variant="small">Tu solicitud queda por confirmar hasta que la veterinaria la acepte.</T>
  </Screen>
}
