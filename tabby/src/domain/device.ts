import type { Timestamp } from './common'
import type { DeviceId, SessionId } from './ids'

export type DeviceStatus = 'connected' | 'offline' | 'syncing' | 'error'

export interface Device {
  readonly id: DeviceId
  /** Un dispositivo appartiene a una sola sessione alla volta. */
  readonly sessionId: SessionId
  readonly name: string
  readonly status: DeviceStatus
  readonly lastSyncAt?: Timestamp
  /** Operazioni salvate in locale e non ancora sincronizzate. */
  readonly pendingOperations: number
}