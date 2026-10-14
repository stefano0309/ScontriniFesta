import type { Timestamp } from './common'
import type { EventId, SessionId } from './ids'

export type SessionStatus = 'draft' | 'active' | 'suspended' | 'closed'

/** Unità di lavoro di un evento: menu, casse, dispositivi e ordini appartengono a una sessione. */
export interface Session {
  readonly id: SessionId
  readonly eventId: EventId
  readonly name: string
  readonly status: SessionStatus
  readonly createdAt: Timestamp
  readonly closedAt?: Timestamp
}

/** Si può vendere solo in una sessione attiva (non sospesa né chiusa). */
export const canSell = (session: Pick<Session, 'status'>): boolean => session.status === 'active'