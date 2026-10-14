import type { Timestamp } from './common'
import type { EventId } from './ids'

export type EventStatus = 'planned' | 'running' | 'ended'

/** La festa o manifestazione, es. "Festa d'autunno". Può avere più sessioni. */
export interface Event {
  readonly id: EventId
  readonly name: string
  readonly location?: string
  readonly status: EventStatus
  readonly createdAt: Timestamp
}