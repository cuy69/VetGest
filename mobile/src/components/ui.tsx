import { useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { errorMessage, serverWake } from '@/lib/api'
import { STEPS, stageIcon, stageOf } from '@/lib/appointments'
import type { Appointment, AppointmentStage, Species } from '@/lib/types'
import { controlRadius, hitSlop, radius, space, stageTone, toneOf, toWeight, touch, useTheme, useType, type Weight } from '@/theme'
import { useReduceMotion } from '@/lib/prefs'
import { Icon, type IconName } from './Icon'
import { group, hidden } from '@/lib/a11y'

// ---------- Texto ----------
type Variant = 'title' | 'heading' | 'subheading' | 'body' | 'muted' | 'small' | 'eyebrow'
const variants: Record<Variant, { size: number; weight: Weight; lineHeight: number; extra?: TextStyle }> = {
  title: { size: 30, weight: 800, lineHeight: 36, extra: { letterSpacing: -0.3 } },
  heading: { size: 21, weight: 800, lineHeight: 27 },
  subheading: { size: 17, weight: 700, lineHeight: 24 },
  body: { size: 16, weight: 400, lineHeight: 24 },
  muted: { size: 15, weight: 400, lineHeight: 22 },
  small: { size: 13.5, weight: 600, lineHeight: 19 },
  eyebrow: { size: 12.5, weight: 800, lineHeight: 17, extra: { letterSpacing: 1, textTransform: 'uppercase' } },
}
/** Texto con la tipografía de la app; aplica tamaño, negrita y espaciado de las preferencias. */
export function T({ variant = 'body', style, children, color, ...rest }: { variant?: Variant; style?: StyleProp<TextStyle>; children: ReactNode; color?: string } & Omit<React.ComponentProps<typeof Text>, 'style'>) {
  const theme = useTheme()
  const type = useType()
  const v = variants[variant]
  const flat = StyleSheet.flatten(style) ?? {}
  const size = flat.fontSize ?? v.size
  const { fontSize: _size, fontWeight, lineHeight: _lh, ...own } = flat
  const tone = color ?? (variant === 'muted' || variant === 'small' || variant === 'eyebrow' ? theme.textSecondary : theme.text)
  return <Text {...rest} accessibilityRole={variant === 'title' || variant === 'heading' ? 'header' : rest.accessibilityRole}
    style={[v.extra, type(size, fontWeight ? toWeight(fontWeight) : v.weight, Math.round(size * (v.lineHeight / v.size))), { color: tone }, own]}>{children}</Text>
}

// ---------- Contenedores ----------
export function Screen({ children, onRefresh, refreshing = false, footer }: { children: ReactNode; onRefresh?: () => void; refreshing?: boolean; footer?: ReactNode }) {
  const theme = useTheme()
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
    <ScrollView
      style={{ flex: 1 }} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} /> : undefined}
    >{children}</ScrollView>
    {footer && <Footer>{footer}</Footer>}
  </KeyboardAvoidingView>
}

/** Barra inferior fija respetando el área segura (botón principal de un flujo). */
export function Footer({ children }: { children: ReactNode }) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  return <View style={[styles.footer, { backgroundColor: theme.card, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, space.md) }]}>{children}</View>
}

export function Card({ children, style, highlight = false }: { children: ReactNode; style?: StyleProp<ViewStyle>; highlight?: boolean }) {
  const theme = useTheme()
  return <View style={[styles.card, theme.scheme === 'light' && !theme.highContrast && styles.lifted, { backgroundColor: theme.card, borderColor: highlight ? theme.primary : theme.border, borderWidth: highlight ? 2 : 1 }, style]}>{children}</View>
}

/** Bloque de bienvenida con el color de la marca (inicio de la app). */
export function Hero({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children?: ReactNode }) {
  const theme = useTheme()
  return <View style={[styles.hero, { backgroundColor: theme.hero, borderColor: theme.highContrast ? theme.border : theme.hero }]}>
    <View style={[styles.heroPaw, { backgroundColor: theme.onHero }]} {...hidden} />
    {eyebrow && <T variant="eyebrow" color={theme.onHeroMuted}>{eyebrow}</T>}
    <T variant="title" color={theme.onHero}>{title}</T>
    {description && <T variant="muted" color={theme.onHeroMuted}>{description}</T>}
    {children}
  </View>
}

export function Header({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return <View style={{ gap: space.xs }}>
    {eyebrow && <T variant="eyebrow">{eyebrow}</T>}
    <T variant="title">{title}</T>
    {description && <T variant="muted">{description}</T>}
  </View>
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return <View style={styles.sectionTitle}><T variant="heading" style={{ flex: 1 }}>{title}</T>{action}</View>
}

// ---------- Botones ----------
type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost'
export function Button({ label, onPress, variant = 'primary', icon, disabled, loading, loadingLabel, accessibilityHint, style, compact }: {
  label: string; onPress?: () => void; variant?: ButtonVariant; icon?: IconName; disabled?: boolean; loading?: boolean
  loadingLabel?: string; accessibilityHint?: string; style?: StyleProp<ViewStyle>; compact?: boolean
}) {
  const theme = useTheme()
  const type = useType()
  const palette: Record<ButtonVariant, { bg: string; pressed: string; fg: string; border: string }> = {
    primary: { bg: theme.primary, pressed: theme.primaryHover, fg: theme.onPrimary, border: theme.primary },
    accent: { bg: theme.accent, pressed: theme.accentSoft, fg: theme.onAccent, border: theme.highContrast ? theme.onAccent : theme.accent },
    secondary: { bg: theme.card, pressed: theme.soft, fg: theme.primary, border: theme.highContrast ? theme.primary : theme.inputBorder },
    danger: { bg: theme.danger, pressed: theme.danger, fg: theme.scheme === 'dark' ? '#1a0d0b' : '#ffffff', border: theme.danger },
    ghost: { bg: 'transparent', pressed: theme.soft, fg: theme.primary, border: 'transparent' },
  }
  const c = palette[variant]
  const off = disabled || loading
  const text = loading && loadingLabel ? loadingLabel : label
  return <Pressable
    onPress={onPress} disabled={off} hitSlop={hitSlop}
    accessibilityRole="button" accessibilityLabel={text} accessibilityHint={accessibilityHint}
    accessibilityState={{ disabled: !!off, busy: !!loading }} aria-disabled={!!off} aria-busy={!!loading}
    android_ripple={{ color: theme.soft }}
    style={({ pressed }) => [styles.button, compact && styles.compact, { backgroundColor: pressed ? c.pressed : c.bg, borderColor: c.border, opacity: off ? 0.5 : pressed ? 0.9 : 1 }, style]}
  >
    {loading ? <ActivityIndicator color={c.fg} /> : icon ? <Icon name={icon} size={20} color={c.fg} /> : null}
    <Text style={[styles.buttonText, type(16, 700, 22), { color: c.fg }]}>{text}</Text>
  </Pressable>
}

/** Fila táctil de lista (tarjeta con flecha), p. ej. una mascota o una cita. */
export function RowLink({ onPress, children, accessibilityLabel, accessibilityHint }: { onPress: () => void; children: ReactNode; accessibilityLabel: string; accessibilityHint?: string }) {
  const theme = useTheme()
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint}
    android_ripple={{ color: theme.soft }}
    style={({ pressed }) => [styles.card, styles.row, { backgroundColor: pressed ? theme.soft : theme.card, borderColor: theme.border }]}>
    <View style={{ flex: 1, gap: 6 }}>{children}</View>
    <Icon name="chevron" size={20} color={theme.textSecondary} />
  </Pressable>
}

/** Control segmentado (p. ej. Próximas / Anteriores). */
export function Segmented<V extends string>({ label, options, value, onChange }: { label: string; options: { value: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  const theme = useTheme()
  const type = useType()
  return <View accessibilityRole="tablist" accessibilityLabel={label} style={[styles.segmented, { backgroundColor: theme.soft }]}>
    {options.map(o => {
      const selected = o.value === value
      return <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected }} aria-selected={selected} accessibilityLabel={o.label}
        style={({ pressed }) => [styles.segment, { backgroundColor: selected ? theme.card : 'transparent', borderColor: selected && theme.highContrast ? theme.text : 'transparent', opacity: pressed ? 0.8 : 1 }]}>
        <Text style={[type(15, selected ? 800 : 600, 20), { color: selected ? theme.text : theme.textSecondary, textAlign: 'center' }]}>{o.label}</Text>
      </Pressable>
    })}
  </View>
}

// ---------- Formularios ----------
export function Field({ label, error, hint, style, ...input }: { label: string; error?: string; hint?: string; style?: StyleProp<TextStyle> } & TextInputProps) {
  const theme = useTheme()
  const type = useType()
  const [focused, setFocused] = useState(false)
  return <View style={{ gap: 6 }}>
    <T variant="subheading" style={{ fontSize: 15 }}>{label}</T>
    <TextInput
      placeholderTextColor={theme.textSecondary}
      accessibilityLabel={label}
      accessibilityHint={[error, hint].filter(Boolean).join('. ') || undefined}
      aria-invalid={!!error}
      {...input}
      onFocus={e => { setFocused(true); input.onFocus?.(e) }}
      onBlur={e => { setFocused(false); input.onBlur?.(e) }}
      style={[styles.input, type(16, 400, 22), input.multiline && { minHeight: 104, textAlignVertical: 'top', paddingTop: 12 }, {
        color: input.editable === false ? theme.textSecondary : theme.text, backgroundColor: input.editable === false ? theme.soft : theme.inputBackground,
        borderColor: error ? theme.danger : focused ? theme.primary : theme.inputBorder, borderWidth: focused || error ? 2.5 : 1.5,
      }, style]}
    />
    {hint && !error && <T variant="small">{hint}</T>}
    {error && <FieldError>{error}</FieldError>}
  </View>
}

export function FieldError({ children }: { children: ReactNode }) {
  const theme = useTheme()
  return <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }} accessibilityLiveRegion="polite">
    <Icon name="alert" size={16} color={theme.danger} /><T variant="small" color={theme.danger} style={{ flex: 1 }}>{children}</T>
  </View>
}

/** Opciones como tarjetas seleccionables (radio). */
export function Choice<V extends string | number>({ label, options, value, onChange, error, layout = 'wrap' }: {
  label: string; options: { value: V; label: string; hint?: string; icon?: IconName; disabled?: boolean }[]; value: V | undefined
  onChange: (value: V) => void; error?: string; layout?: 'wrap' | 'list'
}) {
  const theme = useTheme()
  const type = useType()
  return <View style={{ gap: 8 }}>
    <T variant="subheading" style={{ fontSize: 15 }}>{label}</T>
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={layout === 'wrap' ? styles.chips : { gap: space.sm }}>
      {options.map(o => {
        const selected = o.value === value
        return <Pressable key={String(o.value)} onPress={() => onChange(o.value)} disabled={o.disabled} hitSlop={4}
          accessibilityRole="radio" accessibilityLabel={o.hint ? `${o.label}, ${o.hint}` : o.label} accessibilityState={{ checked: selected, disabled: !!o.disabled }} aria-checked={selected} aria-disabled={!!o.disabled}
          android_ripple={{ color: theme.soft }}
          style={({ pressed }) => [styles.chip, layout === 'list' && styles.listChoice, {
            backgroundColor: selected ? theme.primary : pressed ? theme.soft : theme.card,
            borderColor: selected ? theme.primary : error ? theme.danger : theme.inputBorder, opacity: o.disabled ? 0.45 : 1,
          }]}>
          {o.icon && <Icon name={o.icon} size={20} color={selected ? theme.onPrimary : theme.primary} />}
          <View style={{ flexShrink: 1, alignItems: layout === 'list' ? 'flex-start' : 'center' }}>
            <Text style={[type(16, 700, 22), { color: selected ? theme.onPrimary : theme.text }]}>{o.label}</Text>
            {o.hint && <Text style={[type(14, 400, 19), { color: selected ? theme.onPrimary : theme.textSecondary, fontVariant: ['tabular-nums'] }]}>{o.hint}</Text>}
          </View>
          {layout === 'list' && selected && <View style={{ marginLeft: 'auto' }}><Icon name="check" size={20} color={theme.onPrimary} /></View>}
        </Pressable>
      })}
    </View>
    {error && <FieldError>{error}</FieldError>}
  </View>
}

// ---------- Estados ----------
export function Loading({ label = 'Cargando…' }: { label?: string }) {
  const theme = useTheme()
  const waking = useServerWaking()
  const text = waking ? 'Despertando el servidor… La primera conexión puede tardar hasta un minuto.' : label
  return <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={text}>
    <ActivityIndicator size="large" color={theme.primary} /><T variant="muted" style={{ textAlign: 'center' }}>{text}</T>
  </View>
}

export const useServerWaking = () => useSyncExternalStore(serverWake.subscribe, serverWake.isWaking, serverWake.isWaking)

/** Aviso global cuando la API de Render está arrancando (cualquier petición > 4 s). */
export function ServerWakeBanner() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const waking = useServerWaking()
  if (!waking) return null
  const tone = toneOf(theme, 'warning')
  return <View pointerEvents="none" style={[styles.wake, { top: insets.top + space.sm, backgroundColor: tone.bg, borderColor: theme.border }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
    <ActivityIndicator color={tone.fg} />
    <T variant="small" color={tone.fg} style={{ flex: 1, fontWeight: '600' }}>Despertando el servidor… La primera conexión puede tardar hasta un minuto.</T>
  </View>
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const theme = useTheme()
  return <View style={[styles.notice, { backgroundColor: theme.dangerSoft }]} accessibilityRole="alert">
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <Icon name="alert" size={20} color={theme.danger} />
      <T color={theme.danger} style={{ fontWeight: '600', flex: 1 }}>{errorMessage(error)}</T>
    </View>
    {retry && <Button label="Reintentar" icon="refresh" variant="secondary" onPress={retry} compact style={{ alignSelf: 'flex-start' }} />}
  </View>
}

export function Notice({ children, tone = 'success' }: { children: ReactNode; tone?: 'success' | 'info' }) {
  const theme = useTheme()
  const c = tone === 'success' ? toneOf(theme, 'success') : toneOf(theme, 'neutral')
  return <View style={[styles.notice, { backgroundColor: c.bg, flexDirection: 'row', gap: space.sm }]} accessibilityLiveRegion="polite">
    <Icon name={tone === 'success' ? 'attended' : 'bell'} size={20} color={c.fg} />
    <T color={c.fg} style={{ flex: 1 }}>{children}</T>
  </View>
}

export function EmptyState({ title, children, action, icon = 'pets' }: { title: string; children?: ReactNode; action?: ReactNode; icon?: IconName }) {
  const theme = useTheme()
  return <Card style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xl }}>
    <View style={[styles.emptyIcon, { backgroundColor: theme.soft }]}><Icon name={icon} size={26} color={theme.primary} /></View>
    <T variant="subheading" style={{ textAlign: 'center' }}>{title}</T>
    {children && <T variant="muted" style={{ textAlign: 'center' }}>{children}</T>}
    {action}
  </Card>
}

/** Estado con texto + icono + color (MASTER §3). */
export function StageBadge({ appointment }: { appointment: Pick<Appointment, 'status' | 'stage' | 'arrived_at' | 'started_at'> }) {
  const stage = stageOf(appointment)
  return <StageBadgeFor stage={stage} />
}
export function StageBadgeFor({ stage }: { stage: AppointmentStage }) {
  const theme = useTheme()
  const type = useType()
  const tone = stageTone(theme, stage)
  return <View style={[styles.badge, { backgroundColor: tone.bg, borderColor: theme.highContrast ? tone.fg : tone.bg }]} {...group(`Estado: ${stage}`)}>
    <Icon name={stageIcon[stage]} size={15} color={tone.fg} />
    <Text style={[type(13, 800, 18), { color: tone.fg }]}>{stage}</Text>
  </View>
}

export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: 'neutral' | 'success' | 'danger' | 'warning'; icon?: IconName }) {
  const theme = useTheme()
  const type = useType()
  const c = toneOf(theme, tone)
  return <View style={[styles.badge, { backgroundColor: c.bg, borderColor: theme.highContrast ? c.fg : c.bg }]}>
    {icon && <Icon name={icon} size={15} color={c.fg} />}
    <Text style={[type(13, 700, 18), { color: c.fg, fontVariant: ['tabular-nums'] }]}>{label}</Text>
  </View>
}

/** Línea de 5 pasos con el paso actual marcado con texto («Paso actual»), no solo color. */
export function StageTimeline({ appointment }: { appointment: Appointment }) {
  const theme = useTheme()
  const type = useType()
  const stage = stageOf(appointment)
  const current = STEPS.indexOf(stage)
  if (current < 0) return <StageBadgeFor stage={stage} />
  return <View {...group(`Paso ${current + 1} de 5: ${stage}`)} style={{ gap: 6 }}>
    {STEPS.map((step, i) => {
      const done = i < current
      const now = i === current
      const tone = stageTone(theme, step)
      return <View key={step} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 28 }}>
        <View style={[styles.dot, {
          backgroundColor: now ? tone.bg : done ? theme.primary : 'transparent',
          borderColor: now ? tone.fg : done ? theme.primary : theme.border,
        }]}>
          {done ? <Icon name="check" size={14} color={theme.onPrimary} /> : now ? <Icon name={stageIcon[step]} size={14} color={tone.fg} /> : null}
        </View>
        <Text style={[type(15, now ? 800 : 600, 21), { flex: 1, color: now ? theme.text : theme.textSecondary }]}>{step}</Text>
        {now && <Text style={[type(12, 800, 17), { color: tone.fg, backgroundColor: tone.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' }]}>Ahora</Text>}
      </View>
    })}
  </View>
}

const speciesIcon: Record<Species, IconName> = { Perro: 'dog', Gato: 'cat', Ave: 'bird', Conejo: 'rabbit', Otro: 'pets' }
export function PetAvatar({ species, size = 48 }: { species: Species; size?: number }) {
  const theme = useTheme()
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.accentSoft, borderWidth: theme.highContrast ? 1.5 : 0, borderColor: theme.onAccentSoft, alignItems: 'center', justifyContent: 'center' }} {...hidden}>
    <Icon name={speciesIcon[species] ?? 'pets'} size={size * 0.5} color={theme.onAccentSoft} />
  </View>
}

export function InfoLine({ icon, children }: { icon: IconName; children: ReactNode }) {
  const theme = useTheme()
  return <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
    <View style={{ paddingTop: 2 }}><Icon name={icon} size={18} color={theme.textSecondary} /></View>
    <T variant="muted" style={{ flex: 1 }}>{children}</T>
  </View>
}

// ---------- Hoja de confirmación (MASTER §4.3: dentro de la app, con la consecuencia) ----------
export function ConfirmSheet({ open, title, children, confirmLabel, cancelLabel = 'Mantener', pending, error, onCancel, onConfirm }: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string; cancelLabel?: string; pending?: boolean; error?: unknown
  onCancel: () => void; onConfirm: () => void
}) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReduceMotion()
  return <Modal visible={open} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onCancel} statusBarTranslucent>
    <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
      <Pressable style={{ flex: 1 }} onPress={pending ? undefined : onCancel} accessibilityLabel={cancelLabel} accessibilityRole="button" />
      <View style={[styles.sheet, { backgroundColor: theme.card, paddingBottom: Math.max(insets.bottom, space.lg) }]} accessibilityViewIsModal>
        <View style={[styles.grabber, { backgroundColor: theme.border }]} />
        <T variant="heading">{title}</T>
        <T variant="muted">{children}</T>
        {!!error && <ErrorState error={error} />}
        <Button label={confirmLabel} variant="danger" onPress={onConfirm} loading={pending} loadingLabel="Procesando…" />
        <Button label={cancelLabel} variant="secondary" onPress={onCancel} disabled={pending} />
      </View>
    </View>
  </Modal>
}

// ---------- Ajustes ----------
/** Interruptor accesible: toda la fila es el objetivo táctil; el lector anuncia nombre, ayuda y estado. */
export function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (value: boolean) => void }) {
  const theme = useTheme()
  return <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityLabel={label} accessibilityHint={hint}
    accessibilityState={{ checked: value }} aria-checked={value} android_ripple={{ color: theme.soft }}
    style={({ pressed }) => [styles.toggleRow, { backgroundColor: pressed ? theme.soft : 'transparent' }]}>
    <View style={{ flex: 1, gap: 2 }}>
      <T variant="subheading">{label}</T>
      {hint && <T variant="muted">{hint}</T>}
    </View>
    <View {...hidden} style={[styles.track, { backgroundColor: value ? theme.primary : theme.soft, borderColor: value ? theme.primary : theme.inputBorder }]}>
      <View style={[styles.thumb, { backgroundColor: value ? theme.onPrimary : theme.inputBorder, transform: [{ translateX: value ? 22 : 0 }] }]}>
        {value && <Icon name="check" size={14} color={theme.primary} />}
      </View>
    </View>
  </Pressable>
}

/** Fila de menú con icono (p. ej. «Accesibilidad» en el perfil). */
export function MenuRow({ icon, label, hint, onPress }: { icon: IconName; label: string; hint?: string; onPress: () => void }) {
  const theme = useTheme()
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} android_ripple={{ color: theme.soft }}
    style={({ pressed }) => [styles.card, styles.row, { backgroundColor: pressed ? theme.soft : theme.card, borderColor: theme.border }]}>
    <View style={[styles.menuIcon, { backgroundColor: theme.accentSoft }]}><Icon name={icon} size={22} color={theme.onAccentSoft} /></View>
    <View style={{ flex: 1, gap: 2 }}><T variant="subheading">{label}</T>{hint && <T variant="small">{hint}</T>}</View>
    <Icon name="chevron" size={20} color={theme.textSecondary} />
  </Pressable>
}

const styles = StyleSheet.create({
  screen: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 1.5, flexGrow: 1 },
  footer: { borderTopWidth: 1, paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  card: { borderRadius: radius, borderWidth: 1, padding: space.lg, gap: space.sm },
  lifted: { shadowColor: '#5b4a2e', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  hero: { borderRadius: radius + 4, borderWidth: 1.5, padding: space.xl, gap: space.sm, overflow: 'hidden' },
  heroPaw: { position: 'absolute', right: -36, top: -36, width: 140, height: 140, borderRadius: 70, opacity: 0.07 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touch + 16 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touch, flexWrap: 'wrap' },
  button: { minHeight: touch, borderRadius: controlRadius, borderWidth: 1, paddingHorizontal: space.lg, paddingVertical: space.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, overflow: 'hidden' },
  compact: { minHeight: 44, paddingHorizontal: space.md },
  buttonText: { textAlign: 'center', flexShrink: 1 },
  input: { minHeight: touch, borderWidth: 1.5, borderRadius: controlRadius, paddingHorizontal: 14, paddingVertical: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: touch, minWidth: touch, borderRadius: controlRadius, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 8, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: space.sm, overflow: 'hidden' },
  listChoice: { justifyContent: 'flex-start', paddingVertical: 12 },
  segmented: { flexDirection: 'row', borderRadius: controlRadius + 2, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 44, borderRadius: controlRadius, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
  center: { padding: space.xxl, alignItems: 'center', justifyContent: 'center', gap: space.md },
  notice: { borderRadius: 14, padding: space.lg, gap: space.md },
  badge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  wake: { position: 'absolute', left: space.lg, right: space.lg, zIndex: 10, borderRadius: 14, borderWidth: 1, padding: space.md, flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius + 6, borderTopRightRadius: radius + 6, padding: space.xl, gap: space.md, width: '100%', maxWidth: 640, alignSelf: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: touch + 12, paddingVertical: space.sm, paddingHorizontal: space.sm, borderRadius: controlRadius },
  track: { width: 52, height: 30, borderRadius: 15, borderWidth: 2, padding: 2, justifyContent: 'center' },
  thumb: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  menuIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  grabber: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: space.xs },
})
