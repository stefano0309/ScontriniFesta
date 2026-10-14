import type { Cents, Timestamp } from './common'
import type { DeviceId, SessionId, ShiftId, UserId } from './ids'

export type ShiftStatus = 'open' | 'closed'

/** Periodo in cui una postazione usa una cassa. Chiuderlo NON chiude la sessione. */
export interface Shift {
  readonly id: ShiftId
  readonly sessionId: SessionId
  readonly name: string
  readonly deviceId?: DeviceId
  readonly openedByUserId: UserId
  readonly openedAt: Timestamp
  readonly openingFloatCents: Cents
  readonly status: ShiftStatus
  readonly closedAt?: Timestamp
}