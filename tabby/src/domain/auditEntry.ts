import type { Timestamp } from './common'
import type { AuditEntryId, DeviceId, SessionId, UserId } from './ids'

export type AuditAction =
  | 'order.created'
  | 'order.statusChanged'
  | 'order.cancelled'
  | 'payment.recorded'
  | 'product.updated'
  | 'product.priceChanged'
  | 'product.soldOut'
  | 'shift.opened'
  | 'shift.closed'
  | 'session.created'
  | 'session.suspended'
  | 'session.resumed'
  | 'device.paired'
  | 'print.failed'

/** Registro append-only: si aggiungono voci, non si modificano né si cancellano. */
export interface AuditEntry {
  readonly id: AuditEntryId
  readonly sessionId: SessionId
  readonly action: AuditAction
  readonly actorUserId: UserId
  readonly deviceId?: DeviceId
  /** Cosa è stato toccato, es. "order" + id dell'ordine. */
  readonly targetType: string
  readonly targetId: string
  readonly reason?: string
  readonly details?: Readonly<Record<string, string | number | boolean>>
  readonly at: Timestamp
}

/** Azioni sensibili: l'interfaccia deve chiedere una motivazione. */
const NEEDS_REASON: ReadonlySet<AuditAction> = new Set([
  'order.cancelled',
  'product.priceChanged',
  'session.suspended',
])

export const requiresReason = (action: AuditAction): boolean => NEEDS_REASON.has(action)