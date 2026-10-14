import type { ReceiptConfigId, SessionId } from './ids'

export interface ReceiptConfig {
  readonly id: ReceiptConfigId
  readonly sessionId: SessionId
  readonly header: string
  readonly eventName: string
  readonly footer: string
  readonly showOrderCode: boolean
  readonly showTime: boolean
  /** Sempre false: la ricevuta non è un documento fiscale. La conformità va verificata a parte. */
  readonly fiscal: false
}

export const DEFAULT_RECEIPT_TEXT = {
  header: 'FESTA',
  eventName: '',
  footer: 'Grazie e buon appetito!',
} as const

export const defaultReceiptConfig = (id: ReceiptConfigId, sessionId: SessionId): ReceiptConfig => ({
  id,
  sessionId,
  ...DEFAULT_RECEIPT_TEXT,
  showOrderCode: true,
  showTime: true,
  fiscal: false,
})