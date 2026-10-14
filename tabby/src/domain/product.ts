import type { Cents } from './common'
import type { CategoryId, ProductId, SessionId } from './ids'

export interface Product {
  readonly id: ProductId
  readonly sessionId: SessionId
  readonly categoryId: CategoryId
  readonly name: string
  readonly priceCents: Cents
  /** Scorta iniziale. null = senza limite. */
  readonly initialStock: number | null
  readonly lowStockThreshold?: number
  /** "Esaurito" segnato a mano, indipendente dalla scorta. */
  readonly manuallySoldOut: boolean
  /** Disattivato = non compare più nel menu, ma resta negli ordini passati. */
  readonly active: boolean
  readonly sortOrder: number
}