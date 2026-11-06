import { useState } from 'react'
import { View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { Button, Card, ErrorState, Field, Header, MenuRow, Notice, Screen, T } from '@/components/ui'
import { router } from 'expo-router'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { profileSchema, validate, type FieldErrors, type ProfileValues } from '@/lib/schemas'
import type { User } from '@/lib/types'
import { space, useTheme } from '@/theme'
import { hidden } from '@/lib/a11y'

export default function Profile() {
  const { user, setUser, signOut } = useAuth()
  const theme = useTheme()
  const [values, setValues] = useState<ProfileValues>(user?.profile ?? { first_name: '', last_name: '', phone: '' })
  const [errors, setErrors] = useState<FieldErrors<ProfileValues>>({})
  const [saved, setSaved] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const set = (key: keyof ProfileValues) => (text: string) => { setSaved(false); setValues(v => ({ ...v, [key]: text })) }
  const mutation = useMutation({
    mutationFn: (data: ProfileValues) => api<User>('/auth/profile', { method: 'PATCH', body: data }),
    onSuccess: data => { setUser(data); setValues(data.profile); setSaved(true) },
  })
  if (!user) return null
  const dirty = (Object.keys(values) as (keyof ProfileValues)[]).some(k => values[k] !== user.profile[k])

  function submit() {
    const result = validate(profileSchema, values)
    if (!result.ok) { setErrors(result.errors); return }
    setErrors({}); setSaved(false)
    mutation.mutate(result.data)
  }

  return <Screen>
    <Header title="Mi perfil" description="Un espacio para tu información personal." />
    <Card style={{ alignItems: 'center', gap: space.sm }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }} {...hidden}>
        <T variant="heading" color={theme.onAccentSoft}>{user.profile.first_name[0]}{user.profile.last_name[0]}</T>
      </View>
      <T variant="heading">{user.profile.first_name} {user.profile.last_name}</T>
      <T variant="muted">Propietario de mascota</T>
    </Card>
    <Card style={{ gap: space.lg }}>
      <T variant="heading">Información personal</T>
      <T variant="muted">Mantén tus datos de contacto actualizados.</T>
      {saved && <Notice>Tus datos se guardaron correctamente.</Notice>}
      <Field label="Nombres" value={values.first_name} onChangeText={set('first_name')} error={errors.first_name} autoComplete="given-name" maxLength={80} />
      <Field label="Apellidos" value={values.last_name} onChangeText={set('last_name')} error={errors.last_name} autoComplete="family-name" maxLength={80} />
      <Field label="Correo electrónico" value={user.email} editable={false} hint="El correo identifica tu cuenta y no se puede modificar en esta versión." />
      <Field label="Teléfono" value={values.phone} onChangeText={set('phone')} error={errors.phone} keyboardType="phone-pad" autoComplete="tel" />
      {mutation.isError && <ErrorState error={mutation.error} />}
      <Button label="Guardar cambios" icon="check" onPress={submit} loading={mutation.isPending} loadingLabel="Guardando…" disabled={!dirty} />
      <T variant="small">Solo tú puedes consultar y actualizar estos datos. Para cambiar tu contraseña, entra a VetGest desde la web.</T>
    </Card>
    <MenuRow icon="a11y" label="Accesibilidad" hint="Tamaño del texto, contraste, tema y animaciones" onPress={() => router.push('/accesibilidad')} />
    <Button label="Cerrar sesión" icon="logout" variant="secondary" loading={leaving} loadingLabel="Cerrando sesión…"
      onPress={() => { setLeaving(true); void signOut() }} accessibilityHint="Cierra tu sesión en este dispositivo" />
  </Screen>
}
