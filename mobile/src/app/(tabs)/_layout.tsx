import { Tabs } from 'expo-router/js-tabs'
import type { ColorValue } from 'react-native'
import { Icon, type IconName } from '@/components/Icon'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { usePrefs } from '@/lib/prefs'
import { useTheme, useType } from '@/theme'

const tab = (title: string, icon: IconName, label = title) => ({
  title,
  tabBarAccessibilityLabel: label,
  tabBarIcon: ({ color }: { color: ColorValue }) => <Icon name={icon} color={color} size={24} />,
})

export default function TabsLayout() {
  const theme = useTheme()
  const type = useType()
  // La barra de pestañas tiene alto fijo: sus etiquetas crecen hasta 120 % (como en iOS) y el resto de la app, hasta 160 %.
  const { prefs } = usePrefs()
  const cap = Math.min(prefs.text, 1.2) / prefs.text
  const insets = useSafeAreaInsets()
  // Máximo 4 pestañas (design-system/vetgest/pages/app-propietario.md). «Pedir turno» es un botón, no una pestaña.
  return <Tabs screenOptions={{
    tabBarActiveTintColor: theme.primary,
    tabBarInactiveTintColor: theme.textSecondary,
    tabBarStyle: { height: 64 + insets.bottom, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 6), backgroundColor: theme.card, borderTopColor: theme.highContrast ? theme.text : theme.border, borderTopWidth: theme.highContrast ? 2 : 1 },
    tabBarLabelStyle: { ...type(12 * cap, 700, Math.round(16 * cap)) },
    tabBarItemStyle: { minHeight: 48 },
    headerStyle: { backgroundColor: theme.background },
    headerShadowVisible: false,
    headerTitleStyle: { color: theme.text, ...type(17, 800, 22) },
    headerTintColor: theme.primary,
    sceneStyle: { backgroundColor: theme.background },
  }}>
    <Tabs.Screen name="index" options={tab('Inicio', 'home')} />
    <Tabs.Screen name="citas" options={tab('Citas', 'calendar', 'Mis citas')} />
    <Tabs.Screen name="mascotas" options={tab('Mascotas', 'pets', 'Mis mascotas')} />
    <Tabs.Screen name="perfil" options={tab('Perfil', 'person', 'Mi perfil')} />
  </Tabs>
}
