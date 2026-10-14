import { sumCents, type Cents, type Timestamp } from './common'
import type { DeviceId, OrderId, OrderLineId, ProductId, SessionId, UserId } from './ids'

/** Stato di preparazione (cucina). */
export type OrderStatus = 'new' | 'preparing' | 'ready' | 'cancelled'

/** Stato di incasso. Separato da OrderStatus: un ordine può essere "pronto" e "da pagare". */
export type PaymentStatus = 'unpaid' | 'paid'

/**
 * Nome e prezzo sono copiati dal prodotto al momento dell'ordine:
 * cambiare il prezzo dopo non altera gli ordini già fatti.
 */
export interface OrderLine {
  readonly id: OrderLineId
  readonly productId: ProductId
  readonly productName: string
  readonly unitPriceCents: Cents
  readonly quantity: number
}

export interface Order {
  readonly id: OrderId
  readonly sessionId: SessionId
  /** Codice leggibile, es. "A-101". */
  readonly code: string
  readonly lines: readonly OrderLine[]
  readonly note?: string
  readonly status: OrderStatus
  readonly paymentStatus: PaymentStatus
  readonly createdByUserId: UserId
  readonly deviceId: DeviceId
  readonly createdAt: Timestamp
  readonly cancelledAt?: Timestamp
}

export const lineTotalCents = (line: OrderLine): Cents => line.unitPriceCents * line.quantity

export const orderTotalCents = (order: Pick<Order, 'lines'>): Cents =>
  sumCents(order.lines.map(lineTotalCents))

export const canPay = (order: Pick<Order, 'status' | 'paymentStatus' | 'lines'>): boolean =>
  order.status !== 'cancelled' && order.paymentStatus === 'unpaid' && order.lines.length > 0

/** Prossimo stato in cucina, o null se non c'è un passaggio successivo. */
export function nextKitchenStatus(status: OrderStatus): OrderStatus | null {
  switch (status) {
    case 'new': return 'preparing'
    case 'preparing': return 'ready'
    default: return null
  }
}