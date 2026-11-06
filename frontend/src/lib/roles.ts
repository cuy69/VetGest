import type { ClinicRole, User } from './types'

export type Area = 'owner' | 'clinic' | 'admin'
export const areaOf = (user: User): Area => user.role === 'owner' ? 'owner' : user.role === 'staff' ? 'clinic' : 'admin'
export const homeFor = (user: User) => ({ owner: '/app', clinic: '/clinica', admin: '/admin' })[areaOf(user)]
export const can = (user: User | null | undefined, ...roles: ClinicRole[]) => !!user?.membership && roles.includes(user.membership.role)

/** Permisos del espacio de clínica según docs/api.md (ampliación de noviembre de 2026). */
export const PERMISSIONS = {
  /** Registrar llegada a sala de espera. */
  arrival: ['admin', 'reception'],
  /** Iniciar consulta (el veterinario solo en sus citas; lo valida también el backend). */
  startConsult: ['admin', 'vet'],
  /** Caja: pendientes de cobro, cobrar y ver cobros. */
  cashier: ['admin', 'reception'],
  /** Anular cobros. */
  voidPayment: ['admin'],
  /** Gestionar inventario y ver movimientos. */
  inventory: ['admin'],
  /** Reporte de ingresos. */
  income: ['admin'],
} as const satisfies Record<string, readonly ClinicRole[]>
export type Permission = keyof typeof PERMISSIONS
export const allowed = (user: User | null | undefined, permission: Permission) => can(user, ...PERMISSIONS[permission])
