// Iconos Lucide (MASTER §2): trazo 2, nunca emojis. Son decorativos para el lector de pantalla:
// el texto que los acompaña es el que se lee.
import {
  Accessibility, Armchair, BadgeCheck, Bell, Bird, CalendarCheck, CalendarDays, Cat, Check, ChevronLeft, ChevronRight,
  CircleCheck, CircleX, Clock, Dog, House, Hospital, LogOut, MapPin, PawPrint, Pencil, Phone, Plus,
  Rabbit, RefreshCw, Search, Stethoscope, Syringe, Trash2, TriangleAlert, User, UserX, Wallet, X, Zap,
} from 'lucide-react-native'
import { View, type ColorValue } from 'react-native'
import { hidden } from '@/lib/a11y'

const icons = {
  home: House, pets: PawPrint, calendar: CalendarDays, clinic: Hospital, person: User, search: Search,
  add: Plus, bell: Bell, vaccine: Syringe, stethoscope: Stethoscope, edit: Pencil, trash: Trash2,
  chevron: ChevronRight, back: ChevronLeft, close: X, clock: Clock, pin: MapPin, phone: Phone,
  a11y: Accessibility, check: Check, logout: LogOut, refresh: RefreshCw, zap: Zap, alert: TriangleAlert, wallet: Wallet,
  // Estados de MASTER §3
  pending: Clock, confirmed: CalendarCheck, waiting: Armchair, consult: Stethoscope,
  attended: CircleCheck, cancelled: CircleX, noshow: UserX, paid: BadgeCheck,
  // Especies
  dog: Dog, cat: Cat, bird: Bird, rabbit: Rabbit,
}

export type IconName = keyof typeof icons

export function Icon({ name, size = 22, color, strokeWidth = 2 }: { name: IconName; size?: number; color: ColorValue; strokeWidth?: number }) {
  const Component = icons[name]
  return <View {...hidden} pointerEvents="none">
    <Component size={size} color={color as string} strokeWidth={strokeWidth} />
  </View>
}
