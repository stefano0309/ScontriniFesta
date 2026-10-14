import type { Cents, Timestamp } from './common'
import type { OrderId, PaymentId, PaymentMethodId, SessionId, ShiftId, UserId } from './ids'
import { canPay, orderTotalCents, type Order } from './order'

export type PaymentMethodKind = 'cash' | 'card' | 'other'

/** Configurabile per sessione. `kind` dice quali incassi contano come contante. */
export interface PaymentMethod {
  readonly id: PaymentMethodId
  readonly sessionId: SessionId
  readonly label: string
  readonly kind: PaymentMethodKind
  readonly enabled: boolean
  readonly sortOrder: number
}

/** L'incasso di un ordine. Non si modifica: le correzioni passano dal registro operazioni. */
export interface Payment {
  readonly id: PaymentId
  readonly orderId: OrderId
  readonly sessionId: SessionId
  readonly shiftId: ShiftId
  readonly methodId: PaymentMethodId
  readonly amountCents: Cents
  readonly receivedByUserId: UserId
  readonly recordedAt: Timestamp
}

export type PayOrderError = 'cancelled' | 'alreadyPaid' | 'empty' | 'methodNotAvailable'

export type PayOrderResult =
  | { readonly ok: true; readonly payment: Payment; readonly order: Order }
  | { readonly ok: false; readonly error: PayOrderError }

export interface PayOrderInput {
  readonly order: Order
  readonly method: PaymentMethod
  readonly shiftId: ShiftId
  readonly userId: UserId
  /** Generato sul dispositivo prima del tentativo, per riconoscere i ritentativi. */
  readonly paymentId: PaymentId
  readonly now: Timestamp
}

/** Regola chiave: un ordine si paga una sola volta. Restituisce sempre un risultato esplicito. */
export function payOrder(input: PayOrderInput): PayOrderResult {
  const { order, method } = input
  if (order.status === 'cancelled') return { ok: false, error: 'cancelled' }
  if (order.paymentStatus === 'paid') return { ok: false, error: 'alreadyPaid' }
  if (!canPay(order)) return { ok: false, error: 'empty' }
  if (!method.enabled || method.sessionId !== order.sessionId) {
    return { ok: false, error: 'methodNotAvailable' }
  }
  const payment: Payment = {
    id: input.paymentId,
    orderId: order.id,
    sessionId: order.sessionId,
    shiftId: input.shiftId,
    methodId: method.id,
    amountCents: orderTotalCents(order),
    receivedByUserId: input.userId,
    recordedAt: input.now,
  }
  return { ok: true, payment, order: { ...order, paymentStatus: 'paid' } }
}