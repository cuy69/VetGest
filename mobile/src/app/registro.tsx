import { useState } from 'react'
import { router } from 'expo-router'
import { Button, Card, ErrorState, Field, Header, Screen } from '@/components/ui'
import { api } from '@/lib/api'
import { registerSchema, validate, type FieldErrors, type RegisterValues } from '@/lib/schemas'
import { space } from '@/theme'

const empty: RegisterValues = { first_name: '', last_name: '', email: '', phone: '', password: '', password_confirmation: '' }

export default function Register() {
  const [values, setValues] = useState<RegisterValues>(empty)
  const [errors, setErrors] = useState<FieldErrors<RegisterValues>>({})
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)
  const set = (key: keyof RegisterValues) => (text: string) => setValues(v => ({ ...v, [key]: text }))

  async function submit() {
    setError(null)
    const result = validate(registerSchema, values)
    if (!result.ok) { setErrors(result.errors); return }
    setErrors({})
    setPending(true)
    try {
      await api('/auth/register', { method: 'POST', body: result.data })
      router.replace({ pathname: '/ingresar', params: { registrado: '1' } })
    } catch (e) { setError(e) } finally { setPending(false) }
  }

  return <Screen>
    <Header eyebrow="Bienvenido a su nuevo espacio" title="El cuidado empieza aquí." description="Crea tu cuenta y reúne a toda tu familia de cuatro patas." />
    <Card style={{ gap: space.lg }}>
      <Field label="Nombres" value={values.first_name} onChangeText={set('first_name')} error={errors.first_name} autoComplete="given-name" textContentType="givenName" maxLength={80} />
      <Field label="Apellidos" value={values.last_name} onChangeText={set('last_name')} error={errors.last_name} autoComplete="family-name" textContentType="familyName" maxLength={80} />
      <Field label="Correo electrónico" value={values.email} onChangeText={set('email')} error={errors.email} placeholder="nombre@correo.com"
        keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" />
      <Field label="Teléfono" value={values.phone} onChangeText={set('phone')} error={errors.phone} placeholder="Ej. 987 654 321" keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
      <Field label="Contraseña" value={values.password} onChangeText={set('password')} error={errors.password} hint="Mínimo 10 caracteres."
        secureTextEntry autoComplete="new-password" textContentType="newPassword" />
      <Field label="Confirmar contraseña" value={values.password_confirmation} onChangeText={set('password_confirmation')} error={errors.password_confirmation}
        secureTextEntry autoComplete="new-password" textContentType="newPassword" />
      {!!error && <ErrorState error={error} />}
      <Button label="Crear mi cuenta" onPress={() => void submit()} loading={pending} loadingLabel="Creando tu cuenta…" />
    </Card>
    <Button label="¿Ya tienes una cuenta? Inicia sesión" variant="ghost" onPress={() => router.canGoBack() ? router.back() : router.replace('/ingresar')} />
  </Screen>
}
