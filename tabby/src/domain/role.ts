export const ROLES = ['waiter', 'cashier', 'kitchen', 'admin', 'superAdmin'] as const
export type Role = (typeof ROLES)[number]

export type Permission =
  | 'order.create'
  | 'order.pay'
  | 'order.cancel'
  | 'kitchen.updateStatus'
  | 'menu.editPrices'
  | 'menu.toggleAvailability'
  | 'shift.close'
  | 'session.create'
  | 'session.suspend'
  | 'event.manageAll'

const PERMISSIONS: Record<Role, readonly Permission[]> = {
  waiter: ['order.create'],
  cashier: ['order.create', 'order.pay', 'order.cancel', 'shift.close'],
  kitchen: ['kitchen.updateStatus'],
  admin: [
    'order.create', 'order.pay', 'order.cancel', 'kitchen.updateStatus',
    'menu.editPrices', 'menu.toggleAvailability',
    'shift.close', 'session.create', 'session.suspend',
  ],
  superAdmin: [
    'order.create', 'order.pay', 'order.cancel', 'kitchen.updateStatus',
    'menu.editPrices', 'menu.toggleAvailability',
    'shift.close', 'session.create', 'session.suspend', 'event.manageAll',
  ],
}

export const can = (role: Role, permission: Permission): boolean =>
  PERMISSIONS[role].includes(permission)

export const isRole = (value: unknown): value is Role =>
  typeof value === 'string' && (ROLES as readonly string[]).includes(value)