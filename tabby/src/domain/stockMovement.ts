import type { Timestamp } from './common'
import type { OrderId, ProductId, SessionId, StockMovementId, UserId } from './ids'
import type { Product } from './product'

export type StockMovementKind = 'sale' | 'adjustment' | 'soldOut'

/**
 * La scorta residua si calcola dai movimenti, non si sovrascrive:
 * si può ricostruire cosa è successo.
 * - sale: delta negativo, collegato a un ordine
 * - adjustment: correzione manuale (+/-), con motivazione
 * - soldOut: traccia il cambio "esaurito", delta 0
 */
export interface StockMovement {
  readonly id: StockMovementId
  readonly sessionId: SessionId
  readonly productId: ProductId
  readonly kind: StockMovementKind
  readonly delta: number
  readonly orderId?: OrderId
  readonly reason?: string
  readonly userId: UserId
  readonly at: Timestamp
}

export type Availability = 'available' | 'low' | 'soldOut'

export function remainingStock(
  product: Pick<Product, 'id' | 'initialStock'>,
  movements: readonly StockMovement[],
): number | null {
  if (product.initialStock === null) return null
  const delta = movements
    .filter((m) => m.productId === product.id)
    .reduce((sum, m) => sum + m.delta, 0)
  return product.initialStock + delta
}

export function availability(
  product: Pick<Product, 'id' | 'initialStock' | 'manuallySoldOut' | 'lowStockThreshold'>,
  movements: readonly StockMovement[],
): Availability {
  if (product.manuallySoldOut) return 'soldOut'
  const remaining = remainingStock(product, movements)
  if (remaining === null) return 'available'
  if (remaining <= 0) return 'soldOut'
  if (product.lowStockThreshold !== undefined && remaining <= product.lowStockThreshold) return 'low'
  return 'available'
}