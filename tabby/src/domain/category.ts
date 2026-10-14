import type { CategoryId, SessionId } from './ids'

export interface Category {
  readonly id: CategoryId
  readonly sessionId: SessionId
  readonly name: string
  readonly sortOrder: number
}