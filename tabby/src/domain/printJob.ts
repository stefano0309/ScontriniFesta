import type { Timestamp } from './common'
import type { OrderId, PrintJobId, PrinterId, SessionId } from './ids'

export type PrintKind = 'receipt' | 'kitchenTicket'
export type PrintStatus = 'pending' | 'printed' | 'failed' | 'uncertain'

/**
 * Una stampa è separata da ordine e pagamento: se fallisce, l'ordine e l'incasso
 * restano intatti.
 */
export interface PrintJob {
  readonly id: PrintJobId
  readonly sessionId: SessionId
  readonly orderId: OrderId
  readonly printerId: PrinterId
  readonly kind: PrintKind
  readonly status: PrintStatus
  readonly attempts: number
  readonly isReprint: boolean
  readonly createdAt: Timestamp
  readonly lastAttemptAt?: Timestamp
  readonly errorMessage?: string
}

export type ReprintPolicy = 'allowed' | 'needsConfirmation' | 'blocked'

/**
 * - failed: si riprova liberamente (non è uscito nulla)
 * - printed / uncertain: potrebbe esistere già una copia, serve conferma
 * - pending: stampa in corso, si aspetta il risultato
 */
export function reprintPolicy(job: Pick<PrintJob, 'status'>): ReprintPolicy {
  switch (job.status) {
    case 'failed': return 'allowed'
    case 'printed':
    case 'uncertain': return 'needsConfirmation'
    case 'pending': return 'blocked'
  }
}