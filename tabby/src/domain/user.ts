import { z } from 'zod'
import { asEventId, asUserId, type EventId, type UserId } from './ids'
import { ROLES, can, type Permission, type Role } from './role'

export interface User {
  readonly id: UserId
  readonly displayName: string
  readonly role: Role
  /** Feste a cui è assegnato. Ignorato per il super admin. */
  readonly eventIds: readonly EventId[]
  /** Si disattiva, non si cancella: lo storico continua a puntare all'utente. */
  readonly active: boolean
}

export const userSchema = z.object({
  id: z.string().min(1).transform(asUserId),
  displayName: z.string().min(1),
  role: z.enum(ROLES),
  eventIds: z.array(z.string().min(1).transform(asEventId)).default([]),
  active: z.boolean().default(true),
})

export function canAccessEvent(user: User, eventId: EventId): boolean {
  if (!user.active) return false
  if (user.role === 'superAdmin') return true
  return user.eventIds.includes(eventId)
}

/** Ruolo (cosa) + assegnazione (dove). Nelle schermate usa questa. */
export const canInEvent = (user: User, permission: Permission, eventId: EventId): boolean =>
  canAccessEvent(user, eventId) && can(user.role, permission)

export const visibleEvents = <T extends { id: EventId }>(user: User, all: readonly T[]): T[] =>
  all.filter((e) => canAccessEvent(user, e.id))