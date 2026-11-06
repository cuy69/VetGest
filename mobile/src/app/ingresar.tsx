import { useState } from 'react'
import { Image, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, ErrorState, Field, Notice, Screen, T } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { loginSchema, validate, type FieldErrors, type LoginValues } from '@/lib/schemas'
import { space, useTheme } from '@/theme'
import { group, hidden } from '@/lib/a11y'
import { usePrefs } from '@/lib/prefs'

export default function Login() {
  const { signIn, notice } = useAuth()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  // Con texto grande, la marca y «Accesibilidad» no caben en una fila: se apilan.
  const stacked = usePrefs().prefs.text >= 1.4
  const params = useLocalSearchParams<{ registrado?: string }>()
  const [values, setValues] = useState<LoginValues>({ email: '', password: '' })
  const [errors, setErrors] = useState<FieldErrors<LoginValues>>({})
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)
  const set = (key: keyof LoginValues) => (text: string) => setValues(v => ({ ...v, [key]: text }))

  async function submit() {
    setError(null)
    const result = validate(loginSchema, values)
    if (!result.ok) { setErrors(result.errors); return }
    setErrors({})
    setPending(true)
    // 403 para personal: el backend responde «La app es para propietarios…» y se muestra tal cual.
    try { await signIn(result.data) } catch (e) { setError(e) } finally { setPending(false) }
  }

  return <Screen>
    <View style={{ paddingTop: insets.top + space.lg, gap: space.xl }}>
      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center', justifyContent: 'space-between', gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }} {...group('VetGest')}>
            <Image source={require('../../assets/images/icon.png')} style={{ width: 48, height: 48, borderRadius: 14 }} {...hidden} />
            <T variant="heading" color={theme.primary}>VetGest</T>
          </View>
          <Button label="Accesibilidad" icon="a11y" variant="ghost" compact onPress={() => router.push('/accesibilidad')} accessibilityHint="Tamaño del texto, contraste y tema" />
        </View>
        <T variant="eyebrow">Tu veterinaria, en tu bolsillo</T>
        <T variant="title">Qué bueno verte de nuevo.</T>
        <T variant="muted">Tus compañeros y sus próximos cuidados te esperan.</T>
      </View>
      {params.registrado === '1' && <Notice>Tu cuenta está lista. Inicia sesión para registrar a tu mascota.</Notice>}
      {notice && !error && <Notice tone="info">{notice}</Notice>}
      <Card style={{ gap: space.lg }}>
        <Field label="Correo electrónico" value={values.email} onChangeText={set('email')} error={errors.email}
          placeholder="nombre@correo.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" autoCorrect={false} returnKeyType="next" />
        <Field label="Contraseña" value={values.password} onChangeText={set('password')} error={errors.password}
          secureTextEntry autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={() => void submit()} />
        {!!error && <ErrorState error={error} />}
        <Button label="Iniciar sesión" onPress={() => void submit()} loading={pending} loadingLabel="Iniciando sesión…" />
      </Card>
      <View style={{ alignItems: 'center', gap: space.xs }}>
        <T variant="muted">¿Es tu primera visita?</T>
        <Button label="Crea tu cuenta" variant="ghost" onPress={() => router.push('/registro')} />
      </View>
      <T variant="small" style={{ textAlign: 'center' }}>La app es para propietarios de mascotas. El personal de las veterinarias entra desde la web.</T>
    </View>
  </Screen>
}
