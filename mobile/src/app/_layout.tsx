import { useEffect, useState } from 'react'
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, useFonts } from '@expo-google-fonts/nunito'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import { AuthProvider, useAuth } from '@/lib/auth'
import { View } from 'react-native'
import { Loading, ServerWakeBanner } from '@/components/ui'
import { PrefsProvider, useReduceMotion } from '@/lib/prefs'
import { useTheme, useType } from '@/theme'

void SplashScreen.preventAutoHideAsync().catch(() => undefined)

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        // No reintentar errores del cliente (401/403/404/409/422): mostrar el mensaje de una vez.
        retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      },
    },
  })
}

function RootNavigator() {
  const { status } = useAuth()
  const theme = useTheme()
  const type = useType()
  const reduceMotion = useReduceMotion()
  if (status === 'loading') return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.background }}><Loading label="Abriendo VetGest…" /></View>
  const signedIn = status === 'signedIn'
  const navTheme = theme.scheme === 'dark' ? DarkTheme : DefaultTheme
  return <ThemeProvider value={{ ...navTheme, colors: { ...navTheme.colors, primary: theme.primary, background: theme.background, card: theme.card, text: theme.text, border: theme.border } }}>
    <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
    <Stack screenOptions={{
      headerStyle: { backgroundColor: theme.background }, headerShadowVisible: false, headerTintColor: theme.primary,
      headerTitleStyle: { color: theme.text, fontFamily: type(17, 800).fontFamily, fontSize: type(17, 800).fontSize },
      headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: theme.background },
      animation: reduceMotion ? 'none' : 'default',
    }}>
      {/* Disponible con o sin sesión: ajustar la lectura antes de ingresar. */}
      <Stack.Screen name="accesibilidad" options={{ title: 'Accesibilidad' }} />
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="ingresar" options={{ headerShown: false, title: 'Ingresar' }} />
        <Stack.Screen name="registro" options={{ title: 'Crear cuenta' }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="mascotas/nueva" options={{ title: 'Nueva mascota' }} />
        <Stack.Screen name="mascotas/[id]/index" options={{ title: 'Mascota' }} />
        <Stack.Screen name="mascotas/[id]/editar" options={{ title: 'Editar mascota' }} />
        <Stack.Screen name="veterinarias" options={{ title: 'Veterinarias' }} />
        <Stack.Screen name="veterinaria/[id]" options={{ title: 'Veterinaria' }} />
        <Stack.Screen name="citas/nueva" options={{ title: 'Pedir turno' }} />
        <Stack.Screen name="citas/[id]" options={{ title: 'Tu turno' }} />
      </Stack.Protected>
    </Stack>
    <ServerWakeBanner />
  </ThemeProvider>
}

export default function RootLayout() {
  const [client] = useState(makeClient)
  const [fontsLoaded, fontError] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold })
  const fontsDone = fontsLoaded || !!fontError
  // La pantalla de arranque espera a la fuente (o a su error: entonces se usa la del sistema).
  // Si la API está dormida, después se ve «Despertando el servidor…».
  useEffect(() => { if (fontsDone) void SplashScreen.hideAsync().catch(() => undefined) }, [fontsDone])
  if (!fontsDone) return null
  return <SafeAreaProvider>
    <PrefsProvider fontsReady={fontsLoaded}>
      <QueryClientProvider client={client}>
        <AuthProvider><RootNavigator /></AuthProvider>
      </QueryClientProvider>
    </PrefsProvider>
  </SafeAreaProvider>
}
