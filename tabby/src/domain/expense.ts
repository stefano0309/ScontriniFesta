import type { Cents, Timestamp } from './common'
import type { ExpenseId, SessionId, UserId } from './ids'

/** Funzione facoltativa. Vendite meno spese è un riepilogo gestionale, non un utile contabile. */
export interface Expense {
  readonly id: ExpenseId
  readonly sessionId: SessionId
  readonly description: string
  readonly amountCents: Cents
  readonly recordedByUserId: UserId
  readonly recordedAt: Timestamp
}